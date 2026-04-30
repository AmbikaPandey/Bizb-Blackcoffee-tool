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
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const UsersPage = lazy(() => import("./pages/Users"));

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

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <AppLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/invoices" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (user) return <Navigate to="/invoices" replace />;
  return children;
}

function DefaultRedirect() {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? "/dashboard" : "/invoices"} replace />;
}

function LoginRedirect() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <AppLoader />;
  if (user) return <Navigate to={isAdmin ? "/dashboard" : "/invoices"} replace />;
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
                  <Route path="dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                  <Route path="clients" element={<AdminRoute><Clients /></AdminRoute>} />
                  <Route path="clients/:id" element={<AdminRoute><ClientDetail /></AdminRoute>} />
                  <Route path="products" element={<AdminRoute><Products /></AdminRoute>} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="invoices/new" element={<NewInvoice />} />
                  <Route path="invoices/:id" element={<ViewInvoice />} />
                  <Route path="invoices/:id/edit" element={<EditInvoice />} />
                  <Route path="payments" element={<AdminRoute><Payments /></AdminRoute>} />
                  <Route path="projects" element={<AdminRoute><Projects /></AdminRoute>} />
                  <Route path="vendors" element={<AdminRoute><Vendors /></AdminRoute>} />
                  <Route path="expenses" element={<AdminRoute><Expenses /></AdminRoute>} />
                  <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
                  <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
                  <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
