import getpass
import sys

from pydantic import ValidationError
from sqlalchemy import select

from app.core.security import hasher
from app.db.database import SessionLocal
from app.models import User
from app.schemas.inputs import RegisterInput
from app.services.common import audit


def main():
    print("StockPilot · İlk yönetici hesabı (parola ekranda gösterilmez)")
    try:
        name = input("Ad soyad: ")
        email = input("E-posta: ")
        password = getpass.getpass("Parola (en az 12 karakter): ")
        if password != getpass.getpass("Parola tekrar: "):
            raise ValueError("Parolalar eşleşmiyor.")
        data = RegisterInput(name=name, email=email, password=password)
        with SessionLocal.begin() as db:
            db.connection(execution_options={"sqlite_write": True})
            if db.scalar(select(User.id).where(User.email == str(data.email).lower())):
                raise ValueError("Bu e-posta zaten kayıtlı; mevcut hesap değiştirilmedi.")
            user = User(name=data.name, email=str(data.email).lower(), password_hash=hasher.hash(data.password),
                        role="admin", status="active", manage_products=True, manage_stock=True, manage_orders=True)
            db.add(user)
            db.flush()
            audit(db, user, "admin_created_cli", "users", user.id)
        print("Yönetici oluşturuldu. Parolanız kaydedilmedi; yalnızca Argon2 hash'i saklandı.")
    except ValidationError:
        print("Geçerli ad, e-posta ve en az 12 karakterli parola girin.", file=sys.stderr)
        sys.exit(1)
    except (ValueError, KeyboardInterrupt) as exc:
        print(str(exc) or "İşlem iptal edildi.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
