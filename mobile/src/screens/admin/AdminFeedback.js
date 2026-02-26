import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    FlatList
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Star, TrendingUp, Users, MessageSquare } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const AdminFeedback = ({ navigation }) => {
    const { userData } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [feedbacks, setFeedbacks] = useState([]);
    const [stats, setStats] = useState({
        avg: 0,
        total: 0,
        distribution: [0, 0, 0, 0, 0] // 1, 2, 3, 4, 5 stars
    });
    const [loading, setLoading] = useState(true);
    const [loadingFeedback, setLoadingFeedback] = useState(false);

    useEffect(() => {
        if (!userData?.college_id) return;

        const fetchTeachers = async () => {
            try {
                const collegeId = userData.college_id;
                const tQ = query(collection(db, 'teachers'), where('college_id', '==', collegeId));
                const staffQ = query(collection(db, 'staff'), where('college_id', '==', collegeId));

                const [tSnap, staffSnap] = await Promise.all([getDocs(tQ), getDocs(staffQ)]);

                const list = [
                    ...tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                    ...staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                ];
                setTeachers(list);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeachers();
    }, [userData]);

    useEffect(() => {
        if (!selectedTeacher) return;

        setLoadingFeedback(true);
        const q = query(
            collection(db, 'teacher_feedback'),
            where('teacherId', '==', selectedTeacher.id),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFeedbacks(list);

            if (list.length > 0) {
                const total = list.length;
                let sum = 0;
                const dist = [0, 0, 0, 0, 0];

                list.forEach(f => {
                    sum += f.rating;
                    if (f.rating >= 1 && f.rating <= 5) {
                        dist[f.rating - 1]++;
                    }
                });

                setStats({
                    avg: (sum / total).toFixed(1),
                    total: total,
                    distribution: dist
                });
            } else {
                setStats({ avg: 0, total: 0, distribution: [0, 0, 0, 0, 0] });
            }
            setLoadingFeedback(false);
        }, (error) => {
            console.error(error);
            setLoadingFeedback(false);
        });

        return () => unsubscribe();
    }, [selectedTeacher]);

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.title}>Faculty Feedback</Text>
        </View>
    );

    const renderTeacherPicker = () => (
        <View style={styles.pickerContainer}>
            <Text style={styles.sectionLabel}>Select Faculty Member</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teacherScroll}>
                {teachers.map(t => (
                    <TouchableOpacity
                        key={t.id}
                        style={[
                            styles.teacherChip,
                            selectedTeacher?.id === t.id && styles.selectedTeacherChip
                        ]}
                        onPress={() => setSelectedTeacher(t)}
                    >
                        <Text style={[
                            styles.teacherChipText,
                            selectedTeacher?.id === t.id && styles.selectedTeacherChipText
                        ]}>
                            {t.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderStats = () => {
        if (!selectedTeacher) return null;
        if (loadingFeedback) return <ActivityIndicator size="small" color="#6366f1" style={{ marginVertical: 40 }} />;

        return (
            <View style={styles.statsContainer}>
                <View style={styles.statsMain}>
                    <View style={styles.avgBox}>
                        <Text style={styles.avgVal}>{stats.avg}</Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <Star
                                    key={s}
                                    size={14}
                                    color={s <= Math.round(stats.avg) ? "#f59e0b" : "#cbd5e1"}
                                    fill={s <= Math.round(stats.avg) ? "#f59e0b" : "transparent"}
                                />
                            ))}
                        </View>
                        <Text style={styles.totalText}>{stats.total} ratings</Text>
                    </View>

                    <View style={styles.distBox}>
                        {[5, 4, 3, 2, 1].map(num => (
                            <View key={num} style={styles.distRow}>
                                <Text style={styles.distNum}>{num}</Text>
                                <Star size={10} color="#64748b" fill="#64748b" />
                                <View style={styles.barBg}>
                                    <View style={[
                                        styles.barFill,
                                        { width: stats.total > 0 ? `${(stats.distribution[num - 1] / stats.total) * 100}%` : '0%' }
                                    ]} />
                                </View>
                                <Text style={styles.distCount}>{stats.distribution[num - 1]}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {feedbacks.length > 0 && <Text style={styles.sectionTitle}>Individual Feedback</Text>}
            </View>
        );
    };

    const renderItem = ({ item }) => (
        <View style={styles.feedbackCard}>
            <View style={styles.cardHeader}>
                <View style={[styles.starsSmall, { gap: 4 }]}>
                    {[1, 2, 3, 4, 5].map(s => (
                        <Star
                            key={s}
                            size={12}
                            color={s <= item.rating ? "#f59e0b" : "#cbd5e1"}
                            fill={s <= item.rating ? "#f59e0b" : "transparent"}
                        />
                    ))}
                </View>
                <Text style={styles.timeText}>
                    {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Recent'}
                </Text>
            </View>
            {item.remark ? (
                <Text style={styles.remarkText}>"{item.remark}"</Text>
            ) : (
                <Text style={styles.emptyRemark}>No remark provided</Text>
            )}
        </View>
    );

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;

    return (
        <View style={styles.container}>
            {renderHeader()}

            <FlatList
                data={feedbacks}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListHeaderComponent={
                    <>
                        {renderTeacherPicker()}
                        {renderStats()}
                        {selectedTeacher && feedbacks.length === 0 && !loadingFeedback && (
                            <View style={styles.emptyBox}>
                                <MessageSquare size={48} color="#cbd5e1" />
                                <Text style={styles.emptyText}>No feedback yet for this faculty member</Text>
                            </View>
                        )}
                    </>
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { marginRight: 15, padding: 4 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    pickerContainer: { padding: 20 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
    teacherScroll: { flexDirection: 'row' },
    teacherChip: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    selectedTeacherChip: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    teacherChipText: { fontSize: 14, fontWeight: '600', color: '#475569' },
    selectedTeacherChipText: { color: '#fff' },
    statsContainer: { paddingHorizontal: 20 },
    statsMain: { backgroundColor: '#fff', borderRadius: 24, padding: 24, flexDirection: 'row', gap: 24, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 32 },
    avgBox: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    avgVal: { fontSize: 44, fontWeight: '900', color: '#1e293b' },
    starsRow: { flexDirection: 'row', gap: 4, marginVertical: 8 },
    totalText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    distBox: { flex: 1.5, justifyContent: 'center' },
    distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    distNum: { fontSize: 11, fontWeight: 'bold', color: '#64748b', width: 10 },
    barBg: { flex: 1, height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: '#6366f1' },
    distCount: { fontSize: 10, fontWeight: '600', color: '#94a3b8', width: 20, textAlign: 'right' },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 16 },
    feedbackCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 20 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    starsSmall: { flexDirection: 'row' },
    timeText: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
    remarkText: { fontSize: 14, color: '#334155', fontStyle: 'italic', lineHeight: 20 },
    emptyRemark: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
    emptyBox: { alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: 40 },
    emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 16, fontSize: 15 },
    listContent: { paddingBottom: 40 }
});

export default AdminFeedback;
