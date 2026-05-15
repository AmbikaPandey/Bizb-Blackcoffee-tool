import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter email and password');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login">
            <button
                className="login__theme-toggle"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="login__container">
                <div className="login__brand">
                    <div className="login__brand-icon">BC</div>
                    <div className='login__brand-name'>
                        <h1>BizB</h1>
                        <p>Blackcoffee Business Management Tool</p>
                    </div>
                </div>

                <div className="login__card">
                    <h2 className="login__title">Sign In</h2>
                    <p className="login__subtitle">Enter your credentials to access your account</p>

                    <form onSubmit={handleSubmit} className="login__form">
                        {error && <div className="login__error">{error}</div>}
                        <div className="login__field">
                            <label>Email</label>
                            <div className="login__input-wrap">
                                <Mail size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>
                        <div className="login__field">
                            <label>Password</label>
                            <div className="login__input-wrap">
                                <Lock size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                />
                                <button
                                    type="button"
                                    className="login__eye-toggle"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="login__submit" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>

                <p className="login__footer">
                    &copy; 2026 Black Coffee Communication Pvt. Ltd.
                </p>
            </div>
        </div>
    );
}
