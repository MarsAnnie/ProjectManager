import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Descriptions, Tag, Button, Table, Spin, Row, Col, Timeline,
  Modal, Form, Select, InputNumber, Input, Switch, message, Steps
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
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
  const [uiPersons, setUIPersons] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [editForm] = Form.useForm();
  const [memberRows, setMemberRows] = useState<any[]>([{ key: 1, employee_id: null, is_lead: false, is_ui: false, share_ratio: 1 }]);

  const openMemberModal = () => {
    // 回显已有成员
    if (project?.members && project.members.length > 0) {
      setMemberRows(project.members.map((m: any) => ({
        key: m.id,
        employee_id: m.employee_id,
        is_lead: m.role === "负责人",
        is_ui: m.role === "UI",
        share_ratio: Number(m.share_ratio) || 1,
        _existing: true, // 标记为已存在的成员
      })));
    } else {
      setMemberRows([{ key: 1, employee_id: null, is_lead: false, is_ui: false, share_ratio: 1 }]);
    }
    setMemberOpen(true);
  };
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
    api.get("/employees", { params: { page_size: 200, status: "在职" } }).then((r) => {
      setEmployees(r.data.items || []);
    });
    api.get("/ui-persons").then((r) => setUIPersons(r.data));
    api.get("/business-managers").then((r) => setManagers(r.data));
  }, [id]);

  const calcCost = async () => {
    setCalcLoading(true);
    const r = await api.post(`/projects/${id}/calculate-cost`);
    setCostData(r.data);
    setCalcLoading(false);
    message.success("成本计算完成");
    fetchProject();
  };

  const addMemberRow = () => {
    setMemberRows([...memberRows, {
      key: Date.now(),
      employee_id: null, is_lead: false, is_ui: false, share_ratio: 1,
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
    // 校验1: 开发人员(非UI)分成总和不超过100%
    const devs = valid.filter((r) => !r.is_ui);
    const totalRatio = devs.reduce((sum, r) => sum + (Number(r.share_ratio) || 0), 0);
    if (totalRatio > 1.001) {
      message.error(`开发分成比例总和 ${(totalRatio * 100).toFixed(0)}% 超过100%`);
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
      role: r.is_lead ? "负责人" : r.is_ui ? "UI" : "开发",
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
    setMemberRows([{ key: 1, employee_id: null, is_lead: false, is_ui: false, share_ratio: 1 }]);
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
    {
      title: "角色", dataIndex: "role", key: "role",
      render: (v: string) => {
        const cls = v === "负责人" ? "status-tag-regular" : v === "UI" ? "status-tag-probation" : "status-tag-progress";
        return <Tag className={cls}>{v || "开发"}</Tag>;
      },
    },
    {
      title: "分成比例", dataIndex: "share_ratio", key: "sr",
      render: (v: any, r: any) => r.role === "开发" ? `${((v || 1) * 100).toFixed(0)}%` : "-",
    },
    { title: "奖金", dataIndex: "bonus", key: "bonus", render: (v: number) => formatMoney(v) },
    {
      title: "操作", key: "actions", render: (_: any, r: any) => (
        <Button type="link" danger size="small" onClick={() => removeMember(r.id)}>移除</Button>
      ),
    },
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
          editForm.setFieldsValue({
            ...project,
            business_manager_ids: (project.business_managers || []).map((m: any) => m.id),
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
              <Descriptions.Item label="项目周期">{project.project_cycle_month || "-"} 月</Descriptions.Item>
              <Descriptions.Item label="商务经理">
                {(project.business_managers || []).map((m: any) => m.name).filter(Boolean).join(" / ") || "-"}
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

          <Card className="glass-card" title="参与人员" extra={<Button size="small" onClick={openMemberModal}>+ 添加</Button>}
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
          setMemberRows([{ key: 1, employee_id: null, is_lead: false, is_ui: false, share_ratio: 1 }]);
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
                    // 清除其他行的负责人标记
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
              title: "UI", dataIndex: "is_ui", width: 50,
              render: (v: any, r: any) => (
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) => updateMemberRow(r.key, "is_ui", e.target.checked)}
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
                <Button type="link" danger size="small" onClick={() => removeMemberRow(r.key)}>删除</Button>
              ),
            },
          ]}
        />
        <Button type="dashed" onClick={addMemberRow} icon={<PlusOutlined />} style={{ marginTop: 12, width: "100%" }}>
          增加一行
        </Button>
        {(() => {
          const devs = memberRows.filter((r) => r.employee_id && !r.is_ui);
          const total = devs.reduce((s, r) => s + (Number(r.share_ratio) || 0), 0);
          const hasLead = memberRows.some((r) => r.employee_id && r.is_lead);
          const color = total > 1.001 ? "#ef4444" : "#2dd4bf";
          return (
            <div style={{ marginTop: 12, padding: 10, background: "rgba(255,255,255,0.04)", borderRadius: 6, fontSize: 12 }}>
              <div style={{ color }}>
                开发分成总和: {(total * 100).toFixed(0)}% {total > 1.001 ? "❌ 超过100%" : "✓"}
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
          <Form.Item name="needs_ui" label="是否需要UI" valuePropName="checked">
            <Switch checkedChildren="需要" unCheckedChildren="不需要" />
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
    </div>
  );
}
