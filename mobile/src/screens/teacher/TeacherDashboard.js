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
import { Calendar, Clock, FileText, Users, Megaphone, ArrowRight, ClipboardCheck, BookOpen, Bus, LogOut, Layers, Award, Trophy, Star, Medal, TrendingUp } from 'lucide-react-native';
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
    const [badges, setBadges] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [activeTab, setActiveTab] = useState('badges');
    const [myPoints, setMyPoints] = useState(0);

    const TEACHER_BADGES = [
        { name: "Best Teacher", points: 100, icon: Trophy, color: "#f59e0b" },
        { name: "Active Teacher", points: 60, icon: Star, color: "#10b981" },
        { name: "Dedicated Teacher", points: 50, icon: Medal, color: "#6366f1" }
    ];

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

        const bQ = query(collection(db, 'badges'), where('college_id', '==', userData.college_id), where('type', '==', 'teacher'));
        const unsubBadges = onSnapshot(bQ, (snap) => {
            const allBadges = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBadges(allBadges.filter(b => b.recipient_id === userData?.uid));

            const agg = {};
            allBadges.forEach(b => {
                if (!agg[b.recipient_id]) agg[b.recipient_id] = { name: b.recipient_name, points: 0, id: b.recipient_id };
                agg[b.recipient_id].points += (b.points || 0);
            });
            const sorted = Object.values(agg).sort((a, b) => b.points - a.points);
            setLeaderboard(sorted);
            const mine = sorted.find(u => u.id === userData?.uid);
            setMyPoints(mine?.points || 0);
        });

        return () => {
            unsubTT();
            unsubQuiz();
            unsubStudents();
            unsubNotices();
            unsubBadges();
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
                <StatCard label="Merit Pts" value={myPoints} icon={Trophy} color={['#f59e0b', '#d97706']} />
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
                    <ShortcutBtn icon={Layers} label="My Topics" color="#10b981" onPress={() => navigation.navigate('MyTopics')} />
                    {userData?.is_class_teacher && (
                        <ShortcutBtn icon={Users} label="Tracker" color="#ef4444" onPress={() => navigation.navigate('Tracker')} />
                    )}
                </View>

                {/* Achievements Section */}
                <Text style={styles.sectionTitle}>Achievements</Text>
                <View style={styles.achCard}>
                    <View style={styles.achTabs}>
                        <TouchableOpacity style={[styles.achTab, activeTab === 'badges' && styles.activeAchTab]} onPress={() => setActiveTab('badges')}>
                            <Award size={16} color={activeTab === 'badges' ? '#6366f1' : '#94a3b8'} />
                            <Text style={[styles.achTabText, activeTab === 'badges' && styles.activeAchTabText]}>My Badges</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.achTab, activeTab === 'leaderboard' && styles.activeAchTab]} onPress={() => setActiveTab('leaderboard')}>
                            <TrendingUp size={16} color={activeTab === 'leaderboard' ? '#6366f1' : '#94a3b8'} />
                            <Text style={[styles.achTabText, activeTab === 'leaderboard' && styles.activeAchTabText]}>Leaderboard</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'badges' ? (
                        <View style={styles.badgesView}>
                            {badges.length === 0 ? (
                                <View style={styles.emptyAch}>
                                    <Star size={32} color="#cbd5e1" />
                                    <Text style={styles.emptyAchText}>No badges earned yet</Text>
                                </View>
                            ) : (
                                <View style={styles.badgesGrid}>
                                    {badges.map((b, i) => {
                                        const def = TEACHER_BADGES.find(db => db.name === b.badge_name) || { icon: Award, color: '#94a3b8' };
                                        return (
                                            <View key={i} style={styles.badgeItem}>
                                                <View style={[styles.badgeIconSmall, { backgroundColor: `${def.color}1a` }]}>
                                                    <def.icon size={20} color={def.color} />
                                                </View>
                                                <Text style={styles.badgeNameSmall} numberOfLines={1}>{b.badge_name}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={styles.leaderboardView}>
                            {leaderboard.slice(0, 5).map((user, idx) => {
                                const isMe = user.id === userData?.uid;
                                return (
                                    <View key={idx} style={[styles.lbItem, isMe && styles.lbItemMe]}>
                                        <View style={[styles.rankBadge, idx === 0 && styles.rank1, idx === 1 && styles.rank2, idx === 2 && styles.rank3]}>
                                            <Text style={[styles.rankText, idx < 3 && styles.rankTextTop]}>{idx + 1}</Text>
                                        </View>
                                        <Text style={[styles.lbName, isMe && styles.lbNameMe]}>{user.name}</Text>
                                        <Text style={styles.lbPoints}>{user.points} pts</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
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
    shortcutsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'flex-start' },
    shortcutBtn: { width: '30%', alignItems: 'center', gap: 8, marginBottom: 16 },
    shortcutIconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    shortcutLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
    noticesList: { gap: 12 },
    noticeItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    noticeIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    noticeContent: { flex: 1 },
    noticeTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    noticeMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
    emptyText: { textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 14 },
    dashboardGrid: { gap: 16 },

    // Achievements
    achCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    achTabs: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 12, padding: 4, marginBottom: 16 },
    achTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
    activeAchTab: { backgroundColor: '#fff', elevation: 1 },
    achTabText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
    activeAchTabText: { color: '#1e293b' },
    emptyAch: { alignItems: 'center', padding: 20, gap: 8 },
    emptyAchText: { fontSize: 12, color: '#cbd5e1', fontWeight: '600' },
    badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    badgeItem: { width: '30%', alignItems: 'center', gap: 6 },
    badgeIconSmall: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    badgeNameSmall: { fontSize: 9, fontWeight: '700', color: '#64748b', textAlign: 'center' },
    leaderboardView: { gap: 8 },
    lbItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, gap: 10 },
    lbItemMe: { backgroundColor: '#f5f7ff', borderWidth: 1, borderColor: '#e0e7ff' },
    rankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
    rank1: { backgroundColor: '#fef3c7' },
    rank2: { backgroundColor: '#f1f5f9' },
    rank3: { backgroundColor: '#ffedd5' },
    rankText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    rankTextTop: { color: '#d97706' },
    lbName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#475569' },
    lbNameMe: { color: '#6366f1', fontWeight: '800' },
    lbPoints: { fontSize: 12, fontWeight: '800', color: '#10b981' }
});

export default TeacherDashboard;
