from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.models import Employee
from app.schemas.schemas import EmployeeCreate, EmployeeUpdate, EmployeeResponse

router = APIRouter(prefix="/api/employees", tags=["employees"])


@router.get("", response_model=List[EmployeeResponse])
def list_employees(
    status: str | None = Query(None),
    employment_type: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Employee).filter(Employee.deleted_at.is_(None))
    if status:
        q = q.filter(Employee.status == status)
    if employment_type:
        q = q.filter(Employee.employment_type == employment_type)
    return q.order_by(Employee.name).all()


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(
        Employee.id == employee_id, Employee.deleted_at.is_(None)
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="员工不存在")
    return emp


@router.post("", response_model=EmployeeResponse)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    emp = Employee(**data.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(
        Employee.id == employee_id, Employee.deleted_at.is_(None)
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="员工不存在")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(emp, key, val)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(
        Employee.id == employee_id, Employee.deleted_at.is_(None)
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="员工不存在")
    from datetime import datetime
    emp.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "已删除"}
