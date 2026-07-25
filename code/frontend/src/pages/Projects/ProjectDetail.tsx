import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Descriptions, Tag, Button, Table, Spin, Row, Col, Timeline,
  Modal, Form, Select, InputNumber, message, Steps
} from "antd";
import api from "../../api/client";

const formatMoney = (v: number) => `¥${Number(v || 0).toLocaleString()}`;

const STATUS_STEPS = [
  "待签约", "已签约", "UI确认", "开发中", "测试", "待验收", "已交付", "完成"
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberOpen, setMemberOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [memberForm] = Form.useForm();
  const [costData, setCostData] = useState<any>(null);

  const fetchProject = () => {
    api.get(`/projects/${id}`).then((r) => {
      setProject(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchProject();
    api.get("/employees").then((r) => setEmployees(r.data));
  }, [id]);

  const calcCost = async () => {
    const r = await api.post(`/projects/${id}/calculate-cost`);
    setCostData(r.data);
    message.success("成本计算完成");
    fetchProject();
  };

  const addMember = async () => {
    const values = await memberForm.validateFields();
    await api.post(`/projects/${id}/members`, { ...values, project_id: Number(id) });
    message.success("成员已添加");
    setMemberOpen(false);
    memberForm.resetFields();
    fetchProject();
  };

  const removeMember = async (memberId: number) => {
    await api.delete(`/projects/${id}/members/${memberId}`);
    message.success("已移除");
    fetchProject();
  };

  if (loading) return <Spin />;
  if (!project) return <p>项目不存在</p>;

  const currentStep = STATUS_STEPS.indexOf(project.status);

  const memberColumns = [
    { title: "员工", dataIndex: ["employee", "name"], key: "emp" },
    { title: "角色", dataIndex: "role", key: "role" },
    { title: "投入(月)", dataIndex: "input_month", key: "month" },
    {
      title: "开发奖金", dataIndex: "bonus", key: "bonus",
      render: (v: number) => formatMoney(v),
    },
    {
      title: "产品提成", dataIndex: "product_bonus", key: "pb",
      render: (v: number) => formatMoney(v),
    },
    {
      title: "操作", key: "actions",
      render: (_: any, r: any) => (
        <Button type="link" danger size="small" onClick={() => removeMember(r.id)}>移除</Button>
      ),
    },
  ];

  const costColumns = [
    { title: "成本项", dataIndex: "label", key: "label" },
    {
      title: "金额", dataIndex: "value", key: "value",
      render: (v: number) => formatMoney(v),
    },
  ];

  const costTableData = costData
    ? [
        { label: "工资成本", value: costData.salary_cost },
        { label: "社保成本", value: costData.social_security_cost },
        { label: "开发奖金", value: costData.developer_bonus },
        { label: "产品提成", value: costData.product_bonus },
        { label: "总成本", value: costData.total_cost },
        { label: "项目利润", value: costData.profit },
      ]
    : [];

  return (
    <div>
      <Button onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← 返回</Button>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="glass-card" style={{ borderRadius: 12, marginBottom: 16 }}>
            <Descriptions title="项目信息" column={2} size="small">
              <Descriptions.Item label="项目名称">{project.project_name}</Descriptions.Item>
              <Descriptions.Item label="客户">{project.customer_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="合同金额">{formatMoney(project.amount)}</Descriptions.Item>
              <Descriptions.Item label="地区">{project.region || "-"}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={project.status === "完成" ? "green" : "blue"}>{project.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="周期">{String(project.project_cycle_month || "-")}月</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Steps
                current={currentStep >= 0 ? currentStep : 0}
                status={currentStep >= STATUS_STEPS.length - 1 ? "finish" : "process"}
                size="small"
                items={STATUS_STEPS.map((s) => ({ title: s }))}
              />
            </div>
          </Card>

          {project.children && project.children.length > 0 && (
            <Card
              className="glass-card"
              title={
                <span>
                  <Tag color="orange" style={{ marginRight: 8 }}>增项</Tag>
                  共 {project.children.length} 个增项
                </span>
              }
              style={{
                borderRadius: 12, marginBottom: 16,
                borderLeft: "3px solid #f59e0b",
              }}
            >
              {project.children.map((child: any) => (
                <div
                  key={child.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #1e2a3a",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <a onClick={() => navigate(`/projects/${child.id}`)} style={{ fontSize: 14 }}>
                      {child.project_name}
                    </a>
                    <Tag style={{ marginLeft: 8 }}>{child.status}</Tag>
                  </div>
                  <span style={{ fontWeight: 600 }}>{formatMoney(child.amount)}</span>
                </div>
              ))}
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: "1px solid #f59e0b",
                display: "flex", justifyContent: "space-between", fontWeight: 700,
              }}>
                <span style={{ color: "#f59e0b" }}>增项合计</span>
                <span style={{ color: "#f59e0b" }}>
                  {formatMoney(project.children.reduce((sum: number, c: any) =>
                    sum + Number(c.amount), 0))}
                </span>
              </div>
            </Card>
          )}

          <Card
            className="glass-card"
            title="参与人员"
            extra={<Button size="small" onClick={() => setMemberOpen(true)}>+ 添加</Button>}
            style={{ borderRadius: 12, marginBottom: 16 }}
          >
            <Table dataSource={project.members || []} columns={memberColumns} rowKey="id" size="small" pagination={false} />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            className="glass-card"
            title="成本分析"
            extra={<Button size="small" type="primary" onClick={calcCost}>计算成本</Button>}
            style={{ borderRadius: 12, marginBottom: 16 }}
          >
            {costTableData.length > 0 ? (
              <Table dataSource={costTableData} columns={costColumns} rowKey="label" size="small" pagination={false} showHeader={false} />
            ) : (
              <p style={{ color: "#8b949e" }}>点击"计算成本"按钮进行成本分析</p>
            )}
            {costData && (
              <div style={{ marginTop: 12, padding: 12, background: "rgba(45,212,191,0.1)", borderRadius: 8 }}>
                <span>利润率：</span>
                <strong style={{ color: costData.profit_rate >= 0.2 ? "#2dd4bf" : "#ef4444", fontSize: 18 }}>
                  {(costData.profit_rate * 100).toFixed(1)}%
                </strong>
              </div>
            )}
          </Card>

          <Card className="glass-card" title="时间节点" style={{ borderRadius: 12 }}>
            <Timeline
              items={[
                { children: `签约: ${project.contract_date || "-"}`, color: project.contract_date ? "green" : "gray" },
                { children: `UI确认: ${project.ui_confirm_date || "-"}`, color: project.ui_confirm_date ? "green" : "gray" },
                { children: `开发开始: ${project.develop_start_date || "-"}`, color: project.develop_start_date ? "blue" : "gray" },
                { children: `理论交付: ${project.theoretical_delivery_date || "-"}`, color: project.theoretical_delivery_date ? "blue" : "gray" },
                { children: `实际交付: ${project.actual_delivery_date || "-"}`, color: project.actual_delivery_date ? "green" : "gray" },
                { children: `验收: ${project.acceptance_date || "-"}`, color: project.acceptance_date ? "green" : "gray" },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="添加项目成员"
        open={memberOpen}
        onOk={addMember}
        onCancel={() => setMemberOpen(false)}
        okText="确认"
        cancelText="取消"
      >
        <Form form={memberForm} layout="vertical">
          <Form.Item name="employee_id" label="员工" rules={[{ required: true }]}>
            <Select options={employees.map((e: any) => ({ value: e.id, label: e.name }))} />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select options={[
              { value: "开发", label: "开发" },
              { value: "设计", label: "设计" },
              { value: "产品", label: "产品" },
              { value: "测试", label: "测试" },
            ]} />
          </Form.Item>
          <Form.Item name="input_month" label="投入月份" initialValue={0.5}>
            <InputNumber min={0} step={0.1} />
          </Form.Item>
          <Form.Item name="bonus" label="开发奖金" initialValue={0}>
            <InputNumber min={0} prefix="¥" />
          </Form.Item>
          <Form.Item name="product_bonus" label="产品提成" initialValue={0}>
            <InputNumber min={0} prefix="¥" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
