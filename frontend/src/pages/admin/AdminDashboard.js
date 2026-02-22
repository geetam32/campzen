import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, BookOpen, ClipboardCheck, Plus, Calendar, Settings, Bus } from 'lucide-react';

const AdminDashboard = () => {
    const { userData } = useAuth();
    const [stats, setStats] = useState({
        teachers: 0,
        students: 0,
        classes: 0,
        attendanceToday: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!userData?.college_id) return;

            try {
                const collegeId = userData.college_id;

                // Count teachers
                const teachersQuery = query(collection(db, 'teachers'), where('college_id', '==', collegeId));
                const teachersSnapshot = await getDocs(teachersQuery);

                // Count students
                const studentsQuery = query(collection(db, 'students'), where('college_id', '==', collegeId));
                const studentsSnapshot = await getDocs(studentsQuery);

                // Count classes
                const classesQuery = query(collection(db, 'classes'), where('college_id', '==', collegeId));
                const classesSnapshot = await getDocs(classesQuery);

                // Count today's attendance records
                const today = new Date().toISOString().split('T')[0];
                const attendanceQuery = query(
                    collection(db, 'attendance_records'),
                    where('college_id', '==', collegeId),
                    where('date', '==', today)
                );
                const attendanceSnapshot = await getDocs(attendanceQuery);

                setStats({
                    teachers: teachersSnapshot.size,
                    students: studentsSnapshot.size,
                    classes: classesSnapshot.size,
                    attendanceToday: attendanceSnapshot.size
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [userData]);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                Loading dashboard...
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Admin Dashboard</h1>
                    <p className="page-description">Welcome back! Here's an overview of your college.</p>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon primary">
                        <Users size={20} />
                    </div>
                    <div className="stat-value">{stats.teachers}</div>
                    <div className="stat-label">Teachers</div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon success">
                        <GraduationCap size={20} />
                    </div>
                    <div className="stat-value">{stats.students}</div>
                    <div className="stat-label">Students</div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon warning">
                        <BookOpen size={20} />
                    </div>
                    <div className="stat-value">{stats.classes}</div>
                    <div className="stat-label">Classes</div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon danger">
                        <ClipboardCheck size={20} />
                    </div>
                    <div className="stat-value">{stats.attendanceToday}</div>
                    <div className="stat-label">Attendance Records Today</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Quick Actions</h3>
                </div>
                <div className="quick-actions">
                    <Link to="/admin/classes" className="btn btn-primary">
                        <Plus size={16} />
                        Create Class
                    </Link>
                    <Link to="/admin/teachers" className="btn btn-primary">
                        <Plus size={16} />
                        Create Teacher
                    </Link>
                    <Link to="/admin/timetables" className="btn btn-secondary">
                        <Calendar size={16} />
                        View Timetables
                    </Link>
                    <Link to="/admin/settings" className="btn btn-secondary">
                        <Settings size={16} />
                        College Settings
                    </Link>
                    <Link to="/admin/subjects" className="btn btn-secondary">
                        <BookOpen size={16} />
                        Manage Subjects
                    </Link>
                    <Link to="/admin/assignments" className="btn btn-secondary">
                        <ClipboardCheck size={16} />
                        Assignment Repository
                    </Link>
                    <Link to="/admin/transport" className="btn btn-secondary">
                        <Bus size={16} />
                        Transport Management
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
