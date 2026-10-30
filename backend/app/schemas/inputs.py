from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Name = Annotated[str, Field(min_length=2, max_length=120)]
Password = Annotated[str, Field(min_length=12, max_length=128)]
Money = Annotated[int, Field(strict=True, ge=0, le=100_000_000_00)]
Quantity = Annotated[int, Field(strict=True, ge=0, le=1_000_000)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RegisterInput(Input):
    name: Name
    email: EmailStr
    password: Password


class LoginInput(Input):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileInput(Input):
    name: Name
    email: EmailStr


class PasswordInput(Input):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password


class UserInput(Input):
    role: Literal["admin", "employee"]
    status: Literal["active", "pending", "disabled"]
    manage_products: bool
    manage_stock: bool
    manage_orders: bool


class CategoryInput(Input):
    name: Annotated[str, Field(min_length=2, max_length=100)]
    description: str = Field(default="", max_length=1000)


class ContactInput(Input):
    name: Name
    email: EmailStr | Literal[""] = ""
    phone: str = Field(default="", max_length=40)
    address: str = Field(default="", max_length=1000)
    active: bool = True


class ProductInput(Input):
    sku: str = Field(min_length=2, max_length=60, pattern=r"^[A-Za-z0-9_.-]+$")
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=5000)
    category_id: int = Field(gt=0)
    supplier_id: int | None = Field(default=None, gt=0)
    sale_price: Money
    purchase_price: Money
    critical_stock: Quantity = 10

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value):
        return value.upper()


class StockInput(Input):
    product_id: int = Field(gt=0)
    kind: Literal["in", "out", "adjustment"]
    quantity: Quantity
    note: str = Field(min_length=3, max_length=1000)


class OrderLineInput(Input):
    product_id: int = Field(gt=0)
    quantity: int = Field(strict=True, ge=1, le=10000)


class OrderInput(Input):
    customer_id: int = Field(gt=0)
    notes: str = Field(default="", max_length=2000)
    items: list[OrderLineInput] = Field(min_length=1, max_length=100)


class StatusInput(Input):
    status: Literal["Confirmed", "Processing", "Completed", "Cancelled"]


class SettingsInput(Input):
    company_name: Name
    registration_enabled: bool
