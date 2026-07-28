from app.models.models import Project


def auto_advance_status(project: Project) -> Project:
    """根据已填时间节点自动推进项目状态。"""
    if project.acceptance_date:
        project.status = "已分成"
    elif project.actual_delivery_date:
        project.status = "已交付"
    elif project.ui_confirm_date:
        project.status = "UI确认"

    if project.develop_start_date is None and project.ui_confirm_date:
        project.develop_start_date = project.ui_confirm_date

    if project.theoretical_delivery_date is None and project.ui_confirm_date and project.project_cycle_month:
        import datetime
        days = int(float(project.project_cycle_month) * 22)
        project.theoretical_delivery_date = project.ui_confirm_date + datetime.timedelta(days=days)

    return project
