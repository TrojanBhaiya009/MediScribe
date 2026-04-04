from sqlmodel import create_engine, Session, SQLModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text

class Settings(BaseSettings):
    DATABASE_URL: str
    DIRECT_URL: str = "" # Optional if using Supabase pooling

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

# Handle "postgres://" vs "postgresql://"
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url, echo=True)

def get_session():
    with Session(engine) as session:
        yield session


def _sqlite_columns(table_name: str) -> set[str]:
    with engine.begin() as conn:
        rows = conn.execute(text(f'PRAGMA table_info("{table_name}")')).fetchall()
        return {row[1] for row in rows}


def _run_sqlite_compat_migrations():
    if engine.dialect.name != "sqlite":
        return

    user_cols = _sqlite_columns("user_accounts")
    if not user_cols:
        return

    with engine.begin() as conn:
        if "passwordHash" not in user_cols:
            conn.execute(text('ALTER TABLE "user_accounts" ADD COLUMN "passwordHash" VARCHAR'))
        if "displayName" not in user_cols:
            conn.execute(text('ALTER TABLE "user_accounts" ADD COLUMN "displayName" VARCHAR'))
        if "isActive" not in user_cols:
            conn.execute(text('ALTER TABLE "user_accounts" ADD COLUMN "isActive" BOOLEAN DEFAULT 1'))
        if "doctorId" not in user_cols:
            conn.execute(text('ALTER TABLE "user_accounts" ADD COLUMN "doctorId" VARCHAR'))
        if "updatedAt" not in user_cols:
            conn.execute(text('ALTER TABLE "user_accounts" ADD COLUMN "updatedAt" DATETIME'))
        if "lastLoginAt" not in user_cols:
            conn.execute(text('ALTER TABLE "user_accounts" ADD COLUMN "lastLoginAt" DATETIME'))

        refreshed = {row[1] for row in conn.execute(text('PRAGMA table_info("user_accounts")')).fetchall()}
        if "hashedPassword" in refreshed:
            conn.execute(text('UPDATE "user_accounts" SET "passwordHash" = "hashedPassword" WHERE "passwordHash" IS NULL OR "passwordHash" = ""'))
        if "fullName" in refreshed:
            conn.execute(text('UPDATE "user_accounts" SET "displayName" = "fullName" WHERE "displayName" IS NULL OR "displayName" = ""'))
        conn.execute(text('UPDATE "user_accounts" SET "displayName" = username WHERE "displayName" IS NULL OR "displayName" = ""'))
        conn.execute(text('UPDATE "user_accounts" SET "isActive" = 1 WHERE "isActive" IS NULL'))

    inventory_cols = _sqlite_columns("pharmacy_inventory")
    if not inventory_cols:
        return

    with engine.begin() as conn:
        if "genericName" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "genericName" VARCHAR'))
        if "manufacturer" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "manufacturer" VARCHAR'))
        if "stockCapacity" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "stockCapacity" INTEGER DEFAULT 100'))
        if "currentQuantity" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "currentQuantity" INTEGER DEFAULT 0'))
        if "lowStockThreshold" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "lowStockThreshold" INTEGER DEFAULT 20'))
        if "unitType" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "unitType" VARCHAR DEFAULT "tablets"'))
        if "pricePerUnit" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "pricePerUnit" FLOAT DEFAULT 0'))
        if "expiryDate" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "expiryDate" DATETIME'))
        if "batchNumber" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "batchNumber" VARCHAR'))
        if "isActive" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "isActive" BOOLEAN DEFAULT 1'))
        if "createdAt" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "createdAt" DATETIME'))
        if "updatedAt" not in inventory_cols:
            conn.execute(text('ALTER TABLE "pharmacy_inventory" ADD COLUMN "updatedAt" DATETIME'))

        refreshed = {row[1] for row in conn.execute(text('PRAGMA table_info("pharmacy_inventory")')).fetchall()}
        if "stock" in refreshed:
            conn.execute(text('UPDATE "pharmacy_inventory" SET "currentQuantity" = stock WHERE "currentQuantity" IS NULL'))
        if "reorderLevel" in refreshed:
            conn.execute(text('UPDATE "pharmacy_inventory" SET "lowStockThreshold" = reorderLevel WHERE "lowStockThreshold" IS NULL'))
        conn.execute(text('UPDATE "pharmacy_inventory" SET "stockCapacity" = CASE WHEN "stockCapacity" IS NULL OR "stockCapacity" = 0 THEN 100 ELSE "stockCapacity" END'))
        conn.execute(text('UPDATE "pharmacy_inventory" SET "currentQuantity" = 0 WHERE "currentQuantity" IS NULL'))
        conn.execute(text('UPDATE "pharmacy_inventory" SET "lowStockThreshold" = 20 WHERE "lowStockThreshold" IS NULL'))
        conn.execute(text('UPDATE "pharmacy_inventory" SET "isActive" = 1 WHERE "isActive" IS NULL'))

    emr_cols = _sqlite_columns("emrs")
    if not emr_cols:
        return

    with engine.begin() as conn:
        if "investigations" not in emr_cols:
            conn.execute(text('ALTER TABLE "emrs" ADD COLUMN "investigations" JSON'))

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _run_sqlite_compat_migrations()
