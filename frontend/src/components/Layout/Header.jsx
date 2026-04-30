import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ChevronDown, LogOut, Sun, Moon, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';

export default function Header() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { toggle } = useSidebar();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <header className="header">
            <button className="header__hamburger" onClick={toggle} aria-label="Toggle menu">
                <Menu size={22} />
            </button>
            <div className="header__actions">
                <button
                    className="header__theme-toggle"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <div className="header__profile" ref={menuRef}>
                    <div className="header__profile-btn" onClick={() => setMenuOpen((v) => !v)}>
                        <div className="header__avatar">
                            <User size={16} />
                        </div>
                        <span className="header__name">{user?.username || 'User'}</span>
                        <ChevronDown size={16} className="header__chevron" />
                    </div>
                    {menuOpen && (
                        <div className="header__dropdown">
                            <div className="header__dropdown-info">
                                <strong>{user?.username}</strong>
                                <span>{user?.email}</span>
                                <span className="header__dropdown-role">{user?.role}</span>
                            </div>
                            <button className="header__dropdown-item" onClick={handleLogout}>
                                <LogOut size={16} />
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
