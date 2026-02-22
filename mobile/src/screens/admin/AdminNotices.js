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
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, updateDoc, orderBy, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import {
    Plus, Trash2, Edit2, X,
    Megaphone as MegaphoneIcon,
    Users as UsersIcon,
    GraduationCap as GradIcon,
    Clock as ClockIcon,
    AlertCircle as AlertIcon
} from 'lucide-react-native';

const AdminNotices = () => {
    const { userData } = useAuth();
    const [notices, setNotices] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingNotice, setEditingNotice] = useState(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        target_type: 'college',
        target_class_id: '',
        type: 'info'
    });

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const nQ = query(collection(db, 'notices'), where('college_id', '==', userData.college_id), orderBy('created_at', 'desc'));
            const cQ = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));

            const [nS, cS] = await Promise.all([getDocs(nQ), getDocs(cQ)]);
            setNotices(nS.docs.map(d => ({ id: d.id, ...d.data() })));
            setClasses(cS.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleSave = async () => {
        if (!formData.title || !formData.content) return;
        setSaving(true);
        try {
            const nData = {
                college_id: userData.college_id,
                title: formData.title,
                content: formData.content,
                target_type: formData.target_type,
                target_class_id: formData.target_type === 'class' ? formData.target_class_id : null,
                type: formData.type,
                created_by: userData.uid,
                author_name: userData.name,
                author_role: userData.role,
                updated_at: Timestamp.now()
            };

            if (editingNotice) {
                await updateDoc(doc(db, 'notices', editingNotice.id), nData);
            } else {
                await addDoc(collection(db, 'notices'), { ...nData, created_at: Timestamp.now() });
                // Simple notification trigger simulation
                await addDoc(collection(db, 'notifications'), {
                    college_id: userData.college_id,
                    type: 'notice',
                    title: `New Notice: ${formData.title}`,
                    content: formData.content.substring(0, 50),
                    target_type: formData.target_type,
                    target_id: formData.target_type === 'class' ? formData.target_class_id : userData.college_id,
                    created_at: Timestamp.now()
                });
            }
            setShowModal(false);
            fetchData();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const confirmDelete = (id) => {
        Alert.alert("Delete Notice", "Are you sure?", [
            { text: "No" },
            { text: "Delete", style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'notices', id)); fetchData(); } }
        ]);
    };

    const renderNotice = ({ item }) => {
        const cls = classes.find(c => c.id === item.target_class_id);
        const isUrgent = item.type === 'urgent';
        return (
            <View style={[styles.card, isUrgent && styles.urgentCard]}>
                <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                        <Text style={[styles.noticeTitle, isUrgent && styles.urgentText]}>{item.title}</Text>
                        <View style={styles.targetRow}>
                            {item.target_type === 'college' ? (
                                <View style={styles.targetBadge}><UsersIcon size={10} color="#64748b" /><Text style={styles.targetText}>ALL COLLEGE</Text></View>
                            ) : (
                                <View style={styles.targetBadge}><GradIcon size={10} color="#64748b" /><Text style={styles.targetText}>{cls ? `${cls.branch}-${cls.section}` : '-'}</Text></View>
                            )}
                            <Text style={styles.date}>{item.created_at?.toDate().toLocaleDateString()}</Text>
                        </View>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity onPress={() => { setEditingNotice(item); setFormData(item); setShowModal(true); }}><Edit2 size={16} color="#6366f1" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(item.id)}><Trash2 size={16} color="#ef4444" /></TouchableOpacity>
                    </View>
                </View>
                <Text style={styles.content} numberOfLines={3}>{item.content}</Text>
                <Text style={styles.author}>- {item.author_name} ({item.author_role})</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.pageTitle}>Notice Board</Text>
                    <Text style={styles.subTitle}>Broadcast alerts and info</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingNotice(null); setFormData({ title: '', content: '', target_type: 'college', target_class_id: '', type: 'info' }); setShowModal(true); }}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={notices}
                    keyExtractor={item => item.id}
                    renderItem={renderNotice}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><MegaphoneIcon size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No notices yet</Text></View>}
                    onRefresh={fetchData}
                    refreshing={loading}
                />
            )}

            <Modal visible={showModal} animationType="slide" transparent={false}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.mHeader}>
                        <Text style={styles.mTitle}>Broadcast Notice</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.mBody}>
                        <Text style={styles.label}>Title</Text>
                        <TextInput style={styles.input} value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} placeholder="e.g. Schedule Update" />

                        <Text style={styles.label}>Notice Type</Text>
                        <View style={styles.row}>
                            {['info', 'urgent'].map(t => (
                                <TouchableOpacity key={t} style={[styles.typeBtn, formData.type === t && styles.activeTypeBtn]} onPress={() => setFormData({ ...formData, type: t })}>
                                    <Text style={[styles.typeBtnText, formData.type === t && styles.activeTypeBtnText]}>{t.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Message Body</Text>
                        <TextInput style={[styles.input, styles.textArea]} value={formData.content} onChangeText={t => setFormData({ ...formData, content: t })} placeholder="Detailed explanation..." multiline={true} numberOfLines={5} textAlignVertical="top" />

                        <Text style={styles.label}>Broadcast Range</Text>
                        <View style={styles.row}>
                            {['college', 'class'].map(r => (
                                <TouchableOpacity key={r} style={[styles.typeBtn, formData.target_type === r && styles.activeTypeBtn]} onPress={() => setFormData({ ...formData, target_type: r })}>
                                    <Text style={[styles.typeBtnText, formData.target_type === r && styles.activeTypeBtnText]}>{r === 'college' ? 'ENTIRE COLLEGE' : 'SPECIFIC CLASS'}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {formData.target_type === 'class' && (
                            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                                {classes.map(c => (
                                    <TouchableOpacity key={c.id} style={[styles.chip, formData.target_class_id === c.id && styles.activeChip]} onPress={() => setFormData({ ...formData, target_class_id: c.id })}>
                                        <Text style={[styles.chipText, formData.target_class_id === c.id && styles.activeChipText]}>{c.branch}-{c.section}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </ScrollView>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Post Notice</Text>}
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    addBtn: { backgroundColor: '#6366f1', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 20, paddingTop: 0 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    urgentCard: { borderColor: '#ef4444', backgroundColor: '#fff' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    cardInfo: { flex: 1 },
    noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    urgentText: { color: '#ef4444' },
    targetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    targetBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    targetText: { fontSize: 9, fontWeight: 'bold', color: '#64748b' },
    date: { fontSize: 9, color: '#94a3b8' },
    actions: { flexDirection: 'row', gap: 12 },
    content: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 12 },
    author: { fontSize: 10, fontStyle: 'italic', color: '#94a3b8', textAlign: 'right' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1', marginTop: 12 },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    mTitle: { fontSize: 20, fontWeight: 'bold' },
    mBody: { padding: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    textArea: { height: 120 },
    row: { flexDirection: 'row', gap: 8, marginTop: 4 },
    typeBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
    activeTypeBtn: { backgroundColor: '#6366f1' },
    typeBtnText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeTypeBtnText: { color: '#fff' },
    chipRow: { marginTop: 12 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8 },
    activeChip: { backgroundColor: '#6366f1' },
    chipText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeChipText: { color: '#fff' },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default AdminNotices;
