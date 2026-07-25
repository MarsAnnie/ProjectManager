import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Card, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import api from "../../api/client";

export default function UIPersonList() {
  const [data, setData] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = () => api.get("/ui-persons").then((r) => setData(r.data));

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await api.post("/ui-persons", values);
    message.success("已添加");
    setOpen(false);
    form.resetFields();
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/ui-persons/${id}`);
    message.success("已删除");
    fetchData();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#e6edf3" }}>UI人员管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>
          添加UI人员
        </Button>
      </div>
      <Card className="glass-card" style={{ borderRadius: 12 }}>
        <Table
          dataSource={data}
          columns={[
            { title: "姓名", dataIndex: "name", key: "name" },
            { title: "备注", dataIndex: "remark", key: "remark", render: (v: string) => v || "-" },
            { title: "操作", key: "act", render: (_: any, r: any) => (
              <Button type="link" danger size="small" onClick={() => handleDelete(r.id)}>删除</Button>
            )},
          ]}
          rowKey="id"
          size="middle"
          pagination={false}
        />
      </Card>
      <Modal title="添加UI人员" open={open} onOk={handleSubmit} onCancel={() => setOpen(false)} okText="确认" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input placeholder="UI人员姓名" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
