import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import admin, auth, catalog, contacts, orders
from app.core.config import settings
from app.db.database import SessionLocal
from app.dependencies.auth import CurrentUser

logger = logging.getLogger("stockpilot")


def error(status, code, message, details=None):
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "details": details}})


def create_app(config=settings, session_factory=SessionLocal):
    app = FastAPI(title="StockPilot API", version="1.0.0", description="Stok ve sipariş yönetimi · Tutarlar kuruş cinsindedir.")
    app.state.settings = config
    app.state.session_factory = session_factory
    config.upload_dir.mkdir(parents=True, exist_ok=True)
    app.add_middleware(CORSMiddleware, allow_origins=config.allowed_origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "PATCH", "OPTIONS"], allow_headers=["Content-Type", "X-CSRF-Token"])

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            if request.headers.get("origin") not in config.allowed_origins:
                return error(403, "origin_rejected", "İstek kaynağına izin verilmiyor.")
            size = request.headers.get("content-length", "0")
            if not size.isdigit() or int(size) > 6 * 1024 * 1024:
                return error(413, "too_large", "İstek boyutu çok büyük.")
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        if request.url.path.startswith(("/api/", "/uploads/")):
            response.headers["Cache-Control"] = "no-store"
        if request.url.path not in {"/docs", "/redoc"}:
            response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        if config.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return error(exc.status_code, f"http_{exc.status_code}", str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # Do not echo request bodies: they may contain passwords.
        details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "type": e["type"]} for e in exc.errors()]
        return error(422, "validation_error", "Alanları kontrol edin. Eksik veya geçersiz bir değer var.", details)

    @app.exception_handler(IntegrityError)
    async def integrity_error(request, exc):
        return error(409, "conflict", "Kayıt zaten mevcut (SKU, e-posta veya ad) ya da ilişkili veri geçersiz.")

    @app.exception_handler(OperationalError)
    async def database_error(request, exc):
        logger.error("Database operation unavailable (%s)", type(exc).__name__)
        return error(503, "database_unavailable", "Veritabanı şu an kullanılamıyor. Kurulumu kontrol edip tekrar deneyin.")

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc):
        logger.error("Unhandled request error: %s %s (%s)", request.method, request.url.path, type(exc).__name__)
        return error(500, "internal_error", "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.")

    for router in (auth.router, catalog.router, orders.router, contacts.router, admin.router):
        app.include_router(router)

    @app.get("/api/health", tags=["Sistem"])
    def health():
        return {"status": "ok"}

    @app.get("/uploads/{name}", include_in_schema=False)
    def image(name: str, user: CurrentUser):
        if len(name) != 45 or not name.endswith(".webp") or any(c not in "0123456789abcdef" for c in name[:-5]):
            raise HTTPException(404, "Görsel bulunamadı.")
        path = config.upload_dir / name
        if not path.is_file():
            raise HTTPException(404, "Görsel bulunamadı.")
        return FileResponse(path, media_type="image/webp")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith(("api/", "uploads/")):
            raise HTTPException(404, "Endpoint bulunamadı.")
        root = config.frontend_dir.resolve()
        candidate = (root / path).resolve()
        if not candidate.is_relative_to(root):
            raise HTTPException(404, "Sayfa bulunamadı.")
        if candidate.is_file():
            return FileResponse(candidate)
        if (root / "index.html").is_file():
            return FileResponse(root / "index.html")
        raise HTTPException(404, "Frontend henüz build edilmedi. npm run build komutunu çalıştırın.")

    return app


app = create_app()
