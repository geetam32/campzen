import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Shield, User, Users, Lock, ArrowRight, ArrowLeft, Loader2, BookOpen, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/styles.css';
import '../styles/auth.css';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState(null);
    const [formData, setFormData] = useState({
        collegeCode: '',
        userId: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const roles = [
        {
            id: 'admin',
            label: 'Admin',
            icon: Shield,
            description: 'Institue Management',
            color: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
            bgLight: 'rgba(99, 102, 241, 0.1)',
            hasRegister: false
        },
        {
            id: 'student',
            label: 'Student',
            icon: GraduationCap,
            description: 'Learning Resources',
            color: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
            bgLight: 'rgba(34, 197, 94, 0.1)',
            hasRegister: false
        },
        {
            id: 'teacher',
            label: 'Teacher',
            icon: Users,
            description: 'Academic Faculty',
            color: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            bgLight: 'rgba(139, 92, 246, 0.1)',
            hasRegister: false
        },
        {
            id: 'driver',
            label: 'Driver',
            icon: Truck,
            description: 'Bus Tracking',
            color: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
            bgLight: 'rgba(249, 115, 22, 0.1)',
            hasRegister: false
        }
    ];



    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);



        try {
            const result = await login(
                formData.collegeCode,
                formData.userId,
                formData.password
            );

            if (result.role !== selectedRole) {
                setError(`Invalid credentials. This is not a ${selectedRole} account.`);
                setLoading(false);
                return;
            }

            if (result.mustChangePassword) {
                navigate('/change-password');
            } else {
                navigate(`/${result.role}`);
            }
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setSelectedRole(null);
        setError('');
        setFormData({ collegeCode: '', userId: '', password: '' });
    };

    const currentRole = roles.find(r => r.id === selectedRole);

    return (
        <div className="modern-auth-container">
            {/* Background Decorative Elements */}
            <div className="bg-dots"></div>
            <div className="bg-circle circle-1"></div>
            <div className="bg-circle circle-2"></div>

            <div className={`auth-content-wrapper ${selectedRole ? 'form-active' : ''}`}>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="corner-logo"
                >
                    <img src="/campusnet-logo.jpg" alt="Logo" />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="auth-brand"
                >
                    <h1 className="brand-title">Campus<span className="text-brand-blue">Net</span></h1>
                    <p className="brand-tagline">── CONNECT • LEARN • SUCCEED ──</p>
                </motion.div>

                <AnimatePresence mode="wait">
                    {!selectedRole ? (
                        <motion.div
                            key="role-selection"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="modern-role-selection"
                        >
                            <h2 className="selection-title">Choose Your Identity</h2>
                            <div className="modern-role-grid">
                                {roles.map((role) => (
                                    <motion.div
                                        key={role.id}
                                        whileHover={{ y: -5 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="role-card-wrapper"
                                    >
                                        <button
                                            className="modern-role-card"
                                            onClick={() => setSelectedRole(role.id)}
                                            style={{ '--role-color': role.color, '--role-bg': role.bgLight, '--role-theme': role.color }}
                                        >
                                            <div className="role-icon-box">
                                                <role.icon size={48} />
                                            </div>
                                            <div className="role-meta">
                                                <span className="role-title">{role.label}</span>
                                                <span className="role-info">{role.description}</span>
                                            </div>
                                        </button>
                                        {role.hasRegister && (
                                            <Link to={role.registerPath} className="modern-register-link">
                                                {role.registerLabel}
                                            </Link>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="login-form"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="modern-auth-card"
                        >
                            <button className="modern-back-btn" onClick={handleBack}>
                                <ArrowLeft size={18} />
                                <span>Change Role</span>
                            </button>

                            <div className="auth-role-header" style={{ '--role-theme': currentRole.color }}>
                                <div className="role-badge-icon">
                                    <currentRole.icon size={24} />
                                </div>
                                <div className="role-badge-text">
                                    <h3>{currentRole.label} Entrance</h3>
                                    <p>Please provide your credentials to continue</p>
                                </div>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="modern-alert"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <form onSubmit={handleSubmit} className="modern-form">
                                <div className="modern-form-group">
                                    <label>College Code</label>
                                    <div className="modern-input-wrapper">
                                        <Shield size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            placeholder="e.g. PIT01"
                                            required
                                            value={formData.collegeCode}
                                            onChange={(e) => setFormData({ ...formData, collegeCode: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                </div>

                                <div className="modern-form-group">
                                    <label>{selectedRole === 'student' ? 'Student ID / PIN' : 'User ID / Email'}</label>
                                    <div className="modern-input-wrapper">
                                        <User size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            placeholder={selectedRole === 'student' ? 'Enter PIN' : 'Enter ID'}
                                            required
                                            value={formData.userId}
                                            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="modern-form-group">
                                    <label>Access Password</label>
                                    <div className="modern-input-wrapper">
                                        <Lock size={18} className="input-icon" />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            required
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="modern-btn-submit" disabled={loading} style={{ '--btn-theme': currentRole.color }}>
                                    {loading ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <>
                                            Authorize Access
                                            <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Login;

