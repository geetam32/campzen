import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Calendar, Clock, FileText, Users, Megaphone, ArrowRight, ClipboardCheck, BookOpen, Bus, LogOut } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const TeacherDashboard = ({ navigation }) => {
    const { userData, logout } = useAuth();
    const [stats, setStats] = useState({
        classesToday: 0,
        periodsToday: 0,
        pendingQuizzes: 0,
        totalStudents: 0
    });
    const [todaySchedule, setTodaySchedule] = useState([]);
    const [recentNotices, setRecentNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const getDayName = () => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[new Date().getDay()];
    };

    useEffect(() => {
        if (!userData?.college_id || !userData?.uid) return;

        setLoading(true);
        const today = getDayName();

        // Timetable Listener
        const ttQuery = query(
            collection(db, 'timetables'),
            where('college_id', '==', userData.college_id),
            where('teacher_id', '==', userData.uid)
        );
        const unsubTT = onSnapshot(ttQuery, (snap) => {
            const allSlots = snap.docs.map(doc => doc.data());
            const todaySlots = allSlots.filter(s => s.day === today).sort((a, b) => a.period - b.period);
            setTodaySchedule(todaySlots);

            const uniqueClasses = [...new Set(todaySlots.map(s => s.class_id))];
            setStats(prev => ({
                ...prev,
                classesToday: uniqueClasses.length,
                periodsToday: todaySlots.length
            }));
            setLoading(false);
        });

        // Quiz Listener
        const quizQuery = query(
            collection(db, 'quizzes'),
            where('college_id', '==', userData.college_id),
            where('created_by', '==', userData.uid)
        );
        const unsubQuiz = onSnapshot(quizQuery, (snap) => {
            const draftQuizzes = snap.docs.filter(doc => doc.data().status === 'draft');
            setStats(prev => ({ ...prev, pendingQuizzes: draftQuizzes.length }));
        });

        // Student Listener (if class teacher)
        let unsubStudents = () => { };
        if (userData.is_class_teacher && userData.class_id_assigned) {
            const studentQuery = query(
                collection(db, 'students'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id_assigned)
            );
            unsubStudents = onSnapshot(studentQuery, (snap) => {
                setStats(prev => ({ ...prev, totalStudents: snap.size }));
            });
        }

        // Notice Listener
        const nQuery = query(collection(db, 'notices'), where('college_id', '==', userData.college_id));
        const unsubNotices = onSnapshot(nQuery, (snap) => {
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filtered = list.filter(n =>
                n.target_type === 'college' ||
                n.created_by === userData.uid ||
                (n.target_type === 'class' && n.target_class_id === userData.class_id_assigned)
            ).sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0)).slice(0, 3);
            setRecentNotices(filtered);
        });

        return () => {
            unsubTT();
            unsubQuiz();
            unsubStudents();
            unsubNotices();
        };
    }, [userData]);

    const onRefresh = () => {
        // Live data doesn't strictly need manual refresh
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.greeting}>Campzen Faculty</Text>
                    <Text style={styles.subGreeting}>Welcome back, {userData?.name}!</Text>
                </View>
                <TouchableOpacity onPress={() => logout()} style={{ backgroundColor: '#fee2e2', padding: 10, borderRadius: 12 }}>
                    <LogOut size={20} color="#ef4444" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
                <StatCard label="Classes" value={stats.classesToday} icon={Calendar} color={['#6366f1', '#4338ca']} />
                <StatCard label="Periods" value={stats.periodsToday} icon={Clock} color={['#10b981', '#059669']} />
                <StatCard label="Drafts" value={stats.pendingQuizzes} icon={FileText} color={['#f59e0b', '#d97706']} />
                {userData?.is_class_teacher && (
                    <StatCard label="Students" value={stats.totalStudents} icon={Users} color={['#ef4444', '#dc2626']} />
                )}
            </View>

            <View style={styles.dashboardGrid}>
                {/* Schedule Section */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Today's Schedule</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('MyTimetable')}>
                            <Text style={styles.viewAllBtn}>My Timetable</Text>
                        </TouchableOpacity>
                    </View>
                    {todaySchedule.length === 0 ? (
                        <Text style={styles.emptyText}>No classes scheduled for today.</Text>
                    ) : (
                        <View style={styles.scheduleList}>
                            {todaySchedule.map((slot, idx) => (
                                <View key={idx} style={styles.scheduleItem}>
                                    <View style={styles.periodBadge}>
                                        <Text style={styles.periodText}>P{slot.period}</Text>
                                    </View>
                                    <View style={styles.scheduleDetails}>
                                        <Text style={styles.subjectText}>{slot.subject}</Text>
                                        <Text style={styles.classText}>{slot.class_name || 'Assigned Class'}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Quick Shortcuts */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.shortcutsRow}>
                    <ShortcutBtn icon={ClipboardCheck} label="Attendance" color="#6366f1" onPress={() => navigation.navigate('Attendance')} />
                    <ShortcutBtn icon={FileText} label="Quizzes" color="#10b981" onPress={() => navigation.navigate('Quizzes')} />
                    <ShortcutBtn icon={BookOpen} label="Materials" color="#f59e0b" onPress={() => navigation.navigate('Materials')} />
                    {userData?.is_class_teacher && (
                        <ShortcutBtn icon={Users} label="Tracker" color="#ef4444" onPress={() => navigation.navigate('Tracker')} />
                    )}
                    <ShortcutBtn icon={Bus} label="Bus Share" color="#8b5cf6" onPress={() => navigation.navigate('BusSharing')} />
                </View>

                {/* Notices Section */}
                <View style={[styles.card, { marginTop: 24 }]}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Recent Notices</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Notices')}>
                            <Text style={styles.viewAllBtn}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.noticesList}>
                        {recentNotices.length === 0 ? (
                            <Text style={styles.emptyText}>No recent notices.</Text>
                        ) : (
                            recentNotices.map((notice, idx) => (
                                <View key={notice.id} style={styles.noticeItem}>
                                    <View style={[styles.noticeIconBox, { backgroundColor: notice.type === 'urgent' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                                        <Megaphone size={16} color={notice.type === 'urgent' ? '#ef4444' : '#f59e0b'} />
                                    </View>
                                    <View style={styles.noticeContent}>
                                        <Text style={styles.noticeTitle} numberOfLines={1}>{notice.title}</Text>
                                        <Text style={styles.noticeMeta}>{notice.author_name} • {notice.created_at?.toDate ? notice.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const StatCard = ({ label, value, icon: Icon, color }) => (
    <LinearGradient colors={color} style={styles.statCard}>
        <View style={styles.statIconBox}>
            <Icon size={18} color="#fff" />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </LinearGradient>
);

const ShortcutBtn = ({ icon: Icon, label, color, onPress }) => (
    <TouchableOpacity style={styles.shortcutBtn} onPress={onPress}>
        <View style={[styles.shortcutIconBox, { backgroundColor: `${color}1a` }]}>
            <Icon size={24} color={color} />
        </View>
        <Text style={styles.shortcutLabel}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingTop: 60 },
    header: { marginBottom: 24 },
    greeting: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subGreeting: { fontSize: 14, color: '#64748b', marginTop: 4 },
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    statCard: { flex: 1, padding: 12, borderRadius: 16, gap: 4 },
    statIconBox: { width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 24, marginBottom: 16 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    viewAllBtn: { fontSize: 12, color: '#6366f1', fontWeight: 'bold' },
    scheduleList: { gap: 10 },
    scheduleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    periodBadge: { backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 12 },
    periodText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    subjectText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    classText: { fontSize: 12, color: '#64748b', marginTop: 2 },
    shortcutsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    shortcutBtn: { flex: 1, alignItems: 'center', gap: 8 },
    shortcutIconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    shortcutLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
    noticesList: { gap: 12 },
    noticeItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    noticeIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    noticeContent: { flex: 1 },
    noticeTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    noticeMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
    emptyText: { textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 14 },
    dashboardGrid: { gap: 16 }
});

export default TeacherDashboard;
