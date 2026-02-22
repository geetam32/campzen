import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    FlatList,
    Alert
} from 'react-native';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, X, Clock, CheckCircle, AlertTriangle, Shield, User } from 'lucide-react-native';

const ConcernsManagement = () => {
    const { userData } = useAuth();
    const [concerns, setConcerns] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedConcern, setSelectedConcern] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const coQ = query(collection(db, 'concerns'), where('college_id', '==', userData.college_id));
            const clQ = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));

            const [coS, clS] = await Promise.all([getDocs(coQ), getDocs(clQ)]);

            setConcerns(coS.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)));
            setClasses(clS.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleStatusUpdate = async (id, status) => {
        try {
            await updateDoc(doc(db, 'concerns', id), { status, resolved_at: status === 'resolved' ? new Date() : null });
            setSelectedConcern(null);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'resolved': return { bg: '#dcfce7', text: '#15803d', icon: CheckCircle };
            case 'escalated': return { bg: '#fee2e2', text: '#b91c1c', icon: AlertTriangle };
            default: return { bg: '#fef3c7', text: '#b45309', icon: Clock };
        }
    };

    const renderItem = ({ item }) => {
        const style = getStatusStyle(item.status);
        const Icon = style.icon;
        const cls = classes.find(c => c.id === item.class_id);

        return (
            <TouchableOpacity style={styles.card} onPress={() => setSelectedConcern(item)}>
                <View style={styles.cardHeader}>
                    <View style={styles.categoryBadge}><Text style={styles.categoryText}>{item.category.toUpperCase()}</Text></View>
                    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}><Icon size={10} color={style.text} /><Text style={[styles.statusText, { color: style.text }]}>{item.status.toUpperCase()}</Text></View>
                </View>
                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.cardFooter}>
                    <Text style={styles.classText}>{cls ? `${cls.branch}-${cls.section}` : '-'}</Text>
                    <Text style={styles.dateText}>{item.created_at?.toDate().toLocaleDateString()}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const filtered = concerns.filter(c => filterStatus === 'all' || c.status === filterStatus);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Student Concerns</Text>
                <Text style={styles.subTitle}>Grievances and disciplinary reports</Text>
            </View>

            <View style={styles.filterSection}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
                    {['all', 'open', 'resolved', 'escalated'].map(s => (
                        <TouchableOpacity key={s} style={[styles.filterChip, filterStatus === s && styles.activeChip]} onPress={() => setFilterStatus(s)}>
                            <Text style={[styles.chipText, filterStatus === s && styles.activeChipText]}>{s.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><AlertCircle size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No concerns found</Text></View>}
                    refreshing={loading}
                    onRefresh={fetchData}
                />
            )}

            <Modal visible={!!selectedConcern} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.mHeader}>
                            <Text style={styles.mTitle}>Concern Details</Text>
                            <TouchableOpacity onPress={() => setSelectedConcern(null)}><X size={24} color="#1e293b" /></TouchableOpacity>
                        </View>
                        {selectedConcern && (
                            <ScrollView style={styles.mBody}>
                                <View style={styles.detailGrid}>
                                    <View style={styles.detailBox}><Text style={styles.dl}>REPORTER</Text><Text style={styles.dv}>{selectedConcern.anonymous ? 'Anonymous' : selectedConcern.reporter_pin}</Text></View>
                                    <View style={styles.detailBox}><Text style={styles.dl}>REPORTED PIN</Text><Text style={styles.dv}>{selectedConcern.reported_pin || '-'}</Text></View>
                                    <View style={styles.detailBox}><Text style={styles.dl}>CATEGORY</Text><Text style={styles.dv}>{selectedConcern.category.toUpperCase()}</Text></View>
                                    <View style={styles.detailBox}><Text style={styles.dl}>CLASS</Text><Text style={styles.dv}>{classes.find(c => c.id === selectedConcern.class_id)?.branch || '-'}</Text></View>
                                </View>

                                <Text style={styles.dl}>DESCRIPTION</Text>
                                <View style={styles.descBox}><Text style={styles.descText}>{selectedConcern.description}</Text></View>

                                <View style={styles.actionSection}>
                                    <Text style={styles.dl}>TAKE ACTION</Text>
                                    <View style={styles.actionBtns}>
                                        {selectedConcern.status !== 'resolved' && (
                                            <TouchableOpacity style={[styles.btn, styles.resolveBtn]} onPress={() => handleStatusUpdate(selectedConcern.id, 'resolved')}>
                                                <CheckCircle size={16} color="#fff" /><Text style={styles.btnText}>Resolve</Text>
                                            </TouchableOpacity>
                                        )}
                                        {selectedConcern.status === 'open' && (
                                            <TouchableOpacity style={[styles.btn, styles.escalateBtn]} onPress={() => handleStatusUpdate(selectedConcern.id, 'escalated')}>
                                                <AlertTriangle size={16} color="#fff" /><Text style={styles.btnText}>Escalate</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity style={[styles.btn, styles.closeBtn]} onPress={() => setSelectedConcern(null)}><Text style={styles.btnTextBlack}>Keep Open</Text></TouchableOpacity>
                                    </View>
                                </View>
                            </ScrollView>
                        )}
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
    filterSection: { marginBottom: 12 },
    filterBar: { paddingHorizontal: 20, gap: 8 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
    activeChip: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    chipText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeChipText: { color: '#fff' },
    list: { padding: 20, paddingTop: 0 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    categoryBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    categoryText: { fontSize: 9, fontWeight: 'bold', color: '#64748b' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 9, fontWeight: 'bold' },
    desc: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    classText: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8' },
    dateText: { fontSize: 10, color: '#94a3b8' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '80%', padding: 24 },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    mTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    mBody: { flex: 1 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    detailBox: { width: '47%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    dl: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', marginBottom: 4 },
    dv: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    descBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24 },
    descText: { fontSize: 14, color: '#475569', lineHeight: 22 },
    actionSection: {},
    actionBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
    btn: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    resolveBtn: { backgroundColor: '#10b981' },
    escalateBtn: { backgroundColor: '#ef4444' },
    closeBtn: { backgroundColor: '#f1f5f9' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    btnTextBlack: { color: '#1e293b', fontWeight: 'bold', fontSize: 14 }
});

export default ConcernsManagement;
