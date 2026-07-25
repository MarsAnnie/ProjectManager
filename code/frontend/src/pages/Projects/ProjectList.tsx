import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, InputNumber, Row, Col, Card, Tag, Switch, message } from "antd";
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [managers, setManagers] = useState([]);
  const [uiPersons, setUIPersons] = useState([]);
  const navigate = useNavigate();

  const fetchData = (p = page, ps = pageSize) => {
    api.get("/projects", { params: { page: p, page_size: ps } }).then((r) => {
      setProjects(r.data.items);
      setTotal(r.data.total);
    });
  };

  useEffect(() => {
    fetchData();
    api.get("/business-managers").then((r) => setManagers(r.data));
    api.get("/ui-persons").then((r) => setUIPersons(r.data));
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
      title: "项目名称", dataIndex: "project_name", key: "name", width: 200,
      render: (v: string, r: any) => (
        <span>
          <a onClick={() => navigate(`/projects/${r.id}`)}>{v}</a>
          {r.children && r.children.length > 0 && (
            <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>
              +{r.children.length}增项
            </Tag>
          )}
        </span>
      ),
    },
    { title: "客户", dataIndex: "customer_name", key: "customer", width: 120 },
    {
      title: "金额", dataIndex: "amount", key: "amount", width: 110,
      render: (v: number) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatMoney(v)}</span>,
    },
    {
      title: "状态", dataIndex: "status", key: "status", width: 90,
      render: (v: string) => {
        const cls = ["完成", "已交付"].includes(v) ? "status-tag-done"
          : ["开发中", "开发准备", "UI确认"].includes(v) ? "status-tag-progress"
          : "status-tag-pending";
        return <Tag className={cls}>{v}</Tag>;
      },
    },
    { title: "地区", dataIndex: "region", key: "region", width: 80 },
    { title: "周期(月)", dataIndex: "project_cycle_month", key: "cycle", width: 80 },
    {
      title: "商务", dataIndex: ["business_manager", "name"], key: "bm", width: 80,
      render: (v: string) => v || "-",
    },
    {
      title: "签约", dataIndex: "contract_date", key: "cd", width: 100,
      render: (v: string) => v || "-",
    },
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
        <Table
          dataSource={projects}
          columns={columns}
          rowKey="id"
          size="middle"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "200"],
            showTotal: (t) => `共 ${t} 个项目`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              fetchData(p, ps);
            },
          }}
        />
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
          <Form.Item name="project_name" label="项目名称" rules={[
            { required: true, message: "请输入项目名称" },
            { max: 100, message: "项目名称不超过100字" },
          ]}>
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
              <Form.Item name="amount" label="合同金额" rules={[
                { pattern: /^\d+(\.\d{1,2})?$/, message: "请输入有效的金额" },
              ]}>
                <InputNumber min={0} max={99999999} prefix="¥" placeholder="如 50000" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="project_cycle_month" label="项目周期(月)">
                <InputNumber min={0} max={60} step={0.5} placeholder="如 1.5 个月" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="business_manager_id" label="商务经理">
                <Select placeholder="选择商务" allowClear style={{ width: "100%" }}
                  options={managers.map((m: any) => ({ value: m.id, label: m.name }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="项目状态" initialValue="待签约">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="needs_ui" label="是否需要UI" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="需要" unCheckedChildren="不需要" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.needs_ui !== cur.needs_ui}>
            {({ getFieldValue }) =>
              getFieldValue("needs_ui") ? (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="ui_person_name" label="UI负责人">
                      <Select
                        placeholder="选择或输入UI人员"
                        showSearch
                        allowClear
                        options={uiPersons.map((u: any) => ({ value: u.name, label: u.name }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="ui_commission_rate" label="UI提成比例">
                      <Select placeholder="选择提成比例" options={[
                        { value: 0.05, label: "5%" },
                        { value: 0.07, label: "7%" },
                        { value: 0.10, label: "10%" },
                      ]} />
                    </Form.Item>
                  </Col>
                </Row>
              ) : null
            }
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="是否上架、特殊要求等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
