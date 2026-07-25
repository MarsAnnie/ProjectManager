from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.models import UIPerson
from app.schemas.schemas import UIPersonCreate, UIPersonResponse

router = APIRouter(prefix="/api/ui-persons", tags=["ui_persons"])


@router.get("", response_model=List[UIPersonResponse])
def list_ui_persons(db: Session = Depends(get_db)):
    return db.query(UIPerson).filter(
        UIPerson.deleted_at.is_(None)
    ).order_by(UIPerson.name).all()


@router.post("", response_model=UIPersonResponse)
def create_ui_person(data: UIPersonCreate, db: Session = Depends(get_db)):
    existing = db.query(UIPerson).filter(
        UIPerson.name == data.name, UIPerson.deleted_at.is_(None)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该UI人员已存在")
    ui = UIPerson(**data.model_dump())
    db.add(ui)
    db.commit()
    db.refresh(ui)
    return ui


@router.delete("/{ui_id}")
def delete_ui_person(ui_id: int, db: Session = Depends(get_db)):
    ui = db.query(UIPerson).filter(
        UIPerson.id == ui_id, UIPerson.deleted_at.is_(None)
    ).first()
    if not ui:
        raise HTTPException(status_code=404, detail="不存在")
    from datetime import datetime
    ui.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "已删除"}
