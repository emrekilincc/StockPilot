import secrets

from fastapi import HTTPException

from app.db.database import utcnow
from app.models import Customer, Order, OrderEvent, OrderItem, Product
from app.services.catalog import move_stock
from app.services.common import audit, get_or_404


def authorize_order(order, user):
    if user.role != "admin" and order.created_by != user.id:
        raise HTTPException(403, "Yalnızca kendi oluşturduğunuz siparişleri yönetebilirsiniz.")


def save_order(db, data, user, order=None):
    if order:
        authorize_order(order, user)
        if order.status != "Pending":
            raise HTTPException(409, "Yalnızca bekleyen siparişler düzenlenebilir.")
    customer = get_or_404(db, Customer, data.customer_id)
    if not customer.active:
        raise HTTPException(409, "Aktif bir müşteri seçin.")
    ids = [line.product_id for line in data.items]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Bir ürünü yalnızca bir satırda ekleyin.")
    items = []
    for line in data.items:
        product = get_or_404(db, Product, line.product_id)
        if product.archived:
            raise HTTPException(409, f"{product.name} arşivlenmiş.")
        items.append(OrderItem(product_id=product.id, product_name=product.name, sku=product.sku,
                               category_name=product.category.name, quantity=line.quantity, unit_price=product.sale_price))
    created = order is None
    if created:
        order = Order(number=f"SP-{utcnow():%y%m}-{secrets.token_hex(4).upper()}",
                      created_by=user.id, customer_id=customer.id, total=0, status="Pending")
        db.add(order)
    else:
        order.items.clear()
        db.flush()  # Delete existing unique order/product pairs before replacements.
    order.customer_id = customer.id
    order.customer = customer
    order.notes = data.notes
    order.items = items
    order.total = sum(item.quantity * item.unit_price for item in items)
    if order.total > 100_000_000_000:
        raise HTTPException(422, "Sipariş tutarı 1 milyar TL üst sınırını aşamaz.")
    order.events.append(OrderEvent(user_id=user.id, status="Pending", note="Sipariş oluşturuldu." if created else "Sipariş güncellendi."))
    db.flush()
    audit(db, user, "create" if created else "update", "orders", order.id)
    return order


TRANSITIONS = {
    "Pending": {"Confirmed", "Cancelled"}, "Confirmed": {"Processing", "Cancelled"},
    "Processing": {"Completed", "Cancelled"}, "Completed": set(), "Cancelled": set(),
}


def transition(db, order, status, user):
    authorize_order(order, user)
    if order.status == status:
        return order
    if status not in TRANSITIONS[order.status]:
        raise HTTPException(409, "Bu sipariş durumu geçişine izin verilmiyor.")
    if status == "Confirmed":
        # Validate ALL lines before changing any balance. The request owns the writer lock.
        products = {item.product_id: get_or_404(db, Product, item.product_id) for item in order.items}
        for item in order.items:
            p = products[item.product_id]
            if p.archived or p.stock < item.quantity:
                raise HTTPException(409, f"{p.name}: ürün arşivlenmiş veya stok yetersiz.")
        for item in order.items:
            move_stock(db, products[item.product_id], -item.quantity, "order", user, f"{order.number} onaylandı.", order.id)
        order.stock_deducted = True
    if status == "Cancelled" and order.stock_deducted:
        for item in order.items:
            product = get_or_404(db, Product, item.product_id)
            move_stock(db, product, item.quantity, "return", user, f"{order.number} iptal edildi.", order.id)
        order.stock_deducted = False
    if status == "Completed":
        order.completed_at = utcnow()
    order.status = status
    order.events.append(OrderEvent(user_id=user.id, status=status, note="Sipariş durumu değiştirildi."))
    audit(db, user, status, "orders", order.id)
    db.flush()
    return order
