import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.models import (
    Project, ProjectMember, ProjectCost, CostSnapshot, Employee
)
from app.services.bonus_calculator import calculate_bonus_pool, get_bonus_rate


class CostCalculator:
    def __init__(self, db: Session):
        self.db = db

    def calculate(self, project_id: int) -> dict:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError("项目不存在")

        members = self.db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.deleted_at.is_(None)
        ).all()

        # ── 计算奖金分配 ──
        is_sub = project.parent_project_id is not None
        commission_pool = calculate_bonus_pool(project.amount, is_sub=is_sub)
        ui_rate = project.ui_commission_rate or Decimal("0")

        has_lead = any(m.role == "负责人" for m in members)
        has_ui_member = any(m.role == "UI" for m in members)
        single_member = len(members) == 1

        if single_member:
            # 单人: 100% 全部
            lead_share = Decimal("0")
            ui_share = Decimal("0")
            dev_pool = commission_pool
        else:
            lead_share = commission_pool * Decimal("0.10") if has_lead else Decimal("0")
            ui_share = commission_pool * ui_rate if has_ui_member and ui_rate > 0 else Decimal("0")
            dev_pool = commission_pool - lead_share - ui_share

        # 开发人员按 share_ratio 分配 dev_pool
        dev_members = [m for m in members if m.role in ("开发", None, "")]
        total_dev_ratio = sum((m.share_ratio or Decimal("1")) for m in dev_members) or Decimal("1")

        # 写回每个成员的奖金到数据库
        for m in members:
            if single_member:
                m.bonus = commission_pool
                m.product_bonus = Decimal("0")
            elif m.role == "负责人":
                m.bonus = lead_share
                m.product_bonus = Decimal("0")
            elif m.role == "UI":
                m.bonus = ui_share
                m.product_bonus = Decimal("0")
            elif m.role in ("开发", None, ""):
                ratio = (m.share_ratio or Decimal("1")) / total_dev_ratio
                m.bonus = dev_pool * ratio
                m.product_bonus = Decimal("0")
        self.db.commit()

        # ── 计算工资/社保成本 ──
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

            is_dev = member.role in ("开发", "负责人", None, "")

            if is_dev:
                self._ensure_snapshot(project_id, employee)

            snapshot = self.db.query(CostSnapshot).filter(
                CostSnapshot.project_id == project_id,
                CostSnapshot.employee_id == employee.id
            ).first()

            sal = snapshot.salary_at_snapshot if snapshot else employee.salary
            soc = snapshot.social_security_at_snapshot if snapshot else employee.social_security

            salary_ratio = Decimal("0.8") if employee.employment_type == "试用" else Decimal("1")

            # 只有开发人员计算工资和社保成本
            if is_dev:
                member_salary_cost = sal * member.input_month * salary_ratio
                member_social_cost = Decimal("0")
                if employee.employment_type == "正式":
                    member_social_cost = soc * member.input_month
            else:
                member_salary_cost = Decimal("0")
                member_social_cost = Decimal("0")

            salary_cost += member_salary_cost
            social_security_cost += member_social_cost
            developer_bonus += member.bonus
            product_bonus += member.product_bonus

            detail.append({
                "employee_name": employee.name,
                "role": member.role or "开发",
                "share_ratio": float(member.share_ratio or 1),
                "employment_type": employee.employment_type,
                "salary_ratio": float(salary_ratio),
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

        # Commission pool split (UI vs Dev)
        is_sub = project.parent_project_id is not None
        commission_pool = calculate_bonus_pool(project.amount, is_sub=is_sub)
        ui_commission = Decimal("0")
        dev_commission = commission_pool
        if project.ui_commission_rate and project.ui_commission_rate > 0:
            ui_commission = commission_pool * project.ui_commission_rate
            dev_commission = commission_pool - ui_commission

        return {
            "project_id": project_id,
            "salary_cost": float(salary_cost),
            "social_security_cost": float(social_security_cost),
            "developer_bonus": float(developer_bonus),
            "product_bonus": float(product_bonus),
            "total_cost": float(total_cost),
            "profit": float(profit),
            "profit_rate": profit_rate,
            "commission_pool": float(commission_pool),
            "commission_rate": float(get_bonus_rate(project.amount, is_sub=is_sub)),
            "is_sub_project": is_sub,
            "ui_commission_rate": float(project.ui_commission_rate or 0),
            "ui_commission": float(ui_commission),
            "dev_commission": float(dev_commission),
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
