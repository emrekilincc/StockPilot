"""add demo record scope

Revision ID: db976d326882
Revises: 214768e25502
"""
from alembic import op
import sqlalchemy as sa


revision = 'db976d326882'
down_revision = '214768e25502'
branch_labels = None
depends_on = None
TABLES = ("audit_logs", "categories", "customers", "order_events", "order_items",
          "orders", "products", "stock_movements", "suppliers")


def upgrade():
    for table in TABLES:
        op.add_column(table, sa.Column('is_demo', sa.Boolean(), server_default=sa.false(), nullable=False))
        op.create_index(f'ix_{table}_is_demo', table, ['is_demo'], unique=False)

    # Mark deterministic seed rows that predate this scope column.
    op.execute("UPDATE products SET is_demo = 1 WHERE sku LIKE 'DEMO-%'")
    op.execute("UPDATE categories SET is_demo = 1 WHERE id IN (SELECT category_id FROM products WHERE is_demo = 1)")
    op.execute("UPDATE suppliers SET is_demo = 1 WHERE email LIKE 'tedarik%@example.com'")
    op.execute("UPDATE customers SET is_demo = 1 WHERE email LIKE 'musteri%@example.com'")
    op.execute("UPDATE orders SET is_demo = 1 WHERE notes LIKE '%Demo veri%'")
    op.execute("UPDATE order_items SET is_demo = 1 WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)")
    op.execute("UPDATE order_events SET is_demo = 1 WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)")
    op.execute("UPDATE stock_movements SET is_demo = 1 WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1) OR note LIKE '%Demo%'")
    op.execute("UPDATE audit_logs SET is_demo = 1 WHERE entity IN ('products', 'orders', 'stock_movements')")

    # ### end Alembic commands ###


def downgrade():
    for table in reversed(TABLES):
        op.drop_index(f'ix_{table}_is_demo', table_name=table)
        op.drop_column(table, 'is_demo')
