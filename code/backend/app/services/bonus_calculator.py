from decimal import Decimal


# 主体项目阶梯费率
BONUS_RATE_TIERS_MAIN = [
    (Decimal("20000"), Decimal("0.03")),   # ≤2万: 3%
    (Decimal("50000"), Decimal("0.05")),   # 2~5万: 5%
    (Decimal("100000"), Decimal("0.07")),  # 5~10万: 7%
    (Decimal("999999999"), Decimal("0.10")),  # >10万: 10%
]

# 增项阶梯费率（金额较小，费率更高）
BONUS_RATE_TIERS_SUB = [
    (Decimal("50000"), Decimal("0.05")),   # ≤5万: 5%
    (Decimal("100000"), Decimal("0.07")),  # 5~10万: 7%
    (Decimal("999999999"), Decimal("0.10")),  # >10万: 10%
]


def get_bonus_rate(amount: Decimal, is_sub: bool = False) -> Decimal:
    """根据金额返回阶梯奖金比例，增项用更高费率"""
    tiers = BONUS_RATE_TIERS_SUB if is_sub else BONUS_RATE_TIERS_MAIN
    for threshold, rate in tiers:
        if amount <= threshold:
            return rate
    return Decimal("0.10")


def calculate_bonus_pool(amount: Decimal, is_sub: bool = False) -> Decimal:
    """计算开发奖金池"""
    return amount * get_bonus_rate(amount, is_sub)
