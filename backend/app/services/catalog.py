from fastapi import HTTPException

from app.models import Category, Product, StockMovement, Supplier
from app.services.common import audit, get_or_404


def save_product(db, data, user, product=None):
    get_or_404(db, Category, data.category_id)
    if data.supplier_id:
        supplier = get_or_404(db, Supplier, data.supplier_id)
        if not supplier.active:
            raise HTTPException(409, "Pasif bir tedarikçiye ürün bağlanamaz.")
    if product and product.archived:
        raise HTTPException(409, "Önce ürünü arşivden çıkarın.")
    created = product is None
    if created:
        product = Product(**data.model_dump())
        db.add(product)
    else:
        for key, value in data.model_dump().items():
            setattr(product, key, value)
    db.flush()
    db.refresh(product)
    audit(db, user, "create" if created else "update", "products", product.id)
    return product


def move_stock(db, product, delta, kind, user, note, order_id=None):
    if delta == 0:
        raise HTTPException(422, "İşlem stok miktarını değiştirmeli.")
    if product.stock + delta < 0:
        raise HTTPException(409, f"{product.name}: yetersiz stok. Mevcut stok: {product.stock}.")
    if product.stock + delta > 1_000_000_000:
        raise HTTPException(422, "Stok üst sınırı aşıldı.")
    product.stock += delta
    movement = StockMovement(product_id=product.id, user_id=user.id, order_id=order_id,
                             kind=kind, delta=delta, balance=product.stock, note=note)
    db.add(movement)
    db.flush()
    audit(db, user, kind, "stock_movements", movement.id)
    return movement


def manual_stock(db, data, user):
    product = get_or_404(db, Product, data.product_id)
    if product.archived:
        raise HTTPException(409, "Arşivlenmiş ürünün stoğu değiştirilemez.")
    delta = data.quantity if data.kind == "in" else -data.quantity
    if data.kind == "adjustment":
        delta = data.quantity - product.stock
    return move_stock(db, product, delta, data.kind, user, data.note)
