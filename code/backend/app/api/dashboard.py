import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from decimal import Decimal

from app.database.database import get_db
from app.models.models import Project, ProjectCost, Payment
from app.schemas.schemas import DashboardResponse, ProjectProfitItem
from app.services.cost_calculator import CostCalculator

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    projects = db.query(Project).filter(
        Project.deleted_at.is_(None),
        Project.parent_project_id.is_(None)
    ).all()

    project_count = len(projects)
    contract_amount = sum((p.amount for p in projects), Decimal("0"))
    total_cost = sum(
        (db.query(ProjectCost).filter(ProjectCost.project_id == p.id).first().total_cost
         if db.query(ProjectCost).filter(ProjectCost.project_id == p.id).first() else Decimal("0"))
        for p in projects
    )
    total_profit = contract_amount - total_cost
    overall_profit_rate = float(total_profit / contract_amount) if contract_amount > 0 else 0.0

    # Unpaid amount
    total_paid = Decimal("0")
    for p in projects:
        paid = db.query(Payment).filter(
            Payment.project_id == p.id,
            Payment.deleted_at.is_(None),
            Payment.status == "已到账"
        ).all()
        total_paid += sum((pm.payment_amount for pm in paid), Decimal("0"))
    unpaid = contract_amount - total_paid
    payment_rate = float(total_paid / contract_amount) if contract_amount > 0 else 0.0

    # Estimated 30-day income
    today = datetime.date.today()
    cutoff = today + datetime.timedelta(days=30)
    upcoming_payments = db.query(Payment).filter(
        Payment.deleted_at.is_(None),
        Payment.status.in_(["待回款", "已申请"]),
        Payment.expected_payment_date >= today,
        Payment.expected_payment_date <= cutoff
    ).all()
    estimated_30day = sum((p.payment_amount for p in upcoming_payments), Decimal("0"))

    return {
        "project_count": project_count,
        "contract_amount": contract_amount,
        "total_cost": total_cost,
        "total_profit": total_profit,
        "overall_profit_rate": overall_profit_rate,
        "unpaid_amount": unpaid,
        "payment_rate": payment_rate,
        "estimated_30day_income": estimated_30day,
    }


@router.get("/profit-ranking")
def profit_ranking(
    top_n: int = 10,
    order: str = "desc",
    db: Session = Depends(get_db),
):
    projects = db.query(Project).filter(
        Project.deleted_at.is_(None),
        Project.parent_project_id.is_(None)
    ).all()

    results = []
    for p in projects:
        cost_record = db.query(ProjectCost).filter(
            ProjectCost.project_id == p.id
        ).first()
        cost = cost_record.total_cost if cost_record else Decimal("0")
        profit = p.amount - cost
        profit_rate = float(profit / p.amount) if p.amount > 0 else 0.0
        results.append({
            "id": p.id,
            "project_name": p.project_name,
            "amount": p.amount,
            "total_cost": cost,
            "profit": profit,
            "profit_rate": profit_rate,
        })

    reverse = order == "desc"
    results.sort(key=lambda x: x["profit"], reverse=reverse)
    return results[:top_n]
