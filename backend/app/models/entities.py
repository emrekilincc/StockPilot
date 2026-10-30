from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base, DemoMixin, utcnow


class Timestamp:
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class User(Timestamp, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin','employee')", name="role"),
                     CheckConstraint("status IN ('active','pending','disabled')", name="status"))
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="employee")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    manage_products: Mapped[bool] = mapped_column(Boolean, default=False)
    manage_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    manage_orders: Mapped[bool] = mapped_column(Boolean, default=True)


class SessionToken(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_token: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(index=True)
    user: Mapped[User] = relationship()


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)


class Category(DemoMixin, Timestamp, Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")


class Contact(Timestamp):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    email: Mapped[str] = mapped_column(String(254), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class Supplier(DemoMixin, Contact, Base):
    __tablename__ = "suppliers"


class Customer(DemoMixin, Contact, Base):
    __tablename__ = "customers"


class Product(DemoMixin, Timestamp, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("stock >= 0", name="nonnegative_stock"),
        CheckConstraint("sale_price >= 0 AND purchase_price >= 0", name="nonnegative_prices"),
        CheckConstraint("critical_stock >= 0", name="critical_stock"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), index=True)
    sale_price: Mapped[int] = mapped_column(Integer)
    purchase_price: Mapped[int] = mapped_column(Integer)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    critical_stock: Mapped[int] = mapped_column(Integer, default=10)
    image: Mapped[str | None] = mapped_column(String(200))
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    category: Mapped[Category] = relationship(lazy="joined")
    supplier: Mapped[Supplier | None] = relationship(lazy="joined")


class Order(DemoMixin, Timestamp, Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("status IN ('Pending','Confirmed','Processing','Completed','Cancelled')", name="status"),
        CheckConstraint("total >= 0", name="nonnegative_total"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(40), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="Pending", index=True)
    total: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(Text, default="")
    stock_deducted: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(index=True)
    customer: Mapped[Customer] = relationship(lazy="joined")
    items: Mapped[list["OrderItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    events: Mapped[list["OrderEvent"]] = relationship(cascade="all, delete-orphan", order_by="OrderEvent.id", lazy="selectin")


class OrderItem(DemoMixin, Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity > 0 AND unit_price >= 0", name="positive_values"),
                     Index("uq_order_product", "order_id", "product_id", unique=True))
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    product_name: Mapped[str] = mapped_column(String(160))
    sku: Mapped[str] = mapped_column(String(60))
    category_name: Mapped[str] = mapped_column(String(100))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(Integer)


class OrderEvent(DemoMixin, Base):
    __tablename__ = "order_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    user: Mapped[User] = relationship(lazy="joined")


class StockMovement(DemoMixin, Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("kind IN ('in','out','adjustment','order','return')", name="kind"),
        CheckConstraint("balance >= 0 AND delta != 0", name="valid_balance"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    delta: Mapped[int] = mapped_column(Integer)
    balance: Mapped[int] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    product: Mapped[Product] = relationship(lazy="joined")
    user: Mapped[User] = relationship(lazy="joined")


class AuditLog(DemoMixin, Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(80))
    entity: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
