import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Modal,
    Switch,
    FlatList
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { AlertCircle, Send, CheckCircle, X, Shield, Lock } from 'lucide-react-native';

const StudentConcerns = () => {
    const { userData } = useAuth();
    const [concerns, setConcerns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        category: 'academic',
        reported_pin: '',
        description: '',
        anonymous: false
    });

    const categories = ['academic', 'bullying', 'infrastructure', 'other'];

    const fetchData = async () => {
        if (!userData?.college_id || !userData?.pin) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'concerns'), where('college_id', '==', userData.college_id), where('reporter_pin', '==', userData.pin));
            const snap = await getDocs(q);
            setConcerns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleSave = async () => {
        if (!formData.description) return;
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'concerns'), {
                college_id: userData.college_id,
                class_id: userData.class_id,
                reporter_pin: userData.pin,
                anonymous: formData.anonymous,
                category: formData.category,
                reported_pin: formData.reported_pin,
                description: formData.description,
                status: 'open',
                created_at: new Date()
            });
            setShowModal(false);
            setFormData({ category: 'academic', reported_pin: '', description: '', anonymous: false });
            fetchData();
        } catch (err) { console.error(err); }
        finally { setSubmitting(false); }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'resolved': return { bg: '#dcfce7', text: '#15803d' };
            case 'escalated': return { bg: '#fee2e2', text: '#b91c1c' };
            default: return { bg: '#fef3c7', text: '#b45309' };
        }
    };

    const renderConcern = ({ item }) => {
        const style = getStatusStyle(item.status);
        const date = item.created_at?.toDate().toLocaleDateString();

        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={styles.categoryBadge}><Text style={styles.categoryText}>{item.category.toUpperCase()}</Text></View>
                    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}><Text style={[styles.statusText, { color: style.text }]}>{item.status.toUpperCase()}</Text></View>
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.cardBottom}>
                    <Text style={styles.dateText}>{date}</Text>
                    {item.anonymous && <View style={styles.anonRow}><Shield size={10} color="#94a3b8" /><Text style={styles.anonText}>Anonymous</Text></View>}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.pageTitle}>Report Issues</Text>
                    <Text style={styles.subTitle}>Secure and direct to administration</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
                    <AlertCircle size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={concerns}
                    keyExtractor={item => item.id}
                    renderItem={renderConcern}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><AlertCircle size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No concerns reported</Text></View>}
                    refreshing={loading}
                    onRefresh={fetchData}
                />
            )}

            <Modal visible={showModal} animationType="slide" transparent={false}>
                <View style={styles.modal}>
                    <View style={styles.mHeader}>
                        <Text style={styles.mTitle}>New Report</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.mBody}>
                        <View style={styles.infoBox}><Lock size={16} color="#6366f1" /><Text style={styles.infoText}>Your safety is our priority. Reports are handled discreetly.</Text></View>

                        <Text style={styles.label}>Concern Category</Text>
                        <View style={styles.catGrid}>
                            {categories.map(c => (
                                <TouchableOpacity key={c} style={[styles.catBtn, formData.category === c && styles.activeCat]} onPress={() => setFormData({ ...formData, category: c })}>
                                    <Text style={[styles.catBtnText, formData.category === c && styles.activeCatText]}>{c.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Reported Student PIN (Optional)</Text>
                        <TextInput style={styles.input} value={formData.reported_pin} onChangeText={t => setFormData({ ...formData, reported_pin: t })} placeholder="e.g. 21001" />

                        <Text style={styles.label}>Detailed Description</Text>
                        <TextInput style={[styles.input, { height: 120 }]} value={formData.description} onChangeText={t => setFormData({ ...formData, description: t })} placeholder="Explain the situation..." multiline={true} textAlignVertical="top" />

                        <View style={styles.switchRow}>
                            <View>
                                <Text style={styles.switchTitle}>Submit Anonymously</Text>
                                <Text style={styles.switchSub}>Admins won't see your identity</Text>
                            </View>
                            <Switch
                                value={!!formData.anonymous}
                                onValueChange={v => setFormData({ ...formData, anonymous: v })}
                                trackColor={{ "false": '#e2e8f0', "true": '#6366f1' }}
                                thumbColor="#fff"
                            />
                        </View>
                    </ScrollView>
                    <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={submitting || !formData.description}>
                        {submitting ? <ActivityIndicator color="#fff" /> : <View style={styles.btnContent}><Send size={18} color="#fff" /><Text style={styles.btnText}>Submit Report</Text></View>}
                    </TouchableOpacity>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    addBtn: { backgroundColor: '#ef4444', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 20 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
    categoryBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    categoryText: { fontSize: 9, fontWeight: 'bold', color: '#64748b' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 9, fontWeight: 'bold' },
    cardDesc: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateText: { fontSize: 10, color: '#94a3b8' },
    anonRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    anonText: { fontSize: 10, color: '#94a3b8', fontStyle: 'italic' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1', marginTop: 12 },
    modal: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    mTitle: { fontSize: 20, fontWeight: 'bold' },
    mBody: { paddingHorizontal: 20 },
    infoBox: { backgroundColor: '#f5f3ff', padding: 12, borderRadius: 12, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 24 },
    infoText: { flex: 1, fontSize: 12, color: '#6366f1', fontWeight: '500' },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    activeCat: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    catBtnText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    activeCatText: { color: '#fff' },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, padding: 16, backgroundColor: '#f8fafc', borderRadius: 16 },
    switchTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    switchSub: { fontSize: 11, color: '#94a3b8' },
    submitBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default StudentConcerns;
