"""Explicit, additive and transactional demo seed. No known password is created."""
from datetime import datetime, timedelta

from sqlalchemy import select

from app.db.database import SessionLocal, utcnow
from app.models import Category, Customer, Order, Product, Setting, Supplier, User
from app.schemas.inputs import OrderInput
from app.services.catalog import move_stock
from app.services.orders import save_order, transition

PRODUCTS = [
    ("Logitech MX Master 3S", "Elektronik", 429900, 315000),
    ("Keychron K2 Kablosuz Klavye", "Elektronik", 389900, 280000),
    ("Anker USB-C Hub 7-in-1", "Elektronik", 189900, 125000),
    ("Samsung 27 inç IPS Monitör", "Elektronik", 729900, 540000),
    ("Sony WH-CH720N Kulaklık", "Elektronik", 549900, 410000),
    ("Moleskine Klasik Defter", "Kırtasiye", 64900, 38000),
    ("Faber-Castell Kalem Seti", "Kırtasiye", 32900, 18000),
    ("Post-it Not Küpü", "Kırtasiye", 14900, 8000),
    ("A4 Fotokopi Kağıdı 500 Yaprak", "Kırtasiye", 21900, 14500),
    ("Ergonomik Çalışma Sandalyesi", "Ofis Mobilyası", 899900, 620000),
    ("Ayarlanabilir Laptop Standı", "Ofis Mobilyası", 89900, 54000),
    ("Minimal Masa Lambası", "Ofis Mobilyası", 124900, 82000),
    ("Ahşap Masa Düzenleyici", "Ofis Mobilyası", 45900, 28000),
    ("Çelik Termos 500 ml", "Mutfak & Yaşam", 79900, 46000),
    ("Seramik Kupa Seti", "Mutfak & Yaşam", 54900, 31000),
    ("Filtre Kahve 1 kg", "Mutfak & Yaşam", 74900, 48000),
    ("Cam Su Şişesi 750 ml", "Mutfak & Yaşam", 34900, 19500),
    ("Kargo Kutusu 30×20×15", "Ambalaj", 2900, 1700),
    ("Kraft Kargo Zarfı 10'lu", "Ambalaj", 11900, 6500),
    ("Şeffaf Koli Bandı 6'lı", "Ambalaj", 18900, 11000),
    ("Balonlu Ambalaj 10 m", "Ambalaj", 24900, 16000),
    ("Mikrofiber Temizlik Bezi 5'li", "Temizlik", 14900, 7500),
    ("Yüzey Temizleyici 5 L", "Temizlik", 28900, 18000),
    ("Sıvı Sabun 1 L", "Temizlik", 12900, 7000),
]


def seed(db, admin):
    db.info["demo_mode"] = True
    if db.get(Setting, "demo_seed_v1"):
        return False
    categories = {}
    for name in dict.fromkeys(p[1] for p in PRODUCTS):
        category = db.scalar(select(Category).where(Category.name == name).execution_options(skip_demo_scope=True))
        if category is None:
            category = Category(name=name, description=f"{name} ürün grubu")
            db.add(category)
            db.flush()
        categories[name] = category
    suppliers = []
    for index, name in enumerate(["Teknoloji Tedarik A.Ş.", "Ofis Dünyası", "Marmara Dağıtım", "Kraft Ambalaj", "Arın Temizlik"]):
        supplier = Supplier(name=name, email=f"tedarik{index + 1}@example.com", phone=f"0212 555 10 0{index}", address="İstanbul, Türkiye")
        db.add(supplier)
        suppliers.append(supplier)
    customers = []
    for index, name in enumerate(["Nova Tasarım Stüdyosu", "Atlas Teknoloji", "Pera Mimarlık", "Mavi Dijital", "Kuzey Lojistik", "Luna Coffee", "İzmir Kolektif", "Ada Danışmanlık"]):
        customer = Customer(name=name, email=f"musteri{index + 1}@example.com", phone=f"0216 555 20 0{index}", address="Türkiye · Demo müşteri")
        db.add(customer)
        customers.append(customer)
    db.flush()
    products = []
    for index, (name, category, price, cost) in enumerate(PRODUCTS):
        sku = f"DEMO-{index + 1:04d}"
        if db.scalar(select(Product.id).where(Product.sku == sku)):
            raise ValueError("Demo SKU zaten mevcut. İşlem geri alındı; hiçbir veri değiştirilmedi.")
        product = Product(sku=sku, name=name, description="İşletmeniz için özenle seçilmiş, günlük operasyonlara uygun ürün.",
                          category_id=categories[category].id, supplier_id=suppliers[index % 5].id,
                          sale_price=price, purchase_price=cost, critical_stock=10)
        db.add(product)
        db.flush()
        products.append(product)
        movement = move_stock(db, product, 80 + index * 3, "in", admin, "Demo açılış stoğu")
        movement.created_at = utcnow() - timedelta(days=170)
    for index in range(36):
        absolute = utcnow().year * 12 + utcnow().month - 1 - index % 6
        stamp = datetime(absolute // 12, absolute % 12 + 1, min(2 + index % 24, utcnow().day) if index % 6 == 0 else 2 + index % 24, 9)
        lines = [{"product_id": products[(index * 3 + offset) % len(products)].id, "quantity": 1 + index % 3} for offset in range(1 + index % 3)]
        order = save_order(db, OrderInput(customer_id=customers[index % len(customers)].id, items=lines, notes="Örnek iş akışı · Demo veri"), admin)
        target = ["Completed", "Completed", "Completed", "Pending", "Processing", "Cancelled"][(index // 6 + index % 3) % 6]
        if target != "Pending":
            transition(db, order, "Confirmed", admin)
        if target in {"Processing", "Completed"}:
            transition(db, order, "Processing", admin)
        if target in {"Completed", "Cancelled"}:
            transition(db, order, target, admin)
        order.created_at = order.updated_at = stamp
        if target == "Completed":
            order.completed_at = stamp + timedelta(hours=2)
        for event in order.events:
            event.created_at = stamp
        from app.models import StockMovement
        for movement in db.scalars(select(StockMovement).where(StockMovement.order_id == order.id)):
            movement.created_at = stamp
    for index in (0, 5, 11, 18):
        product = products[index]
        move_stock(db, product, (index % 7) - product.stock, "adjustment", admin, "Demo sayım düzeltmesi")
    for key, value in {"company_name": "StockPilot", "registration_enabled": "true", "demo_seed_v1": "true"}.items():
        if not db.get(Setting, key):
            db.add(Setting(key=key, value=value))
    return True


def main():
    with SessionLocal.begin() as db:
        db.connection(execution_options={"sqlite_write": True})
        admin = db.scalar(select(User).where(User.role == "admin", User.status == "active").order_by(User.id))
        if not admin:
            raise SystemExit("Önce python -m scripts.create_admin ile yönetici oluşturun.")
        created = seed(db, admin)
    print("Demo verileri oluşturuldu." if created else "Demo verileri zaten mevcut; değişiklik yapılmadı.")


if __name__ == "__main__":
    main()
