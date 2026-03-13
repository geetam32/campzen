import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
    ArrowLeft,
    Calendar,
    BookOpen,
    Clock,
    User,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    Info,
    Layout,
    FileText,
    Download
} from 'lucide-react-native';

const DailyReview = ({ navigation }) => {
    const { userData } = useAuth();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [records, setRecords] = useState([]);
    const [materials, setMaterials] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDailyTopics = async () => {
        if (!userData?.college_id || !userData?.class_id) return;

        setLoading(true);
        try {
            const q = query(
                collection(db, 'attendance_records'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id),
                where('date', '==', date)
            );

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const sortedData = data.sort((a, b) => a.period - b.period);
            setRecords(sortedData);
        } catch (error) {
            console.error("Error fetching daily reviews:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDailyTopics();
    }, [date, userData]);

    // Real-time listener for materials
    useEffect(() => {
        if (!userData?.college_id || !userData?.class_id) return;

        const q = query(
            collection(db, 'topic_materials'),
            where('college_id', '==', userData.college_id),
            where('class_id', '==', userData.class_id),
            where('date', '==', date)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const mats = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!mats[data.attendance_record_id]) mats[data.attendance_record_id] = [];
                mats[data.attendance_record_id].push({ id: doc.id, ...data });
            });
            setMaterials(mats);
        });

        return () => unsubscribe();
    }, [date, userData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDailyTopics();
    };

    const toggleExpand = (id) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const changeDate = (days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        setDate(d.toISOString().split('T')[0]);
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleViewPDF = async (mat) => {
        if (!mat.pdf_url) return;
        try {
            const tempFile = `${FileSystem.cacheDirectory}${mat.pdf_name || 'document.pdf'}`;
            await FileSystem.writeAsStringAsync(tempFile, mat.pdf_url.split(',')[1], {
                encoding: FileSystem.EncodingType.Base64
            });
            await Sharing.shareAsync(tempFile);
        } catch (error) {
            console.error("Error opening PDF:", error);
            Alert.alert("Error", "Could not open PDF.");
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>Daily Review</Text>
                    <Text style={styles.subtitle}>What was taught today</Text>
                </View>
            </View>

            {/* Date Selector */}
            <View style={styles.dateSelector}>
                <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
                    <ChevronLeft size={20} color="#6366f1" />
                </TouchableOpacity>
                <View style={styles.dateDisplay}>
                    <Calendar size={18} color="#6366f1" />
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                </View>
                <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateNavBtn}>
                    <ChevronRight size={20} color="#6366f1" />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6366f1" />
                    <Text style={styles.loadingText}>Fetching lessons...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {records.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconBox}>
                                <Layout size={48} color="#cbd5e1" />
                            </View>
                            <Text style={styles.emptyTitle}>No Lessons Logged</Text>
                            <Text style={styles.emptySubtitle}>
                                There are no lesson records available for this date.
                            </Text>
                            <TouchableOpacity
                                style={styles.todayBtn}
                                onPress={() => setDate(new Date().toISOString().split('T')[0])}
                            >
                                <Text style={styles.todayBtnText}>Back to Today</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        records.map((record, index) => {
                            const isExpanded = expandedId === record.id;
                            const recordMaterials = materials[record.id] || [];
                            const notes = recordMaterials.filter(m => m.type === 'note');
                            const assignments = recordMaterials.filter(m => m.type === 'assignment');

                            return (
                                <View key={record.id} style={styles.lessonCard}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => toggleExpand(record.id)}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.periodBadge, { backgroundColor: index % 2 === 0 ? '#eef2ff' : '#f0fdf4' }]}>
                                                <Clock size={12} color={index % 2 === 0 ? '#6366f1' : '#10b981'} />
                                                <Text style={[styles.periodText, { color: index % 2 === 0 ? '#6366f1' : '#10b981' }]}>
                                                    Period {record.period}
                                                </Text>
                                            </View>
                                            <View style={styles.headerRight}>
                                                <View style={styles.subjectBox}>
                                                    <BookOpen size={14} color="#64748b" />
                                                    <Text style={styles.subjectName}>{record.subject_name}</Text>
                                                </View>
                                                {isExpanded ? (
                                                    <ChevronUp size={20} color="#cbd5e1" />
                                                ) : (
                                                    <ChevronDown size={20} color="#cbd5e1" />
                                                )}
                                            </View>
                                        </View>

                                        <View style={styles.topicWell}>
                                            <Text style={styles.topicLabel}>TOPIC TAUGHT</Text>
                                            <Text style={styles.topicText}>
                                                {record.topic || 'No specific topic recorded for this lesson.'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.expansionContent}>
                                            {/* Notes Section */}
                                            <View style={styles.materialSection}>
                                                <View style={styles.sectionHeader}>
                                                    <FileText size={16} color="#6366f1" />
                                                    <Text style={styles.sectionTitle}>Notes</Text>
                                                </View>
                                                {notes.length > 0 ? notes.map(note => (
                                                    <View key={note.id} style={styles.materialCard}>
                                                        {note.text ? <Text style={styles.materialText}>{note.text}</Text> : null}
                                                        {note.image_url ? (
                                                            <Image source={{ uri: note.image_url }} style={styles.materialImage} resizeMode="contain" />
                                                        ) : null}
                                                        {note.pdf_url ? (
                                                            <TouchableOpacity
                                                                style={styles.pdfItem}
                                                                onPress={() => handleViewPDF(note)}
                                                            >
                                                                <FileText size={20} color="#ef4444" />
                                                                <Text style={styles.pdfItemText} numberOfLines={1}>{note.pdf_name || 'View PDF'}</Text>
                                                                <Download size={16} color="#6366f1" />
                                                            </TouchableOpacity>
                                                        ) : null}
                                                    </View>
                                                )) : (
                                                    <Text style={styles.noMaterialText}>No notes provided.</Text>
                                                )}
                                            </View>

                                            {/* Assignments Section */}
                                            <View style={styles.materialSection}>
                                                <View style={styles.sectionHeader}>
                                                    <BookOpen size={16} color="#f97316" />
                                                    <Text style={styles.sectionTitle}>Assignments</Text>
                                                </View>
                                                {assignments.length > 0 ? assignments.map(assignment => (
                                                    <View key={assignment.id} style={styles.materialCard}>
                                                        {assignment.text ? <Text style={styles.materialText}>{assignment.text}</Text> : null}
                                                        {assignment.image_url ? (
                                                            <Image source={{ uri: assignment.image_url }} style={styles.materialImage} resizeMode="contain" />
                                                        ) : null}
                                                        {assignment.pdf_url ? (
                                                            <TouchableOpacity
                                                                style={styles.pdfItem}
                                                                onPress={() => handleViewPDF(assignment)}
                                                            >
                                                                <FileText size={20} color="#ef4444" />
                                                                <Text style={styles.pdfItemText} numberOfLines={1}>{assignment.pdf_name || 'View PDF'}</Text>
                                                                <Download size={16} color="#6366f1" />
                                                            </TouchableOpacity>
                                                        ) : null}
                                                    </View>
                                                )) : (
                                                    <Text style={styles.noMaterialText}>No assignments assigned.</Text>
                                                )}
                                            </View>
                                        </View>
                                    )}

                                    <View style={styles.cardFooter}>
                                        <View style={styles.teacherInfo}>
                                            <View style={styles.avatarMini}>
                                                <User size={12} color="#94a3b8" />
                                            </View>
                                            <Text style={styles.teacherName}>Taught by: {record.marked_by_name}</Text>
                                        </View>
                                        <Info size={16} color="#cbd5e1" />
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#fff',
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backBtn: {
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
    },
    subtitle: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dateNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f5f7ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyIconBox: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1e293b',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
        lineHeight: 20,
    },
    todayBtn: {
        marginTop: 24,
        backgroundColor: '#6366f1',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
    },
    todayBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    lessonCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    periodBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 6,
    },
    periodText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    subjectBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    subjectName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1e293b',
    },
    topicWell: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    topicLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 1,
        marginBottom: 6,
    },
    topicText: {
        fontSize: 14,
        color: '#334155',
        lineHeight: 22,
        fontWeight: '600',
    },
    expansionContent: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        marginBottom: 16,
        gap: 20,
    },
    materialSection: {
        gap: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1e293b',
    },
    materialCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        gap: 10,
    },
    materialText: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
        fontWeight: '600',
    },
    materialImage: {
        width: '100%',
        height: 150,
        borderRadius: 10,
        backgroundColor: '#fff',
    },
    pdfItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginTop: 5,
        gap: 10,
        borderWidth: 1,
        borderColor: '#eef2ff',
    },
    pdfItemText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    noMaterialText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
        marginLeft: 24,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    teacherInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    avatarMini: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    teacherName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    }
});

export default DailyReview;
