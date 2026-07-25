import { ConfigProvider, theme } from "antd";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import zhCN from "antd/locale/zh_CN";
import AppLayout from "./components/Layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import ProjectList from "./pages/Projects/ProjectList";
import ProjectDetail from "./pages/Projects/ProjectDetail";
import EmployeeList from "./pages/Employees/EmployeeList";
import EmployeeDetail from "./pages/Employees/EmployeeDetail";
import UIPersonList from "./pages/Employees/UIPersonList";
import BusinessList from "./pages/Employees/BusinessList";

const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#3b82f6",
    colorBgBase: "#0a0e14",
    colorBgContainer: "#12161e",
    colorBgElevated: "#1a1f2b",
    colorBorder: "#1e2a3a",
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    colorText: "#cdd6e0",
    colorTextSecondary: "#8b949e",
    colorSuccess: "#2dd4bf",
    colorWarning: "#f59e0b",
    colorError: "#ef4444",
    colorInfo: "#3b82f6",
  },
  components: {
    Card: {
      colorBgContainer: "rgba(18, 22, 30, 0.8)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)",
    },
    Layout: {
      bodyBg: "#0a0e14",
      siderBg: "#0d1117",
      triggerBg: "#0d1117",
    },
    Menu: {
      darkItemBg: "transparent",
      darkItemSelectedBg: "rgba(59, 130, 246, 0.15)",
    },
  },
};

function App() {
  return (
    <ConfigProvider theme={darkTheme} locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="employees" element={<EmployeeList />} />
            <Route path="employees/:id" element={<EmployeeDetail />} />
            <Route path="ui-persons" element={<UIPersonList />} />
            <Route path="business" element={<BusinessList />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
