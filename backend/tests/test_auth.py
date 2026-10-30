from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import digest
from app.db.database import utcnow
from app.models import SessionToken, User
from tests.conftest import ORIGIN, TEST_PASSWORD


def test_login_cookie_and_hash_storage(env, admin):
    response = admin.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"
    assert "password_hash" not in response.text
    token = admin.cookies.get("stockpilot_session")
    with env["factory"]() as db:
        session = db.scalar(select(SessionToken))
        assert session.token_hash == digest(token)
        assert token != session.token_hash
    response = admin.post("/api/auth/login", json={"email": "admin@example.com", "password": TEST_PASSWORD})
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie


def test_wrong_password_and_unauthenticated(env):
    with TestClient(env["app"], headers={"Origin": ORIGIN}) as client:
        assert client.get("/api/products").status_code == 401
        assert client.post("/api/auth/login", json={"email": "admin@example.com", "password": "incorrect"}).status_code == 401


def test_rate_limit_persists_failures(env):
    with TestClient(env["app"], headers={"Origin": ORIGIN}) as client:
        for _ in range(8):
            assert client.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrong"}).status_code == 401
        assert client.post("/api/auth/login", json={"email": "admin@example.com", "password": TEST_PASSWORD}).status_code == 429


def test_csrf_origin_and_logout(admin):
    payload = {"name": "Kırtasiye"}
    assert admin.post("/api/categories", json=payload, headers={"X-CSRF-Token": "bad"}).status_code == 403
    assert admin.post("/api/categories", json=payload, headers={"Origin": "https://evil.example"}).status_code == 403
    assert admin.post("/api/auth/logout").status_code == 200
    assert admin.get("/api/auth/me").status_code == 401


def test_expired_session(env, admin):
    with env["factory"].begin() as db:
        session = db.scalar(select(SessionToken))
        session.expires_at = utcnow() - timedelta(seconds=1)
    assert admin.get("/api/auth/me").status_code == 401


def test_roles_and_permission_change(admin, employee):
    assert employee.get("/api/users").status_code == 403
    assert employee.get("/api/reports/sales").status_code == 403
    assert employee.patch("/api/settings", json={"company_name": "Test", "registration_enabled": True}).status_code == 403
    assert employee.post("/api/categories", json={"name": "Yeni kategori"}).status_code == 403
    assert admin.get("/api/users").status_code == 200
    response = admin.patch("/api/users/2", json={"role": "employee", "status": "disabled", "manage_products": False, "manage_stock": False, "manage_orders": False})
    assert response.status_code == 200
    assert employee.get("/api/auth/me").status_code == 401


def test_registration_pending_then_admin_activation(env, admin):
    with TestClient(env["app"], headers={"Origin": ORIGIN}) as client:
        data = {"name": "Yeni Çalışan", "email": "new@example.com", "password": TEST_PASSWORD}
        assert client.post("/api/auth/register", json=data).status_code == 201
        assert client.post("/api/auth/login", json={"email": data["email"], "password": TEST_PASSWORD}).status_code == 401
        with env["factory"]() as db:
            user = db.scalar(select(User).where(User.email == data["email"]))
            assert user.role == "employee" and user.status == "pending"
            user_id = user.id
        assert admin.patch(f"/api/users/{user_id}", json={"role": "employee", "status": "active", "manage_products": False, "manage_stock": True, "manage_orders": True}).status_code == 200
        assert client.post("/api/auth/login", json={"email": data["email"], "password": TEST_PASSWORD}).status_code == 200


def test_profile_password_and_session_revocation(admin):
    assert admin.patch("/api/auth/profile", json={"name": "Yeni Ad", "email": "admin@example.com"}).json()["name"] == "Yeni Ad"
    assert admin.post("/api/auth/password", json={"current_password": "bad", "new_password": "New-valid-Password!"}).status_code == 400
    assert admin.post("/api/auth/password", json={"current_password": TEST_PASSWORD, "new_password": "New-valid-Password!"}).status_code == 200
    assert admin.get("/api/auth/me").status_code == 401


def test_cannot_disable_self(admin):
    assert admin.patch("/api/users/1", json={"role": "employee", "status": "disabled", "manage_products": False, "manage_stock": True, "manage_orders": True}).status_code == 409
