from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.config import Settings
from app.main import create_app
from app.models import StockMovement
from tests.conftest import ORIGIN, TEST_PASSWORD, create_order, create_product, logged_client


def test_same_name_products_remain_separate_in_sales_report(admin):
    first, second = create_product(admin, "SKU-ONE"), create_product(admin, "SKU-TWO")
    for product in (first, second):
        order = create_order(admin, product["id"])
        for status in ("Confirmed", "Processing", "Completed"):
            assert admin.post(f"/api/orders/{order['id']}/status", json={"status": status}).status_code == 200
    rows = admin.get("/api/reports/sales?kind=products").json()["items"]
    assert len(rows) == 2
    assert rows[0]["label"].startswith("SKU-ONE")
    assert rows[1]["label"].startswith("SKU-TWO")


def test_pending_cancel_does_not_return_stock(admin):
    product = create_product(admin)
    order = create_order(admin, product["id"])
    assert admin.post(f"/api/orders/{order['id']}/cancel").status_code == 200
    assert admin.get(f"/api/products/{product['id']}").json()["stock"] == 10
    assert len(admin.get("/api/inventory").json()["items"]) == 1


def test_concurrent_cancel_returns_stock_once(env, admin):
    product = create_product(admin)
    order = create_order(admin, product["id"], 4)
    assert admin.post(f"/api/orders/{order['id']}/confirm").status_code == 200
    barrier = Barrier(2)
    def cancel(_):
        with TestClient(env["app"], headers={"Origin": ORIGIN, "X-CSRF-Token": admin.headers["X-CSRF-Token"]}) as client:
            client.cookies.set("stockpilot_session", admin.cookies.get("stockpilot_session"))
            barrier.wait(timeout=5)
            return client.post(f"/api/orders/{order['id']}/cancel").status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert list(executor.map(cancel, range(2))) == [200, 200]
    assert admin.get(f"/api/products/{product['id']}").json()["stock"] == 10
    with env["factory"]() as db:
        assert db.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.kind == "return")) == 1


def test_secure_cookie_in_production(env):
    config = Settings(environment="production", allowed_origins=["https://stockpilot.example"],
                      database_url=env["config"].database_url, upload_dir=env["config"].upload_dir)
    app = create_app(config, env["factory"])
    with TestClient(app, base_url="https://stockpilot.example", headers={"Origin": "https://stockpilot.example"}) as client:
        response = client.post("/api/auth/login", json={"email": "admin@example.com", "password": TEST_PASSWORD})
        assert response.status_code == 200
        assert "secure" in response.headers["set-cookie"].lower()
        assert "strict-transport-security" in response.headers


def test_registration_can_be_closed(admin, env):
    assert admin.patch("/api/settings", json={"company_name": "Test İşletme", "registration_enabled": False}).status_code == 200
    with TestClient(env["app"], headers={"Origin": ORIGIN}) as client:
        assert client.post("/api/auth/register", json={"name": "Yeni Kullanıcı", "email": "new@example.com", "password": TEST_PASSWORD}).status_code == 403


def test_employee_stock_permission_is_enforced(env, admin):
    product = create_product(admin)
    assert admin.patch("/api/users/2", json={"role": "employee", "status": "active", "manage_products": False, "manage_stock": False, "manage_orders": True}).status_code == 200
    with logged_client(env["app"], "employee@example.com") as employee:
        assert employee.post("/api/inventory", json={"product_id": product["id"], "kind": "in", "quantity": 1, "note": "İzin testi"}).status_code == 403


def test_order_snapshots_survive_product_changes_and_archive(admin):
    product = create_product(admin, price=12345)
    order = create_order(admin, product["id"])
    body = {key: product[key] for key in ("sku", "name", "category_id", "supplier_id", "sale_price", "purchase_price", "critical_stock", "description")}
    body.update(name="Yeni Ürün Adı", sale_price=99999)
    assert admin.patch(f"/api/products/{product['id']}", json=body).status_code == 200
    assert admin.post(f"/api/orders/{order['id']}/confirm").status_code == 200
    assert admin.post(f"/api/products/{product['id']}/archive").status_code == 200
    snapshot = admin.get(f"/api/orders/{order['id']}").json()
    assert snapshot["total"] == 24690 and snapshot["items"][0]["product_name"] == "Test Ürün"
    # Cancellation remains possible even after the product has been archived.
    assert admin.post(f"/api/orders/{order['id']}/cancel").status_code == 200


def test_integer_money_and_page_limits(admin):
    body = {"sku": "NO-FLOAT", "name": "Fiyat testi", "category_id": 1, "sale_price": 0.1, "purchase_price": 0}
    assert admin.post("/api/products", json=body).status_code == 422
    assert admin.get("/api/products?page_size=100000").status_code == 422


def test_demo_mode_scopes_business_records(env):
    with logged_client(env["app"]) as real, logged_client(env["app"]) as demo:
        demo.headers["X-Demo-Mode"] = "true"
        demo_category = demo.post("/api/categories", json={"name": "Demo kategori"}).json()
        real_category = real.post("/api/categories", json={"name": "Gerçek kategori"}).json()
        for client, sku, category_id in ((demo, "DEMO-SCOPE", demo_category["id"]), (real, "REAL-SCOPE", real_category["id"])):
            response = client.post("/api/products", json={"sku": sku, "name": sku, "category_id": category_id,
                "sale_price": 1000, "purchase_price": 500, "critical_stock": 3})
            assert response.status_code == 201, response.text
        assert demo.get("/api/products").json()["total"] == 1
        assert real.get("/api/products").json()["total"] == 1
