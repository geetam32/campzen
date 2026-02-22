import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    FlatList
} from 'react-native';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, Users, GraduationCap, Clock, AlertCircle, Calendar } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const NoticeBoard = () => {
    const { userData } = useAuth();
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!userData?.college_id || !userData?.class_id) return;
        setLoading(true);
        try {
            const collageQ = query(collection(db, 'notices'), where('college_id', '==', userData.college_id), where('target_type', '==', 'college'));
            const classQ = query(collection(db, 'notices'), where('college_id', '==', userData.college_id), where('target_type', '==', 'class'), where('target_class_id', '==', userData.class_id));

            const [cSnap, clSnap] = await Promise.all([getDocs(collageQ), getDocs(classQ)]);
            const all = [...cSnap.docs.map(d => ({ id: d.id, ...d.data() })), ...clSnap.docs.map(d => ({ id: d.id, ...d.data() }))];
            all.sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0));
            setNotices(all);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const getTypeColor = (type) => {
        switch (type) {
            case 'urgent': return '#ef4444';
            case 'warning': return '#f59e0b';
            default: return '#6366f1';
        }
    };

    const renderNotice = ({ item }) => {
        const date = item.created_at?.toDate().toLocaleDateString();
        const time = item.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const typeColor = getTypeColor(item.type);

        return (
            <View style={[styles.noticeCard, { borderLeftColor: typeColor, borderLeftWidth: 4 }]}>
                <View style={styles.noticeHeader}>
                    <View style={styles.meta}>
                        <View style={[styles.badge, { backgroundColor: item.target_type === 'college' ? '#f1f5f9' : '#eef2ff' }]}>
                            {item.target_type === 'college' ? <Users size={10} color="#64748b" /> : <GraduationCap size={10} color="#6366f1" />}
                            <Text style={[styles.badgeText, { color: item.target_type === 'college' ? '#64748b' : '#6366f1' }]}>{item.target_type === 'college' ? 'COLLAGE' : 'MY CLASS'}</Text>
                        </View>
                        <Text style={styles.dateText}>{date}</Text>
                    </View>
                    <View style={styles.titleRow}>
                        {item.type === 'urgent' && <AlertCircle size={18} color="#ef4444" style={{ marginRight: 6 }} />}
                        <Text style={styles.noticeTitle}>{item.title}</Text>
                    </View>
                </View>
                <Text style={styles.noticeContent}>{item.content}</Text>
                <View style={styles.footer}>
                    <View style={styles.author}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{item.author_name?.charAt(0)}</Text></View>
                        <View>
                            <Text style={styles.authorName}>{item.author_name}</Text>
                            <Text style={styles.authorRole}>{item.author_role}</Text>
                        </View>
                    </View>
                    <View style={styles.timeBox}><Clock size={10} color="#94a3b8" /><Text style={styles.timeText}>{time}</Text></View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Notice Board</Text>
                <Text style={styles.subTitle}>College and class announcements</Text>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={notices}
                    keyExtractor={item => item.id}
                    renderItem={renderNotice}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><Megaphone size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No notices today</Text></View>}
                    refreshing={loading}
                    onRefresh={fetchData}
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
    list: { padding: 16 },
    noticeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    noticeHeader: { marginBottom: 12 },
    meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeText: { fontSize: 9, fontWeight: 'bold' },
    dateText: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold' },
    titleRow: { flexDirection: 'row', alignItems: 'center' },
    noticeTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    noticeContent: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 20 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
    author: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    authorName: { fontSize: 12, fontWeight: 'bold', color: '#1e293b' },
    authorRole: { fontSize: 9, color: '#94a3b8', textTransform: 'capitalize' },
    timeBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    timeText: { fontSize: 10, color: '#94a3b8' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94a3b8', fontSize: 16, marginTop: 12 }
});

export default NoticeBoard;
