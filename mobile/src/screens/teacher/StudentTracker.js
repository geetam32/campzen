import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Users, TrendingUp, AlertTriangle, Phone, Search, ArrowLeft, BookOpen, Award, Star, Trophy, GraduationCap, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const StudentTracker = ({ navigation }) => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState('overview'); // ['overview', 'exams', 'analytics']
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [exams, setExams] = useState([]);
    const [allMarks, setAllMarks] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [badges, setBadges] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showBadgeModal, setShowBadgeModal] = useState(false);
    const [awarding, setAwarding] = useState(false);

    const STUDENT_BADGES = [
        { name: "Excellent Student", points: 50, icon: Trophy, color: "#f59e0b" },
        { name: "Perfect Attendance", points: 30, icon: Star, color: "#10b981" },
        { name: "Quiz Champion", points: 40, icon: Award, color: "#6366f1" },
        { name: "Active Student", points: 20, icon: GraduationCap, color: "#8b5cf6" }
    ];

    useEffect(() => {
        if (!userData?.college_id || !userData?.class_id_assigned) return;

        setLoading(true);

        // Subscriptions
        const qS = query(collection(db, 'students'),
            where('college_id', '==', userData.college_id),
            where('class_id', '==', userData.class_id_assigned));

        const qSub = query(collection(db, 'subjects'),
            where('college_id', '==', userData.college_id),
            where('class_id', '==', userData.class_id_assigned));

        const qE = query(collection(db, 'exams'),
            where('college_id', '==', userData.college_id),
            where('class_id', '==', userData.class_id_assigned));

        const qA = query(collection(db, 'attendance_records'),
            where('college_id', '==', userData.college_id),
            where('class_id', '==', userData.class_id_assigned));

        const qM = query(collection(db, 'exam_marks'),
            where('college_id', '==', userData.college_id));

        const unsubStudents = onSnapshot(qS, (snap) => {
            setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubSubjects = onSnapshot(qSub, (snap) => {
            setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubExams = onSnapshot(qE, (snap) => {
            setExams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubAttendance = onSnapshot(qA, (snap) => {
            const currentAttendance = snap.docs.map(doc => doc.data());
            const aStats = {};
            const totalRecords = currentAttendance.length;

            // This calculation will be updated when students state changes too
            // For now, let's keep it simple
            setAttendanceStats({ records: currentAttendance, total: totalRecords });
        });

        const unsubMarks = onSnapshot(qM, (snap) => {
            setAllMarks(snap.docs.map(doc => doc.data()));
            setLoading(false);
        });

        // Badges Listener
        const bQ = query(collection(db, 'badges'),
            where('college_id', '==', userData.college_id),
            where('type', '==', 'student'));

        const unsubBadges = onSnapshot(bQ, (snap) => {
            setBadges(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubStudents();
            unsubSubjects();
            unsubExams();
            unsubAttendance();
            unsubMarks();
            unsubBadges();
        };
    }, [userData]);

    // Analytics Calculations (derived from state)
    const analytics = React.useMemo(() => {
        const studentStats = {};
        const totalDays = attendanceStats.total || 0;

        students.forEach(s => {
            const present = (attendanceStats.records || []).filter(r => r.present?.includes(s.pin)).length;
            const attPerc = totalDays > 0 ? Math.round((present / totalDays) * 100) : 100;

            const sMarks = allMarks.filter(m => m.student_pin === s.pin);
            let totalPerc = 0, examCount = 0;

            sMarks.forEach(m => {
                const exam = exams.find(e => e.id === m.exam_id);
                if (exam) {
                    totalPerc += (Number(m.marks) / Number(exam.max_marks)) * 100;
                    examCount++;
                }
            });

            studentStats[s.pin] = {
                attendance: attPerc,
                performance: examCount > 0 ? Math.round(totalPerc / examCount) : 0,
                examCount
            };
        });

        return { studentStats };
    }, [students, exams, allMarks, attendanceStats]);

    const studentBadgesData = React.useMemo(() => {
        const data = {};
        students.forEach(s => {
            const sBadges = badges.filter(b => b.recipient_id === s.id || b.recipient_pin === s.pin);
            const totalPoints = sBadges.reduce((sum, b) => sum + (b.points || 0), 0);
            data[s.pin] = {
                badges: sBadges,
                totalPoints
            };
        });
        return data;
    }, [students, badges]);

    const handleAwardBadge = async (badge) => {
        if (!selectedStudent || awarding) return;
        setAwarding(true);
        try {
            await addDoc(collection(db, 'badges'), {
                badge_name: badge.name,
                points: badge.points,
                type: 'student',
                recipient_id: selectedStudent.id,
                recipient_pin: selectedStudent.pin,
                recipient_name: selectedStudent.name,
                college_id: userData?.college_id,
                class_id: userData?.class_id_assigned,
                awarded_by_id: userData?.uid,
                awarded_by_name: userData?.name,
                created_at: serverTimestamp()
            });
            setShowBadgeModal(false);
            Alert.alert("Success", `${badge.name} awarded to ${selectedStudent.name}!`);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to award badge.");
        } finally {
            setAwarding(false);
        }
    };

    const handleCall = (phone) => {
        if (phone) Linking.openURL(`tel:${phone}`);
        else Alert.alert("Not Available", "No phone number found.");
    };

    const openBadgeModal = (student) => {
        setSelectedStudent(student);
        setShowBadgeModal(true);
    };

    const TabBtn = ({ label, icon: Icon, id }) => (
        <TouchableOpacity
            style={[styles.tabBtn, activeTab === id && styles.activeTabBtn]}
            onPress={() => setActiveTab(id)}
        >
            <Icon size={18} color={activeTab === id ? '#6366f1' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === id && styles.activeTabText]}>{label}</Text>
        </TouchableOpacity>
    );

    const renderStudentCard = ({ item }) => {
        const stats = analytics.studentStats[item.pin] || { attendance: 100, performance: 0 };
        const attColor = stats.attendance < 75 ? '#ef4444' : '#10b981';
        const perfColor = stats.performance < 50 ? '#ef4444' : '#6366f1';

        return (
            <View style={styles.studentCard}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.studentName}>{item.name}</Text>
                        <Text style={styles.studentPin}>{item.pin}</Text>
                    </View>
                    <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item.parent_phone)}>
                        <Phone size={18} color="#6366f1" />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsRowMobile}>
                    <View style={styles.mobileStatBox}>
                        <Text style={styles.statLabel}>ATTENDANCE</Text>
                        <Text style={[styles.statValue, { color: attColor }]}>{stats.attendance}%</Text>
                    </View>
                    <View style={styles.mobileStatBox}>
                        <Text style={styles.statLabel}>PERFORMANCE</Text>
                        <Text style={[styles.statValue, { color: perfColor }]}>{stats.performance}%</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderExamCard = ({ item }) => {
        const examMarks = allMarks.filter(m => m.exam_id === item.id);
        const progress = Math.round((examMarks.length / students.length) * 100) || 0;

        return (
            <View style={styles.examCard}>
                <View style={styles.examBadge}><Text style={styles.examBadgeText}>{item.subject}</Text></View>
                <Text style={styles.examName}>{item.name}</Text>
                <Text style={styles.examMeta}>Max Marks: {item.max_marks}</Text>

                <View style={{ marginTop: 15 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text style={styles.progressLabel}>Entry Progress</Text>
                        <Text style={styles.progressVal}>{examMarks.length}/{students.length}</Text>
                    </View>
                    <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#6366f1' }]} /></View>
                </View>

                <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => navigation.navigate('ExamMarks', { exam: item })}>
                    <Text style={styles.actionBtnText}>Update Marks</Text>
                </TouchableOpacity>
            </View>
        );
    };

    if (!userData?.is_class_teacher) {
        return (
            <View style={styles.centered}><AlertTriangle size={48} color="#94a3b8" /><Text style={styles.errorText}>Only available for class teachers</Text></View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <ArrowLeft size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.pageTitle}>Student Tracker</Text>
                        <Text style={styles.subTitle}>Manage exams, marks and insights</Text>
                    </View>
                </View>
            </View>

            <View style={styles.tabContainer}>
                <TabBtn label="Overview" icon={Users} id="overview" />
                <TabBtn label="Exams" icon={BookOpen} id="exams" />
                <TabBtn label="Analytics" icon={TrendingUp} id="analytics" />
                <TabBtn label="Badges" icon={Award} id="badges" />
            </View>

            <ScrollView style={{ flex: 1 }}>
                {activeTab === 'overview' && (
                    <View style={{ padding: 20 }}>
                        <View style={styles.summaryRow}>
                            <View style={styles.sumCard}>
                                <Text style={styles.sumVal}>{students.length}</Text>
                                <Text style={styles.sumLabel}>Total Students</Text>
                            </View>
                            <View style={[styles.sumCard, { borderColor: '#fee2e2' }]}>
                                <Text style={[styles.sumVal, { color: '#ef4444' }]}>{Object.values(analytics.studentStats).filter(v => v.attendance < 75).length}</Text>
                                <Text style={styles.sumLabel}>Low Attendance</Text>
                            </View>
                        </View>
                        <FlatList
                            data={students}
                            scrollEnabled={false}
                            keyExtractor={item => item.id}
                            renderItem={renderStudentCard}
                            ListEmptyComponent={<View style={styles.empty}><Users size={40} color="#cbd5e1" /><Text style={styles.emptyText}>No students found</Text></View>}
                        />
                    </View>
                )}

                {activeTab === 'exams' && (
                    <View style={{ padding: 20 }}>
                        <FlatList
                            data={exams}
                            scrollEnabled={false}
                            keyExtractor={item => item.id}
                            renderItem={renderExamCard}
                            ListEmptyComponent={<View style={styles.empty}><BookOpen size={40} color="#cbd5e1" /><Text style={styles.emptyText}>No exams created yet</Text></View>}
                        />
                    </View>
                )}

                {activeTab === 'analytics' && (
                    <View style={{ padding: 20 }}>
                        <View style={styles.analyticsCard}>
                            <TrendingUp size={30} color="#6366f1" />
                            <Text style={styles.analyticsTitle}>Performance Analytics</Text>
                            <Text style={styles.analyticsSub}>Subject-wise and class trends will appear here.</Text>

                            <View style={styles.placeholderBox}>
                                <Text style={styles.placeholderText}>Class Average: --%</Text>
                            </View>
                            <View style={styles.placeholderBox}>
                                <Text style={styles.placeholderText}>Top Subject: --</Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === 'badges' && (
                    <View style={{ padding: 20 }}>
                        <View style={styles.badgeHeaderCard}>
                            <View style={styles.badgeHeaderInfo}>
                                <Trophy size={24} color="#f59e0b" />
                                <Text style={styles.badgeHeaderTitle}>Student Badges & Points</Text>
                            </View>
                            <View style={styles.totalBadgesBox}>
                                <Text style={styles.totalBadgesCount}>{badges.length}</Text>
                                <Text style={styles.totalBadgesLabel}>Total Awarded</Text>
                            </View>
                        </View>

                        {students.map(student => {
                            const data = studentBadgesData[student.pin] || { badges: [], totalPoints: 0 };
                            return (
                                <View key={student.id} style={styles.badgeStudentCard}>
                                    <View style={styles.badgeStudentInfo}>
                                        <View>
                                            <Text style={styles.studentPinSmall}>{student.pin}</Text>
                                            <Text style={styles.studentNameMed}>{student.name}</Text>
                                        </View>
                                        <View style={styles.pointsBox}>
                                            <Text style={styles.pointsValue}>{data.totalPoints} pts</Text>
                                        </View>
                                    </View>

                                    <View style={styles.badgesRow}>
                                        {data.badges.slice(-5).map(b => {
                                            const definition = STUDENT_BADGES.find(db => db.name === b.badge_name) || { icon: Award, color: "#94a3b8" };
                                            return (
                                                <View key={b.id} style={[styles.miniBadge, { backgroundColor: `${definition.color}1a` }]}>
                                                    <definition.icon size={12} color={definition.color} />
                                                </View>
                                            );
                                        })}
                                        {data.badges.length > 5 && (
                                            <Text style={styles.moreBadges}>+{data.badges.length - 5}</Text>
                                        )}
                                    </View>

                                    <TouchableOpacity
                                        style={styles.awardBtnSmall}
                                        onPress={() => openBadgeModal(student)}
                                    >
                                        <Award size={14} color="#fff" />
                                        <Text style={styles.awardBtnTextSmall}>Award Badge</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Badge Modal */}
            <Modal visible={showBadgeModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.badgeModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Award Merit Badge</Text>
                            <TouchableOpacity onPress={() => setShowBadgeModal(false)}>
                                <X size={24} color="#1e293b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>Select a badge for {selectedStudent?.name}</Text>

                        <View style={styles.badgeGrid}>
                            {STUDENT_BADGES.map((badge, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.badgeOption}
                                    onPress={() => handleAwardBadge(badge)}
                                >
                                    <View style={[styles.badgeIconLarge, { backgroundColor: `${badge.color}1a` }]}>
                                        <badge.icon size={32} color={badge.color} />
                                    </View>
                                    <Text style={styles.badgeNameLabel}>{badge.name}</Text>
                                    <Text style={[styles.badgePointsLabel, { color: badge.color }]}>+{badge.points} pts</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {awarding && (
                            <View style={styles.awardingOverlay}>
                                <ActivityIndicator size="large" color="#6366f1" />
                                <Text style={styles.awardingText}>Awarding badge...</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 10 },
    pageTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
    subTitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 20, gap: 20 },
    tabBtn: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, position: 'relative' },
    activeTabBtn: { borderBottomWidth: 3, borderColor: '#6366f1' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
    activeTabText: { color: '#6366f1' },

    summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    sumCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    sumVal: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
    sumLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase' },

    studentCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    studentName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    studentPin: { fontSize: 12, color: '#6366f1', fontWeight: '700', marginTop: 2 },
    callBtn: { backgroundColor: '#f5f3ff', width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    statsRowMobile: { flexDirection: 'row', gap: 20 },
    mobileStatBox: { flex: 1 },
    statLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 4 },
    statValue: { fontSize: 14, fontWeight: '800' },

    examCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    examBadge: { alignSelf: 'flex-start', backgroundColor: '#f5f3ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
    examBadgeText: { fontSize: 10, color: '#6366f1', fontWeight: '800' },
    examName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    examMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
    progressLabel: { fontSize: 11, color: '#64748b' },
    progressVal: { fontSize: 11, fontWeight: '800', color: '#1e293b' },
    progressBar: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    actionBtnSecondary: { marginTop: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 12, alignItems: 'center' },
    actionBtnText: { color: '#1e293b', fontWeight: '700', fontSize: 14 },

    analyticsCard: { backgroundColor: '#fff', padding: 30, borderRadius: 25, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    analyticsTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginTop: 15 },
    analyticsSub: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 8 },
    placeholderBox: { width: '100%', backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginTop: 15, alignItems: 'center' },
    placeholderText: { color: '#94a3b8', fontWeight: '600' },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    errorText: { color: '#64748b', textAlign: 'center', marginTop: 12 },
    empty: { alignItems: 'center', marginTop: 30 },
    emptyText: { color: '#94a3b8', marginTop: 12 },

    // Badge Styles
    badgeHeaderCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    badgeHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    badgeHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    totalBadgesBox: { alignItems: 'flex-end' },
    totalBadgesCount: { fontSize: 18, fontWeight: '800', color: '#10b981' },
    totalBadgesLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },

    badgeStudentCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    badgeStudentInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    studentPinSmall: { fontSize: 10, fontWeight: '800', color: '#6366f1' },
    studentNameMed: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    pointsBox: { backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    pointsValue: { fontSize: 14, fontWeight: '800', color: '#10b981' },
    badgesRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
    miniBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    moreBadges: { fontSize: 10, fontWeight: '700', color: '#94a3b8', alignSelf: 'center' },
    awardBtnSmall: { backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, elevation: 2, shadowColor: '#f97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    awardBtnTextSmall: { color: '#fff', fontSize: 13, fontWeight: '800' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    badgeModal: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40, position: 'relative' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    badgeOption: { width: '47.1%', backgroundColor: '#f8fafc', borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    badgeIconLarge: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    badgeNameLabel: { fontSize: 13, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: 4 },
    badgePointsLabel: { fontSize: 12, fontWeight: '900' },
    awardingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', borderRadius: 30, zIndex: 10 },
    awardingText: { marginTop: 12, fontWeight: '700', color: '#6366f1' }
});

export default StudentTracker;
