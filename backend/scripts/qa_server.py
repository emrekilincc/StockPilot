"""Bounded E2E server. Uses a temporary migrated DB; never touches application data."""
import os
import subprocess
import sys
import tempfile
import threading
from pathlib import Path


def main():
    if not os.environ.get("QA_PASSWORD"):
        raise SystemExit("Run via npm run test:e2e; no default account is provided.")
    with tempfile.TemporaryDirectory(prefix="stockpilot-qa-") as temporary:
        root = Path(temporary)
        os.environ["DATABASE_URL"] = f"sqlite:///{(root / 'qa.db').as_posix()}"
        os.environ["ENVIRONMENT"] = "test"
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import uvicorn
        from app.core.config import Settings
        from app.core.security import hasher
        from app.db.database import SessionLocal, engine
        from app.main import create_app
        from app.models import User
        from scripts.seed import seed
        with SessionLocal.begin() as db:
            db.connection(execution_options={"sqlite_write": True})
            user = User(name="Deniz Yılmaz", email="qa@example.com", role="admin", status="active", password_hash=hasher.hash(os.environ["QA_PASSWORD"]))
            db.add(user)
            db.flush()
            seed(db, user)
        port = int(os.environ.get("QA_PORT", "8765"))
        config = Settings(environment="test", upload_dir=root / "uploads", allowed_origins=[f"http://127.0.0.1:{port}"])
        server = uvicorn.Server(uvicorn.Config(create_app(config, SessionLocal), host="127.0.0.1", port=port, log_level="error", access_log=False))
        # A hard lifetime bounds the server even when the browser runner crashes.
        timer = threading.Timer(180, lambda: setattr(server, "should_exit", True))
        timer.daemon = True
        timer.start()
        def stop_from_parent():
            sys.stdin.readline()
            server.should_exit = True
        threading.Thread(target=stop_from_parent, daemon=True).start()
        try:
            server.run()
        finally:
            timer.cancel()
            engine.dispose()


if __name__ == "__main__":
    main()
