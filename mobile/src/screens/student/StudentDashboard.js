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
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import {
    Calendar, FileText, BookOpen, TrendingUp, TrendingDown,
    Activity, Clock, AlertTriangle, Download, ChevronRight, CheckCircle,
    Flame, Star, Trophy, Bell, Zap, PlayCircle, Megaphone, LogOut, Bus
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

    const fetchData = async () => {
        if (!userData?.college_id || !userData?.class_id) return;

        try {
            // Count materials
            const matsQuery = query(
                collection(db, 'materials'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id)
            );
            const matsSnapshot = await getDocs(matsQuery);

            // Count active quizzes
            const quizQuery = query(
                collection(db, 'quizzes'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id),
                where('status', '==', 'active')
            );
            const quizSnapshot = await getDocs(quizQuery);

            // Calculate attendance percentage
            const attQuery = query(
                collection(db, 'attendance_records'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id)
            );
            const attSnapshot = await getDocs(attQuery);

            let presentCount = 0;
            attSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.present?.includes(userData.pin)) {
                    presentCount++;
                }
            });
            const attPercentage = attSnapshot.size > 0 ? Math.round((presentCount / attSnapshot.size) * 100) : 100;

            setStats(prev => ({
                ...prev,
                materials: matsSnapshot.size,
                quizzes: quizSnapshot.size,
                attendance: attPercentage
            }));

            // Fetch recent updates
            const updatesQuery = query(
                collection(db, 'notifications'),
                where('college_id', '==', userData.college_id)
            );
            const updatesSnapshot = await getDocs(updatesQuery);
            const list = updatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const filtered = list
                .filter(n =>
                    n.target_type === 'college' ||
                    (n.target_type === 'class' && n.target_id === userData.class_id)
                )
                .sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0))
                .slice(0, 5);

            setRecentUpdates(filtered);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [userData]);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchData();
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
                    <Text style={styles.brandSubtitle}>Campzen Student Portal</Text>
                    <Text style={styles.greeting}>{getGreeting()},</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.userName}>{userData?.name.split(' ')[0]}! ✨</Text>
                        <TouchableOpacity onPress={logout} style={{ backgroundColor: '#fee2e2', padding: 4, borderRadius: 8 }}>
                            <LogOut size={16} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.dateRow}>
                        <Calendar size={12} color="#64748b" />
                        <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>
                    </View>
                </View>
                <View style={styles.badgesColumn}>
                    <View style={styles.streakBadge}>
                        <Flame size={14} color="#fff" />
                        <Text style={styles.badgeText}>{stats.streak} Days</Text>
                    </View>
                    <LinearGradient colors={['#10B981', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.trophyBadge}>
                        <Trophy size={14} color="#fff" />
                        <Text style={styles.badgeText}>Top 10%</Text>
                    </LinearGradient>
                </View>
            </View>

            {/* Attendance Alert */}
            <View style={[
                styles.alertBox,
                {
                    backgroundColor: stats.attendance >= 75 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(234, 179, 8, 0.05)',
                    borderLeftColor: stats.attendance >= 75 ? '#10B981' : '#EAB308'
                }
            ]}>
                {stats.attendance >= 75 ? (
                    <CheckCircle size={20} color="#10B981" />
                ) : (
                    <AlertTriangle size={20} color="#EAB308" />
                )}
                <Text style={styles.alertText}>
                    {stats.attendance >= 75 ?
                        "Great job! Your attendance is on track. 🌟" :
                        "Heads up! Your attendance is below 75%."
                    }
                </Text>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
                <ActionBtn icon={FileText} label="Take Quiz" color={['#7C3AED', '#A78BFA']} onPress={() => navigation.navigate('StudentQuizzes')} />
                <ActionBtn icon={Download} label="Materials" color={['#10B981', '#34D399']} onPress={() => navigation.navigate('StudentMaterials')} />
                <ActionBtn icon={AlertTriangle} label="Concern" color={['#F59E0B', '#FBBF24']} onPress={() => navigation.navigate('StudentConcerns')} />
                <ActionBtn icon={Clock} label="Timetable" color={['#3B82F6', '#60A5FA']} onPress={() => navigation.navigate('StudentTimetable')} />
                <ActionBtn icon={Bus} label="Track Bus" color={['#6366f1', '#818cf8']} onPress={() => navigation.navigate('BusTracking')} />
            </View>

            {/* Stats Cards */}
            <View style={styles.statsGrid}>
                <StatCard
                    label="Attendance"
                    value={`${stats.attendance}%`}
                    trend="+2%"
                    success={stats.attendance >= 75}
                />
                <StatCard
                    label="Quizzes"
                    value={stats.quizzes}
                    icon={Zap}
                    iconColor="#7C3AED"
                />
            </View>

            {/* Updates Section */}
            <View style={styles.card}>
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
                            <UpdateItem key={update.id} update={update} />
                        ))
                    )}
                </View>
            </View>
        </ScrollView>
    );
};

const ActionBtn = ({ icon: Icon, label, color, onPress }) => (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
        <LinearGradient colors={color} style={styles.actionIconBox}>
            <Icon size={20} color="#fff" />
        </LinearGradient>
        <Text style={styles.actionLabel}>{label}</Text>
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

const UpdateItem = ({ update }) => {
    const getIconInfo = (type) => {
        switch (type) {
            case 'quiz': return { icon: FileText, color: '#7C3AED' };
            case 'material': return { icon: Download, color: '#10B981' };
            case 'notice': return { icon: Megaphone, color: '#F59E0B' };
            default: return { icon: Activity, color: '#3B82F6' };
        }
    };
    const { icon: Icon, color } = getIconInfo(update.type);

    return (
        <View style={styles.updateItem}>
            <View style={[styles.updateIconBox, { backgroundColor: `${color}1a` }]}>
                <Icon size={16} color={color} />
            </View>
            <View style={styles.updateContent}>
                <Text style={styles.updateTitle} numberOfLines={1}>{update.title}</Text>
                <Text style={styles.updateMeta}>{update.author_name ? `${update.author_name} • ` : ''}Just now</Text>
            </View>
            <TouchableOpacity style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    brandSubtitle: { fontSize: 10, fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    greeting: { fontSize: 16, color: '#64748b' },
    userName: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    dateText: { fontSize: 12, color: '#64748b' },
    badgesColumn: { alignItems: 'flex-end', gap: 8 },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f97316',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 4
    },
    trophyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 4
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
        marginBottom: 24,
        gap: 10
    },
    alertText: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 12 },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    actionBtn: {
        width: '48%',
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 12
    },
    actionIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
    statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statLabel: { fontSize: 12, color: '#64748b' },
    statValue: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 4 },
    trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 2 },
    trendText: { fontSize: 10, fontWeight: 'bold' },
    statIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    cardTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    viewAllBtn: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
    updatesList: { gap: 12 },
    updateItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, gap: 12 },
    updateIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    updateContent: { flex: 1 },
    updateTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
    updateMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
    viewBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    viewBtnText: { fontSize: 12, color: '#1e293b', fontWeight: 'bold' },
    emptyText: { textAlign: 'center', color: '#64748b', padding: 20 }
});

export default StudentDashboard;
