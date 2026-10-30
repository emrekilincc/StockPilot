import io
import secrets
from typing import Annotated, Literal

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, or_, select

from app.dependencies.auth import CurrentUser, Db, ProductEditor, StockEditor
from app.models import Category, Product, StockMovement
from app.schemas.inputs import CategoryInput, ProductInput, StockInput
from app.services.catalog import manual_stock, save_product
from app.services.common import audit, get_or_404, movement_data, page_result, product_data

router = APIRouter(prefix="/api", tags=["Ürün ve stok"])
Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


@router.get("/categories")
def categories(db: Db, user: CurrentUser):
    rows = db.execute(select(Category, func.count(Product.id)).outerjoin(Product, (Product.category_id == Category.id) & Product.archived.is_(False)).group_by(Category.id).order_by(Category.name))
    return [{"id": c.id, "name": c.name, "description": c.description, "product_count": count} for c, count in rows]


@router.post("/categories", status_code=201)
def create_category(data: CategoryInput, db: Db, user: ProductEditor):
    category = Category(**data.model_dump())
    db.add(category)
    db.flush()
    audit(db, user, "create", "categories", category.id)
    return {"id": category.id, **data.model_dump()}


@router.patch("/categories/{category_id}")
def update_category(category_id: int, data: CategoryInput, db: Db, user: ProductEditor):
    category = get_or_404(db, Category, category_id)
    category.name, category.description = data.name, data.description
    audit(db, user, "update", "categories", category.id)
    return {"id": category.id, **data.model_dump()}


@router.get("/products")
def products(db: Db, user: CurrentUser, page: Page = 1, page_size: Size = 20,
             q: str = Query(default="", max_length=160), category_id: int | None = None,
             supplier_id: int | None = None, stock_status: Literal["all", "critical", "available", "empty"] = "all",
             sort: Literal["newest", "name", "price_asc", "price_desc"] = "newest", archived: bool = False):
    query = select(Product).where(Product.archived == archived)
    if q:
        query = query.where(or_(Product.name.icontains(q, autoescape=True), Product.sku.icontains(q, autoescape=True)))
    if category_id:
        query = query.where(Product.category_id == category_id)
    if supplier_id:
        query = query.where(Product.supplier_id == supplier_id)
    if stock_status == "critical":
        query = query.where(Product.stock <= Product.critical_stock)
    elif stock_status == "available":
        query = query.where(Product.stock > Product.critical_stock)
    elif stock_status == "empty":
        query = query.where(Product.stock == 0)
    sorts = {"newest": Product.id.desc(), "name": Product.name, "price_asc": Product.sale_price, "price_desc": Product.sale_price.desc()}
    return page_result(db, query.order_by(sorts[sort], Product.id), page, page_size, product_data)


@router.post("/products", status_code=201)
def create_product(data: ProductInput, db: Db, user: ProductEditor):
    return product_data(save_product(db, data, user))


@router.get("/products/{product_id}")
def product(product_id: int, db: Db, user: CurrentUser):
    return product_data(get_or_404(db, Product, product_id))


@router.patch("/products/{product_id}")
def update_product(product_id: int, data: ProductInput, db: Db, user: ProductEditor):
    return product_data(save_product(db, data, user, get_or_404(db, Product, product_id)))


@router.post("/products/{product_id}/archive")
def archive_product(product_id: int, db: Db, user: ProductEditor, archived: bool = True):
    p = get_or_404(db, Product, product_id)
    p.archived = archived
    audit(db, user, "archive" if archived else "restore", "products", p.id)
    return product_data(p)


@router.post("/products/{product_id}/image")
def upload_image(product_id: int, request: Request, db: Db, user: ProductEditor, file: UploadFile = File(...)):
    p = get_or_404(db, Product, product_id)
    content = file.file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "Görsel en fazla 5 MB olabilir.")
    try:
        with Image.open(io.BytesIO(content)) as picture:
            if picture.format not in {"PNG", "JPEG", "WEBP"} or picture.width * picture.height > 20_000_000:
                raise ValueError()
            picture.load()
            picture.thumbnail((1200, 1200))
            # Re-encode to discard metadata and embedded content; never trust names or MIME types.
            name = secrets.token_hex(20) + ".webp"
            picture.convert("RGB").save(request.app.state.settings.upload_dir / name, "WEBP", quality=85)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, "Geçerli bir PNG, JPEG veya WebP görseli seçin.")
    p.image = "/uploads/" + name
    audit(db, user, "image_uploaded", "products", p.id)
    return product_data(p)


@router.get("/inventory")
def inventory(db: Db, user: CurrentUser, page: Page = 1, page_size: Size = 20,
              product_id: int | None = None, kind: Literal["in", "out", "adjustment", "order", "return"] | None = None):
    query = select(StockMovement)
    if product_id:
        query = query.where(StockMovement.product_id == product_id)
    if kind:
        query = query.where(StockMovement.kind == kind)
    return page_result(db, query.order_by(StockMovement.id.desc()), page, page_size, movement_data)


@router.post("/inventory", status_code=201)
def change_stock(data: StockInput, db: Db, user: StockEditor):
    return movement_data(manual_stock(db, data, user))
