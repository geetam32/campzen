import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, LogOut, Bell, X, Info, FileText, BookOpen, Megaphone } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';

const Navbar = () => {
    const { userData, logout } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!userData?.college_id) return;

        // Fetch notifications targeting this user
        // If student: target class or college
        // If teacher/admin: target college? (Usually notifications are for students, but let's keep it flexible)

        let q = query(
            collection(db, 'notifications'),
            where('college_id', '==', userData.college_id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter student notifications by class_id on client side because Firestore doesn't support complex OR queries easily with multiple fields
            let filteredList = list;
            if (userData.role === 'student') {
                filteredList = list.filter(n =>
                    n.target_type === 'college' ||
                    (n.target_type === 'class' && n.target_id === userData.class_id)
                );
            }

            const sortedList = filteredList.sort((a, b) =>
                (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0)
            ).slice(0, 10);

            setNotifications(sortedList);

            // Calculate unread
            const lastRead = localStorage.getItem(`last_read_${userData.uid}`) || 0;
            const newUnread = filteredList.filter(n => n.created_at?.toMillis() > lastRead).length;
            setUnreadCount(newUnread);
        });

        return () => unsubscribe();
    }, [userData]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const toggleNotifications = () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications && notifications.length > 0) {
            // Mark all as read
            const newestTime = notifications[0].created_at?.toMillis() || Date.now();
            localStorage.setItem(`last_read_${userData.uid}`, newestTime);
            setUnreadCount(0);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'quiz': return <FileText size={16} className="text-secondary" />;
            case 'material': return <BookOpen size={16} className="text-primary" />;
            case 'notice': return <Megaphone size={16} className="text-warning" />;
            default: return <Bell size={16} />;
        }
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <div className="flex items-center gap-3">
                    <img src="/campzen-logo.png" alt="Logo" className="w-10 h-10" />
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Campzen
                    </span>
                </div>
            </div>

            <div className="navbar-user">
                {userData && (
                    <div className="user-info">
                        <div className="user-name">{userData.name}</div>
                        <div className="user-role">{userData.role}</div>
                    </div>
                )}

                <div className="notification-wrapper" style={{ position: 'relative' }}>
                    <button
                        className="btn btn-icon notification-btn"
                        style={{ marginRight: '0.5rem' }}
                        onClick={toggleNotifications}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                    </button>

                    {showNotifications && (
                        <div className="notification-dropdown">
                            <div className="notification-header">
                                <h3>Notifications</h3>
                                <button className="btn btn-icon btn-sm" onClick={() => setShowNotifications(false)}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="notification-list">
                                {notifications.length === 0 ? (
                                    <div className="notification-empty">
                                        <Bell size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                                        <p>No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map(n => (
                                        <Link
                                            key={n.id}
                                            to={n.link || '#'}
                                            className="notification-item"
                                            onClick={() => setShowNotifications(false)}
                                        >
                                            <div className="notification-icon">
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="notification-body">
                                                <div className="notification-title">{n.title}</div>
                                                <div className="notification-content">{n.content}</div>
                                                <div className="notification-time">
                                                    {n.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                    <LogOut size={16} />
                    Logout
                </button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .notification-dropdown {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    width: 320px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                    z-index: 1000;
                    margin-top: 10px;
                    overflow: hidden;
                }
                .notification-header {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .notification-header h3 {
                    font-size: 1rem;
                    margin: 0;
                }
                .notification-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                .notification-item {
                    display: flex;
                    gap: 1rem;
                    padding: 1rem;
                    text-decoration: none;
                    color: inherit;
                    border-bottom: 1px solid var(--border-color);
                    transition: background 0.2s;
                }
                .notification-item:hover {
                    background: var(--bg-hover);
                }
                .notification-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: var(--bg-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .notification-body {
                    flex: 1;
                    min-width: 0;
                }
                .notification-title {
                    font-weight: 600;
                    font-size: 0.875rem;
                    margin-bottom: 0.25rem;
                }
                .notification-content {
                    font-size: 0.8125rem;
                    color: var(--text-muted);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .notification-time {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-top: 0.5rem;
                }
                .notification-empty {
                    padding: 2rem;
                    text-align: center;
                    color: var(--text-muted);
                }
                .notification-badge {
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    background: #ef4444;
                    color: white;
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 10px;
                    border: 2px solid var(--bg-primary);
                }
            `}} />
        </nav>
    );
};

export default Navbar;
