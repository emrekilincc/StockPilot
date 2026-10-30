from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import delete

from app.core.security import hasher, verify_password
from app.dependencies.auth import CurrentUser, Db
from app.models import SessionToken
from app.schemas.inputs import LoginInput, PasswordInput, ProfileInput, RegisterInput
from app.services import auth
from app.services.common import audit, public_user

router = APIRouter(prefix="/api/auth", tags=["Kimlik doğrulama"])


@router.post("/login")
def login(data: LoginInput, request: Request, response: Response, db: Db):
    return auth.login(db, data, request, response)


@router.post("/register", status_code=201)
def register(data: RegisterInput, request: Request, db: Db):
    return auth.register(db, data, request)


@router.get("/me")
def me(request: Request, user: CurrentUser):
    return {"user": public_user(user), "csrf_token": request.state.session.csrf_token}


@router.post("/logout")
def logout(request: Request, response: Response, user: CurrentUser, db: Db):
    db.delete(request.state.session)
    response.delete_cookie("stockpilot_session", path="/")
    audit(db, user, "logout", "users", user.id)
    return {"message": "Oturum kapatıldı."}


@router.patch("/profile")
def profile(data: ProfileInput, user: CurrentUser, db: Db):
    user.name, user.email = data.name, str(data.email).lower()
    db.flush()
    audit(db, user, "profile_updated", "users", user.id)
    return public_user(user)


@router.post("/password")
def password(data: PasswordInput, response: Response, user: CurrentUser, db: Db):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Mevcut parola hatalı.")
    user.password_hash = hasher.hash(data.new_password)
    db.execute(delete(SessionToken).where(SessionToken.user_id == user.id))
    response.delete_cookie("stockpilot_session", path="/")
    audit(db, user, "password_changed", "users", user.id)
    return {"message": "Parolanız değişti. Tüm oturumlar kapatıldı."}
