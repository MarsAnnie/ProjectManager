import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, InputNumber, Row, Col, Tag, Card, Tabs, message } from "antd";
import { PlusOutlined, TeamOutlined, UserOutlined, PieChartOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

const EMPLOYMENT_ORDER: Record<string, number> = { "正式": 1, "试用": 2, "实习": 3 };
const LEVEL_ORDER: Record<string, number> = { "高级": 1, "中级": 2, "初级": 3, "实习生": 4 };

export default function EmployeeList() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [filter, setFilter] = useState<string>("在职");
  const navigate = useNavigate();

  // UI persons & business
  const [uiPersons, setUIPersons] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("dev");

  const fetchEmployees = (p = page, ps = pageSize) => {
    const params: any = { page: p, page_size: ps };
    if (filter && filter !== "all") params.status = filter;
    api.get("/employees", { params }).then((r) => {
      const sorted = [...r.data.items].sort((a: any, b: any) => {
        if (a.status === "离职" && b.status !== "离职") return 1;
        if (b.status === "离职" && a.status !== "离职") return -1;
        const typeA = EMPLOYMENT_ORDER[a.employment_type] ?? 9;
        const typeB = EMPLOYMENT_ORDER[b.employment_type] ?? 9;
        if (typeA !== typeB) return typeA - typeB;
        const lvlA = LEVEL_ORDER[a.level] ?? 9;
        const lvlB = LEVEL_ORDER[b.level] ?? 9;
        return lvlA - lvlB;
      });
      setEmployees(sorted);
      setTotal(r.data.total);
    });
  };

  const fetchUIPersons = () => api.get("/ui-persons").then((r) => setUIPersons(r.data));
  const fetchBusiness = () => api.get("/business-managers").then((r) => setBusinesses(r.data));

  useEffect(() => {
    fetchEmployees();
    fetchUIPersons();
    fetchBusiness();
  }, [filter]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await api.put(`/employees/${editing.id}`, values);
      message.success("已更新");
    } else {
      await api.post("/employees", values);
      message.success("已添加");
    }
    setOpen(false); setEditing(null); form.resetFields();
    fetchEmployees();
  };

  const openEdit = (r: any) => { setEditing(r); form.setFieldsValue(r); setOpen(true); };
  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true); };

  const statusTag = (type: string, status: string) => {
    if (status === "离职") return <Tag className="status-tag-resigned">离职</Tag>;
    return <Tag className={`status-tag-${type}`}>{type}</Tag>;
  };

  // ═══ Stat cards ═══
  const statCards = [
    { key: "在职", label: "在职", icon: <TeamOutlined />, color: "#22c55e", bg: "rgba(34,197,94,0.1)", count: employees.filter((e: any) => e.status === "在职").length },
    { key: "正式", label: "正式", icon: null, color: "#f97316", bg: "rgba(249,115,22,0.1)", count: employees.filter((e: any) => e.employment_type === "正式" && e.status === "在职").length },
    { key: "试用", label: "试用", icon: null, color: "#3b82f6", bg: "rgba(59,130,246,0.1)", count: employees.filter((e: any) => e.employment_type === "试用" && e.status === "在职").length },
    { key: "实习", label: "实习", icon: null, color: "#22c55e", bg: "rgba(34,197,94,0.1)", count: employees.filter((e: any) => e.employment_type === "实习" && e.status === "在职").length },
    { key: "离职", label: "离职", icon: null, color: "#ef4444", bg: "rgba(239,68,68,0.1)", count: employees.filter((e: any) => e.status === "离职").length },
    { key: "ui", label: "UI人员", icon: <UserOutlined />, color: "#a78bfa", bg: "rgba(167,139,250,0.1)", count: uiPersons.length },
    { key: "biz", label: "商务人员", icon: <PieChartOutlined />, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", count: businesses.length },
  ];

  // ═══ Dev columns ═══
  const devColumns = [
    { title: "姓名", dataIndex: "name", key: "name", render: (v: string, r: any) => <a onClick={() => navigate(`/employees/${r.id}`)}>{v}</a> },
    { title: "岗位", dataIndex: "position", key: "position" },
    { title: "级别", dataIndex: "level", key: "level" },
    { title: "类型", dataIndex: "employment_type", key: "type", render: (v: string, r: any) => statusTag(v, r.status) },
    { title: "状态", dataIndex: "status", key: "status", render: (v: string) => <Tag className={v === "离职" ? "status-tag-resigned" : "status-tag-active"}>{v}</Tag> },
    { title: "工资", dataIndex: "salary", key: "salary", render: (v: number) => v > 0 ? `¥${v?.toLocaleString()}` : "-" },
    { title: "操作", key: "act", render: (_: any, r: any) => <Button type="link" size="small" onClick={() => openEdit(r)}>修改</Button> },
  ];

  // ═══ UI person columns ═══
  const uiColumns = [
    { title: "姓名", dataIndex: "name", key: "name" },
    { title: "备注", dataIndex: "remark", key: "remark", render: (v: string) => v || "-" },
    { title: "操作", key: "act", render: (_: any, r: any) => (
      <Button type="link" danger size="small" onClick={async () => { await api.delete(`/ui-persons/${r.id}`); message.success("已删除"); fetchUIPersons(); }}>删除</Button>
    )},
  ];

  // ═══ Business columns ═══
  const bizColumns = [
    { title: "姓名", dataIndex: "name", key: "name" },
    { title: "电话", dataIndex: "phone", key: "phone", render: (v: string) => v || "-" },
    { title: "备注", dataIndex: "remark", key: "remark", render: (v: string) => v || "-" },
    { title: "操作", key: "act", render: (_: any, r: any) => (
      <Button type="link" danger size="small" onClick={async () => { await api.delete(`/business-managers/${r.id}`); message.success("已删除"); fetchBusiness(); }}>删除</Button>
    )},
  ];

  // ═══ UI person add ═══
  const [uiOpen, setUIOpen] = useState(false);
  const [uiForm] = Form.useForm();
  const addUI = async () => {
    const v = await uiForm.validateFields();
    await api.post("/ui-persons", v);
    message.success("已添加"); setUIOpen(false); uiForm.resetFields(); fetchUIPersons();
  };

  // ═══ Business add ═══
  const [bizOpen, setBizOpen] = useState(false);
  const [bizForm] = Form.useForm();
  const addBiz = async () => {
    const v = await bizForm.validateFields();
    await api.post("/business-managers", v);
    message.success("已添加"); setBizOpen(false); bizForm.resetFields(); fetchBusiness();
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "#e6edf3", marginBottom: 16 }}>人员管理</h2>

      {/* Stat Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {statCards.map((card) => (
          <Col xs={12} sm={6} md={4} lg={3} xl={Math.floor(24 / 7)} key={card.key}>
            <Card
              className="glass-card"
              hoverable
              style={{
                borderRadius: 12, cursor: "pointer", textAlign: "center",
                border: filter === card.key ? `1px solid ${card.color}` : undefined,
                background: filter === card.key ? card.bg : undefined,
              }}
              onClick={() => {
                if (card.key === "ui") { setActiveTab("ui"); return; }
                if (card.key === "biz") { setActiveTab("biz"); return; }
                if (card.key === "在职") { setActiveTab("dev"); }
                setFilter(filter === card.key ? "在职" : card.key);
              }}
              bodyStyle={{ padding: "14px 8px" }}
            >
              <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>{card.icon} {card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: card.color, fontVariantNumeric: "tabular-nums" }}>
                {card.count}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <Card className="glass-card" style={{ borderRadius: 12 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: "dev", label: "开发人员",
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加员工</Button>
                </div>
                <Table dataSource={employees} columns={devColumns} rowKey="id" size="middle"
                  pagination={{
                    current: page, pageSize, total, showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50", "200"],
                    showTotal: (t) => `共 ${t} 人`,
                    onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchEmployees(p, ps); },
                  }}
                />
              </>
            ),
          },
          {
            key: "ui", label: `UI人员 (${uiPersons.length})`,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { uiForm.resetFields(); setUIOpen(true); }}>添加UI人员</Button>
                </div>
                <Table dataSource={uiPersons} columns={uiColumns} rowKey="id" size="middle" pagination={false} />
              </>
            ),
          },
          {
            key: "biz", label: `商务人员 (${businesses.length})`,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { bizForm.resetFields(); setBizOpen(true); }}>添加商务人员</Button>
                </div>
                <Table dataSource={businesses} columns={bizColumns} rowKey="id" size="middle" pagination={false} />
              </>
            ),
          },
        ]} />
      </Card>

      {/* Employee Modal */}
      <Modal title={editing ? "修改员工" : "添加员工"} open={open} onOk={handleSubmit} onCancel={() => { setOpen(false); setEditing(null); }}
        okText="确认" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }, { max: 20 }]}>
            <Input placeholder="员工姓名" />
          </Form.Item>
          <Form.Item name="position" label="岗位"><Input placeholder="如 AI应用开发工程师" /></Form.Item>
          <Form.Item name="level" label="级别">
            <Select placeholder="选择级别" options={[{ value: "高级", label: "高级" }, { value: "中级", label: "中级" }, { value: "初级", label: "初级" }, { value: "实习生", label: "实习生" }]} />
          </Form.Item>
          <Form.Item name="employment_type" label="员工类型" initialValue="正式">
            <Select options={[{ value: "正式", label: "正式" }, { value: "试用", label: "试用" }, { value: "实习", label: "实习" }]} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="在职">
            <Select options={[{ value: "在职", label: "在职" }, { value: "离职", label: "离职" }]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="salary" label="工资"><InputNumber min={0} max={999999} prefix="¥" placeholder="月薪" style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="guarantee" label="保底"><InputNumber min={0} max={999999} prefix="¥" placeholder="保底金额" style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="social_security" label="社保"><InputNumber min={0} max={99999} prefix="¥" placeholder="社保金额" style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* UI Person Modal */}
      <Modal title="添加UI人员" open={uiOpen} onOk={addUI} onCancel={() => setUIOpen(false)} okText="确认" cancelText="取消">
        <Form form={uiForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input placeholder="UI人员姓名" /></Form.Item>
          <Form.Item name="remark" label="备注"><Input placeholder="备注信息" /></Form.Item>
        </Form>
      </Modal>

      {/* Business Modal */}
      <Modal title="添加商务人员" open={bizOpen} onOk={addBiz} onCancel={() => setBizOpen(false)} okText="确认" cancelText="取消">
        <Form form={bizForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input placeholder="商务人员姓名" /></Form.Item>
          <Form.Item name="phone" label="电话"><Input placeholder="手机号码" /></Form.Item>
          <Form.Item name="remark" label="备注"><Input placeholder="备注信息" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
