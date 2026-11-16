from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from telegram import Bot

from dashboard.product_ops import AddProductRequest, add_product, product_to_dict
from dashboard.settings import DashboardSettings, as_bot_settings, load_dashboard_settings
from db import ProductRepository
from price_checker import PriceChecker

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).resolve().parent / "static"
TOKEN_HEADER = "X-Dashboard-Token"
TOKEN_COOKIE = "dashboard_token"


class ProductCreateBody(BaseModel):
    url: str = Field(..., min_length=1)
    target_price: float | None = None
    target_drop_percent: float | None = None
    target_text: str | None = None


def _extract_token(request: Request, settings: DashboardSettings) -> str | None:
    header = request.headers.get(TOKEN_HEADER, "").strip()
    if header:
        return header
    auth = request.headers.get("Authorization", "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    cookie = request.cookies.get(TOKEN_COOKIE, "").strip()
    if cookie:
        return cookie
    return None


def require_token(request: Request) -> DashboardSettings:
    settings: DashboardSettings = request.app.state.settings
    token = _extract_token(request, settings)
    if not token or token != settings.dashboard_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya eksik panel anahtarı.",
        )
    return settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_dashboard_settings()
    repo = ProductRepository(settings.database_path)
    repo.init_db()
    bot: Bot | None = None
    if settings.telegram_configured:
        bot = Bot(settings.telegram_bot_token)
    checker = PriceChecker(as_bot_settings(settings), repo, bot)
    app.state.settings = settings
    app.state.repo = repo
    app.state.checker = checker
    logger.info(
        "Panel hazır (port %s, telegram uyarıları: %s)",
        settings.dashboard_port,
        "açık" if bot else "kapalı",
    )
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="İndirim Takip Paneli", lifespan=lifespan)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    @app.get("/api/products")
    def list_products(
        request: Request,
        _: DashboardSettings = Depends(require_token),
    ):
        repo: ProductRepository = request.app.state.repo
        items = [product_to_dict(p) for p in repo.list_products()]
        return {"products": items}

    @app.post("/api/products")
    async def create_product(
        body: ProductCreateBody,
        request: Request,
        _: DashboardSettings = Depends(require_token),
    ):
        repo: ProductRepository = request.app.state.repo
        req = AddProductRequest(
            url=body.url,
            target_price=body.target_price,
            target_drop_percent=body.target_drop_percent,
            target_text=body.target_text,
        )
        settings: DashboardSettings = request.app.state.settings
        result = add_product(repo, req, settings.http_user_agent)
        if isinstance(result, str):
            raise HTTPException(status_code=400, detail=result)
        return product_to_dict(result)

    @app.delete("/api/products/{product_id}")
    def delete_product(
        product_id: int,
        request: Request,
        _: DashboardSettings = Depends(require_token),
    ):
        repo: ProductRepository = request.app.state.repo
        if not repo.remove_product(product_id):
            raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
        return {"ok": True, "id": product_id}

    @app.post("/api/check")
    async def run_check(
        request: Request,
        _: DashboardSettings = Depends(require_token),
    ):
        checker: PriceChecker = request.app.state.checker
        ok, failed = await checker.check_all()
        repo: ProductRepository = request.app.state.repo
        last_run = checker.last_run.isoformat() if checker.last_run else None
        return {
            "ok_count": ok,
            "failed_count": failed,
            "product_count": repo.count(),
            "last_run": last_run,
        }

    @app.exception_handler(HTTPException)
    async def http_exc_handler(request: Request, exc: HTTPException):
        if request.url.path.startswith("/api/"):
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.get("/manifest.webmanifest")
    def manifest():
        return FileResponse(
            STATIC_DIR / "manifest.webmanifest",
            media_type="application/manifest+json",
        )

    app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")

    @app.get("/")
    def index():
        return FileResponse(STATIC_DIR / "index.html")

    return app


def main() -> None:
    import uvicorn

    logging.basicConfig(
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        level=logging.INFO,
    )
    settings = load_dashboard_settings()
    uvicorn.run(
        "dashboard.server:create_app",
        factory=True,
        host=settings.dashboard_host,
        port=settings.dashboard_port,
        log_level="info",
    )
