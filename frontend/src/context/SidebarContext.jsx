import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SidebarContext = createContext(null);

const STORAGE_KEY = 'bizb_sidebar_collapsed';
const BREAKPOINT = 768;

export function SidebarProvider({ children }) {
    const [collapsed, setCollapsed] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) return saved === 'true';
        return window.innerWidth < BREAKPOINT;
    });

    const [mobileOpen, setMobileOpen] = useState(false);

    const isMobile = () => window.innerWidth <= BREAKPOINT;

    const toggle = useCallback(() => {
        if (isMobile()) {
            setMobileOpen((prev) => !prev);
        } else {
            setCollapsed((prev) => {
                localStorage.setItem(STORAGE_KEY, String(!prev));
                return !prev;
            });
        }
    }, []);

    const closeMobile = useCallback(() => {
        setMobileOpen(false);
    }, []);

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${BREAKPOINT}px)`);
        const handler = (e) => {
            if (e.matches) {
                setCollapsed(true);
                setMobileOpen(false);
                localStorage.setItem(STORAGE_KEY, 'true');
            }
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return (
        <SidebarContext.Provider value={{ collapsed, toggle, mobileOpen, closeMobile }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const ctx = useContext(SidebarContext);
    if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
    return ctx;
}
