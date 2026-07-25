import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, InputNumber, Card, Tag, message, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

const STATUS_OPTIONS = [
  { value: "待签约", label: "待签约" },
  { value: "已签约", label: "已签约" },
  { value: "UI确认", label: "UI确认" },
  { value: "开发中", label: "开发中" },
  { value: "测试", label: "测试" },
  { value: "待验收", label: "待验收" },
  { value: "已交付", label: "已交付" },
  { value: "完成", label: "完成" },
];

const formatMoney = (v: number) => `¥${v?.toLocaleString() ?? "0"}`;

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [managers, setManagers] = useState([]);
  const navigate = useNavigate();

  const fetchData = () => api.get("/projects").then((r) => setProjects(r.data));

  useEffect(() => {
    fetchData();
    api.get("/business-managers").then((r) => setManagers(r.data));
  }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    // Check quote health
    if (values.amount && values.project_cycle_month) {
      try {
        const health = await api.post("/projects/check-quote-health", {
          amount: values.amount,
          expected_days: Math.round((values.project_cycle_month || 0) * 22),
          developer_level: "中级",
          developer_count: 1,
        });
        const h = health.data;
        if (h.health_status === "danger") {
          message.warning(`⚠ 报价健康检查：${h.health_label}。预计成本 ¥${h.estimated_cost.toLocaleString()}，建议报价 ¥${h.suggested_min_price.toLocaleString()}`);
        }
      } catch {}
    }
    await api.post("/projects", values);
    message.success("项目已创建");
    setOpen(false);
    form.resetFields();
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/projects/${id}`);
    message.success("已删除");
    fetchData();
  };

  const columns = [
    {
      title: "项目名称", dataIndex: "project_name", key: "name",
      render: (v: string, r: any) => (
        <span>
          <a onClick={() => navigate(`/projects/${r.id}`)}>{v}</a>
          {r.children && r.children.length > 0 && (
            <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>
              +{r.children.length}项增项
            </Tag>
          )}
        </span>
      ),
    },
    { title: "客户", dataIndex: "customer_name", key: "customer" },
    {
      title: "金额", dataIndex: "amount", key: "amount",
      render: (v: number) => formatMoney(v),
    },
    {
      title: "状态", dataIndex: "status", key: "status",
      render: (v: string) => (
        <Tag color={v === "完成" ? "green" : v === "已交付" ? "blue" : "default"}>{v}</Tag>
      ),
    },
    { title: "地区", dataIndex: "region", key: "region" },
    { title: "周期(月)", dataIndex: "project_cycle_month", key: "cycle" },
    {
      title: "操作", key: "actions",
      render: (_: any, r: any) => (
        <Button type="link" danger size="small" onClick={() => handleDelete(r.id)}>删除</Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#e6edf3" }}>项目管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建项目
        </Button>
      </div>

      <Card className="glass-card" style={{ borderRadius: 12 }}>
        <Table dataSource={projects} columns={columns} rowKey="id" size="middle" />
      </Card>

      <Modal
        title="新建项目"
        open={open}
        onOk={handleCreate}
        onCancel={() => setOpen(false)}
        okText="确认"
        cancelText="取消"
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="project_name" label="项目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space>
            <Form.Item name="customer_name" label="客户名称">
              <Input />
            </Form.Item>
            <Form.Item name="region" label="地区">
              <Input />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item name="amount" label="合同金额">
              <InputNumber min={0} prefix="¥" style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="project_cycle_month" label="项目周期(月)">
              <InputNumber min={0} step={0.5} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="business_manager_id" label="商务经理">
              <Select
                style={{ width: 140 }}
                options={managers.map((m: any) => ({ value: m.id, label: m.name }))}
              />
            </Form.Item>
          </Space>
          <Form.Item name="status" label="项目状态" initialValue="待签约">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
