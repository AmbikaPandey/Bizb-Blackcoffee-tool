import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/common/Toast";
import Layout from "./components/Layout/Layout";
import Login from "./pages/Login";
import PageLoader from "./components/common/PageLoader";

// Lazy-loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Products = lazy(() => import("./pages/Products"));
const Invoices = lazy(() => import("./pages/Invoices"));
const NewInvoice = lazy(() => import("./pages/NewInvoice"));
const ViewInvoice = lazy(() => import("./pages/ViewInvoice"));
const EditInvoice = lazy(() => import("./pages/EditInvoice"));
const Payments = lazy(() => import("./pages/Payments"));
const Projects = lazy(() => import("./pages/Projects"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const UsersPage = lazy(() => import("./pages/Users"));
const UserDetail = lazy(() => import("./pages/UserDetail"));

function AppLoader() {
  return (
    <div className="app-loader">
      <div className="app-loader__inner">
        <div className="app-loader__mark">BC</div>
        <div className="app-loader__dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }) {
  return <RoleRoute roles={['Admin']}>{children}</RoleRoute>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function DefaultRedirect() {
  const { user } = useAuth();
  if (user?.role === 'Executive') return <Navigate to="/projects" replace />;
  return <Navigate to="/dashboard" replace />;
}

function LoginRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<PublicRoute><LoginRedirect /></PublicRoute>} />
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route index element={<DefaultRedirect />} />
                  <Route path="dashboard" element={<RoleRoute roles={['Admin', 'Manager']}><Dashboard /></RoleRoute>} />
                  <Route path="clients" element={<RoleRoute roles={['Admin', 'Manager']}><Clients /></RoleRoute>} />
                  <Route path="clients/:id" element={<RoleRoute roles={['Admin', 'Manager']}><ClientDetail /></RoleRoute>} />
                  <Route path="products" element={<AdminRoute><Products /></AdminRoute>} />
                  <Route path="invoices" element={<RoleRoute roles={['Admin', 'Manager']}><Invoices /></RoleRoute>} />
                  <Route path="invoices/new" element={<RoleRoute roles={['Admin', 'Manager']}><NewInvoice /></RoleRoute>} />
                  <Route path="invoices/:id" element={<RoleRoute roles={['Admin', 'Manager']}><ViewInvoice /></RoleRoute>} />
                  <Route path="invoices/:id/edit" element={<RoleRoute roles={['Admin', 'Manager']}><EditInvoice /></RoleRoute>} />
                  <Route path="payments" element={<AdminRoute><Payments /></AdminRoute>} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="vendors" element={<RoleRoute roles={['Admin', 'Manager']}><Vendors /></RoleRoute>} />
                  <Route path="vendors/:id" element={<RoleRoute roles={['Admin', 'Manager']}><VendorDetail /></RoleRoute>} />
                  <Route path="expenses" element={<Expenses />} />
                  <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
                  <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
                  <Route path="users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
                  <Route path="users/:id" element={<ProtectedRoute><UserDetail /></ProtectedRoute>} />
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
