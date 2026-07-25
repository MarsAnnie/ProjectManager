import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Descriptions, Tag, Button, Table, Spin, Row, Col, Timeline,
  Modal, Form, Select, InputNumber, Input, message, Steps
} from "antd";
import api from "../../api/client";

const formatMoney = (v: number) => `¥${Number(v || 0).toLocaleString()}`;

const STATUS_STEPS = [
  "待签约", "已签约", "UI确认", "开发中", "测试", "待验收", "已交付", "完成"
];

const STATUS_CLS: Record<string, string> = {
  "完成": "status-tag-done", "已交付": "status-tag-done",
  "开发中": "status-tag-progress", "开发准备": "status-tag-progress", "UI确认": "status-tag-progress",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberOpen, setMemberOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [memberForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [costData, setCostData] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const fetchProject = () => {
    api.get(`/projects/${id}`).then((r) => {
      setProject(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchProject();
    api.get("/employees", { params: { page_size: 200 } }).then((r) => {
      setEmployees(r.data.items || []);
    });
  }, [id]);

  const calcCost = async () => {
    setCalcLoading(true);
    const r = await api.post(`/projects/${id}/calculate-cost`);
    setCostData(r.data);
    setCalcLoading(false);
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

  const handleEdit = async () => {
    const values = await editForm.validateFields();
    await api.put(`/projects/${id}`, values);
    message.success("已更新");
    setEditOpen(false);
    fetchProject();
  };

  if (loading) return <Spin />;
  if (!project) return <p>项目不存在</p>;

  const currentStep = STATUS_STEPS.indexOf(project.status);
  const statusCls = STATUS_CLS[project.status] || "status-tag-pending";

  const memberColumns = [
    { title: "员工", dataIndex: ["employee", "name"], key: "emp" },
    { title: "角色", dataIndex: "role", key: "role" },
    { title: "投入(月)", dataIndex: "input_month", key: "month" },
    { title: "投入(天)", dataIndex: "input_days", key: "days" },
    { title: "开发奖金", dataIndex: "bonus", key: "bonus", render: (v: number) => formatMoney(v) },
    { title: "产品提成", dataIndex: "product_bonus", key: "pb", render: (v: number) => formatMoney(v) },
    { title: "操作", key: "actions", render: (_: any, r: any) => (
      <Button type="link" danger size="small" onClick={() => removeMember(r.id)}>移除</Button>
    )},
  ];

  // Cost summary table
  const costSummary = costData
    ? [
        { label: "工资成本", value: costData.salary_cost, color: "#60a5fa" },
        { label: "社保成本", value: costData.social_security_cost, color: "#a78bfa" },
        { label: "开发奖金", value: costData.developer_bonus, color: "#f59e0b" },
        { label: "产品提成", value: costData.product_bonus, color: "#f97316" },
        { label: "总成本", value: costData.total_cost, color: "#ef4444", bold: true },
        { label: "项目收入", value: Number(project.amount), color: "#2dd4bf", bold: true },
        { label: "项目利润", value: costData.profit, color: costData.profit >= 0 ? "#2dd4bf" : "#ef4444", bold: true },
      ]
    : [];

  // Per-person cost detail
  const detailColumns = [
    { title: "员工", dataIndex: "employee_name", key: "name" },
    { title: "工资成本", dataIndex: "salary_cost", key: "sc", render: (v: number) => formatMoney(v) },
    { title: "社保成本", dataIndex: "social_security_cost", key: "ss", render: (v: number) => formatMoney(v) },
    { title: "奖金", dataIndex: "bonus", key: "bo", render: (v: number) => formatMoney(v) },
    { title: "提成", dataIndex: "product_bonus", key: "pb", render: (v: number) => formatMoney(v) },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Button onClick={() => navigate(-1)}>← 返回</Button>
        <Button onClick={() => {
          editForm.setFieldsValue(project);
          setEditOpen(true);
        }}>✎ 编辑</Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="glass-card" style={{ borderRadius: 12, marginBottom: 16 }}>
            <Descriptions title="项目信息" column={2} size="small" bordered>
              <Descriptions.Item label="项目名称">{project.project_name}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{project.customer_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="合同金额">
                <strong>{formatMoney(project.amount)}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="地区">{project.region || "-"}</Descriptions.Item>
              <Descriptions.Item label="项目状态">
                <Tag className={statusCls}>{project.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="项目周期">{project.project_cycle_month || "-"} 月</Descriptions.Item>
              <Descriptions.Item label="商务经理">
                {project.business_manager?.name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="签约时间">{project.contract_date || "-"}</Descriptions.Item>
              <Descriptions.Item label="UI确认">{project.ui_confirm_date || "-"}</Descriptions.Item>
              <Descriptions.Item label="开发开始">{project.develop_start_date || "-"}</Descriptions.Item>
              <Descriptions.Item label="理论交付">{project.theoretical_delivery_date || "-"}</Descriptions.Item>
              <Descriptions.Item label="实际交付">{project.actual_delivery_date || "-"}</Descriptions.Item>
              <Descriptions.Item label="验收时间">{project.acceptance_date || "-"}</Descriptions.Item>
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
              title={<span><Tag color="orange" style={{ marginRight: 8 }}>增项</Tag>共 {project.children.length} 个增项</span>}
              style={{ borderRadius: 12, marginBottom: 16, borderLeft: "3px solid #f59e0b" }}
            >
              {project.children.map((child: any) => (
                <div key={child.id} style={{ padding: "10px 0", borderBottom: "1px solid #1e2a3a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <a onClick={() => navigate(`/projects/${child.id}`)} style={{ fontSize: 14 }}>{child.project_name}</a>
                    <Tag className={STATUS_CLS[child.status] || "status-tag-pending"} style={{ marginLeft: 8 }}>{child.status}</Tag>
                  </div>
                  <span style={{ fontWeight: 600 }}>{formatMoney(child.amount)}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f59e0b", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span style={{ color: "#f59e0b" }}>增项合计</span>
                <span style={{ color: "#f59e0b" }}>{formatMoney(project.children.reduce((s: number, c: any) => s + Number(c.amount), 0))}</span>
              </div>
            </Card>
          )}

          <Card className="glass-card" title="参与人员" extra={<Button size="small" onClick={() => setMemberOpen(true)}>+ 添加</Button>}
            style={{ borderRadius: 12, marginBottom: 16 }}>
            <Table dataSource={project.members || []} columns={memberColumns} rowKey="id" size="small" pagination={false} />
          </Card>

          <Card className="glass-card" title="回款记录" style={{ borderRadius: 12, marginBottom: 16 }}>
            {(project.payments && project.payments.length > 0) ? (
              <Table
                dataSource={project.payments}
                columns={[
                  { title: "阶段", dataIndex: "payment_stage", key: "s" },
                  { title: "金额", dataIndex: "payment_amount", key: "a", render: (v: number) => formatMoney(v) },
                  { title: "预计日期", dataIndex: "expected_payment_date", key: "ed", render: (v: any) => v || "-" },
                  { title: "到账日期", dataIndex: "actual_payment_date", key: "ad", render: (v: any) => v || "-" },
                  { title: "状态", dataIndex: "status", key: "st", render: (v: string) => {
                    const cls = v === "已到账" ? "status-tag-done" : v === "逾期" ? "status-tag-resigned" : "status-tag-pending";
                    return <Tag className={cls}>{v}</Tag>;
                  }},
                ]}
                rowKey="id" size="small" pagination={false}
              />
            ) : <p style={{ color: "#8b949e" }}>暂无回款记录</p>}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card className="glass-card" title="成本分析" extra={<Button size="small" type="primary" loading={calcLoading} onClick={calcCost}>计算成本</Button>}
            style={{ borderRadius: 12, marginBottom: 16 }}>
            {costSummary.length > 0 ? (
              <>
                {costSummary.map((item) => (
                  <div key={item.label} style={{
                    display: "flex", justifyContent: "space-between", padding: "8px 0",
                    borderBottom: "1px solid #1e2a3a", fontWeight: item.bold ? 700 : 400,
                  }}>
                    <span>{item.label}</span>
                    <span style={{ color: item.color, fontVariantNumeric: "tabular-nums" }}>{formatMoney(item.value)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: 12, background: "rgba(45,212,191,0.1)", borderRadius: 8 }}>
                  <span>利润率：</span>
                  <strong style={{ color: costData.profit_rate >= 0.2 ? "#2dd4bf" : "#ef4444", fontSize: 18 }}>
                    {(costData.profit_rate * 100).toFixed(1)}%
                  </strong>
                </div>
              </>
            ) : <p style={{ color: "#8b949e" }}>点击"计算成本"查看成本分析</p>}
          </Card>

          {costData?.detail && costData.detail.length > 0 && (
            <Card className="glass-card" title="人均成本明细" style={{ borderRadius: 12, marginBottom: 16 }}>
              <Table dataSource={costData.detail} columns={detailColumns} rowKey="employee_name" size="small" pagination={false} />
            </Card>
          )}

          <Card className="glass-card" title="时间节点" style={{ borderRadius: 12 }}>
            <Timeline items={[
              { children: `签约: ${project.contract_date || "-"}`, color: project.contract_date ? "green" : "gray" },
              { children: `UI确认: ${project.ui_confirm_date || "-"}`, color: project.ui_confirm_date ? "green" : "gray" },
              { children: `开发开始: ${project.develop_start_date || "-"}`, color: project.develop_start_date ? "blue" : "gray" },
              { children: `理论交付: ${project.theoretical_delivery_date || "-"}`, color: project.theoretical_delivery_date ? "blue" : "gray" },
              { children: `实际交付: ${project.actual_delivery_date || "-"}`, color: project.actual_delivery_date ? "green" : "gray" },
              { children: `验收: ${project.acceptance_date || "-"}`, color: project.acceptance_date ? "green" : "gray" },
            ]} />
          </Card>
        </Col>
      </Row>

      {/* Add Member Modal */}
      <Modal title="添加项目成员" open={memberOpen} onOk={addMember} onCancel={() => setMemberOpen(false)} okText="确认" cancelText="取消">
        <Form form={memberForm} layout="vertical">
          <Form.Item name="employee_id" label="员工" rules={[{ required: true, message: "请选择员工" }]}>
            <Select placeholder="选择参与该项目的员工" options={employees.map((e: any) => ({ value: e.id, label: `${e.name} (${e.position || "-"})` }))} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: "请选择角色" }]}>
            <Select placeholder="开发/设计/产品/测试" options={[
              { value: "开发", label: "开发" }, { value: "设计", label: "设计" },
              { value: "产品", label: "产品" }, { value: "测试", label: "测试" },
            ]} />
          </Form.Item>
          <Form.Item name="input_month" label="投入月份" rules={[{ required: true, message: "请输入投入月份" }]}>
            <InputNumber min={0} max={24} step={0.1} placeholder="如 0.5 表示半个月" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="input_days" label="投入天数">
            <InputNumber min={0} max={365} placeholder="投入的工作日天数" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="bonus" label="开发奖金 (¥)">
            <InputNumber min={0} prefix="¥" placeholder="项目奖金金额" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="product_bonus" label="产品提成 (¥)">
            <InputNumber min={0} prefix="¥" placeholder="产品/UI提成金额" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal title="编辑项目" open={editOpen} onOk={handleEdit} onCancel={() => setEditOpen(false)} okText="保存" cancelText="取消" width={640}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="project_name" label="项目名称" rules={[{ required: true, message: "请输入项目名称" }]}>
            <Input placeholder="项目名称，如 AI客服系统" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_name" label="客户名称">
                <Input placeholder="客户公司或联系人名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="region" label="地区">
                <Input placeholder="如 郑州、北京、深圳" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="amount" label="合同金额" rules={[{ pattern: /^\d+(\.\d{1,2})?$/, message: "请输入有效金额" }]}>
                <InputNumber min={0} prefix="¥" placeholder="如 50000" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="project_cycle_month" label="项目周期(月)">
                <InputNumber min={0} max={60} step={0.5} placeholder="如 1.5" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="项目状态">
                <Select placeholder="选择状态" options={STATUS_STEPS.map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="contract_date" label="签约时间">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ui_confirm_date" label="UI确认时间">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actual_delivery_date" label="实际交付">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
