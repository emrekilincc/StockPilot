import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import digest
from app.db.database import utcnow
from app.models import SessionToken, User


def get_db(request: Request):
    with request.app.state.session_factory() as db:
        try:
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                db.connection(execution_options={"sqlite_write": True})
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise


Db = Annotated[Session, Depends(get_db, scope="function")]


def current_user(request: Request, db: Db):
    token = request.cookies.get("stockpilot_session", "")
    session = db.scalar(select(SessionToken).where(SessionToken.token_hash == digest(token))) if token else None
    if not session or session.expires_at <= utcnow() or session.user.status != "active":
        raise HTTPException(401, "Oturumunuz sona erdi. Lütfen giriş yapın.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        csrf = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(session.csrf_token, csrf):
            raise HTTPException(403, "Güvenlik doğrulaması başarısız. Sayfayı yenileyin.")
    request.state.session = session
    return session.user


CurrentUser = Annotated[User, Depends(current_user)]


def require_admin(user: CurrentUser):
    if user.role != "admin":
        raise HTTPException(403, "Bu işlem için yönetici yetkisi gerekiyor.")
    return user


Admin = Annotated[User, Depends(require_admin)]


def permission(name):
    def check(user: CurrentUser):
        if user.role != "admin" and not getattr(user, f"manage_{name}"):
            raise HTTPException(403, "Bu işlem için yetkiniz bulunmuyor.")
        return user
    return check


ProductEditor = Annotated[User, Depends(permission("products"))]
StockEditor = Annotated[User, Depends(permission("stock"))]
OrderEditor = Annotated[User, Depends(permission("orders"))]
