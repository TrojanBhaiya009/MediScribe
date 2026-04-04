from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.trae_service import get_trae_service

router = APIRouter(prefix="/trae", tags=["trae"])


class TraeAssistRequest(BaseModel):
    transcript: str
    include_hindi_summary: bool = False
    context: Optional[dict[str, Any]] = None


@router.get("/status")
async def trae_status():
    service = get_trae_service()
    return service.get_status()


@router.get("/capabilities")
async def trae_capabilities():
    service = get_trae_service()
    return {
        "service": service.name,
        "capabilities": [cap.model_dump() for cap in service.get_capabilities()],
    }


@router.post("/assist")
async def trae_assist(request: TraeAssistRequest):
    service = get_trae_service()

    try:
        result = service.assist(
            transcript=request.transcript,
            include_hindi_summary=request.include_hindi_summary,
        )
        response = result.model_dump()
        if request.context:
            response["context"] = request.context
        return response
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
