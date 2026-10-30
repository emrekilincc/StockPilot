from fastapi import HTTPException
from sqlalchemy import func, select

from app.models import AuditLog


def get_or_404(db, model, record_id):
    record = db.get(model, record_id)
    if record is None:
        raise HTTPException(404, "Kayıt bulunamadı.")
    return record


def audit(db, user, action, entity, entity_id=None):
    db.add(AuditLog(user_id=user.id if user else None, action=action, entity=entity, entity_id=entity_id))


def page_result(db, query, page, page_size, serialize):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    rows = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return {"items": [serialize(row) for row in rows], "total": total, "page": page, "page_size": page_size}


def public_user(user):
    return {key: getattr(user, key) for key in (
        "id", "name", "email", "role", "status", "manage_products", "manage_stock", "manage_orders", "created_at")}


def product_data(product):
    result = {key: getattr(product, key) for key in ("id", "sku", "name", "description", "category_id",
        "supplier_id", "sale_price", "purchase_price", "stock", "critical_stock", "image", "archived", "created_at", "updated_at")}
    return {**result, "category_name": product.category.name, "supplier_name": product.supplier.name if product.supplier else None}


def contact_data(contact):
    return {key: getattr(contact, key) for key in ("id", "name", "email", "phone", "address", "active", "created_at")}


def movement_data(m):
    return {"id": m.id, "product_id": m.product_id, "product_name": m.product.name, "sku": m.product.sku,
            "user_name": m.user.name, "kind": m.kind, "delta": m.delta, "balance": m.balance,
            "note": m.note, "order_id": m.order_id, "created_at": m.created_at}


def order_data(order, detail=False):
    result = {key: getattr(order, key) for key in ("id", "number", "customer_id", "created_by", "status", "total", "notes", "created_at", "updated_at", "completed_at")}
    result["customer_name"] = order.customer.name
    result["item_count"] = sum(item.quantity for item in order.items)
    if detail:
        result["items"] = [{key: getattr(item, key) for key in ("id", "product_id", "product_name", "sku", "category_name", "quantity", "unit_price")} for item in order.items]
        result["events"] = [{"id": e.id, "status": e.status, "note": e.note, "user_name": e.user.name, "created_at": e.created_at} for e in order.events]
    return result
