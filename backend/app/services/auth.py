import secrets
from datetime import timedelta

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, select

from app.core.security import digest, dummy_hash, hasher, verify_password
from app.db.database import utcnow
from app.models import LoginAttempt, SessionToken, Setting, User
from app.services.common import audit, public_user


def limited(db, request, email):
    cutoff = utcnow() - timedelta(minutes=15)
    db.execute(delete(LoginAttempt).where(LoginAttempt.created_at < cutoff))
    ip = request.client.host if request.client else "local"
    keys = [(digest("ip:" + ip), 40), (digest("email:" + email), 8)]
    for key, limit in keys:
        count = db.scalar(select(func.count()).select_from(LoginAttempt).where(LoginAttempt.key == key))
        if count >= limit:
            return True
    for key, _ in keys:
        db.add(LoginAttempt(key=key))
    db.flush()
    return False


def rate_response():
    return JSONResponse(status_code=429, content={"error": {"code": "rate_limited", "message": "Çok fazla deneme. 15 dakika sonra tekrar deneyin."}}, headers={"Retry-After": "900"})


def login(db, data, request, response):
    email = str(data.email).lower()
    if limited(db, request, email):
        return rate_response()
    user = db.scalar(select(User).where(User.email == email))
    valid = verify_password(data.password, user.password_hash if user else dummy_hash)
    if not user or not valid or user.status != "active":
        # Return a response instead of raising, so failed attempts are committed.
        return JSONResponse(status_code=401, content={"error": {"code": "login_failed", "message": "E-posta veya parola hatalı ya da hesabınız henüz aktif değil."}})
    if hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hasher.hash(data.password)
    old_token = request.cookies.get("stockpilot_session")
    if old_token:
        db.execute(delete(SessionToken).where(SessionToken.token_hash == digest(old_token)))
    db.execute(delete(SessionToken).where(SessionToken.expires_at < utcnow()))
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    settings = request.app.state.settings
    session = SessionToken(user_id=user.id, token_hash=digest(token), csrf_token=csrf,
                           expires_at=utcnow() + timedelta(hours=settings.session_hours))
    db.add(session)
    response.set_cookie("stockpilot_session", token, httponly=True, secure=settings.environment == "production",
                        samesite="lax", max_age=settings.session_hours * 3600, path="/")
    audit(db, user, "login", "users", user.id)
    return {"user": public_user(user), "csrf_token": csrf}


def register(db, data, request):
    setting = db.get(Setting, "registration_enabled")
    if not setting or setting.value != "true":
        raise HTTPException(403, "Yeni hesap başvuruları yönetici tarafından kapatılmış.")
    if limited(db, request, str(data.email).lower()):
        return rate_response()
    user = User(name=data.name, email=str(data.email).lower(), password_hash=hasher.hash(data.password),
                role="employee", status="pending")
    db.add(user)
    db.flush()
    audit(db, user, "register", "users", user.id)
    return {"message": "Başvurunuz alındı. Yönetici onayından sonra giriş yapabilirsiniz."}


def update_user(db, target, data, actor):
    if target.id == actor.id and (data.status != "active" or data.role != "admin"):
        raise HTTPException(409, "Kendi yönetici hesabınızı devre dışı bırakamazsınız.")
    if target.role == "admin" and target.status == "active" and (data.role != "admin" or data.status != "active"):
        count = db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.status == "active"))
        if count <= 1:
            raise HTTPException(409, "En az bir aktif yönetici bulunmalı.")
    for key, value in data.model_dump().items():
        setattr(target, key, value)
    db.execute(delete(SessionToken).where(SessionToken.user_id == target.id))
    audit(db, actor, "permissions_updated", "users", target.id)
    return public_user(target)
