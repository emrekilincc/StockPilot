from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Order, Product, StockMovement
from tests.conftest import ORIGIN, create_order, create_product


def stock(client, product):
    return client.get(f"/api/products/{product['id']}").json()["stock"]


def test_product_create_update_unique_and_archive(admin, employee):
    product = create_product(admin)
    body = {key: product[key] for key in ("sku", "name", "category_id", "supplier_id", "sale_price", "purchase_price", "critical_stock", "description")}
    assert admin.post("/api/products", json=body).status_code == 409
    body["name"] = "Güncellenmiş Ürün"
    assert admin.patch(f"/api/products/{product['id']}", json=body).json()["name"] == body["name"]
    assert employee.patch(f"/api/products/{product['id']}", json=body).status_code == 403
    assert admin.post(f"/api/products/{product['id']}/archive").json()["archived"] is True
    assert admin.get("/api/products").json()["total"] == 0
    assert admin.get("/api/products?archived=true").json()["total"] == 1


def test_stock_moves_negative_and_adjustment(admin, employee):
    product = create_product(admin)
    def move(kind, quantity):
        return employee.post("/api/inventory", json={"product_id": product["id"], "kind": kind, "quantity": quantity, "note": "Test hareketi"})
    assert move("out", 11).status_code == 409
    assert stock(admin, product) == 10
    assert move("out", 3).status_code == 201
    assert stock(admin, product) == 7
    assert move("adjustment", 4).status_code == 201
    assert stock(admin, product) == 4
    assert move("in", 2).status_code == 201
    assert move("in", 0).status_code == 422
    assert stock(admin, product) == 6


def test_order_pricing_confirmation_cancel_idempotent(admin):
    product = create_product(admin, price=12345)
    order = create_order(admin, product["id"], 3)
    assert order["total"] == 37035
    for _ in range(2):
        assert admin.post(f"/api/orders/{order['id']}/confirm").status_code == 200
    assert stock(admin, product) == 7
    for _ in range(2):
        assert admin.post(f"/api/orders/{order['id']}/cancel").status_code == 200
    assert stock(admin, product) == 10
    assert admin.post(f"/api/orders/{order['id']}/confirm").status_code == 409
    movements = admin.get(f"/api/inventory?product_id={product['id']}").json()["items"]
    assert len([m for m in movements if m["kind"] == "return"]) == 1


def test_pending_edit_and_completed_terminal(admin):
    product = create_product(admin)
    order = create_order(admin, product["id"])
    body = {"customer_id": 1, "items": [{"product_id": product["id"], "quantity": 4}]}
    assert admin.patch(f"/api/orders/{order['id']}", json=body).json()["total"] == 4 * product["sale_price"]
    for status in ("Confirmed", "Processing", "Completed"):
        assert admin.post(f"/api/orders/{order['id']}/status", json={"status": status}).status_code == 200
    assert admin.patch(f"/api/orders/{order['id']}", json=body).status_code == 409
    assert admin.post(f"/api/orders/{order['id']}/cancel").status_code == 409


def test_multi_line_insufficient_stock_rolls_back(admin, env):
    first, second = create_product(admin, "A1", 10), create_product(admin, "A2", 1)
    response = admin.post("/api/orders", json={"customer_id": 1, "items": [{"product_id": p["id"], "quantity": 2} for p in (first, second)]})
    order_id = response.json()["id"]
    assert admin.post(f"/api/orders/{order_id}/confirm").status_code == 409
    assert stock(admin, first) == 10 and stock(admin, second) == 1
    with env["factory"]() as db:
        assert db.get(Order, order_id).status == "Pending"
        assert db.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.order_id == order_id)) == 0


def test_record_level_authorization(admin, employee):
    product = create_product(admin)
    admin_order = create_order(admin, product["id"])
    assert employee.get(f"/api/orders/{admin_order['id']}").status_code == 403
    assert employee.post(f"/api/orders/{admin_order['id']}/confirm").status_code == 403
    assert employee.get("/api/orders").json()["total"] == 0
    own_order = create_order(employee, product["id"])
    assert employee.post(f"/api/orders/{own_order['id']}/confirm").status_code == 200


@pytest.mark.parametrize("same_order", [True, False])
def test_concurrent_confirmations(env, admin, same_order):
    product = create_product(admin, stock=5)
    first = create_order(admin, product["id"], 4)
    second = first if same_order else create_order(admin, product["id"], 4)
    barrier = Barrier(2)
    def confirm(order_id):
        with TestClient(env["app"], headers={"Origin": ORIGIN, "X-CSRF-Token": admin.headers["X-CSRF-Token"]}) as client:
            client.cookies.set("stockpilot_session", admin.cookies.get("stockpilot_session"))
            barrier.wait(timeout=5)
            return client.post(f"/api/orders/{order_id}/confirm").status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(confirm, [first["id"], second["id"]]))
    assert sorted(results) == ([200, 200] if same_order else [200, 409])
    assert stock(admin, product) == 1


def test_database_constraints(env, admin):
    product = create_product(admin)
    with env["engine"].connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
        assert connection.exec_driver_sql("PRAGMA journal_mode").scalar() == "wal"
    with pytest.raises(IntegrityError), env["factory"].begin() as db:
        db.execute(text("UPDATE products SET stock = -1 WHERE id = :id"), {"id": product["id"]})
    with pytest.raises(IntegrityError), env["factory"].begin() as db:
        db.execute(text("UPDATE products SET category_id = 999999 WHERE id = :id"), {"id": product["id"]})


def test_no_client_price_or_role_injection(admin):
    product = create_product(admin)
    assert admin.post("/api/orders", json={"customer_id": 1, "total": 1, "items": [{"product_id": product["id"], "quantity": 2}]}).status_code == 422
    assert admin.post("/api/auth/register", json={"name": "Fake Admin", "email": "evil@example.com", "password": "LongEnoughPassword", "role": "admin"}).status_code == 422
