import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Descriptions, Tag, Button, Spin } from "antd";
import api from "../../api/client";

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/employees/${id}`).then((r) => {
      setEmployee(r.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Spin />;
  if (!employee) return <p>员工不存在</p>;

  return (
    <div>
      <Button onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← 返回</Button>
      <Card className="glass-card" style={{ borderRadius: 12, marginBottom: 24 }}>
        <Descriptions title="员工信息" column={3}>
          <Descriptions.Item label="姓名">{employee.name}</Descriptions.Item>
          <Descriptions.Item label="岗位">{employee.position}</Descriptions.Item>
          <Descriptions.Item label="级别">{employee.level}</Descriptions.Item>
          <Descriptions.Item label="员工类型">
            <Tag>{employee.employment_type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={employee.status === "在职" ? "green" : "default"}>{employee.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="入职时间">{employee.hire_date}</Descriptions.Item>
          <Descriptions.Item label="工资">¥{Number(employee.salary).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="保底">¥{Number(employee.guarantee).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="社保">¥{Number(employee.social_security).toLocaleString()}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
