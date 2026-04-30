import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';

function LayoutInner() {
    const { collapsed, mobileOpen, closeMobile } = useSidebar();
    return (
        <div className={`layout ${collapsed ? 'layout--collapsed' : ''} ${mobileOpen ? 'layout--mobile-open' : ''}`}>
            <Sidebar />
            {mobileOpen && <div className="layout__overlay" onClick={closeMobile} />}
            <div className="layout__content">
                <Header />
                <main className="layout__main">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default function Layout() {
    return (
        <SidebarProvider>
            <LayoutInner />
        </SidebarProvider>
    );
}
