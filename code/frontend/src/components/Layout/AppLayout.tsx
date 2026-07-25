import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu } from "antd";
import {
  DashboardOutlined,
  ProjectOutlined,
  TeamOutlined,
} from "@ant-design/icons";

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: "/", icon: <DashboardOutlined />, label: "经营驾驶舱" },
  { key: "/projects", icon: <ProjectOutlined />, label: "项目管理" },
  { key: "/employees", icon: <TeamOutlined />, label: "人员管理" },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = location.pathname === "/" ? "/" : `/${location.pathname.split("/")[1]}`;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={220}
        style={{
          borderRight: "1px solid #1e2a3a",
          background: "#0d1117",
        }}
      >
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            borderBottom: "1px solid #1e2a3a",
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#e6edf3",
              letterSpacing: "-0.3px",
            }}
          >
            ProjectManager
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          theme="dark"
          style={{
            background: "transparent",
            borderInlineEnd: "none",
            marginTop: 8,
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#0a0e14",
            borderBottom: "1px solid #1e2a3a",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
          }}
        >
          <span style={{ color: "#8b949e", fontSize: 13 }}>
            {new Date().toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </span>
        </Header>
        <Content
          style={{
            padding: 24,
            overflow: "auto",
            maxHeight: "calc(100vh - 56px)",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
