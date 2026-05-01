import { createContext, useContext, useState, useEffect } from 'react';
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

    useEffect(() => {
        const token = localStorage.getItem('bizb_token');
        if (token) {
            // Background validation — UI renders instantly from cached user
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
        const { token, user: u } = await api.login(email, password);
        localStorage.setItem('bizb_token', token);
        localStorage.setItem('bizb_user', JSON.stringify(u));
        setUser(u);
        return u;
    };

    const logout = async () => {
        try { await api.logout(); } catch { }
        localStorage.removeItem('bizb_token');
        localStorage.removeItem('bizb_user');
        setUser(null);
    };

    const isAdmin = user?.role === 'Admin';
    const isManager = user?.role === 'Manager';
    const isExecutive = user?.role === 'Executive';
    const hasRole = (...roles) => roles.includes(user?.role);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isManager, isExecutive, hasRole }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
