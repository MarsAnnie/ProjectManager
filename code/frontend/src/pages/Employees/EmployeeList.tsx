import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, InputNumber, Row, Col, Tag, Card, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
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
  const navigate = useNavigate();

  const fetchData = (p = page, ps = pageSize) => {
    api.get("/employees", { params: { page: p, page_size: ps } }).then((r) => {
      // Sort: 正式 first, then by level (高级→初级), then 离职 last
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

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await api.put(`/employees/${editing.id}`, values);
      message.success("已更新");
    } else {
      await api.post("/employees", values);
      message.success("员工已添加");
    }
    setOpen(false);
    setEditing(null);
    form.resetFields();
    fetchData();
  };

  const openEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue(record);
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const statusTag = (type: string, status: string) => {
    if (status === "离职") return <Tag className="status-tag-resigned">离职</Tag>;
    const cls = `status-tag-${type}`;
    return <Tag className={cls}>{type}</Tag>;
  };

  const columns = [
    { title: "姓名", dataIndex: "name", key: "name",
      render: (v: string, r: any) => <a onClick={() => navigate(`/employees/${r.id}`)}>{v}</a>,
    },
    { title: "岗位", dataIndex: "position", key: "position" },
    { title: "级别", dataIndex: "level", key: "level" },
    {
      title: "类型", dataIndex: "employment_type", key: "type",
      render: (v: string, r: any) => statusTag(v, r.status),
    },
    {
      title: "状态", dataIndex: "status", key: "status",
      render: (v: string) => (
        <Tag className={v === "离职" ? "status-tag-resigned" : "status-tag-active"}>{v}</Tag>
      ),
    },
    {
      title: "工资", dataIndex: "salary", key: "salary",
      render: (v: number) => v > 0 ? `¥${v?.toLocaleString()}` : "-",
    },
    {
      title: "操作", key: "actions",
      render: (_: any, r: any) => (
        <Button type="link" size="small" onClick={() => openEdit(r)}>修改</Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#e6edf3" }}>人员管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          添加员工
        </Button>
      </div>

      <Card className="glass-card" style={{ borderRadius: 12 }}>
        <Table
          dataSource={employees}
          columns={columns}
          rowKey="id"
          size="middle"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "200"],
            showTotal: (t) => `共 ${t} 人`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              fetchData(p, ps);
            },
          }}
        />
      </Card>

      <Modal
        title={editing ? "修改员工" : "添加员工"}
        open={open}
        onOk={handleSubmit}
        onCancel={() => { setOpen(false); setEditing(null); }}
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[
            { required: true, message: "请输入姓名" },
            { max: 20, message: "姓名不超过20字" },
          ]}>
            <Input placeholder="员工姓名" />
          </Form.Item>
          <Form.Item name="position" label="岗位">
            <Input placeholder="如 AI应用开发工程师" />
          </Form.Item>
          <Form.Item name="level" label="级别">
            <Select placeholder="选择级别" options={[
              { value: "高级", label: "高级" },
              { value: "中级", label: "中级" },
              { value: "初级", label: "初级" },
              { value: "实习生", label: "实习生" },
            ]} />
          </Form.Item>
          <Form.Item name="employment_type" label="员工类型" initialValue="正式">
            <Select options={[
              { value: "正式", label: "正式" },
              { value: "试用", label: "试用" },
              { value: "实习", label: "实习" },
            ]} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="在职">
            <Select options={[
              { value: "在职", label: "在职" },
              { value: "离职", label: "离职" },
            ]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="salary" label="工资" rules={[
                { pattern: /^\d+(\.\d{1,2})?$/, message: "请输入有效数字" },
              ]}>
                <InputNumber min={0} max={999999} prefix="¥" placeholder="月薪" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="guarantee" label="保底">
                <InputNumber min={0} max={999999} prefix="¥" placeholder="保底金额" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="social_security" label="社保">
                <InputNumber min={0} max={99999} prefix="¥" placeholder="社保金额" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
