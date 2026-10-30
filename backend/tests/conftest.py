import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.core.security import hasher
from app.db.database import Base, make_engine
from app.main import create_app
from app.models import Category, Customer, Setting, User

TEST_PASSWORD = "Test-only-Password-2026!"
ORIGIN = "http://localhost:5173"


@pytest.fixture(scope="session")
def password_hash():
    return hasher.hash(TEST_PASSWORD)


@pytest.fixture
def env(tmp_path, password_hash):
    config = Settings(environment="test", database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
                      upload_dir=tmp_path / "uploads", frontend_dir=tmp_path / "frontend")
    engine = make_engine(config.database_url)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory.begin() as db:
        db.add_all([
            User(id=1, name="Test Yönetici", email="admin@example.com", password_hash=password_hash, role="admin", status="active"),
            User(id=2, name="Test Çalışan", email="employee@example.com", password_hash=password_hash, role="employee", status="active"),
            Category(id=1, name="Elektronik"), Customer(id=1, name="Test Müşteri"),
            Setting(key="registration_enabled", value="true"),
        ])
    app = create_app(config, factory)
    yield {"app": app, "factory": factory, "engine": engine, "config": config}
    engine.dispose()


def logged_client(app, email="admin@example.com"):
    client = TestClient(app, headers={"Origin": ORIGIN})
    response = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return client


@pytest.fixture
def admin(env):
    with logged_client(env["app"]) as client:
        yield client


@pytest.fixture
def employee(env):
    with logged_client(env["app"], "employee@example.com") as client:
        yield client


def create_product(client, sku="TEST-001", stock=10, price=19999):
    response = client.post("/api/products", json={"sku": sku, "name": "Test Ürün", "category_id": 1,
        "sale_price": price, "purchase_price": 10000, "critical_stock": 3})
    assert response.status_code == 201, response.text
    product = response.json()
    if stock:
        response = client.post("/api/inventory", json={"product_id": product["id"], "kind": "in", "quantity": stock, "note": "Test açılış stoğu"})
        assert response.status_code == 201, response.text
    return product


def create_order(client, product_id, quantity=2):
    response = client.post("/api/orders", json={"customer_id": 1, "items": [{"product_id": product_id, "quantity": quantity}]})
    assert response.status_code == 201, response.text
    return response.json()
