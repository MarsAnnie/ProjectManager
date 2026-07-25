import { useEffect, useState } from "react";
import { Row, Col, Card, Table, Tag } from "antd";
import ReactECharts from "echarts-for-react";
import api from "../../api/client";

interface DashboardData {
  project_count: number;
  contract_amount: number;
  total_cost: number;
  total_profit: number;
  overall_profit_rate: number;
  unpaid_amount: number;
  payment_rate: number;
  estimated_30day_income: number;
  monthly_distributable: number;
  monthly_profit: number;
  monthly_salary_total: number;
  monthly_commission_total: number;
}

interface ProfitItem {
  id: number;
  project_name: string;
  amount: number;
  total_cost: number;
  profit: number;
  profit_rate: number;
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

const chartTheme = {
  textStyle: { color: "#8b949e" },
  backgroundColor: "transparent",
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [ranking, setRanking] = useState<ProfitItem[]>([]);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
    api.get("/dashboard/profit-ranking?top_n=5&order=desc").then((r) => setRanking(r.data));
  }, []);

  if (!data) return null;

  const statCards = [
    { label: "项目总数", value: data.project_count, color: "#3b82f6" },
    { label: "合同总金额", value: formatMoney(data.contract_amount), color: "#8b5cf6" },
    { label: "项目总成本", value: formatMoney(data.total_cost), color: "#f59e0b" },
    { label: "已实现利润", value: formatMoney(data.total_profit), color: "#2dd4bf" },
    { label: "当月可分款", value: formatMoney(data.monthly_distributable), color: "#a78bfa" },
    { label: "当月利润", value: formatMoney(data.monthly_profit), color: data.monthly_profit >= 0 ? "#2dd4bf" : "#ef4444" },
    { label: "未回款金额", value: formatMoney(data.unpaid_amount), color: "#ef4444" },
    { label: "预计30天收入", value: formatMoney(data.estimated_30day_income), color: "#60a5fa" },
  ];

  const profitColumns = [
    { title: "项目", dataIndex: "project_name", key: "name" },
    {
      title: "金额", dataIndex: "amount", key: "amount",
      render: (v: number) => formatMoney(v),
    },
    {
      title: "利润", dataIndex: "profit", key: "profit",
      render: (v: number) => (
        <span className={v >= 0 ? "profit-positive" : "profit-negative"}>
          {formatMoney(v)}
        </span>
      ),
    },
    {
      title: "利润率", dataIndex: "profit_rate", key: "rate",
      render: (v: number) => (
        <Tag className={v >= 0.2 ? "status-tag-done" : v >= 0 ? "status-tag-progress" : "status-tag-resigned"}>
          {(v * 100).toFixed(1)}%
        </Tag>
      ),
    },
  ];

  const lossColumns = [
    { title: "项目", dataIndex: "project_name", key: "name" },
    {
      title: "亏损", dataIndex: "profit", key: "profit",
      render: (v: number) => <span className="profit-negative">{formatMoney(v)}</span>,
    },
    {
      title: "利润率", dataIndex: "profit_rate", key: "rate",
      render: (v: number) => <Tag className="status-tag-resigned">{(v * 100).toFixed(1)}%</Tag>,
    },
  ];

  const topProfit = ranking.filter((r) => r.profit > 0).slice(0, 5);
  const topLoss = ranking.filter((r) => r.profit < 0).slice(0, 5);

  const barOption = {
    ...chartTheme,
    tooltip: { trigger: "axis" as const },
    xAxis: {
      type: "category" as const,
      data: ranking.slice(0, 10).map((r) => r.project_name),
      axisLabel: { color: "#8b949e", fontSize: 11 },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: "#8b949e", formatter: (v: number) => `${(v / 10000).toFixed(0)}万` },
      splitLine: { lineStyle: { color: "#1e2a3a" } },
    },
    series: [
      {
        name: "利润",
        type: "bar",
        data: ranking.slice(0, 10).map((r) => ({
          value: r.profit,
          itemStyle: { color: r.profit >= 0 ? "#2dd4bf" : "#ef4444" },
        })),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: "#e6edf3" }}>
        经营驾驶舱
      </h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {statCards.map((card) => (
          <Col xs={24} sm={12} lg={8} xl={3} key={card.label}>
            <Card className="glass-card" style={{ borderRadius: 12 }}>
              <div className="stat-label">{card.label}</div>
              <div className="stat-number" style={{ color: card.color }}>
                {card.value}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} lg={14}>
          <Card className="glass-card" title="项目利润排行" style={{ borderRadius: 12 }}>
            <ReactECharts option={barOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="glass-card" title="总体指标" style={{ borderRadius: 12, marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <div className="stat-label">总体利润率</div>
                <div
                  className="stat-number"
                  style={{ color: data.overall_profit_rate >= 0.2 ? "#2dd4bf" : "#ef4444" }}
                >
                  {(data.overall_profit_rate * 100).toFixed(1)}%
                </div>
              </Col>
              <Col span={12}>
                <div className="stat-label">回款率</div>
                <div className="stat-number" style={{ color: "#3b82f6" }}>
                  {(data.payment_rate * 100).toFixed(1)}%
                </div>
              </Col>
            </Row>
          </Card>
          {topLoss.length > 0 && (
            <Card className="glass-card" title="⚠ 亏损项目" style={{ borderRadius: 12 }}>
              <Table
                dataSource={topLoss}
                columns={lossColumns}
                rowKey="id"
                pagination={false}
                size="small"
                style={{ background: "transparent" }}
              />
            </Card>
          )}
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="glass-card" title="赚钱项目 TOP5" style={{ borderRadius: 12 }}>
            <Table
              dataSource={topProfit}
              columns={profitColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="glass-card" title="风险预警" style={{ borderRadius: 12 }}>
            {topLoss.length === 0 ? (
              <p style={{ color: "#2dd4bf" }}>所有项目均处于盈利状态</p>
            ) : (
              topLoss.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid #1e2a3a",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{p.project_name}</span>
                  <span className="profit-negative">
                    亏损 {formatMoney(Math.abs(p.profit))}
                  </span>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
