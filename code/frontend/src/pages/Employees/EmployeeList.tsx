import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, InputNumber, Space, Tag, Card, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchData = () => api.get("/employees").then((r) => setEmployees(r.data));

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    await api.post("/employees", values);
    message.success("员工已添加");
    setOpen(false);
    form.resetFields();
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/employees/${id}`);
    message.success("已删除");
    fetchData();
  };

  const columns = [
    { title: "姓名", dataIndex: "name", key: "name",
      render: (v: string, r: any) => <a onClick={() => navigate(`/employees/${r.id}`)}>{v}</a>,
    },
    { title: "岗位", dataIndex: "position", key: "position" },
    { title: "级别", dataIndex: "level", key: "level" },
    {
      title: "类型", dataIndex: "employment_type", key: "type",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "状态", dataIndex: "status", key: "status",
      render: (v: string) => <Tag color={v === "在职" ? "green" : "default"}>{v}</Tag>,
    },
    {
      title: "工资", dataIndex: "salary", key: "salary",
      render: (v: number) => `¥${v?.toLocaleString()}`,
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
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#e6edf3" }}>人员管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          添加员工
        </Button>
      </div>

      <Card className="glass-card" style={{ borderRadius: 12 }}>
        <Table dataSource={employees} columns={columns} rowKey="id" size="middle" />
      </Card>

      <Modal
        title="添加员工"
        open={open}
        onOk={handleCreate}
        onCancel={() => setOpen(false)}
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="position" label="岗位">
            <Input />
          </Form.Item>
          <Form.Item name="level" label="级别">
            <Select options={[
              { value: "初级", label: "初级" },
              { value: "中级", label: "中级" },
              { value: "高级", label: "高级" },
            ]} />
          </Form.Item>
          <Form.Item name="employment_type" label="员工类型" initialValue="正式">
            <Select options={[
              { value: "正式", label: "正式" },
              { value: "试用", label: "试用" },
              { value: "实习", label: "实习" },
            ]} />
          </Form.Item>
          <Space>
            <Form.Item name="salary" label="工资">
              <InputNumber min={0} prefix="¥" />
            </Form.Item>
            <Form.Item name="guarantee" label="保底">
              <InputNumber min={0} prefix="¥" />
            </Form.Item>
            <Form.Item name="social_security" label="社保">
              <InputNumber min={0} prefix="¥" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
