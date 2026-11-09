import type { ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { getRole, logout, RequireAuth } from './auth';
import AlertsPage from './pages/AlertsPage';
import LoginPage from './pages/LoginPage';
import OrdersPage from './pages/OrdersPage';
import ProductsPage from './pages/ProductsPage';
import ReportsPage from './pages/ReportsPage';

function Layout({ children }: { children: ReactNode }) {
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded ${isActive ? 'bg-gray-900 text-white' : 'hover:bg-gray-200'}`;
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex flex-wrap items-center gap-2 border-b bg-white px-4 py-3">
        <span className="mr-4 font-bold">OMS</span>
        <NavLink to="/products" className={link}>Sản phẩm</NavLink>
        <NavLink to="/orders" className={link}>Đơn hàng</NavLink>
        <NavLink to="/alerts" className={link}>Cảnh báo kho</NavLink>
        {getRole() === 'ADMIN' && <NavLink to="/reports" className={link}>Báo cáo</NavLink>}
        <button onClick={logout} className="ml-auto rounded px-3 py-2 hover:bg-gray-200">
          Đăng xuất ({getRole()})
        </button>
      </nav>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}

const page = (el: ReactNode) => (
  <RequireAuth>
    <Layout>{el}</Layout>
  </RequireAuth>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/products" element={page(<ProductsPage />)} />
      <Route path="/orders" element={page(<OrdersPage />)} />
      <Route path="/alerts" element={page(<AlertsPage />)} />
      <Route path="/reports" element={page(<ReportsPage />)} />
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}
