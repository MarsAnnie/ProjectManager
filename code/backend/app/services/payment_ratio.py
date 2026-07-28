"""回款比例模板 — 动态解析任意付款节奏（如 532/32221/7111），自动生成阶段名称与预期金额"""

from decimal import Decimal
from typing import List, Optional

# 阶段命名: 首期款 → 二款/三款/四款... → 尾款
_STAGE_MIDDLE_NAMES = ["", "二款", "三款", "四款", "五款"]


def _parse_ratio_string(ratio_key: str) -> Optional[List[dict]]:
    """
    动态解析比例字符串，如 "532"→[50%,30%,20%], "32221"→[30%,20%,20%,20%,10%]。

    规则: 每位数字 = 比例×10%，所有位之和必须等于 10（100%）。
    返回 stage 列表，解析失败返回 None。
    """
    if not ratio_key or not ratio_key.isdigit():
        return None
    digits = [int(ch) for ch in ratio_key]
    if sum(digits) != 10:
        return None
    n = len(digits)
    # 阶段命名: 第1期=首期款, 最后一期=尾款, 中间=二款/三款/四款...
    if n == 1:
        names = ["全款"]
    elif n == 2:
        names = ["首期款", "尾款"]
    else:
        names = ["首期款"]
        for i in range(1, n - 1):
            if i < len(_STAGE_MIDDLE_NAMES):
                names.append(_STAGE_MIDDLE_NAMES[i])
            else:
                names.append(f"第{i+1}期款")
        names.append("尾款")

    return [
        {"stage": i + 1, "name": names[i], "ratio": Decimal(d) / Decimal(10)}
        for i, d in enumerate(digits)
    ]


def is_valid_ratio(ratio_key: str) -> bool:
    """校验比例字符串是否合法"""
    return _parse_ratio_string(ratio_key) is not None


# 常用预设（前端快捷选择），其余任意合法字符串均可直接输入
_RATIO_PRESETS = ["55", "532", "442", "622", "4321", "3331", "3322", "3232"]


def get_ratio_options() -> List[dict]:
    """获取预设比例模板列表（供前端下拉框参考）"""
    result = []
    for key in _RATIO_PRESETS:
        stages = _parse_ratio_string(key)
        if stages:
            result.append({"value": key, "label": key, "stages": len(stages)})
    return result


def calc_payment_progress(ratio_key: str, total_amount: Decimal, payments: list) -> Optional[dict]:
    """
    计算回款进度。

    参数:
        ratio_key: 比例字符串 (如 "532"/"32221")
        total_amount: 项目合同总额
        payments: Payment ORM 对象列表

    返回:
        {
            "ratio_key": "532",
            "total_amount": float,
            "total_paid": float,
            "total_paid_pct": float,
            "stages": [{stage, name, ratio, expected_amount, paid_amount, paid_pct, reached}, ...],
            "current_stage": int,
            "next_prompt": str | None,
        }
    """
    template = _parse_ratio_string(ratio_key)
    if not template:
        return None

    total_paid = sum(
        (p.payment_amount for p in payments if p.status == "已到账"),
        Decimal("0"),
    )
    total_paid_pct = float(total_paid / total_amount) if total_amount > 0 else 0.0

    stages = []
    next_prompt = None

    for t in template:
        expected_amount = (total_amount * t["ratio"]).quantize(Decimal("0.01"))
        stage_payments = [
            p for p in payments
            if p.payment_stage == t["stage"] and p.status == "已到账"
        ]
        paid_amount = sum((p.payment_amount for p in stage_payments), Decimal("0"))
        paid_pct = float(paid_amount / expected_amount) if expected_amount > 0 else 0.0
        reached = paid_pct >= 0.95

        stages.append({
            "stage": t["stage"],
            "name": t["name"],
            "ratio": float(t["ratio"]),
            "expected_amount": float(expected_amount),
            "paid_amount": float(paid_amount),
            "paid_pct": round(paid_pct * 100, 1),
            "reached": reached,
        })

    # 判断当前阶段和下一阶段提示
    for i, s in enumerate(stages):
        if not s["reached"]:
            if i == 0:
                next_prompt = f"首期款尚差 ¥{s['expected_amount'] - s['paid_amount']:,.0f}，请跟进"
            else:
                prev_name = stages[i - 1]["name"]
                next_prompt = f"✓ {prev_name}已到账，可推进到{s['name']}阶段"
            return {
                "ratio_key": ratio_key,
                "total_amount": float(total_amount),
                "total_paid": float(total_paid),
                "total_paid_pct": round(total_paid_pct * 100, 1),
                "stages": stages,
                "current_stage": s["stage"],
                "next_prompt": next_prompt,
            }

    # 全部达标
    return {
        "ratio_key": ratio_key,
        "total_amount": float(total_amount),
        "total_paid": float(total_paid),
        "total_paid_pct": round(total_paid_pct * 100, 1),
        "stages": stages,
        "current_stage": len(stages) + 1,
        "next_prompt": "✓ 全部回款已完成",
    }
