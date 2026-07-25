import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.models import (
    Project, ProjectMember, ProjectCost, CostSnapshot, Employee
)


class CostCalculator:
    def __init__(self, db: Session):
        self.db = db

    def calculate(self, project_id: int) -> dict:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError("项目不存在")

        members = self.db.query(ProjectMember).options(
            # eager load employee
        ).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.deleted_at.is_(None)
        ).all()

        salary_cost = Decimal("0")
        social_security_cost = Decimal("0")
        developer_bonus = Decimal("0")
        product_bonus = Decimal("0")

        detail = []

        for member in members:
            employee = self.db.query(Employee).filter(
                Employee.id == member.employee_id
            ).first()
            if not employee:
                continue

            # Ensure cost snapshot exists
            self._ensure_snapshot(project_id, employee)

            snapshot = self.db.query(CostSnapshot).filter(
                CostSnapshot.project_id == project_id,
                CostSnapshot.employee_id == employee.id
            ).first()

            sal = snapshot.salary_at_snapshot if snapshot else employee.salary
            soc = snapshot.social_security_at_snapshot if snapshot else employee.social_security

            member_salary_cost = sal * member.input_month
            member_social_cost = Decimal("0")
            if employee.employment_type == "正式":
                member_social_cost = soc * member.input_month

            salary_cost += member_salary_cost
            social_security_cost += member_social_cost
            developer_bonus += member.bonus
            product_bonus += member.product_bonus

            detail.append({
                "employee_name": employee.name,
                "salary_cost": float(member_salary_cost),
                "social_security_cost": float(member_social_cost),
                "bonus": float(member.bonus),
                "product_bonus": float(member.product_bonus),
            })

        total_cost = salary_cost + social_security_cost + developer_bonus + product_bonus

        # Upsert project_costs record
        cost_record = self.db.query(ProjectCost).filter(
            ProjectCost.project_id == project_id
        ).first()
        if cost_record:
            cost_record.salary_cost = salary_cost
            cost_record.social_security_cost = social_security_cost
            cost_record.developer_bonus = developer_bonus
            cost_record.product_bonus = product_bonus
            cost_record.total_cost = total_cost
            cost_record.calculated_at = datetime.datetime.utcnow()
        else:
            cost_record = ProjectCost(
                project_id=project_id,
                salary_cost=salary_cost,
                social_security_cost=social_security_cost,
                developer_bonus=developer_bonus,
                product_bonus=product_bonus,
                total_cost=total_cost,
            )
            self.db.add(cost_record)

        self.db.commit()

        profit = project.amount - total_cost
        profit_rate = float(profit / project.amount) if project.amount > 0 else 0.0

        return {
            "project_id": project_id,
            "salary_cost": float(salary_cost),
            "social_security_cost": float(social_security_cost),
            "developer_bonus": float(developer_bonus),
            "product_bonus": float(product_bonus),
            "total_cost": float(total_cost),
            "profit": float(profit),
            "profit_rate": profit_rate,
            "detail": detail,
        }

    def _ensure_snapshot(self, project_id: int, employee: Employee):
        existing = self.db.query(CostSnapshot).filter(
            CostSnapshot.project_id == project_id,
            CostSnapshot.employee_id == employee.id
        ).first()
        if not existing:
            snapshot = CostSnapshot(
                project_id=project_id,
                employee_id=employee.id,
                snapshot_date=datetime.date.today(),
                salary_at_snapshot=employee.salary,
                social_security_at_snapshot=employee.social_security,
                guarantee_at_snapshot=employee.guarantee,
            )
            self.db.add(snapshot)
            self.db.commit()
