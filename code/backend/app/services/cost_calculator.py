import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.models import (
    Project, ProjectMember, ProjectCost, CostSnapshot, Employee, Payment
)
from app.services.bonus_calculator import calculate_bonus_pool, get_bonus_rate

AVG_DAYS_PER_MONTH = Decimal("30.44")


def calc_actual_months(start_date, end_date, fallback=None) -> Decimal:
    """按实际自然月计算耗时（首尾月按天数比例折算）。

    例如 1月15日 → 7月28日 = 194天 / 30.44 = 6.37个月。
    start_date/end_date 缺失或非法时回退到 fallback。
    """
    if start_date and end_date and isinstance(start_date, datetime.date) and isinstance(end_date, datetime.date):
        days = (end_date - start_date).days
        if days > 0:
            return (Decimal(days) / AVG_DAYS_PER_MONTH).quantize(Decimal("0.01"))
    if fallback is not None:
        return Decimal(str(fallback)).quantize(Decimal("0.01"))
    return Decimal("0")


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

        # ── 实际项目耗时（月）──
        actual_months = calc_actual_months(
            project.develop_start_date,
            project.actual_delivery_date,
            fallback=float(project.project_cycle_month or 0) if project.project_cycle_month else None,
        )

        # ── 计算奖金分配 ──
        # 规则：UI先按 ui_commission_rate 分走（不论是否有人承担UI角色），
        # 剩余按开发 share_ratio 分配（含负责人）
        is_sub = project.parent_project_id is not None
        commission_pool = calculate_bonus_pool(project.amount, is_sub=is_sub)
        ui_rate = project.ui_commission_rate if project.needs_ui else Decimal("0")

        dev_members = [m for m in members if m.role in ("开发", "负责人", None, "")]
        ui_members = [m for m in members if m.role == "UI"]
        has_ui = project.needs_ui and ui_rate > 0
        is_single = len(dev_members) == 1 and not has_ui

        ui_share = (commission_pool * ui_rate).quantize(Decimal("0.01")) if has_ui else Decimal("0")
        dev_pool = commission_pool - ui_share

        total_dev_ratio = sum((m.share_ratio or Decimal("1")) for m in dev_members) or Decimal("1")

        for m in members:
            m.product_bonus = Decimal("0")
            if is_single:
                m.bonus = commission_pool
            elif m.role == "UI":
                m.bonus = ui_share
            else:
                ratio = (m.share_ratio or Decimal("1")) / total_dev_ratio
                m.bonus = (dev_pool * ratio).quantize(Decimal("0.01"))
        self.db.commit()

        # ── 计算工资/社保成本（按实际耗时）──
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
            try:
                if is_dev:
                    self._ensure_snapshot(project_id, employee)
            except Exception:
                pass

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

            # 开发人员按实际耗时计算工资+社保，非开发人员仅奖金
            if is_dev:
                member_salary_cost = (sal * actual_months * salary_ratio).quantize(Decimal("0.01"))
                member_social_cost = Decimal("0")
                if employee.employment_type == "正式":
                    member_social_cost = (soc * actual_months).quantize(Decimal("0.01"))
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
                "actual_months": float(actual_months),
                "salary_cost": float(member_salary_cost),
                "social_security_cost": float(member_social_cost),
                "bonus": float(member.bonus),
                "product_bonus": float(member.product_bonus),
            })

        # 如果UI份额没有分配给具体成员，仍计入奖金成本
        if not ui_members:
            developer_bonus += ui_share

        total_cost = salary_cost + social_security_cost + developer_bonus + product_bonus

        # Upsert project_costs
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

        effective_revenue = project.amount * Decimal("0.35")
        profit = effective_revenue - total_cost
        profit_rate = float(profit / effective_revenue) if effective_revenue > 0 else 0.0

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
            "actual_months": float(actual_months),
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
