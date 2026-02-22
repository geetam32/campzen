import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Settings,
    GraduationCap,
    Users,
    Calendar,
    ClipboardList,
    AlertCircle,
    FileText,
    BookOpen,
    Clock,
    UserCheck,
    User,
    MessageSquare,
<<<<<<< HEAD
    Megaphone
=======
    Bus
>>>>>>> 7cf611b (Live Bus Tracking Working)
} from 'lucide-react';

const Sidebar = () => {
    const { userData } = useAuth();
    const role = userData?.role;

    const adminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/settings', icon: Settings, label: 'College Settings' },
        { to: '/admin/subjects', icon: BookOpen, label: 'Subjects' },
        { to: '/admin/classes', icon: GraduationCap, label: 'Classes' },
        { to: '/admin/teachers', icon: Users, label: 'Teachers' },
        { to: '/admin/students', icon: Users, label: 'Students' },
        { to: '/admin/timetables', icon: Calendar, label: 'Timetable' },
        { to: '/admin/attendance', icon: ClipboardList, label: 'Attendance Overview' },
        { to: '/admin/calendar', icon: Calendar, label: 'Academic Calendar' },
        { to: '/admin/concerns', icon: AlertCircle, label: 'Concerns' },
<<<<<<< HEAD
        { to: '/admin/notices', icon: Megaphone, label: 'Notice Board' },
=======
        { to: '/admin/transport', icon: Bus, label: 'Transport' },
>>>>>>> 7cf611b (Live Bus Tracking Working)
    ];

    const superAdminLinks = [
        { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/super-admin/requests', icon: MessageSquare, label: 'Registration Requests' },
        { to: '/super-admin/colleges', icon: GraduationCap, label: 'Colleges' },
    ];

    const teacherLinks = [
        { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/teacher/attendance', icon: ClipboardList, label: 'Attendance' },
        { to: '/teacher/quizzes', icon: FileText, label: 'Quizzes' },
        { to: '/teacher/materials', icon: BookOpen, label: 'Materials' },
        { to: '/teacher/timetable', icon: Clock, label: 'My Timetable' },
        { to: '/teacher/notices', icon: Megaphone, label: 'Notices' },
        { to: '/teacher/calendar', icon: Calendar, label: 'Academic Calendar' },
    ];

    // Add Student Tracker for class teachers
    const teacherExtraLinks = userData?.is_class_teacher ? [
        { to: '/teacher/tracker', icon: UserCheck, label: 'Student Tracker' },
    ] : [];

    const studentLinks = [
        { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/student/attendance', icon: ClipboardList, label: 'Attendance' },
        { to: '/student/quizzes', icon: FileText, label: 'Quizzes' },
        { to: '/student/materials', icon: BookOpen, label: 'Materials' },
        { to: '/student/calendar', icon: Calendar, label: 'Academic Calendar' },
        { to: '/student/concerns', icon: MessageSquare, label: 'Raise a Concern' },
<<<<<<< HEAD
        { to: '/student/notices', icon: Megaphone, label: 'Notice Board' },
=======
        { to: '/student/bus-tracking', icon: Bus, label: 'Bus Tracking' },
>>>>>>> 7cf611b (Live Bus Tracking Working)
        { to: '/student/profile', icon: User, label: 'Profile' },
    ];

    let links = [];
    let sectionTitle = '';

    const driverLinks = [
        { to: '/driver', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ];

    if (role === 'admin') {
        links = adminLinks;
        sectionTitle = 'Admin Menu';
    } else if (role === 'super_admin') {
        links = superAdminLinks;
        sectionTitle = 'Super Admin';
    } else if (role === 'teacher') {
        links = [...teacherLinks, ...teacherExtraLinks];
        sectionTitle = 'Teacher Menu';
    } else if (role === 'student') {
        links = studentLinks;
        sectionTitle = 'Student Menu';
    } else if (role === 'driver') {
        links = driverLinks;
        sectionTitle = 'Driver Menu';
    }

    return (
        <aside className="sidebar">
            <div className="nav-section">
                <div className="nav-section-title">{sectionTitle}</div>
                {links.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <link.icon size={18} />
                        {link.label}
                    </NavLink>
                ))}
            </div>
        </aside>
    );
};

export default Sidebar;
