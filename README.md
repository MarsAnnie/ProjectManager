# ProjectManager

个人经营驾驶舱 + 项目利润核算系统。替代 Excel 项目管理方式，实现项目收入、人员成本、利润、交付、回款的全过程数字化管理。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + TypeScript + Ant Design 5 + ECharts |
| 后端 | Python FastAPI + SQLAlchemy 2.0 |
| 数据库 | MySQL 8.0（兼容 SQLite） |
| 部署 | Docker Compose |

## 快速启动

```bash
# Docker（推荐）
docker compose up -d

# 或开发模式
cd backend && pip install -r requirements.txt && python -m uvicorn main:app --port 8000
cd frontend && npm install && npx vite --port 5173
```

启动后访问：
- 前端：`http://localhost`
- API 文档：`http://localhost:8000/docs`

## 导入数据

```bash
curl -X POST http://localhost/api/import/excel -F "file=@云蓬项目.xlsx"
```

## 核心功能

- 经营驾驶舱：6 张核心指标卡片 + 利润排行 + 风险预警
- 项目管理：支持增项/子项目（parent_project_id）、状态自动推进、报价健康检查
- 人员管理：员工薪资、保底、社保，项目投入记录
- 成本计算引擎：基于实际工资×投入时间的精确成本核算，历史成本快照防污染
- 回款管理：5 状态机（待回款→已申请→已到账/逾期/取消）
- Excel 导入：自动解析增项、阶梯奖金费率（3%/5%/7%/10%）、多阶段回款

## 成本模型

```
项目实际成本 = 工资成本 + 社保成本 + 开发奖金 + 产品提成
项目利润     = 项目金额 - 项目实际成本
```

保底补差不计入项目成本，独立为月度薪酬结算模块（Phase 3）。
