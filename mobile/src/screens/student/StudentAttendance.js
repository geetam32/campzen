import React, { useState, useEffect, useMemo } from 'react';
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
import {
    Calendar as CalendarIcon, TrendingUp, AlertCircle,
    CheckCircle, XCircle, Flame, Trophy, ChevronLeft, ChevronRight, ArrowLeft
} from 'lucide-react-native';
import { Svg, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../api/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const StudentAttendance = ({ navigation }) => {
    const { userData } = useAuth();
    const [stats, setStats] = useState({
        totalClasses: 0,
        present: 0,
        absent: 0,
        percentage: 0,
        streak: 5
    });
    const [animatedPercentage, setAnimatedPercentage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [allRecords, setAllRecords] = useState([]);
    const [viewingMonth, setViewingMonth] = useState(new Date(2026, 1, 1)); // Default to Feb 2026 for consistency with project timeline

    useEffect(() => {
        if (!userData?.college_id || !userData?.class_id) return;
        setLoading(true);

        const q = query(collection(db, 'attendance_records'),
            where('college_id', '==', userData.college_id),
            where('class_id', '==', userData.class_id));

        const unsubscribe = onSnapshot(q, (snap) => {
            const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            records.sort((a, b) => b.date.localeCompare(a.date) || b.period - a.period);

            let pCount = 0;
            let aCount = 0;
            records.forEach(r => {
                if (r.present?.includes(userData.pin)) pCount++;
                else if (r.absent?.includes(userData.pin)) aCount++;
            });

            const total = pCount + aCount;
            const perc = total > 0 ? Math.round((pCount / total) * 100) : 100;

            setStats(prev => ({
                ...prev,
                totalClasses: total,
                present: pCount,
                absent: aCount,
                percentage: perc
            }));
            setAllRecords(records);
            setLoading(false);

            // Calculate streak
            let streak = 0;
            const uniqueDates = [...new Set(records.map(r => r.date))].sort().reverse();
            for (let d of uniqueDates) {
                const dayRecords = records.filter(r => r.date === d);
                const wasPresent = dayRecords.some(r => r.present?.includes(userData.pin));
                if (wasPresent) streak++;
                else break;
            }
            setStats(prev => ({ ...prev, streak }));
        });

        return () => unsubscribe();
    }, [userData]);

    useEffect(() => {
        let current = 0;
        const interval = setInterval(() => {
            if (current < stats.percentage) {
                current += 2;
                setAnimatedPercentage(Math.min(current, stats.percentage));
            } else {
                setAnimatedPercentage(stats.percentage);
                clearInterval(interval);
            }
        }, 20);
        return () => clearInterval(interval);
    }, [stats.percentage]);

    const getStatusMessage = () => {
        if (stats.percentage >= 75) {
            return { text: "Great! Your attendance is above threshold.", type: "success" };
        } else {
            return { text: "Warning: Your attendance is below 75%.", type: "warning" };
        }
    };

    const statusMsg = getStatusMessage();

    const [selectedDate, setSelectedDate] = useState(null);

    const monthDays = useMemo(() => {
        const year = viewingMonth.getFullYear();
        const month = viewingMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        return Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRecords = allRecords.filter(r => r.date === dateStr);

            let status = 'none';
            if (dayRecords.length > 0) {
                const isPresent = dayRecords.some(r => r.present?.includes(userData.pin));
                status = isPresent ? 'present' : 'absent';
            }

            return { day, date: dateStr, status, records: dayRecords };
        });
    }, [viewingMonth, allRecords, userData]);

    const changeMonth = (offset) => {
        setViewingMonth(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + offset, 1));
    };

    const strokeDasharray = 2 * Math.PI * 15;
    const strokeDashoffset = strokeDasharray - (strokeDasharray * animatedPercentage) / 100;

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Attendance Overview</Text>
                </View>
                <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                        <Flame size={12} color="#fff" />
                        <Text style={styles.badgeText}>{stats.streak} Day Streak</Text>
                    </View>
                    <LinearGradient colors={['#10B981', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badge}>
                        <Trophy size={12} color="#fff" />
                        <Text style={styles.badgeText}>On Track</Text>
                    </LinearGradient>
                </View>
            </View>

            {/* Circular Chart */}
            <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>Consistency Score</Text>
                <View style={styles.circularChartBox}>
                    <Svg width={180} height={180} viewBox="0 0 36 36">
                        <Circle
                            cx={18}
                            cy={18}
                            r={15}
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth={3}
                        />
                        <Circle
                            cx={18}
                            cy={18}
                            r={15}
                            fill="none"
                            stroke={animatedPercentage >= 75 ? '#10b981' : '#ef4444'}
                            strokeWidth={3}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 18 18)"
                        />
                    </Svg>
                    <View style={styles.percentageCenter}>
                        <Text style={styles.percentageNumber}>{animatedPercentage}%</Text>
                        <Text style={[styles.percentageStatus, { color: animatedPercentage >= 75 ? '#10b981' : '#ef4444' }]}>
                            {animatedPercentage >= 75 ? 'Safe' : 'Watch Out'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.alertBox, {
                    backgroundColor: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(234, 179, 8, 0.05)',
                    borderLeftColor: statusMsg.type === 'success' ? '#10b981' : '#eab308'
                }]}>
                    {statusMsg.type === 'success' ? <CheckCircle size={18} color="#10b981" /> : <AlertCircle size={18} color="#eab308" />}
                    <Text style={styles.alertText}>{statusMsg.text}</Text>
                </View>
            </View>

            {/* Calendar */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardTitleBox}>
                        <CalendarIcon size={20} color="#6366f1" />
                        <Text style={styles.cardTitle}>
                            {viewingMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </Text>
                    </View>
                    <View style={styles.navBtns}>
                        <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
                            <ChevronLeft size={20} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
                            <ChevronRight size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.calendarGrid}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                        <Text key={`${day}-${i}`} style={styles.calendarDayHeader}>{day}</Text>
                    ))}
                    {Array.from({ length: (new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
                        <View key={`empty-${i}`} style={styles.calendarDayEmpty} />
                    ))}
                    {monthDays.map(item => (
                        <TouchableOpacity
                            key={item.day}
                            style={[
                                styles.calendarDay,
                                item.status === 'present' ? styles.presentDay :
                                    item.status === 'absent' ? styles.absentDay : null,
                                selectedDate?.date === item.date && styles.selectedDay
                            ]}
                            onPress={() => setSelectedDate(item)}
                        >
                            <Text style={[
                                styles.dayText,
                                item.status === 'present' ? styles.presentText :
                                    item.status === 'absent' ? styles.absentText : { color: '#64748b' }
                            ]}>{item.day}</Text>
                            {item.status === 'present' && <View style={styles.dot} />}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Detailed Report */}
            <Text style={styles.sectionTitle}>
                {selectedDate ? `Records for ${new Date(selectedDate.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` : 'Recent History'}
            </Text>
            <View style={styles.reportCard}>
                {(selectedDate ? selectedDate.records : allRecords.slice(0, 10)).length === 0 ? (
                    <Text style={styles.emptyText}>No records found for this period</Text>
                ) : (
                    (selectedDate ? selectedDate.records : allRecords.slice(0, 10)).map((record, i) => {
                        const isPresent = record.present?.includes(userData.pin);
                        const dateObj = new Date(record.date);
                        return (
                            <View key={record.id} style={styles.reportRow}>
                                <View style={styles.dateBox}>
                                    <Text style={styles.dayNum}>{dateObj.getDate()}</Text>
                                    <Text style={styles.monthName}>{dateObj.toLocaleString('default', { month: 'short' }).toUpperCase()}</Text>
                                </View>
                                <View style={styles.statusLine}>
                                    <View style={[styles.statusDot, { backgroundColor: isPresent ? '#10b981' : '#ef4444' }]} />
                                </View>
                                <View style={styles.reportContent}>
                                    <Text style={styles.statusTitle}>{isPresent ? 'Present' : 'Absent'}</Text>
                                    <Text style={styles.statusTime}>Period {record.period} • {record.marked_by_name || 'Teacher'}</Text>
                                </View>
                                {isPresent && <CheckCircle size={16} color="#10b981" />}
                            </View>
                        );
                    })
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { padding: 20, paddingTop: 60 },
    header: { marginBottom: 24, gap: 12 },
    backBtn: { padding: 4 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    badgeRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 6 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    chartCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    circularChartBox: { position: 'relative', marginVertical: 20 },
    percentageCenter: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center' },
    percentageNumber: { fontSize: 32, fontWeight: 'bold', color: '#1e293b' },
    percentageStatus: { fontSize: 12, fontWeight: 'bold', marginTop: 4 },
    alertBox: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderLeftWidth: 4, width: '100%', gap: 12 },
    alertText: { fontSize: 13, color: '#1e293b', fontWeight: '500', flex: 1 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    cardTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navBtns: { flexDirection: 'row', gap: 8 },
    navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    calendarDayHeader: { width: (width - 88) / 7, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
    calendarDay: { width: (width - 88) / 7, aspectRatio: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    calendarDayEmpty: { width: (width - 88) / 7, aspectRatio: 1 },
    presentDay: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
    absentDay: { backgroundColor: 'rgba(239, 68, 68, 0.05)' },
    dayText: { fontSize: 14, fontWeight: '600' },
    presentText: { color: '#10b981' },
    absentText: { color: '#ef4444' },
    dot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: '#10b981' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 32, marginBottom: 16 },
    reportCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    reportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 16 },
    dateBox: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 10, alignItems: 'center', minWidth: 50 },
    dayNum: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    monthName: { fontSize: 9, color: '#64748b', fontWeight: 'bold' },
    statusLine: { alignItems: 'center', width: 12 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    reportContent: { flex: 1 },
    statusTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
    statusTime: { fontSize: 12, color: '#64748b', marginTop: 2 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { textAlign: 'center', color: '#94a3b8', padding: 20 }
});

export default StudentAttendance;
