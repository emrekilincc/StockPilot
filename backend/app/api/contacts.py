from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select

from app.api.catalog import Page, Size
from app.dependencies.auth import CurrentUser, Db
from app.models import Customer, Supplier
from app.schemas.inputs import ContactInput
from app.services.common import audit, contact_data, get_or_404, page_result

router = APIRouter(prefix="/api", tags=["Müşteri ve tedarikçiler"])


def contact_router(kind, model, permission):
    section = APIRouter(prefix=f"/{kind}")

    def check(user):
        if user.role != "admin" and not getattr(user, permission):
            raise HTTPException(403, "Bu işlem için yetkiniz bulunmuyor.")

    @section.get("", name=f"list_{kind}")
    def listing(db: Db, user: CurrentUser, page: Page = 1, page_size: Size = 20,
                q: str = Query(default="", max_length=120), active: bool | None = None):
        query = select(model)
        if q:
            query = query.where(or_(model.name.icontains(q, autoescape=True), model.email.icontains(q, autoescape=True), model.phone.contains(q, autoescape=True)))
        if active is not None:
            query = query.where(model.active == active)
        return page_result(db, query.order_by(model.name), page, page_size, contact_data)

    @section.get("/{record_id}", name=f"get_{kind}")
    def detail(record_id: int, db: Db, user: CurrentUser):
        return contact_data(get_or_404(db, model, record_id))

    @section.post("", status_code=201, name=f"create_{kind}")
    def create(data: ContactInput, db: Db, user: CurrentUser):
        check(user)
        row = model(**data.model_dump())
        db.add(row)
        db.flush()
        audit(db, user, "create", kind, row.id)
        return contact_data(row)

    @section.patch("/{record_id}", name=f"update_{kind}")
    def update(record_id: int, data: ContactInput, db: Db, user: CurrentUser):
        check(user)
        row = get_or_404(db, model, record_id)
        for key, value in data.model_dump().items():
            setattr(row, key, value)
        audit(db, user, "update", kind, row.id)
        return contact_data(row)

    return section


router.include_router(contact_router("customers", Customer, "manage_orders"))
router.include_router(contact_router("suppliers", Supplier, "manage_products"))
