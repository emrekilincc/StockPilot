import io

from PIL import Image
from sqlalchemy import func, select

from app.models import Product, User
from app.services.analytics import csv_report
from scripts.seed import seed
from tests.conftest import create_order, create_product


def test_report_totals_status_and_date_filter(admin):
    product = create_product(admin, price=10001)
    order = create_order(admin, product["id"], 3)
    for status in ("Confirmed", "Processing", "Completed"):
        assert admin.post(f"/api/orders/{order['id']}/status", json={"status": status}).status_code == 200
    pending = create_order(admin, product["id"], 1)
    for kind in ("daily", "monthly", "products", "categories"):
        report = admin.get(f"/api/reports/sales?kind={kind}").json()["items"]
        assert sum(row["amount"] for row in report) == 30003
    assert admin.get("/api/reports/sales?start=2000-01-01&end=2000-01-31").json()["items"] == []
    assert admin.get("/api/reports/sales?start=2026-02-01&end=2026-01-01").status_code == 422
    assert admin.get("/api/dashboard/summary").json()["monthly_sales"] == 30003
    assert admin.get("/api/reports/export").headers["content-type"].startswith("text/csv")


def test_csv_formula_safety():
    assert "'=HYPERLINK" in csv_report([{"label": "=HYPERLINK(1)", "amount": 50}])


def test_seed_is_idempotent(env):
    with env["factory"].begin() as db:
        db.connection(execution_options={"sqlite_write": True})
        user = db.get(User, 1)
        assert seed(db, user) is True
        assert seed(db, user) is False
        assert db.scalar(select(func.count()).select_from(Product)) == 24


def test_image_upload_validation(admin):
    product = create_product(admin)
    assert admin.post(f"/api/products/{product['id']}/image", files={"file": ("bad.svg", b'<svg onload="alert(1)"/>', "image/svg+xml")}).status_code == 422
    content = io.BytesIO()
    Image.new("RGB", (10, 10), "blue").save(content, "PNG")
    response = admin.post(f"/api/products/{product['id']}/image", files={"file": ("photo.png", content.getvalue(), "image/png")})
    assert response.status_code == 200
    path = response.json()["image"]
    assert path.endswith(".webp") and admin.get(path).status_code == 200


def test_search_filter_and_pagination(admin):
    create_product(admin, "AA-001", stock=0)
    create_product(admin, "BB-002", stock=10)
    assert admin.get("/api/products?q=AA-").json()["total"] == 1
    assert admin.get("/api/products?stock_status=critical").json()["total"] == 1
    result = admin.get("/api/products?page=2&page_size=1").json()
    assert result["total"] == 2 and len(result["items"]) == 1
