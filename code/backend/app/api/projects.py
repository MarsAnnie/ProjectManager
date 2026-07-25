import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database.database import get_db
from app.models.models import Project, ProjectMember, Payment, Employee
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse,
    ProjectMemberCreate, ProjectMemberResponse,
    PaymentCreate, PaymentUpdate, PaymentResponse,
    QuoteHealthRequest, QuoteHealthResponse,
    PaginatedResponse,
)
from app.services.quote_checker import check_quote_health
from app.services.status_engine import auto_advance_status
from app.services.cost_calculator import CostCalculator

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=PaginatedResponse[ProjectResponse])
def list_projects(
    status: str | None = Query(None),
    business_manager_id: int | None = Query(None),
    region: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Project).options(
        joinedload(Project.children)
    ).filter(Project.deleted_at.is_(None), Project.parent_project_id.is_(None))
    if status:
        q = q.filter(Project.status == status)
    if business_manager_id:
        q = q.filter(Project.business_manager_id == business_manager_id)
    if region:
        q = q.filter(Project.region == region)
    total = q.count()
    items = q.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).options(
        joinedload(Project.members).joinedload(ProjectMember.employee),
        joinedload(Project.costs),
        joinedload(Project.payments),
        joinedload(Project.children),
        joinedload(Project.business_manager),
    ).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    return proj


@router.post("", response_model=ProjectResponse)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    proj = Project(**data.model_dump())
    proj = auto_advance_status(proj)
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(
        Project.id == project_id, Project.deleted_at.is_(None)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(proj, key, val)
    proj = auto_advance_status(proj)
    db.commit()
    db.refresh(proj)
    return proj


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(
        Project.id == project_id, Project.deleted_at.is_(None)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    proj.deleted_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "已删除"}


# ── Project Members ──

@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
def list_members(project_id: int, db: Session = Depends(get_db)):
    return db.query(ProjectMember).options(
        joinedload(ProjectMember.employee)
    ).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.deleted_at.is_(None)
    ).all()


@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
def add_member(project_id: int, data: ProjectMemberCreate, db: Session = Depends(get_db)):
    # Verify project exists
    proj = db.query(Project).filter(
        Project.id == project_id, Project.deleted_at.is_(None)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    member = ProjectMember(**data.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    # Reload with employee
    member = db.query(ProjectMember).options(
        joinedload(ProjectMember.employee)
    ).filter(ProjectMember.id == member.id).first()
    return member


@router.delete("/{project_id}/members/{member_id}")
def remove_member(project_id: int, member_id: int, db: Session = Depends(get_db)):
    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id,
        ProjectMember.project_id == project_id,
        ProjectMember.deleted_at.is_(None)
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")
    member.deleted_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "已移除"}


# ── Payments ──

@router.get("/{project_id}/payments", response_model=List[PaymentResponse])
def list_payments(project_id: int, db: Session = Depends(get_db)):
    return db.query(Payment).filter(
        Payment.project_id == project_id,
        Payment.deleted_at.is_(None)
    ).order_by(Payment.payment_stage).all()


@router.post("/{project_id}/payments", response_model=PaymentResponse)
def create_payment(project_id: int, data: PaymentCreate, db: Session = Depends(get_db)):
    payment = Payment(**data.model_dump())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.put("/{project_id}/payments/{payment_id}", response_model=PaymentResponse)
def update_payment(
    project_id: int, payment_id: int, data: PaymentUpdate, db: Session = Depends(get_db)
):
    payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.project_id == project_id,
        Payment.deleted_at.is_(None)
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="回款记录不存在")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(payment, key, val)
    # Auto-mark overdue
    if (
        payment.status in ("待回款", "已申请")
        and payment.expected_payment_date
        and payment.expected_payment_date < datetime.date.today()
    ):
        payment.status = "逾期"
    db.commit()
    db.refresh(payment)
    return payment


# ── Cost Calculation ──

@router.post("/{project_id}/calculate-cost")
def calculate_cost(project_id: int, db: Session = Depends(get_db)):
    calculator = CostCalculator(db)
    return calculator.calculate(project_id)


# ── Quote Health Check ──

@router.post("/check-quote-health", response_model=QuoteHealthResponse)
def check_quote(data: QuoteHealthRequest):
    return check_quote_health(data)
