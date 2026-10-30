import csv
import io
from datetime import date, datetime, time, timedelta

from fastapi import HTTPException
from sqlalchemy import case, func, select

from app.db.database import utcnow
from app.models import Category, Order, OrderItem, Product, StockMovement
from app.services.common import movement_data, order_data, product_data


def date_bounds(start, end):
    if start and end and start > end:
        raise HTTPException(422, "Başlangıç tarihi bitiş tarihinden sonra olamaz.")
    return (datetime.combine(start, time.min) if start else None,
            datetime.combine(end + timedelta(days=1), time.min) if end else None)


def between(query, column, start, end):
    low, high = date_bounds(start, end)
    if low:
        query = query.where(column >= low)
    if high:
        query = query.where(column < high)
    return query


def report(db, kind, start=None, end=None):
    date_bounds(start, end)
    if kind in {"daily", "monthly", "products", "categories"}:
        if kind in {"daily", "monthly"}:
            group = func.strftime("%Y-%m-%d" if kind == "daily" else "%Y-%m", Order.completed_at)
            q = select(group.label("label"), func.count(Order.id).label("count"), func.sum(Order.total).label("amount")).where(Order.status == "Completed")
        else:
            group = (OrderItem.sku + " · " + OrderItem.product_name) if kind == "products" else OrderItem.category_name
            q = select(group.label("label"), func.sum(OrderItem.quantity).label("count"), func.sum(OrderItem.quantity * OrderItem.unit_price).label("amount")).join(Order, Order.id == OrderItem.order_id).where(Order.status == "Completed")
        q = between(q, Order.completed_at, start, end).group_by(group).order_by(group)
        return [dict(row) for row in db.execute(q).mappings()]
    if kind == "stock":
        q = select(StockMovement.kind.label("label"), func.count().label("count"), func.sum(StockMovement.delta).label("quantity"))
        q = between(q, StockMovement.created_at, start, end).group_by(StockMovement.kind)
        return [dict(row) for row in db.execute(q).mappings()]
    if kind == "critical":
        # Current balance snapshot; dates select products by their creation date.
        q = select(Product.name.label("label"), Product.stock.label("quantity"), Product.critical_stock.label("threshold"))
        q = between(q.where(Product.archived.is_(False), Product.stock <= Product.critical_stock), Product.created_at, start, end)
        return [dict(row) for row in db.execute(q).mappings()]
    if kind == "orders":
        q = select(Order.status.label("label"), func.count().label("count"), func.sum(Order.total).label("amount"))
        q = between(q, Order.created_at, start, end).group_by(Order.status)
        return [dict(row) for row in db.execute(q).mappings()]
    raise HTTPException(422, "Geçersiz rapor türü.")


def csv_report(rows):
    output = io.StringIO(newline="")
    labels = {"label": "Kayıt", "count": "Adet", "amount": "Tutar (kuruş)", "quantity": "Stok miktarı", "threshold": "Kritik seviye"}
    keys = list(rows[0]) if rows else ["label", "count", "amount"]
    writer = csv.writer(output)
    writer.writerow([labels.get(k, k) for k in keys])
    for row in rows:
        # Prevent spreadsheet formula injection, including leading whitespace.
        values = []
        for key in keys:
            value = row[key]
            if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
                value = "'" + value
            values.append(value)
        writer.writerow(values)
    return "\ufeff" + output.getvalue()


def dashboard(db, user):
    now = utcnow()
    month_start = datetime(now.year, now.month, 1)
    own = [] if user.role == "admin" else [Order.created_by == user.id]
    product_count, stock_total, critical_count = db.execute(select(
        func.count(Product.id), func.coalesce(func.sum(Product.stock), 0),
        func.coalesce(func.sum(case((Product.stock <= Product.critical_stock, 1), else_=0)), 0)
    ).where(Product.archived.is_(False))).one()
    order_count, completed = db.execute(select(func.count(Order.id), func.coalesce(func.sum(case((Order.status == "Completed", 1), else_=0)), 0)).where(*own)).one()
    monthly_sales = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(*own, Order.status == "Completed", Order.completed_at >= month_start))
    monthly = select(func.strftime("%Y-%m", Order.completed_at).label("month"), func.sum(Order.total).label("amount")).where(*own, Order.status == "Completed").group_by("month").order_by("month")
    monthly_map = {row.month: row.amount for row in db.execute(monthly)}
    sales = []
    for back in range(5, -1, -1):
        absolute = now.year * 12 + now.month - 1 - back
        label = f"{absolute // 12:04d}-{absolute % 12 + 1:02d}"
        sales.append({"month": label, "amount": monthly_map.get(label, 0)})
    statuses = db.execute(select(Order.status.label("label"), func.count().label("count")).where(*own).group_by(Order.status)).mappings().all()
    categories = db.execute(select(Category.name.label("label"), func.count(Product.id).label("count")).join(Product, Category.id == Product.category_id).where(Product.archived.is_(False)).group_by(Category.id)).mappings().all()
    top = db.execute(select(OrderItem.product_name.label("name"), func.sum(OrderItem.quantity).label("quantity"), func.sum(OrderItem.quantity * OrderItem.unit_price).label("amount")).join(Order, Order.id == OrderItem.order_id).where(*own, Order.status == "Completed").group_by(OrderItem.product_id, OrderItem.product_name).order_by(func.sum(OrderItem.quantity).desc()).limit(5)).mappings().all()
    movement_summary = db.execute(select(StockMovement.kind.label("label"), func.sum(func.abs(StockMovement.delta)).label("count")).where(StockMovement.created_at >= month_start).group_by(StockMovement.kind)).mappings().all()
    return {"product_count": product_count, "stock_total": stock_total, "critical_count": critical_count,
            "order_count": order_count, "completed_count": completed, "monthly_sales": monthly_sales,
            "sales": sales, "statuses": [dict(r) for r in statuses], "categories": [dict(r) for r in categories],
            "top_products": [dict(r) for r in top], "movement_summary": [dict(r) for r in movement_summary],
            "recent_orders": [order_data(o) for o in db.scalars(select(Order).where(*own).order_by(Order.created_at.desc()).limit(5))],
            "recent_movements": [movement_data(m) for m in db.scalars(select(StockMovement).order_by(StockMovement.created_at.desc()).limit(5))],
            "critical_products": [product_data(p) for p in db.scalars(select(Product).where(Product.archived.is_(False), Product.stock <= Product.critical_stock).order_by(Product.stock).limit(5))]}
