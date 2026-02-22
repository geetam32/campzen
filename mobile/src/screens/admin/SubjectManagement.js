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
    FlatList
} from 'react-native';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Edit2, X, Search, Book } from 'lucide-react-native';

const SubjectManagement = () => {
    const { userData } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ name: '', code: '', type: 'theory' });

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'subjects'), where('college_id', '==', userData.college_id));
            const snap = await getDocs(q);
            setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleSave = async () => {
        if (!formData.name || !formData.code) return;
        setSaving(true);
        try {
            const data = { college_id: userData.college_id, name: formData.name, code: formData.code.toUpperCase(), type: formData.type };
            if (editingSubject) await updateDoc(doc(db, 'subjects', editingSubject.id), data);
            else await addDoc(collection(db, 'subjects'), data);
            setShowModal(false);
            fetchData();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const confirmDelete = (id) => {
        Alert.alert("Delete", "Are you sure? This affects timetables.", [
            { text: "Cancel" },
            { text: "Delete", style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'subjects', id)); fetchData(); } }
        ]);
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardInfo}>
                <Text style={styles.codeText}>{item.code}</Text>
                <Text style={styles.nameText}>{item.name}</Text>
                <View style={[styles.typeBadge, { backgroundColor: item.type === 'lab' ? '#dcfce7' : '#eef2ff' }]}>
                    <Text style={[styles.typeText, { color: item.type === 'lab' ? '#15803d' : '#6366f1' }]}>{item.type.toUpperCase()}</Text>
                </View>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingSubject(item); setFormData(item); setShowModal(true); }}>
                    <Edit2 size={18} color="#6366f1" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(item.id)}>
                    <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.pageTitle}>Subjects</Text>
                    <Text style={styles.subTitle}>Define course curriculum</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingSubject(null); setFormData({ name: '', code: '', type: 'theory' }); setShowModal(true); }}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBox}>
                    <Search size={18} color="#94a3b8" />
                    <TextInput style={styles.searchInput} placeholder="Search code or name..." value={searchTerm} onChangeText={setSearchTerm} />
                </View>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code.toLowerCase().includes(searchTerm.toLowerCase()))}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><Book size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No subjects yet</Text></View>}
                />
            )}

            <Modal visible={showModal} animationType="slide" transparent={false}>
                <View style={styles.modal}>
                    <View style={styles.mHeader}>
                        <Text style={styles.mTitle}>{editingSubject ? 'Edit' : 'Add'} Subject</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <View style={styles.mBody}>
                        <Text style={styles.label}>Subject Code</Text>
                        <TextInput style={styles.input} value={formData.code} onChangeText={t => setFormData({ ...formData, code: t })} placeholder="e.g. CS101" autoCapitalize="characters" />

                        <Text style={styles.label}>Subject Name</Text>
                        <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} placeholder="e.g. Data Structures" />

                        <Text style={styles.label}>Instruction Type</Text>
                        <View style={styles.typeGrid}>
                            {['theory', 'lab', 'elective'].map(t => (
                                <TouchableOpacity key={t} style={[styles.typeBtn, formData.type === t && styles.activeType]} onPress={() => setFormData({ ...formData, type: t })}>
                                    <Text style={[styles.typeBtnText, formData.type === t && styles.activeTypeText]}>{t.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Subject</Text>}
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
    addBtn: { backgroundColor: '#6366f1', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    searchSection: { paddingHorizontal: 20, marginBottom: 16 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
    list: { padding: 20, paddingTop: 0 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    cardInfo: { flex: 1 },
    codeText: { fontSize: 12, color: '#6366f1', fontWeight: 'bold' },
    nameText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },
    typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 6 },
    typeText: { fontSize: 9, fontWeight: 'bold' },
    actions: { flexDirection: 'row', gap: 12 },
    actionBtn: { padding: 4 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1', marginTop: 12 },
    modal: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    mTitle: { fontSize: 20, fontWeight: 'bold' },
    mBody: { padding: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    typeGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
    typeBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
    activeType: { backgroundColor: '#6366f1' },
    typeBtnText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeTypeText: { color: '#fff' },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default SubjectManagement;
