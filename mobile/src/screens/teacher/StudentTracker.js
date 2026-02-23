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
    Linking
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Users, TrendingUp, AlertTriangle, Phone, Search, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const StudentTracker = ({ navigation }) => {
    const { userData } = useAuth();
    const [students, setStudents] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({});
    const [quizStats, setQuizStats] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!userData?.college_id || !userData?.class_id_assigned) return;
        setLoading(true);
        try {
            const qS = query(collection(db, 'students'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id_assigned));
            const snapS = await getDocs(qS);
            const list = snapS.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(list);

            const qA = query(collection(db, 'attendance_records'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id_assigned));
            const snapA = await getDocs(qA);
            const aStats = {};
            const totalRecords = snapA.size;
            list.forEach(s => {
                let present = 0;
                snapA.docs.forEach(doc => { if (doc.data().present?.includes(s.pin)) present++; });
                aStats[s.pin] = totalRecords > 0 ? Math.round((present / totalRecords) * 100) : 100;
            });
            setAttendanceStats(aStats);

            const qQ = query(collection(db, 'quizzes'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id_assigned));
            const snapQ = await getDocs(qQ);
            const quizIds = snapQ.docs.map(d => d.id);
            const q_stats = {};
            for (const s of list) {
                let totalMarks = 0, count = 0;
                for (const qId of quizIds) {
                    const qAtt = query(collection(db, 'quiz_attempts'), where('quiz_id', '==', qId), where('student_id', '==', s.pin));
                    const snapAtt = await getDocs(qAtt);
                    if (!snapAtt.empty) { count++; totalMarks += snapAtt.docs[0].data().score || 0; }
                }
                q_stats[s.pin] = count > 0 ? Math.round(totalMarks / count) : null;
            }
            setQuizStats(q_stats);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleCall = (phone) => {
        if (phone) Linking.openURL(`tel:${phone}`);
        else Alert.alert("Not Available", "No phone number found.");
    };

    const renderStudentCard = ({ item }) => {
        const att = attendanceStats[item.pin] || 0;
        const score = quizStats[item.pin];
        const color = att < 75 ? '#ef4444' : att < 85 ? '#f59e0b' : '#10b981';

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

                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <View style={styles.statLabelRow}>
                            <Text style={styles.statLabel}>ATTENDANCE</Text>
                            <Text style={[styles.statValue, { color }]}>{att}%</Text>
                        </View>
                        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${att}%`, backgroundColor: color }]} /></View>
                    </View>
                    <View style={styles.statBox}>
                        <View style={styles.statLabelRow}>
                            <Text style={styles.statLabel}>AVG SCORE</Text>
                            <Text style={[styles.statValue, { color: '#6366f1' }]}>{score !== null ? `${score}%` : 'N/A'}</Text>
                        </View>
                        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${score || 0}%`, backgroundColor: '#6366f1' }]} /></View>
                    </View>
                </View>
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
                        <Text style={styles.subTitle}>Performance & behavior insights</Text>
                    </View>
                </View>
            </View>

            <View style={styles.summaryRow}>
                <View style={styles.sumCard}>
                    <Text style={styles.sumVal}>{students.length}</Text>
                    <Text style={styles.sumLabel}>Total</Text>
                </View>
                <View style={[styles.sumCard, { borderColor: '#fee2e2' }]}>
                    <Text style={[styles.sumVal, { color: '#ef4444' }]}>{Object.values(attendanceStats).filter(v => v < 75).length}</Text>
                    <Text style={styles.sumLabel}>Below 75%</Text>
                </View>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={students}
                    keyExtractor={item => item.id}
                    renderItem={renderStudentCard}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><Users size={40} color="#cbd5e1" /><Text style={styles.emptyText}>No students in your class</Text></View>}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 20 },
    sumCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    sumVal: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    sumLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', marginTop: 4 },
    list: { padding: 20, paddingTop: 0 },
    studentCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    studentName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    studentPin: { fontSize: 12, color: '#6366f1', fontWeight: '700', marginTop: 2 },
    callBtn: { backgroundColor: '#f5f3ff', width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    statsContainer: { gap: 12 },
    statBox: {},
    statLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    statLabel: { fontSize: 9, fontWeight: 'bold', color: '#94a3b8' },
    statValue: { fontSize: 10, fontWeight: 'bold' },
    progressBar: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    errorText: { color: '#64748b', textAlign: 'center', marginTop: 12 },
    empty: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#94a3b8', marginTop: 12 }
});

export default StudentTracker;
