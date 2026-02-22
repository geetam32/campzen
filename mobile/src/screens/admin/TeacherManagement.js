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
    Switch,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Edit2, X, Search, UserCheck, ChevronRight, BookOpen, GraduationCap } from 'lucide-react-native';

const TeacherManagement = () => {
    const { userData } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        uid: '',
        name: '',
        email: '',
        password: '',
        is_class_teacher: false,
        class_id_assigned: '',
        subject_assignments: []
    });

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const tQ = query(collection(db, 'teachers'), where('college_id', '==', userData.college_id));
            const cQ = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
            const sQ = query(collection(db, 'subjects'), where('college_id', '==', userData.college_id));

            const [tS, cS, sS] = await Promise.all([getDocs(tQ), getDocs(cQ), getDocs(sQ)]);

            setTeachers(tS.docs.map(d => ({ id: d.id, ...d.data() })));
            setClasses(cS.docs.map(d => ({ id: d.id, ...d.data() })));
            setSubjects(sS.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleSave = async () => {
        if (!formData.uid || !formData.name || !formData.email) {
            Alert.alert("Error", "Required fields missing");
            return;
        }
        setSaving(true);
        try {
            const tData = {
                college_id: userData.college_id,
                uid: formData.uid,
                name: formData.name,
                email: formData.email,
                role: 'teacher',
                is_class_teacher: formData.is_class_teacher,
                class_id_assigned: formData.is_class_teacher ? formData.class_id_assigned : null,
                subject_assignments: formData.subject_assignments.filter(a => a.subject_id && a.class_id)
            };

            if (formData.password) tData.password = formData.password;

            if (editingTeacher) {
                await updateDoc(doc(db, 'teachers', editingTeacher.id), tData);
            } else {
                if (!formData.password) { Alert.alert("Error", "Password required"); return; }
                await addDoc(collection(db, 'teachers'), { ...tData, status: 'active', created_at: new Date() });
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
                    await deleteDoc(doc(db, 'teachers', id));
                    fetchData();
                }
            }
        ]);
    };

    const addAsgn = () => setFormData({ ...formData, subject_assignments: [...formData.subject_assignments, { subject_id: '', class_id: '' }] });
    const remAsgn = (i) => {
        const n = [...formData.subject_assignments]; n.splice(i, 1);
        setFormData({ ...formData, subject_assignments: n });
    };
    const upAsgn = (i, f, v) => {
        const n = [...formData.subject_assignments]; n[i][f] = v;
        setFormData({ ...formData, subject_assignments: n });
    };

    const renderTeacher = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardInfo}>
                <Text style={styles.nameText}>{item.name}</Text>
                <Text style={styles.uidText}>UID: {item.uid}</Text>
                {item.is_class_teacher && (
                    <View style={styles.ctBadge}><UserCheck size={10} color="#10b981" /><Text style={styles.ctText}>Class Teacher</Text></View>
                )}
            </View>
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingTeacher(item); setFormData({ ...item, password: '' }); setShowModal(true); }}>
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
                    <Text style={styles.pageTitle}>Teachers</Text>
                    <Text style={styles.subTitle}>Faculty and class assignments</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingTeacher(null); setFormData({ uid: '', name: '', email: '', password: '', is_class_teacher: false, class_id_assigned: '', subject_assignments: [] }); setShowModal(true); }}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBox}>
                    <Search size={18} color="#94a3b8" />
                    <TextInput style={styles.searchInput} placeholder="Search name or UID..." value={searchTerm} onChangeText={setSearchTerm} />
                </View>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={teachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.uid.toLowerCase().includes(searchTerm.toLowerCase()))}
                    keyExtractor={item => item.id}
                    renderItem={renderTeacher}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No teachers found</Text></View>}
                />
            )}

            <Modal visible={showModal} animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.mHeader}>
                        <Text style={styles.mTitle}>{editingTeacher ? 'Edit' : 'Add'} Teacher</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.mBody}>
                        <Text style={styles.label}>Teacher UID (3 Letters)</Text>
                        <TextInput style={styles.input} value={formData.uid} onChangeText={t => setFormData({ ...formData, uid: t.toUpperCase() })} placeholder="e.g. ABC" maxLength={3} autoCapitalize="characters" />

                        <Text style={styles.label}>Full Name</Text>
                        <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} placeholder="e.g. Dr. Smith" />

                        <Text style={styles.label}>Email Address</Text>
                        <TextInput style={styles.input} value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} placeholder="e.g. smith@edu.in" keyboardType="email-address" autoCapitalize="none" />

                        <Text style={styles.label}>Password {editingTeacher && "(Optional)"}</Text>
                        <TextInput style={styles.input} value={formData.password} onChangeText={t => setFormData({ ...formData, password: t })} placeholder="Login password" secureTextEntry />

                        <View style={styles.divider} />

                        <View style={styles.switchRow}>
                            <Text style={styles.switchText}>Assign as Class Teacher</Text>
                            <Switch
                                value={!!formData.is_class_teacher}
                                onValueChange={v => setFormData({ ...formData, is_class_teacher: v })}
                                trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                                thumbColor="#fff"
                            />
                        </View>

                        {formData.is_class_teacher && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                                {classes.map(c => (
                                    <TouchableOpacity key={c.id} style={[styles.chip, formData.class_id_assigned === c.id && styles.activeChip]} onPress={() => setFormData({ ...formData, class_id_assigned: c.id })}>
                                        <Text style={[styles.chipText, formData.class_id_assigned === c.id && styles.activeChipText]}>{c.branch} - {c.section}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <View style={styles.asgnHeader}>
                            <Text style={styles.label}>Subject Assignments</Text>
                            <TouchableOpacity onPress={addAsgn}><Plus size={20} color="#6366f1" /></TouchableOpacity>
                        </View>

                        {formData.subject_assignments.map((asgn, i) => (
                            <View key={i} style={styles.asgnRow}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniChipScroll}>
                                    {subjects.map(s => (
                                        <TouchableOpacity key={s.id} style={[styles.miniChip, asgn.subject_id === s.id && styles.activeMiniChip]} onPress={() => upAsgn(i, 'subject_id', s.id)}>
                                            <Text style={[styles.miniChipText, asgn.subject_id === s.id && styles.activeMiniChipText]}>{s.code}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniChipScroll}>
                                    {classes.map(c => (
                                        <TouchableOpacity key={c.id} style={[styles.miniChip, asgn.class_id === c.id && styles.activeMiniChip]} onPress={() => upAsgn(i, 'class_id', c.id)}>
                                            <Text style={[styles.miniChipText, asgn.class_id === c.id && styles.activeMiniChipText]}>{c.branch}-{c.section}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity onPress={() => remAsgn(i)} style={styles.remBtn}><X size={16} color="#ef4444" /></TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Faculty</Text>}
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
    searchSection: { paddingHorizontal: 20, marginBottom: 16 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
    list: { padding: 20, paddingTop: 0 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    cardInfo: { flex: 1 },
    nameText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    uidText: { fontSize: 12, color: '#6366f1', fontWeight: 'bold', marginTop: 2 },
    ctBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#f0fdf4', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    ctText: { fontSize: 9, color: '#10b981', fontWeight: 'bold' },
    actions: { flexDirection: 'row', gap: 12 },
    actionBtn: { padding: 4 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1' },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    mTitle: { fontSize: 20, fontWeight: 'bold' },
    mBody: { padding: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    switchText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    chipRow: { marginTop: 12 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8 },
    activeChip: { backgroundColor: '#6366f1' },
    chipText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeChipText: { color: '#fff' },
    asgnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    asgnRow: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    miniChipScroll: { marginBottom: 8 },
    miniChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 6 },
    activeMiniChip: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    miniChipText: { fontSize: 9, fontWeight: 'bold', color: '#64748b' },
    activeMiniChipText: { color: '#fff' },
    remBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 2 },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default TeacherManagement;
