import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, Package, FileText, CreditCard,
    FolderKanban, Building2, Receipt, BarChart3, Settings, UserCog,
    ChevronLeft, ChevronRight, LogOut, Calculator, FileCheck, TrendingUp, ScrollText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';

const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Super Admin', 'Admin', 'Sales Manager', 'Accounts'] },
    { path: '/clients', label: 'Clients', icon: Users, roles: ['Super Admin', 'Admin', 'Sales Manager'] },
    { path: '/products', label: 'Products', icon: Package, roles: ['Super Admin', 'Admin'] },
    { path: '/costings', label: 'Costings', icon: Calculator, roles: ['Super Admin', 'Admin', 'Sales Manager', 'Accounts'] },
    { path: '/quotes', label: 'Quotes', icon: FileCheck, roles: ['Super Admin', 'Admin', 'Sales Manager', 'Accounts'] },
    { path: '/invoices', label: 'Invoices', icon: FileText, roles: ['Super Admin', 'Admin', 'Sales Manager', 'Accounts'] },
    { path: '/payments', label: 'Payments', icon: CreditCard, roles: ['Super Admin', 'Admin', 'Accounts'] },
    { path: '/projects', label: 'Projects', icon: FolderKanban, roles: ['Super Admin', 'Admin', 'Sales Manager', 'Sales Executive'] },
    { path: '/vendors', label: 'Vendors', icon: Building2, roles: ['Super Admin', 'Admin', 'Sales Manager'] },
    { path: '/expenses', label: 'Expenses', icon: Receipt, roles: ['Super Admin', 'Admin', 'Sales Manager', 'Sales Executive', 'Accounts'] },
    { path: '/commission', label: 'Commission', icon: TrendingUp, roles: ['Super Admin', 'Admin'] },
    { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['Super Admin', 'Admin', 'Accounts'] },
    { path: '/audit', label: 'Audit Trail', icon: ScrollText, roles: ['Super Admin', 'Admin'] },
    { path: '/settings', label: 'Settings', icon: Settings, roles: ['Super Admin', 'Admin'] },
    { path: '/users', label: 'Users', icon: UserCog, roles: ['Super Admin', 'Admin', 'Sales Manager', 'Sales Executive', 'Accounts'] },
];

export default function Sidebar() {
    const location = useLocation();
    const { user, isAdmin, logout } = useAuth();
    const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();

    const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(user?.role));

    const handleNavClick = () => {
        if (window.innerWidth <= 768) closeMobile();
    };

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`} aria-label="Main navigation">
            {/* Toggle pill on border edge */}
            <button
                className="sidebar__toggle"
                onClick={toggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
            </button>

            {/* Brand */}
            <div className="sidebar__brand">
                <div className="sidebar__brand-mark">BC</div>
                <div className="sidebar__brand-text">
                    <span className="sidebar__brand-name">BizB</span>
                </div>
            </div>

            {/* Divider */}
            <div className="sidebar__divider" />

            {/* Nav links */}
            <nav className="sidebar__nav">
                {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                            title={collapsed ? item.label : undefined}
                            onClick={handleNavClick}
                        >
                            <span className="sidebar__item-icon">
                                <Icon size={19} strokeWidth={1.8} />
                            </span>
                            <span className="sidebar__item-text">{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* User footer */}
            <div className="sidebar__footer">
                <div className="sidebar__profile">
                    <div className="sidebar__avatar">
                        {(user?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="sidebar__profile-info">
                        <p className="sidebar__profile-name">{user?.username || 'User'}</p>
                        <span className="sidebar__profile-role">{user?.role || 'Admin'}</span>
                    </div>
                    <button className="sidebar__logout" onClick={logout} title="Logout">
                        <LogOut size={16} strokeWidth={2} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
