---
name: projectmanager-overview
description: ProjectManager V1.0.1 个人经营驾驶舱 + 项目利润核算系统，技术栈、部署方式、数据结构总览
metadata:
  type: project
---

ProjectManager V1.1.0 — 个人经营驾驶舱 + 项目利润核算系统。

**Why:** 替代 Excel（云蓬项目.xlsx）管理项目收入、人员成本、利润、交付、回款的全过程数字化。

**技术栈:**
- 前端: React 18 + TypeScript + Vite + Ant Design 5 + ECharts
- 后端: Python FastAPI + SQLAlchemy 2.0
- 数据库: MySQL 8.0（Docker），兼容 SQLite 开发
- 部署: Docker Compose（pm-db, pm-backend, pm-frontend, Nginx :80 代理）

**启动:** `cd code && docker compose up -d`
**前端:** http://localhost
**API文档:** http://localhost:8000/docs

**模块:**
- Dashboard 经营驾驶舱（8张指标卡片 + 利润排行 + 风险预警 + 当月经营利润=尾款×35%-成本）
- 项目管理（增项/子项目、状态自动推进、成本计算下钻、报价健康检查、回款比例模板）
- 人员管理（开发/UI/商务三Tab、统计卡片筛选、试用期80%工资）
- 成本计算引擎（实际时间=交付-开发/30.44天、历史快照、阶梯奖金费率）
- 回款管理（5状态机、自动逾期判定、回款比例模板+进度追踪+阶段达标提示）
- Excel 导入（增项识别、多阶段回款解析）
- 提成分配引擎（UI先扣除→开发池按share_ratio分配，含负责人）

**数据:** 32主项目 + 16增项 + 11员工 + 85回款记录（来自 云蓬项目.xlsx）
