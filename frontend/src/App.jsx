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
const HsnMaster = lazy(() => import("./pages/HsnMaster"));
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

function PermissionRoute({ children, module, action = 'view' }) {
  const { user, loading, can } = useAuth();
  if (loading) return <AppLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!can(module, action)) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function DefaultRedirect() {
  const { can } = useAuth();
  if (can('dashboard', 'view')) return <Navigate to="/dashboard" replace />;
  if (can('projects', 'view')) return <Navigate to="/projects" replace />;
  if (can('expenses', 'view')) return <Navigate to="/expenses" replace />;
  if (can('users', 'view')) return <Navigate to="/users" replace />;
  return <Navigate to="/login" replace />;
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
                  <Route path="dashboard" element={<PermissionRoute module="dashboard"><Dashboard /></PermissionRoute>} />
                  <Route path="clients" element={<PermissionRoute module="clients"><Clients /></PermissionRoute>} />
                  <Route path="clients/:id" element={<PermissionRoute module="clients"><ClientDetail /></PermissionRoute>} />
                  <Route path="products" element={<PermissionRoute module="products"><Products /></PermissionRoute>} />
                  <Route path="hsn-master" element={<PermissionRoute module="hsnMaster"><HsnMaster /></PermissionRoute>} />
                  <Route path="invoices" element={<PermissionRoute module="invoices"><Invoices /></PermissionRoute>} />
                  <Route path="invoices/new" element={<PermissionRoute module="invoices" action="create"><NewInvoice /></PermissionRoute>} />
                  <Route path="invoices/:id" element={<PermissionRoute module="invoices"><ViewInvoice /></PermissionRoute>} />
                  <Route path="invoices/:id/edit" element={<PermissionRoute module="invoices" action="edit"><EditInvoice /></PermissionRoute>} />
                  <Route path="payments" element={<PermissionRoute module="payments"><Payments /></PermissionRoute>} />
                  <Route path="projects" element={<PermissionRoute module="projects"><Projects /></PermissionRoute>} />
                  <Route path="vendors" element={<PermissionRoute module="vendors"><Vendors /></PermissionRoute>} />
                  <Route path="vendors/:id" element={<PermissionRoute module="vendors"><VendorDetail /></PermissionRoute>} />
                  <Route path="expenses" element={<PermissionRoute module="expenses"><Expenses /></PermissionRoute>} />
                  <Route path="reports" element={<PermissionRoute module="reports"><Reports /></PermissionRoute>} />
                  <Route path="settings" element={<PermissionRoute module="settings"><Settings /></PermissionRoute>} />
                  <Route path="users" element={<PermissionRoute module="users"><UsersPage /></PermissionRoute>} />
                  <Route path="users/:id" element={<PermissionRoute module="users"><UserDetail /></PermissionRoute>} />
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
