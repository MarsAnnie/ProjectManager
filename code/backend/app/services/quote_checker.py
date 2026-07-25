from decimal import Decimal
from app.schemas.schemas import QuoteHealthRequest, QuoteHealthResponse

DAILY_RATES = {
    "高级": Decimal("600"),
    "中级": Decimal("400"),
    "初级": Decimal("250"),
}

SOCIAL_SECURITY_RATIO = Decimal("0.16")


def check_quote_health(data: QuoteHealthRequest) -> QuoteHealthResponse:
    daily_rate = DAILY_RATES.get(data.developer_level, Decimal("400"))
    estimated_cost = daily_rate * data.expected_days * data.developer_count
    estimated_cost = estimated_cost * (1 + SOCIAL_SECURITY_RATIO)

    healthy_min = estimated_cost * Decimal("1.4")
    breakeven = estimated_cost

    if data.amount >= healthy_min:
        status, label = "healthy", "健康"
    elif data.amount >= breakeven:
        status, label = "warning", "偏低"
    else:
        status, label = "danger", "亏损风险"

    return QuoteHealthResponse(
        estimated_cost=estimated_cost,
        suggested_min_price=healthy_min,
        health_status=status,
        health_label=label,
    )
