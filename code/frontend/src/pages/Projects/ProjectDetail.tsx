import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Descriptions, Tag, Button, Table, Spin, Row, Col, Timeline,
  Modal, Form, Select, InputNumber, Input, Switch, message, Steps, Progress, DatePicker, Popconfirm
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../api/client";

const formatMoney = (v: number) => `¥${Number(v || 0).toLocaleString()}`;

const getBonusTierRate = (amount: number, isSub: boolean): string => {
  const tiers = isSub
    ? [[50000, 0.05], [100000, 0.07], [Infinity, 0.10]]
    : [[20000, 0.03], [50000, 0.05], [100000, 0.07], [Infinity, 0.10]];
  for (const [threshold, rate] of tiers) {
    if (amount <= threshold) return `${(rate * 100).toFixed(0)}%`;
  }
  return "—";
};

const STATUS_STEPS = [
  "未开始", "UI确认", "开发中", "测试中", "已交付", "已分成", "暂停", "退款"
];

const STATUS_CLS: Record<string, string> = {
  "未开始": "status-tag-未开始",
  "UI确认": "status-tag-UI确认",
  "开发中": "status-tag-开发中",
  "测试中": "status-tag-测试中",
  "已交付": "status-tag-已交付",
  "已分成": "status-tag-已分成",
  "暂停": "status-tag-暂停",
  "退款": "status-tag-退款",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberOpen, setMemberOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [uiPersons, setUIPersons] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [editForm] = Form.useForm();
  const [memberRows, setMemberRows] = useState<any[]>([{ key: 1, employee_id: null, is_lead: false, share_ratio: 1 }]);

  const openMemberModal = () => {
    if (project?.members && project.members.length > 0) {
      setMemberRows(project.members.map((m: any) => ({
        key: m.id,
        employee_id: m.employee_id,
        is_lead: m.role === "负责人",
        share_ratio: Number(m.share_ratio) || 1,
      })));
    } else {
      setMemberRows([{ key: 1, employee_id: null, is_lead: false, share_ratio: 1 }]);
    }
    setMemberOpen(true);
  };
  const [costData, setCostData] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // ── Payment state ──
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [paymentForm] = Form.useForm();
  const [paymentProgress, setPaymentProgress] = useState<any>(null);
  const [ratioOptions, setRatioOptions] = useState<any[]>([]);
  const [ratioSearch, setRatioSearch] = useState("");
  const [childOpen, setChildOpen] = useState(false);
  const [childForm] = Form.useForm();

  const fetchProject = () => {
    api.get(`/projects/${id}`).then((r) => {
      setProject(r.data);
      setLoading(false);
      if (r.data.payment_ratio) {
        api.get(`/projects/${id}/payment-progress`).then((pr) => setPaymentProgress(pr.data)).catch(() => {});
      } else {
        setPaymentProgress(null);
      }
    }).catch(() => {
      message.error("加载项目数据失败");
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchProject();
    api.get("/employees", { params: { page_size: 200, status: "在职" } }).then((r) => {
      setEmployees(r.data.items || []);
    });
    api.get("/ui-persons").then((r) => setUIPersons(r.data));
    api.get("/business-managers").then((r) => setManagers(r.data));
    api.get("/projects/payment-ratios/list").then((r) => setRatioOptions(r.data || []));
  }, [id]);

  const calcCost = async () => {
    setCalcLoading(true);
    const r = await api.post(`/projects/${id}/calculate-cost`);
    setCostData(r.data);
    setCalcLoading(false);
    message.success("成本计算完成");
    fetchProject();
  };

  // ── Payment CRUD ──

  const openPaymentModal = (payment?: any) => {
    if (payment) {
      setEditingPayment(payment);
      paymentForm.setFieldsValue({
        ...payment,
        expected_payment_date: payment.expected_payment_date ? dayjs(payment.expected_payment_date) : null,
        actual_payment_date: payment.actual_payment_date ? dayjs(payment.actual_payment_date) : null,
      });
    } else {
      setEditingPayment(null);
      paymentForm.resetFields();
      paymentForm.setFieldsValue({ payment_stage: 1, status: "待回款", payment_amount: 0 });
    }
    setPaymentOpen(true);
  };

  const savePayment = async () => {
    const values = await paymentForm.validateFields();
    const payload = {
      ...values,
      project_id: Number(id),
      expected_payment_date: values.expected_payment_date ? values.expected_payment_date.format("YYYY-MM-DD") : null,
      actual_payment_date: values.actual_payment_date ? values.actual_payment_date.format("YYYY-MM-DD") : null,
    };
    if (editingPayment) {
      await api.put(`/projects/${id}/payments/${editingPayment.id}`, payload);
      message.success("已更新");
    } else {
      await api.post(`/projects/${id}/payments`, payload);
      message.success("已添加");
    }
    setPaymentOpen(false);
    paymentForm.resetFields();
    await fetchProject();
  };

  const deletePayment = async (paymentId: number) => {
    try {
      await api.delete(`/projects/${id}/payments/${paymentId}`);
      message.success("已删除");
      await fetchProject();
    } catch {
      message.error("删除失败");
    }
  };

  const [childDeletingId, setChildDeletingId] = useState<number | null>(null);

  const handleCreateChild = async () => {
    const values = await childForm.validateFields();
    const payload = { ...values, parent_project_id: Number(id) };
    if (payload.contract_date) payload.contract_date = payload.contract_date.format("YYYY-MM-DD");
    await api.post("/projects", payload);
    message.success("增项已创建");
    setChildOpen(false);
    childForm.resetFields();
    fetchProject();
  };

  const handleDeleteChild = async (childId: number) => {
    setChildDeletingId(childId);
    try {
      await api.delete(`/projects/${childId}`);
      await fetchProject();
      message.success("增项已删除");
    } catch (e: any) {
      const msg = e?.response?.status === 404 ? "该增项不存在或已删除" : "删除失败";
      message.error(msg);
    } finally {
      setChildDeletingId(null);
    }
  };

  const addMemberRow = () => {
    setMemberRows([...memberRows, {
      key: Date.now(),
      employee_id: null, is_lead: false, share_ratio: 1,
    }]);
  };

  const removeMemberRow = (key: any) => {
    setMemberRows(memberRows.filter((r) => r.key !== key));
  };

  const updateMemberRow = (key: any, field: string, value: any) => {
    setMemberRows(memberRows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addMember = async () => {
    const valid = memberRows.filter((r) => r.employee_id);
    if (valid.length === 0) {
      message.warning("请至少选择一名员工");
      return;
    }
    // 校验1: 开发人员分成总和不超过上限（有UI时上限=100%-UI比例，无UI时上限=100%）
    const uiRate = project.needs_ui ? (Number(project.ui_commission_rate) || 0) : 0;
    const maxDevRatio = 1 - uiRate;
    const devs = valid;
    const totalRatio = devs.reduce((sum, r) => sum + (Number(r.share_ratio) || 0), 0);
    if (totalRatio > maxDevRatio + 0.001) {
      const maxPct = (maxDevRatio * 100).toFixed(0);
      message.error(`开发分成比例总和 ${(totalRatio * 100).toFixed(0)}% 超过上限 ${maxPct}%${uiRate > 0 ? `（UI占${(uiRate * 100).toFixed(0)}%）` : ""}`);
      return;
    }
    // 校验2: 多个开发时必须有负责人
    if (devs.length >= 2 && !valid.some((r) => r.is_lead)) {
      message.error("多个开发人员时必须选择一名负责人");
      return;
    }
    // 校验3: 负责人最多1个
    const leads = valid.filter((r) => r.is_lead);
    if (leads.length > 1) {
      message.error("负责人只能有一位");
      return;
    }
    const payload = valid.map((r) => ({
      project_id: Number(id),
      employee_id: r.employee_id,
      role: r.is_lead ? "负责人" : "开发",
      share_ratio: r.share_ratio,
    }));
    // 先移除所有已有成员，再批量添加（实现替换效果）
    if (project?.members) {
      for (const m of project.members) {
        await api.delete(`/projects/${id}/members/${m.id}`).catch(() => {});
      }
    }
    await api.post(`/projects/${id}/members/batch`, payload);
    message.success(`已保存 ${valid.length} 名成员`);
    setMemberOpen(false);
    setMemberRows([{ key: 1, employee_id: null, is_lead: false, share_ratio: 1 }]);
    // 成员变动后自动重算奖金
    calcCost();
  };

  const removeMember = async (memberId: number) => {
    await api.delete(`/projects/${id}/members/${memberId}`);
    message.success("已移除");
    fetchProject();
  };

  const handleEdit = async () => {
    const values = await editForm.validateFields();
    const payload = { ...values };
    if (payload.contract_date) payload.contract_date = payload.contract_date.format("YYYY-MM-DD");
    if (payload.ui_confirm_date) payload.ui_confirm_date = payload.ui_confirm_date.format("YYYY-MM-DD");
    if (payload.actual_delivery_date) payload.actual_delivery_date = payload.actual_delivery_date.format("YYYY-MM-DD");
    await api.put(`/projects/${id}`, payload);
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
    {
      title: "角色", dataIndex: "role", key: "role",
      render: (v: string) => {
        const cls = v === "负责人" ? "status-tag-regular" : v === "UI" ? "status-tag-probation" : "status-tag-progress";
        return <Tag className={cls}>{v || "开发"}</Tag>;
      },
    },
    {
      title: "分成比例", dataIndex: "share_ratio", key: "sr",
      render: (v: any) => `${((v || 1) * 100).toFixed(0)}%`,
    },
    { title: "奖金", dataIndex: "bonus", key: "bonus", render: (v: number) => formatMoney(v) },
    {
      title: "操作", key: "actions", render: (_: any, r: any) => (
        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => removeMember(r.id)} />
      ),
    },
  ];

  // Cost summary table
  const costSummary = costData
    ? [
        { label: `项目耗时 (${costData.actual_months?.toFixed(2) || "—"} 月)`, value: 0, color: "#8b949e", isLabel: true },
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
    { title: "耗时(月)", dataIndex: "actual_months", key: "mos", render: (v: number) => v?.toFixed(2) || "—" },
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
          editForm.setFieldsValue({
            ...project,
            business_manager_ids: (project.business_managers || []).map((m: any) => m.id),
            payment_ratio: project.payment_ratio || undefined,
            contract_date: project.contract_date ? dayjs(project.contract_date) : null,
            ui_confirm_date: project.ui_confirm_date ? dayjs(project.ui_confirm_date) : null,
            actual_delivery_date: project.actual_delivery_date ? dayjs(project.actual_delivery_date) : null,
          });
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
              <Descriptions.Item label="项目周期">{project.project_cycle_month || "-"} 月{project.work_days ? ` / ${project.work_days} 工作日` : ""}</Descriptions.Item>
              <Descriptions.Item label="商务经理">
                {(project.business_managers || []).map((m: any) => m.name).filter(Boolean).join(" / ") || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="回款比例">{project.payment_ratio ? `${project.payment_ratio}（${project.payment_ratio.length}期）` : "-"}</Descriptions.Item>
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

          {(!project.parent_project_id) && (
            <Card
              className="glass-card"
              title={<span><Tag color="orange" style={{ marginRight: 8 }}>增项</Tag>{project.children?.length > 0 ? `共 ${project.children.length} 个增项` : "暂无增项"}</span>}
              extra={<Button size="small" onClick={() => { childForm.resetFields(); childForm.setFieldsValue({ contract_date: dayjs() }); setChildOpen(true); }}>+ 新增增项</Button>}
              style={{ borderRadius: 12, marginBottom: 16, borderLeft: "3px solid #f59e0b" }}
            >
              {project.children && project.children.length > 0 && (
                <>
              {project.children.filter((c: any) => !c.deleted_at).map((child: any) => (
                <div key={child.id} style={{ padding: "10px 0", borderBottom: "1px solid #1e2a3a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <a onClick={() => navigate(`/projects/${child.id}`)} style={{ fontSize: 14 }}>{child.project_name}</a>
                    <Tag className={STATUS_CLS[child.status] || "status-tag-pending"} style={{ marginLeft: 8 }}>{child.status}</Tag>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontWeight: 600 }}>{formatMoney(child.amount)}</span>
                    <Popconfirm title="确定删除该增项？" onConfirm={() => handleDeleteChild(child.id)} okText="确定" cancelText="取消">
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} loading={childDeletingId === child.id} />
                    </Popconfirm>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f59e0b", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span style={{ color: "#f59e0b" }}>增项合计</span>
                <span style={{ color: "#f59e0b" }}>{formatMoney(project.children.reduce((s: number, c: any) => s + Number(c.amount), 0))}</span>
              </div>
                </>
              )}
            </Card>
          )}

          <Card className="glass-card" title="参与人员" extra={<Button size="small" onClick={openMemberModal}>+ 添加</Button>}
            style={{ borderRadius: 12, marginBottom: 16 }}>
            <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(245,158,11,0.06)", borderRadius: 6, display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
              <span>提成池费率 <strong style={{ color: "#f59e0b" }}>{getBonusTierRate(Number(project.amount), !!project.parent_project_id)}</strong></span>
              {project.needs_ui && (
                <span>UI提成 <strong style={{ color: "#a78bfa" }}>{project.ui_commission_rate ? `${(Number(project.ui_commission_rate) * 100).toFixed(0)}%` : "—"}</strong></span>
              )}
              {(() => {
                const uiRate = project.needs_ui ? (Number(project.ui_commission_rate) || 0) : 0;
                const maxDev = ((1 - uiRate) * 100).toFixed(0);
                const devSum = ((project.members || []).filter((m: any) => !(m.role || "").includes("UI")).reduce((s: number, m: any) => s + (Number(m.share_ratio) || 0), 0) * 100).toFixed(0);
                return (
                  <span>开发分成 <strong style={{ color: "#60a5fa" }}>{devSum}% / {maxDev}%</strong></span>
                );
              })()}
            </div>
            <Table dataSource={project.members || []} columns={memberColumns} rowKey="id" size="small" pagination={false} />
          </Card>

          <Card
            className="glass-card"
            title="回款记录"
            extra={<Button size="small" onClick={() => openPaymentModal()}>+ 添加</Button>}
            style={{ borderRadius: 12, marginBottom: 16 }}
          >
            {/* 回款进度提示 */}
            {paymentProgress && (
              <div style={{ marginBottom: 16, padding: 12, background: "rgba(45,212,191,0.08)", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    回款进度 · {paymentProgress.ratio_key}
                  </span>
                  <span style={{ fontSize: 12, color: "#8b949e" }}>
                    已回款 {paymentProgress.total_paid_pct}% · ¥{Number(paymentProgress.total_paid).toLocaleString()} / ¥{Number(paymentProgress.total_amount).toLocaleString()}
                  </span>
                </div>
                <Progress percent={paymentProgress.total_paid_pct} size="small" strokeColor="#2dd4bf" />
                {paymentProgress.next_prompt && (
                  <div style={{
                    marginTop: 10, padding: "6px 12px",
                    background: paymentProgress.total_paid_pct >= 100 ? "rgba(45,212,191,0.12)" : "rgba(245,158,11,0.12)",
                    borderRadius: 6, fontSize: 13, color: paymentProgress.total_paid_pct >= 100 ? "#2dd4bf" : "#f59e0b",
                  }}>
                    {paymentProgress.next_prompt}
                  </div>
                )}
                {/* 各阶段明细 */}
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {paymentProgress.stages.map((s: any) => (
                    <div key={s.stage} style={{
                      flex: "1 1 0", minWidth: 100, padding: 8,
                      background: s.reached ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.03)",
                      borderRadius: 6, border: `1px solid ${s.reached ? "rgba(45,212,191,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 2 }}>{s.name} ({(s.ratio * 100).toFixed(0)}%)</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: s.reached ? "#2dd4bf" : "#c9d1d9" }}>
                        ¥{s.paid_amount.toLocaleString()} / ¥{s.expected_amount.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: s.reached ? "#2dd4bf" : "#8b949e" }}>
                        {s.reached ? `✓ 已达标` : `${s.paid_pct}%`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(project.payments && project.payments.length > 0) ? (
              <Table
                dataSource={project.payments.filter((p: any) => p.status !== "取消")}
                columns={[
                  { title: "阶段", dataIndex: "payment_stage", key: "s", width: 50 },
                  { title: "金额", dataIndex: "payment_amount", key: "a", render: (v: number) => formatMoney(v) },
                  { title: "预计日期", dataIndex: "expected_payment_date", key: "ed", render: (v: any) => v || "-" },
                  { title: "到账日期", dataIndex: "actual_payment_date", key: "ad", render: (v: any) => v || "-" },
                  { title: "状态", dataIndex: "status", key: "st", render: (v: string) => {
                    const cls = v === "已到账" ? "status-tag-done" : v === "逾期" ? "status-tag-resigned" : "status-tag-pending";
                    return <Tag className={cls}>{v}</Tag>;
                  }},
                  { title: "备注", dataIndex: "remark", key: "rm", render: (v: any) => v || "-" },
                  {
                    title: "", key: "actions", width: 80,
                    render: (_: any, r: any) => (
                      <>
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openPaymentModal(r)} />
                        <Popconfirm title="确定删除？" onConfirm={() => deletePayment(r.id)}>
                          <Button type="link" danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </>
                    ),
                  },
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
                {costSummary.map((item: any) => (
                  <div key={item.label} style={{
                    display: "flex", justifyContent: "space-between", padding: "8px 0",
                    borderBottom: "1px solid #1e2a3a", fontWeight: item.bold ? 700 : 400,
                  }}>
                    <span>{item.label}</span>
                    <span style={{ color: item.color, fontVariantNumeric: "tabular-nums" }}>
                      {item.isLabel ? "" : formatMoney(item.value)}
                    </span>
                  </div>
                ))}
                {costData.commission_pool > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: "rgba(245,158,11,0.08)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 6 }}>提成池拆分 (费率 {(costData.commission_rate * 100).toFixed(0)}%)</div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span>提成池总额</span>
                      <span style={{ color: "#f59e0b", fontWeight: 600 }}>{formatMoney(costData.commission_pool)}</span>
                    </div>
                    {costData.ui_commission_rate > 0 && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                          <span>UI分成 ({(costData.ui_commission_rate * 100).toFixed(0)}%)</span>
                          <span style={{ color: "#a78bfa" }}>{formatMoney(costData.ui_commission)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                          <span>开发分成</span>
                          <span style={{ color: "#60a5fa" }}>{formatMoney(costData.dev_commission)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div style={{ marginTop: 12, padding: 12, background: "rgba(45,212,191,0.1)", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 4 }}>
                    {formatMoney(costData.profit)} / {formatMoney(Number(project.amount) * 0.35)} = {(costData.profit_rate * 100).toFixed(1)}%
                  </div>
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
      <Modal
        title="添加项目成员"
        open={memberOpen}
        onOk={addMember}
        onCancel={() => {
          setMemberOpen(false);
          setMemberRows([{ key: 1, employee_id: null, is_lead: false, share_ratio: 1 }]);
        }}
        okText="确认添加"
        cancelText="取消"
        width={680}
      >
        <div style={{ marginBottom: 8, color: "#8b949e", fontSize: 12 }}>
          分成规则：单人项目独享100%。多人项目：负责人固定10%、UI按项目UI比例、开发者按分成比例分配剩余部分。
        </div>
        <Table
          dataSource={memberRows}
          rowKey="key"
          size="small"
          pagination={false}
          columns={[
            {
              title: "员工", dataIndex: "employee_id", width: 200,
              render: (v: any, r: any) => (
                <Select
                  value={v}
                  placeholder="选择员工"
                  showSearch
                  optionFilterProp="label"
                  style={{ width: "100%" }}
                  options={employees
                    .filter((e: any) => e.status === "在职")
                    .map((e: any) => ({ value: e.id, label: `${e.name} - ${e.position || "-"}` }))}
                  onChange={(val) => updateMemberRow(r.key, "employee_id", val)}
                />
              ),
            },
            {
              title: "负责人", dataIndex: "is_lead", width: 70,
              render: (v: any, r: any) => (
                <input
                  type="radio"
                  name="lead-radio"
                  checked={v}
                  onChange={() => {
                    setMemberRows(memberRows.map((row) => ({
                      ...row,
                      is_lead: row.key === r.key,
                    })));
                  }}
                  style={{ cursor: "pointer", width: 18, height: 18 }}
                />
              ),
            },
            {
              title: "分成比例", dataIndex: "share_ratio", width: 130,
              render: (v: any, r: any) => (
                <InputNumber
                  value={v}
                  min={0}
                  max={1}
                  step={0.1}
                  formatter={(val) => val ? `${(val * 100).toFixed(0)}%` : ""}
                  parser={(val: any) => (val ? Number(val.replace("%", "")) / 100 : 0)}
                  onChange={(val) => updateMemberRow(r.key, "share_ratio", val)}
                />
              ),
            },
            {
              title: "", key: "act", width: 60,
              render: (_: any, r: any) => (
                <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => removeMemberRow(r.key)} />
              ),
            },
          ]}
        />
        <Button type="dashed" onClick={addMemberRow} icon={<PlusOutlined />} style={{ marginTop: 12, width: "100%" }}>
          增加一行
        </Button>
        {(() => {
          const devs = memberRows.filter((r) => r.employee_id);
          const total = devs.reduce((s, r) => s + (Number(r.share_ratio) || 0), 0);
          const hasLead = memberRows.some((r) => r.employee_id && r.is_lead);
          const uiRate = project.needs_ui ? (Number(project.ui_commission_rate) || 0) : 0;
          const maxRatio = 1 - uiRate;
          const ok = total <= maxRatio + 0.001;
          const color = ok ? "#2dd4bf" : "#ef4444";
          const maxPct = (maxRatio * 100).toFixed(0);
          return (
            <div style={{ marginTop: 12, padding: 10, background: "rgba(255,255,255,0.04)", borderRadius: 6, fontSize: 12 }}>
              <div style={{ color }}>
                开发分成总和: {(total * 100).toFixed(0)}% / {maxPct}% {ok ? "✓" : "❌ 超出上限"}
                {uiRate > 0 && <span style={{ color: "#8b949e" }}>（UI占{(uiRate * 100).toFixed(0)}%）</span>}
              </div>
              {devs.length >= 2 && (
                <div style={{ color: hasLead ? "#2dd4bf" : "#f59e0b", marginTop: 4 }}>
                  负责人: {hasLead ? "✓ 已选" : "⚠ 多个开发时必选"}
                </div>
              )}
            </div>
          );
        })()}
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
                <InputNumber min={0} max={60} step={0.1} placeholder="如 2.5" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="work_days" label="工期(工作日)">
                <InputNumber min={0} max={365} placeholder="如 55" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="项目状态">
                <Select placeholder="选择状态" options={STATUS_STEPS.map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="business_manager_ids" label="商务经理(可多选)">
            <Select mode="multiple" placeholder="选择一个或多个商务" allowClear style={{ width: "100%" }}
              options={managers.map((m: any) => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="contract_date" label="签约时间">
                <DatePicker style={{ width: "100%" }} placeholder="选择日期" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ui_confirm_date" label="UI确认时间">
                <DatePicker style={{ width: "100%" }} placeholder="选择日期" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actual_delivery_date" label="实际交付">
                <DatePicker style={{ width: "100%" }} placeholder="选择日期" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="needs_ui" label="是否需要UI" valuePropName="checked">
            <Switch checkedChildren="需要" unCheckedChildren="不需要" />
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
          <Form.Item noStyle shouldUpdate={(prev: any, cur: any) => prev.needs_ui !== cur.needs_ui}>
            {({ getFieldValue }) =>
              getFieldValue("needs_ui") ? (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="ui_person_name" label="UI负责人">
                      <Select placeholder="选择或输入UI人员" showSearch allowClear
                        options={uiPersons.map((u: any) => ({ value: u.name, label: u.name }))} />
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

      {/* Payment Add/Edit Modal */}
      <Modal
        title={editingPayment ? "编辑回款记录" : "添加回款记录"}
        open={paymentOpen}
        onOk={savePayment}
        onCancel={() => { setPaymentOpen(false); paymentForm.resetFields(); }}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={paymentForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_stage" label="回款阶段" rules={[{ required: true }]}>
                <Select
                  options={project?.payment_ratio
                    ? paymentProgress?.stages?.map((s: any) => ({ value: s.stage, label: `第${s.stage}期 · ${s.name} (${(s.ratio * 100).toFixed(0)}%)` }))
                    : [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `第${n}期` }))
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_amount" label="回款金额" rules={[{ required: true, message: "请输入金额" }]}>
                <InputNumber min={0} prefix="¥" style={{ width: "100%" }} placeholder="回款金额" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="expected_payment_date" label="预计回款日期">
                <DatePicker style={{ width: "100%" }} placeholder="选择预计日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual_payment_date" label="实际到账日期">
                <DatePicker style={{ width: "100%" }} placeholder="选择到账日期" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select options={[
                  { value: "待回款", label: "待回款" },
                  { value: "已申请", label: "已申请" },
                  { value: "已到账", label: "已到账" },
                  { value: "逾期", label: "逾期" },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remark" label="备注">
                <Input placeholder="备注信息" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Add Child Project Modal */}
      <Modal
        title={`新增增项 — ${project.project_name}`}
        open={childOpen}
        onOk={handleCreateChild}
        onCancel={() => { setChildOpen(false); childForm.resetFields(); }}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form form={childForm} layout="vertical">
          <Form.Item name="project_name" label="增项名称" rules={[{ required: true, message: "请输入增项名称" }]}>
            <Input placeholder="如 AI客服系统-新增语音模块" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="金额" rules={[{ required: true, message: "请输入金额" }]}>
                <InputNumber min={0} prefix="¥" style={{ width: "100%" }} placeholder="增项金额" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contract_date" label="签约时间" initialValue={dayjs()}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="状态" initialValue="待签约">
            <Select options={STATUS_STEPS.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="增项说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
