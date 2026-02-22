import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    Alert,
    Dimensions,
    Platform
} from 'react-native';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, getDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, X, Calendar, AlertCircle, Info, RefreshCcw, ChevronRight, ChevronDown, BookOpen } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const TimetableManagement = () => {
    const { userData } = useAuth();
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [timetable, setTimetable] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [settings, setSettings] = useState({
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        periods_per_day: 8,
        lunch_after_period: 4
    });
    const [loading, setLoading] = useState(true);
    const [fetchingTT, setFetchingTT] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null); // { day, period }

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const [clS, teS, suS, coD] = await Promise.all([
                getDocs(query(collection(db, 'classes'), where('college_id', '==', userData.college_id))),
                getDocs(query(collection(db, 'teachers'), where('college_id', '==', userData.college_id))),
                getDocs(query(collection(db, 'subjects'), where('college_id', '==', userData.college_id))),
                getDoc(doc(db, 'colleges', userData.college_id))
            ]);

            setClasses(clS.docs.map(d => ({ id: d.id, ...d.data() })));
            setTeachers(teS.docs.map(d => ({ id: d.id, ...d.data() })));
            setSubjects(suS.docs.map(d => ({ id: d.id, ...d.data() })));
            if (coD.exists() && coD.data().settings) setSettings(coD.data().settings);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchTimetable = async () => {
        if (!selectedClass) { setTimetable([]); return; }
        setFetchingTT(true);
        try {
            const q = query(collection(db, 'timetables'), where('college_id', '==', userData.college_id), where('class_id', '==', selectedClass));
            const s = await getDocs(q);
            setTimetable(s.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setFetchingTT(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);
    useEffect(() => { fetchTimetable(); }, [selectedClass]);

    const getAssignedSubjects = () => {
        const cls = classes.find(c => c.id === selectedClass);
        if (!cls?.subject_sessions) return [];
        return Object.entries(cls.subject_sessions).map(([sid, sessions]) => {
            const sub = subjects.find(s => s.id === sid);
            const tea = teachers.find(t => t.subject_assignments?.some(a => a.subject_id === sid && a.class_id === selectedClass));
            const placed = timetable.filter(t => t.subject === (sub?.name || 'Unknown')).length;
            return {
                id: sid,
                name: sub?.name || 'Unknown',
                type: sub?.type || 'theory',
                teacher_id: tea?.uid || tea?.id || null,
                teacher_name: tea?.name || 'No Teacher',
                required: sessions,
                placed: sub?.type === 'lab' ? placed / 3 : placed
            };
        }).filter(s => s.required > 0);
    };

    const handleAssign = async (sub) => {
        if (!selectedSlot) return;
        const slotsNeeded = sub.type === 'lab' ? 3 : 1;
        if (selectedSlot.period + slotsNeeded - 1 > settings.periods_per_day) {
            Alert.alert("Error", `Lab needs ${slotsNeeded} periods. Not enough space.`);
            return;
        }

        // Simulating validation
        setFetchingTT(true);
        try {
            const batch = writeBatch(db);
            for (let i = 0; i < slotsNeeded; i++) {
                const targetP = selectedSlot.period + i;
                const existing = timetable.find(t => t.day === selectedSlot.day && t.period === targetP);
                if (existing) batch.delete(doc(db, 'timetables', existing.id));

                const nRef = doc(collection(db, 'timetables'));
                batch.set(nRef, {
                    college_id: userData.college_id,
                    class_id: selectedClass,
                    day: selectedSlot.day,
                    period: targetP,
                    teacher_id: sub.teacher_id,
                    subject: sub.name,
                    is_lab: sub.type === 'lab'
                });
            }
            await batch.commit();
            setShowPicker(false);
            fetchTimetable();
        } catch (err) { console.error(err); }
        finally { setFetchingTT(false); }
    };

    const handleClearSlot = async (slot) => {
        try {
            if (slot.is_lab) {
                const siblings = timetable.filter(s => s.day === slot.day && s.subject === slot.subject && s.teacher_id === slot.teacher_id && Math.abs(s.period - slot.period) <= 2);
                const batch = writeBatch(db);
                siblings.forEach(s => batch.delete(doc(db, 'timetables', s.id)));
                await batch.commit();
            } else {
                await deleteDoc(doc(db, 'timetables', slot.id));
            }
            fetchTimetable();
        } catch (err) { console.error(err); }
    };

    if (loading) return <View style={styles.centered}><ActivityIndicator color="#6366f1" /></View>;

    const assigned = getAssignedSubjects();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Timetable</Text>
                <Text style={styles.subTitle}>Scheduling & slot allocation</Text>
            </View>

            <View style={styles.classPicker}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {classes.map(c => (
                        <TouchableOpacity key={c.id} style={[styles.classChip, selectedClass === c.id && styles.activeChip]} onPress={() => setSelectedClass(c.id)}>
                            <Text style={[styles.chipText, selectedClass === c.id && styles.activeChipText]}>{c.branch}-{c.section}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {selectedClass ? (
                <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                    <View style={styles.subjectOverview}>
                        <Text style={styles.sectionTitle}>Allocation Status</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subScroll}>
                            {assigned.map(s => (
                                <View key={s.id} style={styles.subCard}>
                                    <Text style={styles.subCardName} numberOfLines={1}>{s.name}</Text>
                                    <View style={styles.progressRow}>
                                        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(100, (s.placed / s.required) * 100)}%`, backgroundColor: s.placed >= s.required ? '#10b981' : '#6366f1' }]} /></View>
                                        <Text style={styles.progressText}>{s.placed}/{s.required}</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.gridContainer}>
                        {settings.working_days.map(day => (
                            <View key={day} style={styles.dayGroup}>
                                <View style={styles.dayHeader}><Text style={styles.dayName}>{day.toUpperCase()}</Text></View>
                                <View style={styles.periodGrid}>
                                    {Array.from({ length: settings.periods_per_day }, (_, i) => i + 1).map(p => {
                                        const slot = timetable.find(t => t.day === day && t.period === p);
                                        return (
                                            <TouchableOpacity key={p} style={[styles.periodSlot, slot?.is_lab && styles.labSlot, slot && styles.filledSlot]}
                                                onPress={() => { if (!slot) { setSelectedSlot({ day, period: p }); setShowPicker(true); } }}
                                                onLongPress={() => { if (slot) Alert.alert("Clear Slot", "Remove this entry?", [{ text: "Cancel" }, { text: "Clear", style: 'destructive', onPress: () => handleClearSlot(slot) }]); }}>
                                                <Text style={styles.periodNum}>{p}</Text>
                                                {slot ? (
                                                    <View style={styles.slotContent}>
                                                        <Text style={styles.slotSub} numberOfLines={1}>{slot.subject}</Text>
                                                        <Text style={styles.slotTea}>{teachers.find(t => t.uid === slot.teacher_id || t.id === slot.teacher_id)?.name || '-'}</Text>
                                                    </View>
                                                ) : <Plus size={14} color="#e2e8f0" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            ) : (
                <View style={styles.emptyState}><Calendar size={60} color="#cbd5e1" /><Text style={styles.emptyText}>Select a class to manage timetable</Text></View>
            )}

            <Modal visible={showPicker} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.mHeader}>
                            <Text style={styles.mTitle}>Assign Subject</Text>
                            <TouchableOpacity onPress={() => setShowPicker(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                        </View>
                        <Text style={styles.mSub}>Assigning to {selectedSlot?.day} - Period {selectedSlot?.period}</Text>
                        <ScrollView style={styles.mBody}>
                            <TouchableOpacity style={styles.assignItem} onPress={() => handleAssign({ name: 'Study Hour', type: 'study', teacher_id: null })}>
                                <View style={styles.aiIcon}><Text style={{ fontWeight: 'bold', color: '#64748b' }}>SH</Text></View>
                                <View style={styles.aiInfo}><Text style={styles.aiName}>Study Hour</Text><Text style={styles.aiMeta}>Self study period</Text></View>
                                <ChevronRight size={18} color="#cbd5e1" />
                            </TouchableOpacity>
                            {assigned.map(s => (
                                <TouchableOpacity key={s.id} style={styles.assignItem} onPress={() => handleAssign(s)}>
                                    <View style={[styles.aiIcon, { backgroundColor: s.type === 'lab' ? '#eef2ff' : '#f8fafc' }]}>{s.type === 'lab' ? <Info size={16} color="#6366f1" /> : <BookOpen size={16} color="#64748b" />}</View>
                                    <View style={styles.aiInfo}><Text style={styles.aiName}>{s.name}</Text><Text style={styles.aiMeta}>{s.teacher_name} • {s.type.toUpperCase()}</Text></View>
                                    <Text style={styles.aiStat}>{s.placed}/{s.required}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    classPicker: { paddingHorizontal: 20, marginBottom: 12 },
    classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
    activeChip: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    chipText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeChipText: { color: '#fff' },
    body: { flex: 1 },
    subjectOverview: { paddingVertical: 12 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#94a3b8', marginLeft: 20, marginBottom: 8 },
    subScroll: { paddingHorizontal: 20, gap: 10 },
    subCard: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', width: 140 },
    subCardName: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    progressBar: { flex: 1, height: 4, backgroundColor: '#f1f5f9', borderRadius: 2 },
    progressFill: { height: '100%', borderRadius: 2 },
    progressText: { fontSize: 9, fontWeight: 'bold', color: '#94a3b8' },
    gridContainer: { padding: 16 },
    dayGroup: { marginBottom: 20 },
    dayHeader: { paddingVertical: 6, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    dayName: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8', letterSpacing: 1 },
    periodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    periodSlot: { width: (width - 64) / 4, height: 70, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', padding: 4 },
    filledSlot: { borderStyle: 'solid' },
    labSlot: { borderLeftWidth: 3, borderLeftColor: '#6366f1' },
    periodNum: { position: 'absolute', top: 4, left: 4, fontSize: 8, color: '#cbd5e1', fontWeight: 'bold' },
    slotContent: { alignItems: 'center' },
    slotSub: { fontSize: 10, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
    slotTea: { fontSize: 8, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1', marginTop: 12 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '70%', padding: 24 },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    mTitle: { fontSize: 20, fontWeight: 'bold' },
    mSub: { fontSize: 13, color: '#94a3b8', marginBottom: 20 },
    mBody: { flex: 1 },
    assignItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    aiIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    aiInfo: { flex: 1 },
    aiName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    aiMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
    aiStat: { fontSize: 12, fontWeight: 'bold', color: '#6366f1' }
});

export default TimetableManagement;
