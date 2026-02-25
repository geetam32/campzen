import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Settings,
    Users,
    BookOpen,
    Calendar,
    LogOut,
    Menu,
    X,
    Bell,
    Search,
    School
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const { logout, userData } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
        { name: 'College Settings', icon: Settings, path: '/admin/settings' },
        { name: 'Class Management', icon: School, path: '/admin/classes' },
        { name: 'Teacher Hub', icon: Users, path: '/admin/teachers' },
        { name: 'Student Data', icon: BookOpen, path: '/admin/students' },
        { name: 'Timetables', icon: Calendar, path: '/admin/timetable' },
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#020617] flex">
            {/* Sidebar */}
            <AnimatePresence mode="wait">
                {sidebarOpen && (
                    <motion.aside
                        initial={{ x: -300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -300, opacity: 0 }}
                        className="fixed md:relative z-40 w-72 h-screen bg-slate-900/50 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col"
                    >
                        <div className="flex items-center gap-3 mb-10 px-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden glass-border p-1">
                                    <img src="/campzen-logo.png" alt="Logo" className="w-full h-full object-cover" />
                                </div>
                                <h1 className="text-white font-bold leading-none tracking-tight text-lg">
                                    Camp<span className="text-indigo-400">zen</span>
                                </h1>
                            </div>
                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1 block">Admin Console</span>
                        </div>

                        <nav className="flex-1 space-y-2">
                            {menuItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.path}
                                        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group ${isActive
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'group-hover:text-indigo-400'} transition-colors`} />
                                        <span className="font-semibold text-sm">{item.name}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all mt-auto"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-semibold text-sm">Sign Out</span>
                        </button>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-slate-900/20 backdrop-blur-md border-b border-white/10 px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors"
                        >
                            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                        <div className="hidden md:flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 w-80">
                            <Search className="w-4 h-4 text-slate-500 mr-3" />
                            <input
                                type="text"
                                placeholder="Search network..."
                                className="bg-transparent border-none text-sm text-white outline-none w-full"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative cursor-pointer group">
                            <Bell className="w-6 h-6 text-slate-400 group-hover:text-white transition-all" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full"></span>
                        </div>

                        <div className="h-8 w-px bg-slate-800 mx-2"></div>

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-white">{userData?.name || 'Administrator'}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{userData?.email}</p>
                            </div>
                            <div className="w-10 h-10 bg-gradient-to-tr from-slate-700 to-slate-800 border border-white/10 rounded-xl flex items-center justify-center text-white font-bold">
                                {userData?.email?.[0].toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dynamic Content */}
                <main className="flex-1 overflow-y-auto p-10 bg-[#020617] relative">
                    <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none"></div>
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
