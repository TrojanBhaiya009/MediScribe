"""
Pharmacy inventory router.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import PharmacyInventory, UserAccount, UserRole
from routers.auth import get_current_user, require_role

router = APIRouter(prefix="/inventory", tags=["inventory"])


class DispenseItemRequest(BaseModel):
    drug_name: str
    quantity: int = 1


class DispenseRequest(BaseModel):
    items: List[DispenseItemRequest]
    visit_id: Optional[str] = None


class AddStockRequest(BaseModel):
    drug_id: str
    quantity: int


@router.get("/status")
async def get_inventory_status(
    session: Session = Depends(get_session),
    current_user: UserAccount = Depends(get_current_user),
):
    statement = select(PharmacyInventory).where(PharmacyInventory.isActive == True)
    rows = session.exec(statement).all()

    low_stock_count = 0
    out_of_stock_count = 0
    alerts = []

    for row in rows:
        if row.currentQuantity <= 0:
            out_of_stock_count += 1
            alerts.append(
                {
                    "drug_name": row.drugName,
                    "current_quantity": row.currentQuantity,
                    "threshold": row.lowStockThreshold,
                    "status": "out_of_stock",
                }
            )
        elif row.currentQuantity <= row.lowStockThreshold:
            low_stock_count += 1
            alerts.append(
                {
                    "drug_name": row.drugName,
                    "current_quantity": row.currentQuantity,
                    "threshold": row.lowStockThreshold,
                    "status": "low_stock",
                }
            )

    inventory = [
        {
            "id": row.id,
            "drugName": row.drugName,
            "genericName": row.genericName,
            "manufacturer": row.manufacturer,
            "stockCapacity": row.stockCapacity,
            "currentQuantity": row.currentQuantity,
            "lowStockThreshold": row.lowStockThreshold,
            "unitType": row.unitType,
            "pricePerUnit": row.pricePerUnit,
            "batchNumber": row.batchNumber,
            "expiryDate": row.expiryDate.isoformat() if row.expiryDate else None,
        }
        for row in rows
    ]

    return {
        "total_items": len(rows),
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "alerts": alerts,
        "inventory": inventory,
    }


@router.post("/dispense")
async def dispense_items(
    request: DispenseRequest,
    session: Session = Depends(get_session),
    current_user: UserAccount = Depends(require_role(UserRole.PHARMACIST, UserRole.ADMIN)),
):
    dispensed = []
    errors = []

    for item in request.items:
        statement = select(PharmacyInventory).where(PharmacyInventory.isActive == True)
        candidates = session.exec(statement).all()
        q = item.drug_name.lower()
        drug = next((row for row in candidates if q in row.drugName.lower()), None)

        if not drug:
            errors.append(f"{item.drug_name}: not found")
            continue

        if drug.currentQuantity < item.quantity:
            errors.append(f"{drug.drugName}: insufficient stock ({drug.currentQuantity} available)")
            continue

        drug.currentQuantity -= item.quantity
        if drug.stock is not None:
            drug.stock = drug.currentQuantity
        drug.updatedAt = datetime.now()
        session.add(drug)

        dispensed.append(
            {
                "drug_name": drug.drugName,
                "quantity": item.quantity,
                "remaining": drug.currentQuantity,
            }
        )

    session.commit()

    return {
        "success": len(errors) == 0,
        "dispensed": dispensed,
        "errors": errors,
    }


@router.post("/add")
async def add_stock(
    request: AddStockRequest,
    session: Session = Depends(get_session),
    current_user: UserAccount = Depends(require_role(UserRole.PHARMACIST, UserRole.ADMIN)),
):
    item = session.get(PharmacyInventory, request.drug_id)
    if not item:
        return {"error": "Drug not found"}

    item.currentQuantity += request.quantity
    if item.stock is not None:
        item.stock = item.currentQuantity
    item.updatedAt = datetime.now()
    session.add(item)
    session.commit()

    return {
        "id": item.id,
        "drugName": item.drugName,
        "genericName": item.genericName,
        "manufacturer": item.manufacturer,
        "stockCapacity": item.stockCapacity,
        "currentQuantity": item.currentQuantity,
        "lowStockThreshold": item.lowStockThreshold,
        "unitType": item.unitType,
        "pricePerUnit": item.pricePerUnit,
        "batchNumber": item.batchNumber,
        "expiryDate": item.expiryDate.isoformat() if item.expiryDate else None,
    }
