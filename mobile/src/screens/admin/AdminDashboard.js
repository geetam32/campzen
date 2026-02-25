import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Dimensions
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    Users,
    LogOut,
    GraduationCap,
    BookOpen,
    ClipboardCheck,
    Plus,
    Calendar,
    Settings as SettingsIcon,
    ArrowRight,
    Bell,
    CircleDashed,
    Bus
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const AdminDashboard = ({ navigation }) => {
    const { userData, logout } = useAuth();
    const [stats, setStats] = useState({
        teachers: 0,
        students: 0,
        classes: 0,
        attendanceToday: 0
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const collegeId = userData.college_id;
            const tQ = query(collection(db, 'teachers'), where('college_id', '==', collegeId));
            const sQ = query(collection(db, 'students'), where('college_id', '==', collegeId));
            const cQ = query(collection(db, 'classes'), where('college_id', '==', collegeId));
            const today = new Date().toISOString().split('T')[0];
            const aQ = query(collection(db, 'attendance_records'), where('college_id', '==', collegeId), where('date', '==', today));

            const [tS, sS, cS, aS] = await Promise.all([getDocs(tQ), getDocs(sQ), getDocs(cQ), getDocs(aQ)]);

            setStats({
                teachers: tS.size,
                students: sS.size,
                classes: cS.size,
                attendanceToday: aS.size
            });
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStats(); }, [userData]);

    const QuickAction = ({ title, icon: Icon, color, onPress }) => (
        <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
            <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
                <Icon size={22} color={color} />
            </View>
            <Text style={styles.actionTitle}>{title}</Text>
        </TouchableOpacity>
    );

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.topSection}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.welcomeText}>Campzen Admin Office</Text>
                        <Text style={styles.adminName}>{userData?.name || 'College Admin'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.notifyBtn} onPress={() => navigation.navigate('AdminSettings')}>
                            <SettingsIcon size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.notifyBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]} onPress={() => logout()}>
                            <LogOut size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statVal}>{stats.teachers}</Text>
                        <Text style={styles.statLab}>Faculty</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={styles.statVal}>{stats.students}</Text>
                        <Text style={styles.statLab}>Students</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={styles.statVal}>{stats.classes}</Text>
                        <Text style={styles.statLab}>Classes</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.body}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Administrative Tools</Text>
                </View>

                <View style={styles.actionGrid}>
                    <QuickAction title="Classes" icon={GraduationCap} color="#6366f1" onPress={() => navigation.navigate('ClassManagement')} />
                    <QuickAction title="Faculty" icon={Users} color="#10b981" onPress={() => navigation.navigate('TeacherManagement')} />
                    <QuickAction title="Subjects" icon={BookOpen} color="#f59e0b" onPress={() => navigation.navigate('SubjectManagement')} />
                    <QuickAction title="Admissions" icon={Plus} color="#ec4899" onPress={() => navigation.navigate('StudentManagement')} />
                    <QuickAction title="Circulars" icon={Bell} color="#8b5cf6" onPress={() => navigation.navigate('AdminNotices')} />
                    <QuickAction title="Concerns" icon={ClipboardCheck} color="#ef4444" onPress={() => navigation.navigate('ConcernsManagement')} />
                    <QuickAction title="Timetable" icon={Calendar} color="#06b6d4" onPress={() => navigation.navigate('TimetableManagement')} />
                    <QuickAction title="Transport" icon={Bus} color="#f43f5e" onPress={() => navigation.navigate('TransportManagement')} />
                    <QuickAction title="Settings" icon={SettingsIcon} color="#475569" onPress={() => navigation.navigate('AdminSettings')} />
                </View>

                <TouchableOpacity style={styles.attendanceSummary} onPress={() => navigation.navigate('AttendanceOverview')}>
                    <View style={styles.summaryIcon}>
                        <CircleDashed size={24} color="#6366f1" />
                    </View>
                    <View style={styles.summaryInfo}>
                        <Text style={styles.summaryLabel}>Attendance Overview</Text>
                        <Text style={styles.summaryValue}>{stats.attendanceToday} periods marked today</Text>
                    </View>
                    <ArrowRight size={20} color="#cbd5e1" />
                </TouchableOpacity>

                <View style={styles.collegeInfo}>
                    <Text style={styles.infoTitle}>College Instance</Text>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>ID: {userData?.college_id}</Text>
                        <Text style={styles.infoDesc}>Server: poly-network-alpha</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    topSection: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    welcomeText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 'bold' },
    adminName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    notifyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    statsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 16, alignItems: 'center' },
    statBox: { flex: 1, alignItems: 'center' },
    statVal: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    statLab: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
    statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
    body: { padding: 20 },
    sectionHeader: { marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    actionBtn: { width: (width - 52) / 2, backgroundColor: '#fff', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    actionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    actionTitle: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
    attendanceSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 20, borderLeftWidth: 4, borderLeftColor: '#6366f1', marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    summaryIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f7ff', justifyContent: 'center', alignItems: 'center' },
    summaryInfo: { flex: 1, marginLeft: 12 },
    summaryLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    summaryValue: { fontSize: 11, color: '#64748b', marginTop: 2 },
    collegeInfo: { marginTop: 24 },
    infoTitle: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 8, marginLeft: 4 },
    infoCard: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' },
    infoLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569' },
    infoDesc: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default AdminDashboard;
