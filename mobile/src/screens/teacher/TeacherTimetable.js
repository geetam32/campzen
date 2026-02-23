import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Calendar, Clock, Book, MapPin, ChevronRight, ChevronLeft, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const TeacherTimetable = ({ navigation }) => {
    const { userData } = useAuth();
    const [timetable, setTimetable] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeDay, setActiveDay] = useState(getDayName());

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const periods = [1, 2, 3, 4, 5, 6, 7, 8];

    function getDayName() {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let d = dayNames[new Date().getDay()];
        return d === 'Sunday' ? 'Monday' : d;
    }

    useEffect(() => {
        const fetchTimetable = async () => {
            if (!userData?.college_id || !userData?.uid) return;
            setLoading(true);
            try {
                const ttQuery = query(
                    collection(db, 'timetables'),
                    where('college_id', '==', userData.college_id),
                    where('teacher_id', '==', userData.uid)
                );
                const snapshot = await getDocs(ttQuery);
                setTimetable(snapshot.docs.map(doc => doc.data()));
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchTimetable();
    }, [userData]);

    const getSlot = (day, period) => {
        return timetable.find(t => t.day === day && t.period === period);
    };

    const daySlots = periods.map(p => ({ period: p, data: getSlot(activeDay, p) }));

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <ArrowLeft size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.pageTitle}>Timetable</Text>
                        <Text style={styles.subTitle}>Your weekly schedule</Text>
                    </View>
                </View>
            </View>

            <View style={styles.dayPicker}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPickerContent}>
                    {days.map(day => (
                        <TouchableOpacity
                            key={day}
                            style={[styles.dayTab, activeDay === day && styles.activeTab]}
                            onPress={() => setActiveDay(day)}
                        >
                            <Text style={[styles.dayText, activeDay === day && styles.activeDayText]}>{day.substring(0, 3).toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                    {daySlots.map(slot => (
                        <View key={slot.period} style={styles.periodRow}>
                            <View style={styles.timeLine}>
                                <Text style={styles.periodLabel}>P{slot.period}</Text>
                                <View style={styles.line} />
                            </View>
                            {slot.data ? (
                                <LinearGradient colors={slot.data.is_lab ? ['#f1f5f9', '#e2e8f0'] : ['#fff', '#fff']} style={[styles.slotCard, slot.data.is_lab && styles.labSlot]}>
                                    <View style={styles.slotHeader}>
                                        <Text style={styles.subjectText}>{slot.data.subject}</Text>
                                        {slot.data.is_lab && <View style={styles.labBadge}><Text style={styles.labText}>LAB</Text></View>}
                                    </View>
                                    <View style={styles.slotFooter}>
                                        <View style={styles.metaItem}>
                                            <Book size={12} color="#94a3b8" />
                                            <Text style={styles.metaText}>{slot.data.branch} {slot.data.section}</Text>
                                        </View>
                                        <View style={styles.metaItem}>
                                            <MapPin size={12} color="#94a3b8" />
                                            <Text style={styles.metaText}>Room {slot.data.room || 'N/A'}</Text>
                                        </View>
                                    </View>
                                </LinearGradient>
                            ) : (
                                <View style={styles.emptySlot}>
                                    <Text style={styles.emptyText}>No Class</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    dayPicker: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    dayPickerContent: { paddingHorizontal: 20, gap: 12, height: 60, alignItems: 'center' },
    dayTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f8fafc' },
    activeTab: { backgroundColor: '#6366f1' },
    dayText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
    activeDayText: { color: '#fff' },
    list: { flex: 1 },
    listContent: { padding: 20, paddingBottom: 40 },
    periodRow: { flexDirection: 'row', marginBottom: 16, minHeight: 80 },
    timeLine: { width: 40, alignItems: 'center' },
    periodLabel: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8' },
    line: { flex: 1, width: 2, backgroundColor: '#e2e8f0', marginVertical: 8 },
    slotCard: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    labSlot: { borderColor: '#cbd5e1' },
    slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    subjectText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    labBadge: { backgroundColor: '#475569', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    labText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    slotFooter: { flexDirection: 'row', gap: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 12, color: '#64748b' },
    emptySlot: { flex: 1, backgroundColor: 'rgba(241, 245, 249, 0.5)', borderRadius: 16, justifyContent: 'center', paddingHorizontal: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#e2e8f0' },
    emptyText: { color: '#cbd5e1', fontSize: 14, fontStyle: 'italic' }
});

export default TeacherTimetable;
