import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Platform,
    Dimensions
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { CheckCircle, XCircle, Save, Loader2, ChevronDown, ChevronRight, Calendar, User, ArrowLeft } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const AttendanceMarking = ({ navigation }) => {
    const { userData } = useAuth();
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedPeriod, setSelectedPeriod] = useState('1');
    const [attendance, setAttendance] = useState({});
    const [existingRecord, setExistingRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const periods = [1, 2, 3, 4, 5, 6, 7, 8];

    useEffect(() => {
        const fetchClasses = async () => {
            if (!userData?.college_id) return;
            try {
                const q1 = query(collection(db, 'teaching_assignments'), where('college_id', '==', userData.college_id), where('teacher_id', '==', userData.uid));
                const snap1 = await getDocs(q1);
                const assignedIds = snap1.docs.map(doc => doc.data().class_id);
                if (userData.is_class_teacher && userData.class_id_assigned) assignedIds.push(userData.class_id_assigned);

                const q2 = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
                const snap2 = await getDocs(q2);
                setClasses(snap2.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => assignedIds.includes(c.id)));
            } catch (error) { console.error(error); }
        };
        fetchClasses();
    }, [userData]);

    useEffect(() => {
        const fetchData = async () => {
            if (!selectedClass || !selectedDate || !selectedPeriod) return;
            setLoading(true);
            try {
                const qS = query(collection(db, 'students'), where('college_id', '==', userData.college_id), where('class_id', '==', selectedClass));
                const snapS = await getDocs(qS);
                const list = snapS.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.pin.localeCompare(b.pin, undefined, { numeric: true }));
                setStudents(list);

                const qA = query(collection(db, 'attendance_records'),
                    where('college_id', '==', userData.college_id),
                    where('class_id', '==', selectedClass),
                    where('date', '==', selectedDate),
                    where('period', '==', parseInt(selectedPeriod)));
                const snapA = await getDocs(qA);

                if (!snapA.empty) {
                    const rec = { id: snapA.docs[0].id, ...snapA.docs[0].data() };
                    setExistingRecord(rec);
                    const map = {};
                    list.forEach(s => {
                        if (rec.present?.includes(s.pin)) map[s.pin] = 'present';
                        else if (rec.absent?.includes(s.pin)) map[s.pin] = 'absent';
                    });
                    setAttendance(map);
                } else {
                    setExistingRecord(null);
                    const map = {};
                    list.forEach(s => map[s.pin] = 'present');
                    setAttendance(map);
                }
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [selectedClass, selectedDate, selectedPeriod]);

    const toggleStatus = (pin) => {
        if (existingRecord && !userData.is_class_teacher && userData.role !== 'admin') return;
        setAttendance(prev => ({ ...prev, [pin]: prev[pin] === 'present' ? 'absent' : 'present' }));
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const present = Object.entries(attendance).filter(([_, s]) => s === 'present').map(([p]) => p);
            const absent = Object.entries(attendance).filter(([_, s]) => s === 'absent').map(([p]) => p);
            const data = {
                college_id: userData.college_id,
                class_id: selectedClass,
                date: selectedDate,
                period: parseInt(selectedPeriod),
                present, absent,
                marked_by: userData.uid,
                marked_by_name: userData.name,
                marked_at: new Date()
            };
            if (existingRecord) await updateDoc(doc(db, 'attendance_records', existingRecord.id), data);
            else await addDoc(collection(db, 'attendance_records'), data);
            setMessage({ type: 'success', text: 'Saved!' });
        } catch (error) { setMessage({ type: 'error', text: 'Error!' }); }
        finally { setSaving(false); }
    };

    const [dayRecords, setDayRecords] = useState({});
    const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const fetchDayRecords = async () => {
            if (!selectedClass || !summaryDate || userData.class_id_assigned !== selectedClass) {
                setDayRecords({});
                return;
            }
            try {
                const q = query(collection(db, 'attendance_records'),
                    where('college_id', '==', userData.college_id),
                    where('class_id', '==', selectedClass),
                    where('date', '==', summaryDate));
                const snap = await getDocs(q);
                const recs = {};
                snap.forEach(d => recs[d.data().period] = d.data());
                setDayRecords(recs);
            } catch (e) { console.error(e); }
        };
        fetchDayRecords();
    }, [selectedClass, summaryDate, userData, saving]);

    const presentCount = Object.values(attendance).filter(v => v === 'present').length;
    const absentCount = Object.values(attendance).filter(v => v === 'absent').length;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 }}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={[styles.title, { marginBottom: 0 }]}>Mark Attendance</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Select Class</Text>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.classPicker}>
                    {classes.map(cls => (
                        <TouchableOpacity
                            key={cls.id}
                            style={[styles.classItem, selectedClass === cls.id && styles.activeClass]}
                            onPress={() => setSelectedClass(cls.id)}
                        >
                            <Text style={[styles.classText, selectedClass === cls.id && styles.activeClassText]}>{cls.branch} - {cls.section}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Date</Text>
                        <TextInput style={styles.input} value={selectedDate} onChangeText={setSelectedDate} placeholder="YYYY-MM-DD" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.label}>Period</Text>
                        <View style={styles.periodRow}>
                            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                                {periods.map(p => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[styles.periodBtn, selectedPeriod === String(p) && styles.activePeriod]}
                                        onPress={() => setSelectedPeriod(String(p))}
                                    >
                                        <Text style={[styles.periodBtnText, selectedPeriod === String(p) && styles.activePeriodText]}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </View>

            {loading ? <ActivityIndicator style={{ marginTop: 40 }} color="#6366f1" size="large" /> : (
                selectedClass && (
                    <>
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>PRESENT</Text>
                                <Text style={[styles.statValue, { color: '#10b981' }]}>{presentCount}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>ABSENT</Text>
                                <Text style={[styles.statValue, { color: '#ef4444' }]}>{absentCount}</Text>
                            </View>
                        </View>

                        <View style={styles.gridContainer}>
                            <View style={styles.studentGrid}>
                                {students.map(s => (
                                    <TouchableOpacity
                                        key={s.id}
                                        style={[styles.pinBox, attendance[s.pin] === 'absent' ? styles.absentPin : styles.presentPin]}
                                        onPress={() => toggleStatus(s.pin)}
                                    >
                                        <Text style={styles.pinText}>{s.pin}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <Save size={20} color="#fff" />
                                    <Text style={styles.saveBtnText}>{existingRecord ? 'Update Attendance' : 'Submit Attendance'}</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {userData.class_id_assigned === selectedClass && (
                            <View style={styles.summarySection}>
                                <View style={styles.summaryHeader}>
                                    <Text style={styles.summaryTitle}>Daily Overview</Text>
                                    <TouchableOpacity onPress={() => setSummaryDate(new Date().toISOString().split('T')[0])}>
                                        <Text style={styles.todayBtn}>Today</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.summaryCard}>
                                    {periods.map(p => {
                                        const rec = dayRecords[p];
                                        return (
                                            <View key={p} style={[styles.summaryRow, p === periods.length && { borderBottomWidth: 0 }]}>
                                                <View style={styles.pBadge}><Text style={styles.pBadgeText}>P{p}</Text></View>
                                                <Text style={styles.pStatus}>{rec ? `Marked by ${rec.marked_by_name?.split(' ')[0]}` : 'Not marked'}</Text>
                                                <View style={styles.pStats}>
                                                    <Text style={[styles.pStatText, { color: '#10b981' }]}>{rec?.present?.length || 0}</Text>
                                                    <Text style={styles.pStatDivider}>/</Text>
                                                    <Text style={[styles.pStatText, { color: '#ef4444' }]}>{rec?.absent?.length || 0}</Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
                    </>
                )
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b' },
    row: { flexDirection: 'row', marginTop: 16 },
    classPicker: { marginBottom: 12 },
    classItem: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f1f5f9', marginRight: 8 },
    activeClass: { backgroundColor: '#6366f1' },
    classText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
    activeClassText: { color: '#fff' },
    periodRow: { flexDirection: 'row' },
    periodBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
    activePeriod: { backgroundColor: '#6366f1' },
    periodBtnText: { fontWeight: 'bold', color: '#64748b' },
    activePeriodText: { color: '#fff' },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    statBox: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    statLabel: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },
    statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 4 },
    gridContainer: { backgroundColor: '#1e293b', borderRadius: 20, padding: 16, minHeight: 200 },
    studentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pinBox: { width: (width - 72) / 5, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
    presentPin: { backgroundColor: '#22c55e', borderColor: '#16a34a' },
    absentPin: { backgroundColor: '#ef4444', borderColor: '#b91c1c' },
    pinText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    saveBtn: { backgroundColor: '#6366f1', height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 40 },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    summarySection: { marginTop: 10 },
    summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    summaryTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    todayBtn: { color: '#6366f1', fontWeight: 'bold', fontSize: 13 },
    summaryCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    summaryRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    pBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    pBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
    pStatus: { flex: 1, fontSize: 13, color: '#64748b' },
    pStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pStatText: { fontSize: 13, fontWeight: 'bold' },
    pStatDivider: { color: '#cbd5e1', fontSize: 12 }
});

export default AttendanceMarking;
