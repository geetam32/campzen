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
import { Plus, Trash2, Edit2, X, Megaphone, Users, GraduationCap, Clock, AlertCircle, ArrowLeft } from 'lucide-react-native';

const TeacherNotices = ({ navigation }) => {
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
        target_type: 'class',
        target_class_id: '',
        type: 'info'
    });

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const qN = query(collection(db, 'notices'),
                where('college_id', '==', userData.college_id),
                where('created_by', '==', userData.uid),
                orderBy('created_at', 'desc'));
            const snapN = await getDocs(qN);
            setNotices(snapN.docs.map(d => ({ id: d.id, ...d.data() })));

            const qC = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
            const snapC = await getDocs(qC);
            setClasses(snapC.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleSave = async () => {
        if (!formData.title || !formData.content) {
            Alert.alert("Error", "Please fill all required fields");
            return;
        }

        setSaving(true);
        try {
            const noticeData = {
                college_id: userData.college_id,
                title: formData.title,
                content: formData.content,
                target_type: formData.target_type,
                target_class_id: formData.target_type === 'class' ? formData.target_class_id : null,
                type: formData.type,
                created_by: userData.uid,
                author_name: userData.name,
                author_role: userData.role,
                created_at: editingNotice ? editingNotice.created_at : Timestamp.now(),
                updated_at: Timestamp.now()
            };

            if (editingNotice) {
                await updateDoc(doc(db, 'notices', editingNotice.id), noticeData);
            } else {
                await addDoc(collection(db, 'notices'), noticeData);
                // Also create a notification
                await addDoc(collection(db, 'notifications'), {
                    college_id: userData.college_id,
                    type: 'notice',
                    title: `New Notice: ${formData.title}`,
                    content: formData.content.substring(0, 50) + '...',
                    target_type: formData.target_type,
                    target_id: formData.target_type === 'class' ? formData.target_class_id : userData.college_id,
                    created_at: Timestamp.now(),
                    created_by: userData.uid,
                    author_name: userData.name
                });
            }
            setShowModal(false);
            fetchData();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const confirmDelete = (id) => {
        Alert.alert("Delete", "Are you sure?", [
            { text: "No" },
            {
                text: "Delete", style: 'destructive', onPress: async () => {
                    await deleteDoc(doc(db, 'notices', id));
                    fetchData();
                }
            }
        ]);
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'urgent': return '#ef4444';
            case 'warning': return '#f59e0b';
            default: return '#6366f1';
        }
    };

    const renderNoticeItem = ({ item }) => {
        const cls = classes.find(c => c.id === item.target_class_id);
        const dateStr = item.created_at?.toDate().toLocaleDateString();

        return (
            <View style={styles.noticeCard}>
                <View style={[styles.typeLine, { backgroundColor: getTypeColor(item.type) }]} />
                <View style={styles.noticeContent}>
                    <View style={styles.noticeHeader}>
                        <Text style={styles.noticeTitle}>{item.title}</Text>
                        <View style={styles.actions}>
                            <TouchableOpacity onPress={() => { setEditingNotice(item); setFormData({ ...item }); setShowModal(true); }}>
                                <Edit2 size={16} color="#6366f1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => confirmDelete(item.id)} style={{ marginLeft: 12 }}>
                                <Trash2 size={16} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={styles.noticeDesc} numberOfLines={2}>{item.content}</Text>
                    <View style={styles.noticeFooter}>
                        <View style={styles.targetBadge}>
                            {item.target_type === 'college' ? (
                                <><Users size={12} color="#64748b" /><Text style={styles.targetText}>Entire College</Text></>
                            ) : (
                                <><GraduationCap size={12} color="#64748b" /><Text style={styles.targetText}>{cls ? `${cls.branch} - ${cls.section}` : 'N/A'}</Text></>
                            )}
                        </View>
                        <View style={styles.dateBox}><Clock size={12} color="#94a3b8" /><Text style={styles.dateText}>{dateStr}</Text></View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <ArrowLeft size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.pageTitle}>My Notices</Text>
                        <Text style={styles.subTitle}>Manage class announcements</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingNotice(null); setFormData({ title: '', content: '', target_type: 'class', target_class_id: '', type: 'info' }); setShowModal(true); }}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={notices}
                    keyExtractor={item => item.id}
                    renderItem={renderNoticeItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><Megaphone size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No notices posted</Text></View>}
                />
            )}

            <Modal visible={showModal} animationType="slide" transparent={false}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{editingNotice ? 'Edit' : 'Post'} Notice</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <Text style={styles.label}>Notice Title</Text>
                        <TextInput style={styles.input} value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} placeholder="Notice heading..." />

                        <Text style={styles.label}>Type</Text>
                        <View style={styles.typeRow}>
                            {['info', 'warning', 'urgent'].map(t => (
                                <TouchableOpacity key={t} style={[styles.typeBtn, formData.type === t && { backgroundColor: getTypeColor(t) }]} onPress={() => setFormData({ ...formData, type: t })}>
                                    <Text style={[styles.typeBtnText, formData.type === t && { color: '#fff' }]}>{t.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Content</Text>
                        <TextInput style={[styles.input, { height: 120 }]} value={formData.content} onChangeText={t => setFormData({ ...formData, content: t })} placeholder="Enter notice details..." multiline={true} textAlignVertical="top" />

                        <Text style={styles.label}>Target Range</Text>
                        <View style={styles.typeRow}>
                            <TouchableOpacity style={[styles.typeBtn, formData.target_type === 'college' && styles.activeTypeBtn]} onPress={() => setFormData({ ...formData, target_type: 'college' })}>
                                <Text style={[styles.typeBtnText, formData.target_type === 'college' && styles.activeTypeText]}>COLLEGE</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.typeBtn, formData.target_type === 'class' && styles.activeTypeBtn]} onPress={() => setFormData({ ...formData, target_type: 'class' })}>
                                <Text style={[styles.typeBtnText, formData.target_type === 'class' && styles.activeTypeText]}>SINGLE CLASS</Text>
                            </TouchableOpacity>
                        </View>

                        {formData.target_type === 'class' && (
                            <>
                                <Text style={styles.label}>Target Class</Text>
                                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                                    {classes.map(c => (
                                        <TouchableOpacity key={c.id} style={[styles.chip, formData.target_class_id === c.id && styles.activeChip]} onPress={() => setFormData({ ...formData, target_class_id: c.id })}>
                                            <Text style={[styles.chipText, formData.target_class_id === c.id && styles.activeChipText]}>{c.branch} - {c.section}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </>
                        )}
                    </ScrollView>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingNotice ? 'Update' : 'Post'}</Text>}
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
    list: { padding: 20 },
    noticeCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
    typeLine: { width: 4 },
    noticeContent: { flex: 1, padding: 16 },
    noticeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    actions: { flexDirection: 'row' },
    noticeDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },
    noticeFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' },
    targetBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    targetText: { fontSize: 10, color: '#64748b', fontWeight: 'bold' },
    dateBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dateText: { fontSize: 10, color: '#94a3b8' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94a3b8', marginTop: 12, fontSize: 16 },
    modalView: { flex: 1, backgroundColor: '#fff' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalBody: { padding: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    typeRow: { flexDirection: 'row', gap: 10 },
    typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
    activeTypeBtn: { backgroundColor: '#6366f1' },
    typeBtnText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
    activeTypeText: { color: '#fff' },
    chipRow: { marginTop: 4 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8 },
    activeChip: { backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#6366f1' },
    chipText: { fontSize: 11, color: '#64748b' },
    activeChipText: { color: '#6366f1', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default TeacherNotices;
