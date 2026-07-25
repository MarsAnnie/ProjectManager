import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Employee ──

class EmployeeBase(BaseModel):
    name: str
    position: Optional[str] = None
    level: Optional[str] = None
    hire_date: Optional[datetime.date] = None
    status: str = "在职"
    employment_type: str = "正式"
    salary: Decimal = Field(default=0, max_digits=10, decimal_places=2)
    guarantee: Decimal = Field(default=0, max_digits=10, decimal_places=2)
    social_security: Decimal = Field(default=0, max_digits=10, decimal_places=2)
    remark: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    level: Optional[str] = None
    hire_date: Optional[datetime.date] = None
    status: Optional[str] = None
    employment_type: Optional[str] = None
    salary: Optional[Decimal] = None
    guarantee: Optional[Decimal] = None
    social_security: Optional[Decimal] = None
    remark: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: int
    deleted_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}


# ── Business Manager ──

class BusinessManagerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    remark: Optional[str] = None


class BusinessManagerCreate(BusinessManagerBase):
    pass


class BusinessManagerResponse(BusinessManagerBase):
    id: int
    model_config = {"from_attributes": True}


# ── Project ──

class ProjectBase(BaseModel):
    project_name: str
    customer_name: Optional[str] = None
    amount: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    region: Optional[str] = None
    business_manager_id: Optional[int] = None
    status: str = "待签约"
    project_cycle_month: Optional[Decimal] = None
    parent_project_id: Optional[int] = None
    contract_date: Optional[datetime.date] = None
    ui_confirm_date: Optional[datetime.date] = None
    develop_start_date: Optional[datetime.date] = None
    theoretical_delivery_date: Optional[datetime.date] = None
    actual_delivery_date: Optional[datetime.date] = None
    acceptance_date: Optional[datetime.date] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    customer_name: Optional[str] = None
    amount: Optional[Decimal] = None
    region: Optional[str] = None
    business_manager_id: Optional[int] = None
    status: Optional[str] = None
    project_cycle_month: Optional[Decimal] = None
    parent_project_id: Optional[int] = None
    contract_date: Optional[datetime.date] = None
    ui_confirm_date: Optional[datetime.date] = None
    develop_start_date: Optional[datetime.date] = None
    theoretical_delivery_date: Optional[datetime.date] = None
    actual_delivery_date: Optional[datetime.date] = None
    acceptance_date: Optional[datetime.date] = None


class ProjectResponse(ProjectBase):
    id: int
    deleted_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    business_manager: Optional[BusinessManagerResponse] = None
    children: list["ProjectResponse"] = []

    model_config = {"from_attributes": True}


class ProjectDetailResponse(ProjectResponse):
    members: List["ProjectMemberResponse"] = []
    costs: List["ProjectCostResponse"] = []
    payments: List["PaymentResponse"] = []
    children: List[ProjectResponse] = []


# ── Project Member ──

class ProjectMemberBase(BaseModel):
    project_id: int
    employee_id: int
    role: Optional[str] = None
    input_month: Decimal = Field(default=0, max_digits=5, decimal_places=2)
    input_days: int = 0
    bonus: Decimal = Field(default=0, max_digits=10, decimal_places=2)
    product_bonus: Decimal = Field(default=0, max_digits=10, decimal_places=2)


class ProjectMemberCreate(ProjectMemberBase):
    pass


class ProjectMemberResponse(ProjectMemberBase):
    id: int
    employee: Optional[EmployeeResponse] = None

    model_config = {"from_attributes": True}


# ── Project Cost ──

class ProjectCostResponse(BaseModel):
    id: int
    project_id: int
    salary_cost: Decimal
    social_security_cost: Decimal
    developer_bonus: Decimal
    product_bonus: Decimal
    total_cost: Decimal
    calculated_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}


# ── Payment ──

class PaymentBase(BaseModel):
    project_id: int
    payment_amount: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    expected_payment_date: Optional[datetime.date] = None
    actual_payment_date: Optional[datetime.date] = None
    payment_stage: int = 1
    status: str = "待回款"
    remark: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    payment_amount: Optional[Decimal] = None
    expected_payment_date: Optional[datetime.date] = None
    actual_payment_date: Optional[datetime.date] = None
    payment_stage: Optional[int] = None
    status: Optional[str] = None
    remark: Optional[str] = None


class PaymentResponse(PaymentBase):
    id: int
    created_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}


# ── Dashboard ──

class DashboardResponse(BaseModel):
    project_count: int = 0
    contract_amount: Decimal = Field(default=0, max_digits=14, decimal_places=2)
    total_cost: Decimal = Field(default=0, max_digits=14, decimal_places=2)
    total_profit: Decimal = Field(default=0, max_digits=14, decimal_places=2)
    overall_profit_rate: float = 0.0
    unpaid_amount: Decimal = Field(default=0, max_digits=14, decimal_places=2)
    payment_rate: float = 0.0
    estimated_30day_income: Decimal = Field(default=0, max_digits=14, decimal_places=2)


# ── Quote Health Check ──

class QuoteHealthRequest(BaseModel):
    amount: Decimal
    expected_days: int
    developer_level: str = "中级"
    developer_count: int = 1


class QuoteHealthResponse(BaseModel):
    estimated_cost: Decimal
    suggested_min_price: Decimal
    health_status: str  # healthy / warning / danger
    health_label: str


# ── Project Profit Ranking ──

class ProjectProfitItem(BaseModel):
    id: int
    project_name: str
    amount: Decimal
    total_cost: Decimal
    profit: Decimal
    profit_rate: float

    model_config = {"from_attributes": True}
