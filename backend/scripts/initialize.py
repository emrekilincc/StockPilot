"""Migrate, interactively create the first admin, optionally insert demo data."""
import argparse

from alembic import command
from alembic.config import Config
from sqlalchemy import select

from app.core.config import BACKEND
from app.db.database import SessionLocal
from app.models import User
from scripts.create_admin import main as create_admin
from scripts.seed import main as seed_demo


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Demo verilerini açıkça ekle")
    args = parser.parse_args()
    command.upgrade(Config(str(BACKEND / "alembic.ini")), "head")
    with SessionLocal() as db:
        exists = db.scalar(select(User.id).where(User.role == "admin", User.status == "active").limit(1))
    if not exists:
        create_admin()
    else:
        print("Aktif yönetici hesabı mevcut; hesap değiştirilmedi.")
    if args.demo:
        seed_demo()


if __name__ == "__main__":
    main()
