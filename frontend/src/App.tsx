import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { LoginPage } from './pages/LoginPage';
import { MachineDetailPage } from './pages/MachineDetailPage';
import { MachinesPage } from './pages/MachinesPage';
import { OrdersPage } from './pages/OrdersPage';
import { PlanningPage } from './pages/PlanningPage';
import { ReportsPage } from './pages/ReportsPage';
import { ShiftsPage } from './pages/ShiftsPage';
import { ShopfloorPage } from './pages/ShopfloorPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Panel de administración: exige sesión de ADMIN */}
      <Route element={<ProtectedRoute role="ADMIN" />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/machines" element={<MachinesPage />} />
          <Route path="/machines/:id" element={<MachineDetailPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
        </Route>
      </Route>

      {/* Planta: exige sesión de EMPLOYEE, sin el menú del panel */}
      <Route element={<ProtectedRoute role="EMPLOYEE" />}>
        <Route path="/planta" element={<ShopfloorPage />} />
      </Route>

      {/* Va a "/" y, si es un empleado, ProtectedRoute lo lleva a /planta */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
