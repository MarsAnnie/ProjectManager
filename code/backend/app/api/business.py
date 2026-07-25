from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.models import BusinessManager
from app.schemas.schemas import BusinessManagerCreate, BusinessManagerResponse

router = APIRouter(prefix="/api/business-managers", tags=["business_managers"])


@router.get("", response_model=List[BusinessManagerResponse])
def list_business_managers(db: Session = Depends(get_db)):
    return db.query(BusinessManager).filter(
        BusinessManager.deleted_at.is_(None)
    ).order_by(BusinessManager.name).all()


@router.post("", response_model=BusinessManagerResponse)
def create_business_manager(data: BusinessManagerCreate, db: Session = Depends(get_db)):
    bm = BusinessManager(**data.model_dump())
    db.add(bm)
    db.commit()
    db.refresh(bm)
    return bm


@router.delete("/{bm_id}")
def delete_business_manager(bm_id: int, db: Session = Depends(get_db)):
    bm = db.query(BusinessManager).filter(
        BusinessManager.id == bm_id, BusinessManager.deleted_at.is_(None)
    ).first()
    if not bm:
        raise HTTPException(status_code=404, detail="商务经理不存在")
    from datetime import datetime
    bm.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "已删除"}
