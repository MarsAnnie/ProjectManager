from decimal import Decimal


BONUS_RATE_TIERS = [
    (Decimal("20000"), Decimal("0.03")),   # ≤2万: 3%
    (Decimal("50000"), Decimal("0.05")),   # 2~5万: 5%
    (Decimal("100000"), Decimal("0.07")),  # 5~10万: 7%
    (Decimal("999999999"), Decimal("0.10")),  # >10万: 10%
]


def get_bonus_rate(amount: Decimal) -> Decimal:
    """根据项目金额返回阶梯奖金比例"""
    for threshold, rate in BONUS_RATE_TIERS:
        if amount <= threshold:
            return rate
    return Decimal("0.10")


def calculate_bonus_pool(amount: Decimal) -> Decimal:
    """计算开发奖金池 = 项目金额 × 阶梯费率"""
    return amount * get_bonus_rate(amount)
