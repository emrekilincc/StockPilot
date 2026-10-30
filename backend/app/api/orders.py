from datetime import date
from typing import Literal

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.api.catalog import Page, Size
from app.dependencies.auth import CurrentUser, Db, OrderEditor
from app.models import Customer, Order
from app.schemas.inputs import OrderInput, StatusInput
from app.services.analytics import between
from app.services.common import get_or_404, order_data, page_result
from app.services.orders import authorize_order, save_order, transition

router = APIRouter(prefix="/api/orders", tags=["Siparişler"])


@router.get("")
def orders(db: Db, user: CurrentUser, page: Page = 1, page_size: Size = 20,
           q: str = Query(default="", max_length=160), status: Literal["Pending", "Confirmed", "Processing", "Completed", "Cancelled"] | None = None,
           start: date | None = None, end: date | None = None, customer_id: int | None = None):
    query = select(Order).join(Customer, Order.customer_id == Customer.id)
    if user.role != "admin":
        query = query.where(Order.created_by == user.id)
    if q:
        query = query.where(or_(Order.number.icontains(q, autoescape=True), Customer.name.icontains(q, autoescape=True)))
    if status:
        query = query.where(Order.status == status)
    if customer_id:
        query = query.where(Order.customer_id == customer_id)
    query = between(query, Order.created_at, start, end)
    return page_result(db, query.order_by(Order.id.desc()), page, page_size, order_data)


@router.post("", status_code=201)
def create_order(data: OrderInput, db: Db, user: OrderEditor):
    return order_data(save_order(db, data, user), True)


@router.get("/{order_id}")
def order(order_id: int, db: Db, user: CurrentUser):
    result = get_or_404(db, Order, order_id)
    authorize_order(result, user)
    return order_data(result, True)


@router.patch("/{order_id}")
def update_order(order_id: int, data: OrderInput, db: Db, user: OrderEditor):
    return order_data(save_order(db, data, user, get_or_404(db, Order, order_id)), True)


@router.post("/{order_id}/status")
def change_status(order_id: int, data: StatusInput, db: Db, user: OrderEditor):
    return order_data(transition(db, get_or_404(db, Order, order_id), data.status, user), True)


@router.post("/{order_id}/confirm")
def confirm(order_id: int, db: Db, user: OrderEditor):
    return order_data(transition(db, get_or_404(db, Order, order_id), "Confirmed", user), True)


@router.post("/{order_id}/cancel")
def cancel(order_id: int, db: Db, user: OrderEditor):
    return order_data(transition(db, get_or_404(db, Order, order_id), "Cancelled", user), True)
