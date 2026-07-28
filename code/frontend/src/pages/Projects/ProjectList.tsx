import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, InputNumber, Row, Col, Card, Tag, Switch, DatePicker, Popconfirm, Space, message } from "antd";
import { PlusOutlined, DeleteOutlined, ClearOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

const STATUS_OPTIONS = [
  { value: "未开始", label: "未开始" },
  { value: "UI确认", label: "UI确认" },
  { value: "开发中", label: "开发中" },
  { value: "测试中", label: "测试中" },
  { value: "已交付", label: "已交付" },
  { value: "已分成", label: "已分成" },
  { value: "暂停", label: "暂停" },
  { value: "退款", label: "退款" },
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
  const [ratioOptions, setRatioOptions] = useState<any[]>([]);
  const [ratioSearch, setRatioSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterBM, setFilterBM] = useState<number | undefined>();
  const [filterRegion, setFilterRegion] = useState<string | undefined>();
  const navigate = useNavigate();

  const fetchData = async (p = page, ps = pageSize) => {
    try {
      const params: any = { page: p, page_size: ps };
      if (filterStatus) params.status = filterStatus;
      if (filterBM) params.business_manager_id = filterBM;
      if (filterRegion) params.region = filterRegion;
      const r = await api.get("/projects", { params });
      const cleanChildren = (proj: any): any => ({
        ...proj,
        children: proj.children && proj.children.length > 0
          ? proj.children.map(cleanChildren)
          : undefined,
      });
      setProjects(r.data.items.map(cleanChildren));
      setTotal(r.data.total);
    } catch {
      message.error("加载项目列表失败");
    }
  };

  useEffect(() => {
    fetchData();
    api.get("/business-managers").then((r) => setManagers(r.data));
    api.get("/ui-persons").then((r) => setUIPersons(r.data));
    api.get("/projects/payment-ratios/list").then((r) => setRatioOptions(r.data || []));
  }, []);

  useEffect(() => {
    fetchData(1, pageSize);
  }, [filterStatus, filterBM, filterRegion]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    const payload = { ...values };
    if (payload.contract_date) payload.contract_date = payload.contract_date.format("YYYY-MM-DD");
    // Check quote health
    if (payload.amount && payload.project_cycle_month) {
      try {
        const health = await api.post("/projects/check-quote-health", {
          amount: payload.amount,
          expected_days: Math.round((payload.project_cycle_month || 0) * 22),
          developer_level: "中级",
          developer_count: 1,
        });
        const h = health.data;
        if (h.health_status === "danger") {
          message.warning(`⚠ 报价健康检查：${h.health_label}。预计成本 ¥${h.estimated_cost.toLocaleString()}，建议报价 ¥${h.suggested_min_price.toLocaleString()}`);
        }
      } catch {}
    }
    await api.post("/projects", payload);
    message.success("项目已创建");
    setOpen(false);
    form.resetFields();
    await fetchData();
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await api.delete(`/projects/${id}`);
      await fetchData();
      message.success("已删除");
    } catch (e: any) {
      const msg = e?.response?.status === 404 ? "该项目不存在或已删除" : "删除失败，请重试";
      message.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const dateStyle = { whiteSpace: "nowrap" as const, fontSize: 12 };

  const columns = [
    {
      title: "项目名称", dataIndex: "project_name", key: "name", width: 160, ellipsis: { showTitle: false },
      render: (v: string, r: any) => (
        <span>
          <a onClick={() => navigate(`/projects/${r.id}`)}>{v}</a>
          {r.children && r.children.length > 0 && (
            <Tag color="orange" style={{ marginLeft: 4, fontSize: 10, lineHeight: "16px" }}>
              +{r.children.length}
            </Tag>
          )}
        </span>
      ),
    },
    { title: "客户", dataIndex: "customer_name", key: "customer", width: 80, render: (v: string) => <span style={{ fontSize: 12 }}>{v || "-"}</span> },
    {
      title: "金额", dataIndex: "amount", key: "amount", width: 95,
      render: (v: number) => <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500, fontSize: 12 }}>{formatMoney(v)}</span>,
    },
    {
      title: "状态", dataIndex: "status", key: "status", width: 70,
      render: (v: string) => {
        const cls = `status-tag-${v}`;
        return <Tag className={cls} style={{ fontSize: 10, margin: 0, lineHeight: "18px" }}>{v}</Tag>;
      },
    },
    {
      title: "回款", key: "ratio", width: 48,
      render: (_: any, r: any) => r.payment_ratio
        ? <span style={{ fontSize: 11, color: "#2dd4bf", fontWeight: 500 }}>{r.payment_ratio}</span>
        : <span style={{ color: "#484f58", fontSize: 11 }}>—</span>,
    },
    {
      title: "UI", key: "ui", width: 55,
      render: (_: any, r: any) => r.needs_ui
        ? <span style={{ fontSize: 11, color: "#a78bfa" }}>{r.ui_person_name || "是"}</span>
        : <span style={{ color: "#484f58", fontSize: 11 }}>—</span>,
    },
    {
      title: "商务", key: "bm", width: 90,
      render: (_: any, r: any) => {
        const names = (r.business_managers || []).map((m: any) => m.name).filter(Boolean);
        return <span style={{ fontSize: 11 }}>{names.length > 0 ? names.join("/") : "-"}</span>;
      },
    },
    { title: "周期", dataIndex: "project_cycle_month", key: "cycle", width: 50, render: (v: any) => <span style={{ fontSize: 12 }}>{v ? `${v}月` : "-"}</span> },
    {
      title: "签约", dataIndex: "contract_date", key: "cd", width: 85,
      render: (v: string) => <span style={dateStyle}>{v || "-"}</span>,
    },
    {
      title: "UI确认", dataIndex: "ui_confirm_date", key: "uid", width: 85,
      render: (v: string) => <span style={dateStyle}>{v || "-"}</span>,
    },
    {
      title: "交付", dataIndex: "actual_delivery_date", key: "dd", width: 85,
      render: (v: string) => <span style={dateStyle}>{v || "-"}</span>,
    },
    {
      title: "", key: "actions", width: 44,
      render: (_: any, r: any) => (
        <Popconfirm
          title="确定删除该项目？"
          onConfirm={async () => { await handleDelete(r.id); }}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ loading: deletingId === r.id }}
        >
          <Button type="link" danger size="small" loading={deletingId === r.id} style={{ padding: 0 }} icon={<DeleteOutlined />} />
        </Popconfirm>
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

      <Card className="glass-card" style={{ borderRadius: 12, marginBottom: 16 }}>
        <Space wrap size="small">
          <Select
            placeholder="项目状态"
            allowClear
            style={{ width: 120 }}
            value={filterStatus}
            onChange={(v) => { setFilterStatus(v); setPage(1); }}
            options={STATUS_OPTIONS}
          />
          <Select
            placeholder="商务经理"
            allowClear
            style={{ width: 140 }}
            value={filterBM}
            onChange={(v) => { setFilterBM(v); setPage(1); }}
            options={managers.map((m: any) => ({ value: m.id, label: m.name }))}
            filterOption={(input, option) => (option?.label as string)?.includes(input)}
            showSearch
          />
          <Select
            placeholder="地区"
            allowClear
            style={{ width: 110 }}
            value={filterRegion}
            onChange={(v) => { setFilterRegion(v); setPage(1); }}
            options={["郑州", "北京", "深圳", "广州", "杭二", "周口", "成都"].map((r) => ({ value: r, label: r }))}
          />
          <Button icon={<ClearOutlined />} size="small" onClick={() => { setFilterStatus(undefined); setFilterBM(undefined); setFilterRegion(undefined); setPage(1); }}>
            清除
          </Button>
          <span style={{ fontSize: 12, color: "#8b949e" }}>共 {total} 个项目</span>
        </Space>
      </Card>

      <Card className="glass-card" style={{ borderRadius: 12 }}>
        <Table
          dataSource={projects}
          columns={columns}
          rowKey="id"
          size="small"
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
                <InputNumber min={0} max={60} step={0.1} placeholder="自动计算" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="work_days" label="工期(工作日)">
                <InputNumber min={0} max={365} placeholder="如 55" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="项目状态" initialValue="待签约">
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="business_manager_ids" label="商务经理(可多选)">
            <Select mode="multiple" placeholder="选择一个或多个商务" allowClear style={{ width: "100%" }}
              options={managers.map((m: any) => ({ value: m.id, label: m.name }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="contract_date" label="签约时间" initialValue={dayjs()}>
                <DatePicker style={{ width: "100%" }} placeholder="选择日期" />
              </Form.Item>
            </Col>
          </Row>
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
          <Form.Item name="payment_ratio" label="回款比例">
            <Select
              placeholder="选择或输入比例模板（如 532/32221）"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              onSearch={setRatioSearch}
              onChange={() => setRatioSearch("")}
              options={(() => {
                const opts = ratioOptions.map((r: any) => ({
                  value: r.value,
                  label: `${r.value}（${r.stages}期）`,
                }));
                // 用户输入的自定义比例：纯数字、和为10、不在预设列表中
                if (ratioSearch && /^\d+$/.test(ratioSearch)) {
                  const sum = ratioSearch.split("").reduce((a: number, b: string) => a + Number(b), 0);
                  if (sum === 10 && !ratioOptions.some((r: any) => r.value === ratioSearch)) {
                    opts.unshift({ value: ratioSearch, label: `${ratioSearch}（自定义·${ratioSearch.length}期）` });
                  }
                }
                return opts;
              })()}
            />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="是否上架、特殊要求等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
