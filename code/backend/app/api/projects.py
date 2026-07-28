import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database.database import get_db
from app.models.models import Project, ProjectMember, Payment, Employee, ProjectBusinessManager
from app.core.config import settings
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse,
    ProjectMemberCreate, ProjectMemberResponse,
    PaymentCreate, PaymentUpdate, PaymentResponse,
    QuoteHealthRequest, QuoteHealthResponse,
    PaymentProgressResponse, PaymentRatioOption,
    PaginatedResponse,
)
from app.services.quote_checker import check_quote_health
from app.services.status_engine import auto_advance_status
from app.services.cost_calculator import CostCalculator
from app.services.payment_ratio import calc_payment_progress, get_ratio_options, is_valid_ratio

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
        joinedload(Project.children),
        joinedload(Project.business_manager_links).joinedload(ProjectBusinessManager.business_manager),
    ).filter(Project.deleted_at.is_(None), Project.parent_project_id.is_(None))
    if status:
        q = q.filter(Project.status == status)
    if business_manager_id:
        q = q.filter(Project.business_manager_id == business_manager_id)
    if region:
        q = q.filter(Project.region == region)
    total = q.count()
    items = q.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    # 过滤已软删除的子项目
    for p in items:
        p.children = [c for c in p.children if c.deleted_at is None]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/payment-ratios/list", response_model=List[PaymentRatioOption])
def list_payment_ratios():
    """列出所有可选回款比例模板"""
    return get_ratio_options()


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).options(
        joinedload(Project.members).joinedload(ProjectMember.employee),
        joinedload(Project.costs),
        joinedload(Project.payments),
        joinedload(Project.children),
        joinedload(Project.business_manager_links).joinedload(ProjectBusinessManager.business_manager),
    ).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    # 过滤已软删除的子项目和回款记录
    proj.children = [c for c in proj.children if c.deleted_at is None]
    proj.payments = [p for p in proj.payments if p.deleted_at is None and p.status != "取消"]
    return proj


def _sync_business_managers(proj: Project, manager_ids: list[int], db: Session):
    """替换项目的商务经理关联"""
    # 删除旧的
    db.query(ProjectBusinessManager).filter(
        ProjectBusinessManager.project_id == proj.id
    ).delete()
    # 创建新的
    for bm_id in manager_ids:
        db.add(ProjectBusinessManager(project_id=proj.id, business_manager_id=bm_id))


@router.post("", response_model=ProjectResponse)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    payload = data.model_dump()
    manager_ids = payload.pop("business_manager_ids", [])
    # 校验回款比例格式
    ratio = payload.get("payment_ratio")
    if ratio and not is_valid_ratio(ratio):
        raise HTTPException(status_code=400, detail=f"无效的回款比例: {ratio}，各位数字之和必须为10")
    # 工期自动换算项目周期
    if payload.get("work_days") and not payload.get("project_cycle_month"):
        payload["project_cycle_month"] = round(payload["work_days"] / settings.WORK_DAYS_PER_MONTH, 2)
    proj = Project(**payload)
    proj = auto_advance_status(proj)
    db.add(proj)
    db.flush()
    _sync_business_managers(proj, manager_ids or [], db)
    db.commit()
    # 重新查询以加载关联关系
    proj = db.query(Project).options(
        joinedload(Project.business_manager_links).joinedload(ProjectBusinessManager.business_manager),
        joinedload(Project.children),
    ).filter(Project.id == proj.id).first()
    return proj


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(
        Project.id == project_id, Project.deleted_at.is_(None)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    payload = data.model_dump(exclude_unset=True)
    manager_ids = payload.pop("business_manager_ids", None)
    # 校验回款比例格式
    ratio = payload.get("payment_ratio")
    if ratio is not None and ratio != "" and not is_valid_ratio(ratio):
        raise HTTPException(status_code=400, detail=f"无效的回款比例: {ratio}，各位数字之和必须为10")
    # 工期变更时自动重算项目周期
    if "work_days" in payload and payload["work_days"]:
        if "project_cycle_month" not in payload or payload.get("project_cycle_month") is None:
            payload["project_cycle_month"] = round(payload["work_days"] / settings.WORK_DAYS_PER_MONTH, 2)
    for key, val in payload.items():
        setattr(proj, key, val)
    # 仅当用户未手动指定状态时才自动推进
    if "status" not in payload:
        proj = auto_advance_status(proj)
    if manager_ids is not None:
        _sync_business_managers(proj, manager_ids, db)
    db.commit()
    # 重新查询以加载关联关系
    proj = db.query(Project).options(
        joinedload(Project.business_manager_links).joinedload(ProjectBusinessManager.business_manager),
        joinedload(Project.children),
    ).filter(Project.id == proj.id).first()
    return proj


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(
        Project.id == project_id, Project.deleted_at.is_(None)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    now = datetime.datetime.utcnow()
    proj.deleted_at = now
    # 级联软删除子项目（增项）
    db.query(Project).filter(
        Project.parent_project_id == project_id,
        Project.deleted_at.is_(None)
    ).update({Project.deleted_at: now})
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
    member = db.query(ProjectMember).options(
        joinedload(ProjectMember.employee)
    ).filter(ProjectMember.id == member.id).first()
    return member


@router.post("/{project_id}/members/batch", response_model=List[ProjectMemberResponse])
def add_members_batch(project_id: int, members: List[ProjectMemberCreate], db: Session = Depends(get_db)):
    """批量添加项目成员"""
    proj = db.query(Project).filter(
        Project.id == project_id, Project.deleted_at.is_(None)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    created = []
    for m in members:
        member = ProjectMember(**m.model_dump())
        db.add(member)
        created.append(member)
    db.commit()
    ids = [m.id for m in created]
    return db.query(ProjectMember).options(
        joinedload(ProjectMember.employee)
    ).filter(ProjectMember.id.in_(ids)).all()


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
        Payment.deleted_at.is_(None),
        Payment.status != "取消"
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


@router.delete("/{project_id}/payments/{payment_id}")
def delete_payment(project_id: int, payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.project_id == project_id,
        Payment.deleted_at.is_(None)
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="回款记录不存在")
    payment.deleted_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "已删除"}


# ── Cost Calculation ──

@router.post("/{project_id}/calculate-cost")
def calculate_cost(project_id: int, db: Session = Depends(get_db)):
    calculator = CostCalculator(db)
    return calculator.calculate(project_id)


# ── Quote Health Check ──

@router.post("/check-quote-health", response_model=QuoteHealthResponse)
def check_quote(data: QuoteHealthRequest):
    return check_quote_health(data)


# ── Payment Progress ──

@router.get("/{project_id}/payment-progress", response_model=PaymentProgressResponse)
def get_payment_progress(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(
        Project.id == project_id, Project.deleted_at.is_(None)
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    if not proj.payment_ratio:
        raise HTTPException(status_code=400, detail="该项目未设置回款比例模板")
    payments = db.query(Payment).filter(
        Payment.project_id == project_id,
        Payment.deleted_at.is_(None),
    ).all()
    result = calc_payment_progress(proj.payment_ratio, proj.amount, payments)
    if result is None:
        raise HTTPException(status_code=400, detail="无效的回款比例模板")
    return result
