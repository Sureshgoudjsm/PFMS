from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import accounts, categories, dashboard, people, transactions

app = FastAPI(
    title="Personal Finance Management System",
    description="Track expenses, income, transfers, loans, and net worth",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(people.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
