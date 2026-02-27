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
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import {
    Calendar, FileText, BookOpen, TrendingUp, TrendingDown,
    Activity, Clock, AlertTriangle, Download, ChevronRight, CheckCircle,
    Flame, Trophy, Bell, Zap, PlayCircle, Megaphone, LogOut, Bus, Star,
    Award, GraduationCap
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const StudentDashboard = ({ navigation }) => {
    const { userData, logout } = useAuth();
    const [stats, setStats] = useState({
        materials: 0,
        quizzes: 0,
        attendance: 0,
        pendingAssignments: 3,
        streak: 7
    });
    const [recentUpdates, setRecentUpdates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [badges, setBadges] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [activeTab, setActiveTab] = useState('badges');
    const [myPoints, setMyPoints] = useState(0);

    const STUDENT_BADGES = [
        { name: "Excellent Student", points: 50, icon: Trophy, color: "#f59e0b" },
        { name: "Perfect Attendance", points: 30, icon: Star, color: "#10b981" },
        { name: "Quiz Champion", points: 40, icon: Award, color: "#6366f1" },
        { name: "Active Student", points: 20, icon: GraduationCap, color: "#8b5cf6" }
    ];

    useEffect(() => {
        if (!userData?.college_id || !userData?.class_id) return;

        setLoading(true);

        const matsQuery = query(collection(db, 'materials'), where('college_id', '==', userData.college_id), where('class_id', '==', userData.class_id));
        const quizQuery = query(collection(db, 'quizzes'), where('college_id', '==', userData.college_id), where('class_id', '==', userData.class_id), where('status', '==', 'active'));
        const attQuery = query(collection(db, 'attendance_records'), where('college_id', '==', userData.college_id), where('class_id', '==', userData.class_id));
        const updatesQuery = query(collection(db, 'notifications'), where('college_id', '==', userData.college_id));

        const unsubMats = onSnapshot(matsQuery, (snap) => {
            setStats(prev => ({ ...prev, materials: snap.size }));
            setLoading(false);
        });

        const unsubQuizzes = onSnapshot(quizQuery, (snap) => {
            setStats(prev => ({ ...prev, quizzes: snap.size }));
        });

        const unsubAttendance = onSnapshot(attQuery, (snap) => {
            let presentCount = 0;
            snap.docs.forEach(doc => {
                if (doc.data().present?.includes(userData.pin)) presentCount++;
            });
            const attPercentage = snap.size > 0 ? Math.round((presentCount / snap.size) * 100) : 100;
            setStats(prev => ({ ...prev, attendance: attPercentage }));
        });

        const unsubUpdates = onSnapshot(updatesQuery, (snap) => {
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filtered = list
                .filter(n => n.target_type === 'college' || (n.target_type === 'class' && n.target_id === userData.class_id))
                .sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0))
                .slice(0, 5);
            setRecentUpdates(filtered);
        });

        const bQ = query(collection(db, 'badges'), where('college_id', '==', userData.college_id), where('type', '==', 'student'));
        const unsubBadges = onSnapshot(bQ, (snap) => {
            const allBadges = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBadges(allBadges.filter(b => b.recipient_id === userData?.id || b.recipient_pin === userData?.pin));

            // Leaderboard logic
            const agg = {};
            allBadges.forEach(b => {
                const uid = b.recipient_id || b.recipient_pin;
                if (!agg[uid]) agg[uid] = { name: b.recipient_name, points: 0, id: uid };
                agg[uid].points += (b.points || 0);
            });
            const sorted = Object.values(agg).sort((a, b) => b.points - a.points);
            setLeaderboard(sorted);

            const mine = sorted.find(u => u.id === userData?.id || u.id === userData?.pin);
            setMyPoints(mine?.points || 0);
        });

        return () => {
            unsubMats();
            unsubQuizzes();
            unsubAttendance();
            unsubUpdates();
            unsubBadges();
        };
    }, [userData]);

    const onRefresh = React.useCallback(() => {
        // Data is now real-time, onRefresh is mostly for visual feedback if needed
        // but we can just leave it for now or remove it.
    }, [userData]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
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
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.greeting}>{getGreeting()},</Text>
                    <Text style={styles.userName}>{userData?.name.split(' ')[0]}!</Text>
                    <View style={styles.dateRow}>
                        <Calendar size={12} color="#64748b" />
                        <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>
                    </View>
                </View>

                <TouchableOpacity onPress={logout} style={styles.logoutBtnFixed}>
                    <LogOut size={20} color="#ef4444" />
                </TouchableOpacity>
            </View>

            {/* Attendance & Points Alert */}
            <View style={styles.alertRow}>
                <View style={[
                    styles.alertBox,
                    {
                        flex: 1,
                        backgroundColor: stats.attendance >= 75 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(234, 179, 8, 0.05)',
                        borderLeftColor: stats.attendance >= 75 ? '#10B981' : '#EAB308',
                        marginBottom: 0
                    }
                ]}>
                    <Activity size={18} color={stats.attendance >= 75 ? "#10B981" : "#EAB308"} />
                    <View>
                        <Text style={styles.alertVal}>{stats.attendance}%</Text>
                        <Text style={styles.alertTyp}>Attendance</Text>
                    </View>
                </View>

                <View style={[
                    styles.alertBox,
                    {
                        flex: 1,
                        backgroundColor: 'rgba(99, 102, 241, 0.05)',
                        borderLeftColor: '#6366f1',
                        marginBottom: 0
                    }
                ]}>
                    <Trophy size={18} color="#6366f1" />
                    <View>
                        <Text style={styles.alertVal}>{myPoints} pts</Text>
                        <Text style={styles.alertTyp}>Merit Points</Text>
                    </View>
                </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
                <ActionBtn icon={FileText} label="Take Quiz" color={['#6366f1', '#818cf8']} onPress={() => navigation.navigate('StudentQuizzes')} primary />
                <ActionBtn icon={Download} label="Materials" color={['#10B981', '#34D399']} onPress={() => navigation.navigate('StudentMaterials')} />
                <ActionBtn icon={Activity} label="Attendance" color={['#10B981', '#34D399']} onPress={() => navigation.navigate('StudentAttendance')} />
                <ActionBtn icon={AlertTriangle} label="Concern" color={['#EF4444', '#F87171']} onPress={() => navigation.navigate('StudentConcerns')} />
                <ActionBtn icon={Clock} label="Timetable" color={['#3B82F6', '#60A5FA']} onPress={() => navigation.navigate('StudentTimetable')} />
                <ActionBtn icon={BookOpen} label="Daily Review" color={['#8B5CF6', '#A78BFA']} onPress={() => navigation.navigate('DailyReview')} />
                <ActionBtn icon={Bus} label="Track Bus" color={['#6366f1', '#818cf8']} onPress={() => navigation.navigate('BusTracking')} />

                <TouchableOpacity
                    style={styles.feedbackBanner}
                    onPress={() => navigation.navigate('StudentFeedback')}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={['#F59E0B', '#F97316']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.feedbackGradient}
                    >
                        <View style={styles.feedbackIconBox}>
                            <Star size={24} color="#fff" fill="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.feedbackTitle}>Rate Your Teachers</Text>
                            <Text style={styles.feedbackSubtitle}>Share anonymous feedback & help improve teaching quality</Text>
                        </View>
                        <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Achievements Section */}
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achievementsCard}>
                <View style={styles.achTabs}>
                    <TouchableOpacity
                        style={[styles.achTab, activeTab === 'badges' && styles.activeAchTab]}
                        onPress={() => setActiveTab('badges')}
                    >
                        <Award size={16} color={activeTab === 'badges' ? '#6366f1' : '#94a3b8'} />
                        <Text style={[styles.achTabText, activeTab === 'badges' && styles.activeAchTabText]}>My Badges</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.achTab, activeTab === 'leaderboard' && styles.activeAchTab]}
                        onPress={() => setActiveTab('leaderboard')}
                    >
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
                                    const def = STUDENT_BADGES.find(db => db.name === b.badge_name) || { icon: Award, color: '#94a3b8' };
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
                            const isMe = user.id === userData?.id || user.id === userData?.pin;
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
                        {leaderboard.length > 5 && !leaderboard.slice(0, 5).some(u => u.id === userData?.id || u.id === userData?.pin) && (
                            <View style={styles.lbDivider}>
                                <Text style={styles.lbDividerText}>•••</Text>
                            </View>
                        )}
                        {leaderboard.findIndex(u => u.id === userData?.id || u.id === userData?.pin) >= 5 && (
                            <View style={[styles.lbItem, styles.lbItemMe]}>
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{leaderboard.findIndex(u => u.id === userData?.id || u.id === userData?.pin) + 1}</Text>
                                </View>
                                <Text style={[styles.lbName, styles.lbNameMe]}>{userData?.name}</Text>
                                <Text style={styles.lbPoints}>{myPoints} pts</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Updates Section */}
            <View style={[styles.card, { marginTop: 28 }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardTitleBox}>
                        <Bell size={18} color="#1e293b" />
                        <Text style={styles.cardTitle}>Recent Updates</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('NoticeBoard')}><Text style={styles.viewAllBtn}>View All</Text></TouchableOpacity>
                </View>
                <View style={styles.updatesList}>
                    {recentUpdates.length === 0 ? (
                        <Text style={styles.emptyText}>No recent updates</Text>
                    ) : (
                        recentUpdates.map(update => (
                            <UpdateItem key={update.id} update={update} navigation={navigation} />
                        ))
                    )}
                </View>
            </View>
        </ScrollView>
    );
};

const ActionBtn = ({ icon: Icon, label, color, onPress, primary }) => (
    <TouchableOpacity
        style={[styles.actionBtn, primary && styles.primaryActionBtn]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <LinearGradient colors={color} style={styles.actionIconBox}>
            <Icon size={22} color="#fff" />
        </LinearGradient>
        <Text style={[styles.actionLabel, primary && styles.primaryActionLabel]}>{label}</Text>
        <ChevronRight size={16} color={primary ? "#6366f1" : "#cbd5e1"} style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>
);

const StatCard = ({ label, value, trend, success, icon: Icon, iconColor }) => (
    <View style={styles.statCard}>
        <View style={styles.statInfo}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, success !== undefined && { color: success ? '#10B981' : '#EF4444' }]}>{value}</Text>
        </View>
        {trend ? (
            <View style={[styles.trendBadge, { backgroundColor: success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                {success ? <TrendingUp size={12} color="#10B981" /> : <TrendingDown size={12} color="#EF4444" />}
                <Text style={[styles.trendText, { color: success ? '#10B981' : '#EF4444' }]}>{trend}</Text>
            </View>
        ) : (
            <View style={[styles.statIconBox, { backgroundColor: `${iconColor}1a` }]}>
                <Icon size={20} color={iconColor} />
            </View>
        )}
    </View>
);

const UpdateItem = ({ update, navigation }) => {
    const getIconInfo = (type) => {
        switch (type) {
            case 'quiz': return { icon: FileText, color: '#7C3AED', screen: 'StudentQuizzes' };
            case 'material': return { icon: Download, color: '#10B981', screen: 'StudentMaterials' };
            case 'notice': return { icon: Megaphone, color: '#F59E0B', screen: 'NoticeBoard' };
            default: return { icon: Activity, color: '#3B82F6', screen: 'NoticeBoard' };
        }
    };
    const { icon: Icon, color, screen } = getIconInfo(update.type);

    return (
        <TouchableOpacity
            style={styles.updateItem}
            onPress={() => navigation.navigate(screen)}
        >
            <View style={[styles.updateIconBox, { backgroundColor: `${color}1a` }]}>
                <Icon size={16} color={color} />
            </View>
            <View style={styles.updateContent}>
                <Text style={styles.updateTitle} numberOfLines={1}>{update.title}</Text>
                <Text style={styles.updateMeta}>
                    {update.author_name ? `${update.author_name} • ` : ''}
                    {update.created_at?.toDate ? update.created_at.toDate().toLocaleDateString() : 'Recent'}
                </Text>
            </View>
            <View style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>View</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fdfdff' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingTop: 80, paddingBottom: 120 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },

    greeting: { fontSize: 18, color: '#64748b', fontWeight: '500' },
    userName: { fontSize: 32, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
    logoutBtnFixed: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, alignSelf: 'flex-start' },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
    dateText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

    alertRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 20,
        borderLeftWidth: 5,
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        gap: 12
    },
    alertVal: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    alertTyp: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 16, marginTop: 8 },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 28 },
    actionBtn: {
        width: '47.5%',
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        gap: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
    },
    primaryActionBtn: {
        borderColor: '#e0e7ff',
        backgroundColor: '#f5f7ff',
    },
    actionIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
    primaryActionLabel: { color: '#4338ca' },
    gridStatCard: {
        width: '47.5%',
    },
    feedbackBanner: {
        width: '100%',
        borderRadius: 22,
        overflow: 'hidden',
        elevation: 6,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    feedbackGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        gap: 14,
    },
    feedbackIconBox: {
        width: 50,
        height: 50,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    feedbackTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#fff',
    },
    feedbackSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '500',
        marginTop: 2,
    },
    statsGrid: { flexDirection: 'row', gap: 14, marginBottom: 28 },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 26,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
    },
    statLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    statValue: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginTop: 6 },
    trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
    trendText: { fontSize: 11, fontWeight: 'bold' },
    statIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    card: {
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    cardTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    viewAllBtn: { fontSize: 13, color: '#6366f1', fontWeight: '700' },
    updatesList: { gap: 14 },
    updateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 20,
        gap: 14,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    updateIconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    updateContent: { flex: 1 },
    updateTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    updateMeta: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: '500' },
    viewBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
    },
    viewBtnText: { fontSize: 12, color: '#475569', fontWeight: '800' },
    emptyText: { textAlign: 'center', color: '#94a3b8', padding: 24, fontWeight: '500' },

    // Achievements Styles
    achievementsCard: { backgroundColor: '#fff', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: '#f1f5f9', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16 },
    achTabs: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 16, padding: 6, marginBottom: 20 },
    achTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12 },
    activeAchTab: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1 },
    achTabText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
    activeAchTabText: { color: '#1e293b' },
    emptyAch: { alignItems: 'center', padding: 30, gap: 12 },
    emptyAchText: { fontSize: 14, color: '#cbd5e1', fontWeight: '600' },
    badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    badgeItem: { width: '30%', alignItems: 'center', gap: 8 },
    badgeIconSmall: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    badgeNameSmall: { fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center' },
    leaderboardView: { gap: 10 },
    lbItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, gap: 12 },
    lbItemMe: { backgroundColor: '#f5f7ff', borderWidth: 1, borderColor: '#e0e7ff' },
    rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
    rank1: { backgroundColor: '#fef3c7' },
    rank2: { backgroundColor: '#f1f5f9' },
    rank3: { backgroundColor: '#ffedd5' },
    rankText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
    rankTextTop: { color: '#d97706' },
    lbName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#475569' },
    lbNameMe: { color: '#6366f1', fontWeight: '800' },
    lbPoints: { fontSize: 13, fontWeight: '800', color: '#10b981' },
    lbDivider: { alignItems: 'center', marginVertical: 4 },
    lbDividerText: { color: '#cbd5e1', letterSpacing: 2 }
});

export default StudentDashboard;
