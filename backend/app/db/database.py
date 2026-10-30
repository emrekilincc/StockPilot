from datetime import datetime, timezone

from sqlalchemy import Boolean, MetaData, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.orm import with_loader_criteria

from app.core.config import settings


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={
        "ix": "ix_%(column_0_label)s", "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s", "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    })


class DemoMixin:
    """Business records are transparently scoped to the selected demo mode."""

    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)


@event.listens_for(Session, "do_orm_execute")
def scope_demo_records(execute_state):
    if (execute_state.is_select and not execute_state.is_column_load
            and not execute_state.is_relationship_load
            and not execute_state.execution_options.get("skip_demo_scope")):
        demo_mode = bool(execute_state.session.info.get("demo_mode", False))
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(DemoMixin, lambda cls: cls.is_demo == demo_mode, include_aliases=True)
        )


@event.listens_for(Session, "before_flush")
def stamp_demo_records(session, _flush_context, _instances):
    demo_mode = bool(session.info.get("demo_mode", False))
    for instance in session.new:
        if isinstance(instance, DemoMixin):
            instance.is_demo = demo_mode


def make_engine(url):
    engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 15})

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _):
        connection.isolation_level = None
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=15000")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    @event.listens_for(engine, "begin")
    def begin(connection):
        # Acquire the writer lock BEFORE reading stock or order state.
        mode = " IMMEDIATE" if connection.get_execution_options().get("sqlite_write") else ""
        connection.exec_driver_sql("BEGIN" + mode)

    return engine


engine = make_engine(settings.database_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False, class_=Session)
