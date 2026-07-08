from dotenv import load_dotenv
# Load .env file
load_dotenv()

import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.routers import accounts, categories, dashboard, people, transactions, ai, auth, seed
from app.routers import notifications, insights, query as query_router, forecast
from app.routers import search, export

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Telegram bot polling ──────────────────────────────────────────────
    import app.core.telegram_worker as tw
    tw.polling_task = asyncio.create_task(tw.telegram_polling_loop())

    # ── APScheduler: daily nudge job at 07:00 ────────────────────────────
    from app.logic.nudge_engine import run_nudge_job
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_nudge_job,
        trigger="cron",
        hour=7,
        minute=0,
        id="daily_nudge_job",
        replace_existing=True,
        misfire_grace_time=3600,   # allow up to 1h late start (e.g. after restart)
    )
    scheduler.start()
    logger.info("APScheduler started — nudge job scheduled at 07:00 daily.")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    scheduler.shutdown(wait=False)
    if tw.polling_task:
        tw.polling_task.cancel()
        try:
            await tw.polling_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Personal Finance Management System",
    description="Track expenses, income, transfers, loans, and net worth",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phase 1 routers
app.include_router(auth.router,         prefix="/api")
app.include_router(people.router,       prefix="/api")
app.include_router(accounts.router,     prefix="/api")
app.include_router(categories.router,   prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(dashboard.router,    prefix="/api")
app.include_router(ai.router,           prefix="/api")
app.include_router(seed.router,         prefix="/api")

# Phase 2 routers
app.include_router(notifications.router, prefix="/api")
app.include_router(insights.router,      prefix="/api")
app.include_router(query_router.router,  prefix="/api")
app.include_router(forecast.router, prefix="/api")

# Phase 3 routers
app.include_router(search.router,   prefix="/api")
app.include_router(export.router,   prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
