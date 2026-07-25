import datetime
from sqlalchemy import (
    Column, Integer, String, Date, DateTime,
    DECIMAL, Boolean, Text, ForeignKey, Float
)
from sqlalchemy.orm import relationship, backref

from app.database.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, comment="姓名")
    position = Column(String(50), comment="岗位")
    level = Column(String(50), comment="级别")
    hire_date = Column(Date, comment="入职时间")
    status = Column(String(20), default="在职", comment="在职/离职")
    employment_type = Column(String(20), default="正式", comment="正式/试用/实习")
    salary = Column(DECIMAL(10, 2), default=0, comment="工资")
    guarantee = Column(DECIMAL(10, 2), default=0, comment="保底")
    social_security = Column(DECIMAL(10, 2), default=0, comment="社保")
    remark = Column(Text, comment="备注")
    deleted_at = Column(DateTime, nullable=True, comment="软删除时间")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    project_members = relationship("ProjectMember", back_populates="employee")


class BusinessManager(Base):
    __tablename__ = "business_managers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, comment="姓名")
    phone = Column(String(30), comment="电话")
    remark = Column(Text, comment="备注")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    projects = relationship("ProjectBusinessManager", back_populates="business_manager")


class ProjectBusinessManager(Base):
    __tablename__ = "project_business_managers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    business_manager_id = Column(Integer, ForeignKey("business_managers.id"), nullable=False)
    share_ratio = Column(DECIMAL(3, 2), comment="分成比例(0.5=50%)")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="business_manager_links")
    business_manager = relationship("BusinessManager")


class UIPerson(Base):
    __tablename__ = "ui_persons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, comment="姓名")
    remark = Column(Text, comment="备注")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(100), nullable=False, comment="项目名称")
    customer_name = Column(String(100), comment="客户名称")
    amount = Column(DECIMAL(12, 2), default=0, comment="合同金额")
    region = Column(String(50), comment="地区")
    business_manager_id = Column(Integer, ForeignKey("business_managers.id"), comment="商务经理")
    status = Column(String(30), default="待签约", comment="项目状态")
    project_cycle_month = Column(DECIMAL(5, 2), comment="项目周期(月)")
    work_days = Column(Integer, comment="工期(工作日)")
    parent_project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, comment="父项目ID(增项)")
    contract_date = Column(Date, comment="签约时间")
    ui_confirm_date = Column(Date, comment="UI确认时间")
    develop_start_date = Column(Date, comment="开发开始时间")
    theoretical_delivery_date = Column(Date, comment="理论交付时间")
    actual_delivery_date = Column(Date, comment="实际交付时间")
    acceptance_date = Column(Date, comment="验收时间")
    ui_person_name = Column(String(50), comment="UI负责人")
    ui_commission_rate = Column(DECIMAL(3, 2), comment="UI提成比例(0.05/0.07/0.10)")
    needs_ui = Column(Boolean, default=False, comment="是否需要UI")
    notes = Column(Text, comment="备注(上架/要求等)")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    business_manager_links = relationship("ProjectBusinessManager", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project")
    costs = relationship("ProjectCost", back_populates="project")
    payments = relationship("Payment", back_populates="project")
    snapshots = relationship("CostSnapshot", back_populates="project")
    children = relationship(
        "Project",
        backref=backref("parent", remote_side=[id]),
        foreign_keys="Project.parent_project_id",
    )


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    role = Column(String(50), comment="角色: 负责人/UI/开发")
    share_ratio = Column(DECIMAL(5, 2), default=1, comment="分成比例(0.5=50%)")
    input_month = Column(DECIMAL(5, 2), default=0, comment="投入月份(git集成后自动)")
    input_days = Column(Integer, default=0, comment="投入天数(git集成后自动)")
    bonus = Column(DECIMAL(10, 2), default=0, comment="开发奖金(计算结果)")
    product_bonus = Column(DECIMAL(10, 2), default=0, comment="产品提成(计算结果)")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="members")
    employee = relationship("Employee", back_populates="project_members")


class ProjectCost(Base):
    __tablename__ = "project_costs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    salary_cost = Column(DECIMAL(12, 2), default=0, comment="工资成本")
    social_security_cost = Column(DECIMAL(12, 2), default=0, comment="社保成本")
    developer_bonus = Column(DECIMAL(12, 2), default=0, comment="开发奖金")
    product_bonus = Column(DECIMAL(12, 2), default=0, comment="产品提成")
    total_cost = Column(DECIMAL(12, 2), default=0, comment="总成本")
    calculated_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="costs")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    payment_amount = Column(DECIMAL(12, 2), default=0, comment="回款金额")
    expected_payment_date = Column(Date, comment="预计回款日期")
    actual_payment_date = Column(Date, comment="实际到账日期")
    payment_stage = Column(Integer, default=1, comment="回款阶段")
    status = Column(String(20), default="待回款", comment="待回款/已申请/已到账/逾期/取消")
    remark = Column(Text, comment="备注")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="payments")


class CostSnapshot(Base):
    __tablename__ = "cost_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    snapshot_date = Column(Date, default=datetime.date.today, comment="快照日期")
    salary_at_snapshot = Column(DECIMAL(10, 2), default=0, comment="当时工资")
    social_security_at_snapshot = Column(DECIMAL(10, 2), default=0, comment="当时社保")
    guarantee_at_snapshot = Column(DECIMAL(10, 2), default=0, comment="当时保底")

    project = relationship("Project", back_populates="snapshots")
    employee = relationship("Employee")


class CostRule(Base):
    __tablename__ = "cost_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_name = Column(String(50), nullable=False, comment="规则名称")
    rule_value = Column(String(100), comment="规则值")
    enabled = Column(Boolean, default=True, comment="是否启用")
    remark = Column(Text, comment="备注")


class WorkCalendar(Base):
    __tablename__ = "work_calendar"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, unique=True, comment="日期")
    is_workday = Column(Boolean, default=True, comment="是否工作日")
    remark = Column(String(100), comment="备注")


class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_key = Column(String(50), nullable=False, unique=True, comment="配置键")
    config_value = Column(Text, comment="配置值")


class ProjectLog(Base):
    __tablename__ = "project_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), comment="项目ID")
    action = Column(String(100), comment="操作类型")
    detail = Column(Text, comment="操作详情")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
