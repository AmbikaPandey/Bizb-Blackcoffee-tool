import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('bizb_user');
        return saved ? JSON.parse(saved) : null;
    });
    // Only show loading if there's a token but no cached user
    const [loading, setLoading] = useState(() => {
        const hasToken = !!localStorage.getItem('bizb_token');
        const hasCachedUser = !!localStorage.getItem('bizb_user');
        return hasToken && !hasCachedUser;
    });

    const idleTimerRef = useRef(null);
    const idleTimeoutMinutes = useRef(
        parseInt(localStorage.getItem('bizb_idle_timeout') || '30', 10)
    );

    // Reset idle timer on user activity
    const resetIdleTimer = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (!localStorage.getItem('bizb_token')) return;
        idleTimerRef.current = setTimeout(() => {
            // Auto-logout on idle
            setUser(null);
            localStorage.removeItem('bizb_token');
            localStorage.removeItem('bizb_user');
            window.location.href = '/login';
        }, idleTimeoutMinutes.current * 60 * 1000);
    };

    useEffect(() => {
        if (user) {
            const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
            events.forEach(ev => window.addEventListener(ev, resetIdleTimer));
            resetIdleTimer();
            return () => {
                events.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
                if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            };
        }
    }, [user]);

    useEffect(() => {
        const token = localStorage.getItem('bizb_token');
        if (token) {
            api.getMe()
                .then((u) => {
                    setUser(u);
                    localStorage.setItem('bizb_user', JSON.stringify(u));
                })
                .catch(() => {
                    setUser(null);
                    localStorage.removeItem('bizb_token');
                    localStorage.removeItem('bizb_user');
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        const result = await api.login(email, password);
        const { token, user: u, session } = result;
        localStorage.setItem('bizb_token', token);
        localStorage.setItem('bizb_user', JSON.stringify(u));
        if (session?.idle_timeout_minutes) {
            localStorage.setItem('bizb_idle_timeout', String(session.idle_timeout_minutes));
            idleTimeoutMinutes.current = session.idle_timeout_minutes;
        }
        setUser(u);
        return u;
    };

    const logout = async () => {
        try { await api.logout(); } catch { }
        localStorage.removeItem('bizb_token');
        localStorage.removeItem('bizb_user');
        setUser(null);
    };

    const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';
    const isSuperAdmin = user?.role === 'Super Admin';
    const isManager = user?.role === 'Sales Manager';
    const isExecutive = user?.role === 'Sales Executive';
    const isAccounts = user?.role === 'Accounts';
    const hasRole = (...roles) => roles.includes(user?.role);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isSuperAdmin, isManager, isExecutive, isAccounts, hasRole }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
