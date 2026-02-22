import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    FlatList,
    Alert
} from 'react-native';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Search, Calendar, ChevronDown, ChevronUp, UserCheck, UserX, Clock } from 'lucide-react-native';

const AttendanceOverview = () => {
    const { userData } = useAuth();
    const [classes, setClasses] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [expanded, setExpanded] = useState(null);

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const clQ = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
            const clS = await getDocs(clQ);
            setClasses(clS.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchAttendance = async () => {
        if (!userData?.college_id) return;
        setFetching(true);
        try {
            let q = query(collection(db, 'attendance_records'), where('college_id', '==', userData.college_id), where('date', '==', selectedDate));
            if (selectedClass) q = query(collection(db, 'attendance_records'), where('college_id', '==', userData.college_id), where('class_id', '==', selectedClass), where('date', '==', selectedDate));
            const s = await getDocs(q);
            setRecords(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.period - b.period));
        } catch (err) { console.error(err); }
        finally { setFetching(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);
    useEffect(() => { fetchAttendance(); }, [selectedClass, selectedDate, userData]);

    const renderRecord = ({ item }) => {
        const cls = classes.find(c => c.id === item.class_id);
        const isOpen = expanded === item.id;

        return (
            <View style={styles.card}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(isOpen ? null : item.id)}>
                    <View style={styles.cardMain}>
                        <View style={styles.periodBadge}><Clock size={10} color="#6366f1" /><Text style={styles.periodText}>PERIOD {item.period}</Text></View>
                        <Text style={styles.className}>{cls ? `${cls.branch}-${cls.section}` : '-'}</Text>
                        <Text style={styles.markedBy}>By {item.marked_by}</Text>
                    </View>
                    <View style={styles.statRow}>
                        <View style={styles.stat}><Text style={[styles.statNum, { color: '#10b981' }]}>{item.present?.length || 0}</Text><Text style={styles.statLabel}>P</Text></View>
                        <View style={styles.stat}><Text style={[styles.statNum, { color: '#ef4444' }]}>{item.absent?.length || 0}</Text><Text style={styles.statLabel}>A</Text></View>
                        {isOpen ? <ChevronUp size={20} color="#94a3b8" /> : <ChevronDown size={20} color="#94a3b8" />}
                    </View>
                </TouchableOpacity>

                {isOpen && (
                    <View style={styles.details}>
                        <Text style={styles.detailTitle}>ABSENT STUDENTS</Text>
                        <View style={styles.pinGrid}>
                            {item.absent?.map(p => (
                                <View key={p} style={styles.absentPin}><Text style={styles.pinText}>{p}</Text></View>
                            ))}
                            {(!item.absent || item.absent.length === 0) && <Text style={styles.emptyDetail}>All present</Text>}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    if (loading) return <View style={styles.centered}><ActivityIndicator color="#6366f1" /></View>;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Attendance</Text>
                <Text style={styles.subTitle}>College-wide daily oversight</Text>
            </View>

            <View style={styles.filterSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll}>
                    <TouchableOpacity style={[styles.classChip, selectedClass === '' && styles.activeChip]} onPress={() => setSelectedClass('')}>
                        <Text style={[styles.chipText, selectedClass === '' && styles.activeChipText]}>ALL CLASSES</Text>
                    </TouchableOpacity>
                    {classes.map(c => (
                        <TouchableOpacity key={c.id} style={[styles.classChip, selectedClass === c.id && styles.activeChip]} onPress={() => setSelectedClass(c.id)}>
                            <Text style={[styles.chipText, selectedClass === c.id && styles.activeChipText]}>{c.branch}-{c.section}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <View style={styles.dateSelector}>
                    <Calendar size={16} color="#6366f1" />
                    <TextInput style={styles.dateInput} value={selectedDate} onChangeText={setSelectedDate} placeholder="YYYY-MM-DD" />
                    <Text style={styles.todayText}>{selectedDate === new Date().toISOString().split('T')[0] ? 'TODAY' : ''}</Text>
                </View>
            </View>

            {fetching ? <ActivityIndicator style={{ marginTop: 20 }} color="#6366f1" /> : (
                <FlatList
                    data={records}
                    keyExtractor={item => item.id}
                    renderItem={renderRecord}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><Calendar size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No records for this date</Text></View>}
                    onRefresh={fetchAttendance}
                    refreshing={fetching}
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
    filterSection: { paddingHorizontal: 20, marginBottom: 12 },
    classScroll: { marginBottom: 12 },
    classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
    activeChip: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    chipText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeChipText: { color: '#fff' },
    dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    dateInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    todayText: { fontSize: 10, fontWeight: 'bold', color: '#6366f1' },
    list: { padding: 20, paddingTop: 0 },
    card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', padding: 16, alignItems: 'center' },
    cardMain: { flex: 1 },
    periodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f4ff', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
    periodText: { fontSize: 9, fontWeight: 'bold', color: '#6366f1' },
    className: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    markedBy: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stat: { alignItems: 'center' },
    statNum: { fontSize: 14, fontWeight: 'bold' },
    statLabel: { fontSize: 9, color: '#94a3b8' },
    details: { padding: 16, paddingTop: 0, backgroundColor: '#fcfdfe', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    detailTitle: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginTop: 12, marginBottom: 8 },
    pinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    absentPin: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    pinText: { fontSize: 10, fontWeight: 'bold', color: '#b91c1c' },
    emptyDetail: { fontSize: 12, fontStyle: 'italic', color: '#10b981' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1', marginTop: 12 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default AttendanceOverview;
