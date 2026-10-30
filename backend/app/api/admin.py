from datetime import date
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import Response
from sqlalchemy import select

from app.api.catalog import Page, Size
from app.dependencies.auth import Admin, CurrentUser, Db
from app.models import AuditLog, Setting, User
from app.schemas.inputs import SettingsInput, UserInput
from app.services.analytics import csv_report, dashboard, report
from app.services.auth import update_user
from app.services.common import audit, get_or_404, page_result, public_user

router = APIRouter(prefix="/api", tags=["Dashboard ve yönetim"])
ReportKind = Literal["daily", "monthly", "products", "categories", "stock", "critical", "orders"]


@router.get("/dashboard/summary")
def summary(db: Db, user: CurrentUser):
    return dashboard(db, user)


@router.get("/reports/sales")
def sales_report(db: Db, user: Admin, kind: ReportKind = "daily", start: date | None = None, end: date | None = None):
    return {"items": report(db, kind, start, end), "kind": kind}


@router.get("/reports/export")
def export_report(db: Db, user: Admin, kind: ReportKind = "daily", start: date | None = None, end: date | None = None):
    return Response(csv_report(report(db, kind, start, end)), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="stockpilot-{kind}.csv"'})


@router.get("/users")
def users(db: Db, user: Admin, page: Page = 1, page_size: Size = 20):
    return page_result(db, select(User).order_by(User.id), page, page_size, public_user)


@router.patch("/users/{user_id}")
def edit_user(user_id: int, data: UserInput, db: Db, user: Admin):
    return update_user(db, get_or_404(db, User, user_id), data, user)


@router.get("/settings")
def settings(db: Db, user: CurrentUser):
    values = {s.key: s.value for s in db.scalars(select(Setting))}
    return {"company_name": values.get("company_name", "StockPilot"), "registration_enabled": values.get("registration_enabled") == "true"}


@router.patch("/settings")
def edit_settings(data: SettingsInput, db: Db, user: Admin):
    for key, value in data.model_dump().items():
        value = str(value).lower() if isinstance(value, bool) else value
        row = db.get(Setting, key)
        if row:
            row.value = value
        else:
            db.add(Setting(key=key, value=value))
    audit(db, user, "update", "settings")
    return data.model_dump()


@router.get("/audit-logs")
def audit_logs(db: Db, user: Admin, page: Page = 1, page_size: Size = 20):
    return page_result(db, select(AuditLog).order_by(AuditLog.id.desc()), page, page_size,
                       lambda r: {k: getattr(r, k) for k in ("id", "user_id", "action", "entity", "entity_id", "created_at")})
