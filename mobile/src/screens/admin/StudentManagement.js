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
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Edit2, X, Search, User, ChevronRight, GraduationCap } from 'lucide-react-native';

const StudentManagement = () => {
    const { userData } = useAuth();
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('all');
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        pin: '',
        name: '',
        email: '',
        password: '',
        class_id: ''
    });

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const classesQuery = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
            const classesSnapshot = await getDocs(classesQuery);
            const classesList = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(classesList);

            const studentsQuery = query(collection(db, 'students'), where('college_id', '==', userData.college_id));
            const studentsSnapshot = await getDocs(studentsQuery);
            setStudents(studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleSave = async () => {
        if (!formData.pin || !formData.name || !formData.email || !formData.class_id) {
            Alert.alert("Error", "Please fill all required fields");
            return;
        }
        setSaving(true);
        try {
            const sData = {
                college_id: userData.college_id,
                pin: formData.pin,
                name: formData.name,
                email: formData.email,
                class_id: formData.class_id,
                role: 'student',
                status: 'active',
                must_change_password: true
            };

            if (editingStudent) {
                await updateDoc(doc(db, 'students', editingStudent.id), sData);
            } else {
                if (!formData.password) { Alert.alert("Error", "Password is required"); return; }
                const q = query(collection(db, 'students'), where('college_id', '==', userData.college_id), where('pin', '==', formData.pin));
                const snap = await getDocs(q);
                if (!snap.empty) { Alert.alert("Error", "PIN already exists"); return; }

                await addDoc(collection(db, 'students'), { ...sData, password: formData.password, created_at: new Date() });
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
                    await deleteDoc(doc(db, 'students', id));
                    fetchData();
                }
            }
        ]);
    };

    const filtered = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.pin.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = selectedClass === 'all' || s.class_id === selectedClass;
        return matchesSearch && matchesClass;
    });

    const renderStudent = ({ item }) => {
        const cls = classes.find(c => c.id === item.class_id);
        return (
            <View style={styles.studentCard}>
                <View style={styles.cardInfo}>
                    <Text style={styles.nameText}>{item.name}</Text>
                    <Text style={styles.pinText}>PIN: {item.pin}</Text>
                    <Text style={styles.classText}>{cls ? `${cls.branch} - Sec ${cls.section}` : '-'}</Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingStudent(item); setFormData({ ...item, password: '' }); setShowModal(true); }}>
                        <Edit2 size={18} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(item.id)}>
                        <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.pageTitle}>Students</Text>
                    <Text style={styles.subTitle}>Admission and records</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingStudent(null); setFormData({ pin: '', name: '', email: '', password: '', class_id: '' }); setShowModal(true); }}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
                <View style={styles.searchBox}>
                    <Search size={18} color="#94a3b8" />
                    <TextInput style={styles.searchInput} placeholder="Search name/PIN..." value={searchTerm} onChangeText={setSearchTerm} />
                </View>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.classScroll}>
                    <TouchableOpacity style={[styles.classChip, selectedClass === 'all' && styles.activeChip]} onPress={() => setSelectedClass('all')}>
                        <Text style={[styles.chipText, selectedClass === 'all' && styles.activeChipText]}>ALL</Text>
                    </TouchableOpacity>
                    {classes.map(c => (
                        <TouchableOpacity key={c.id} style={[styles.classChip, selectedClass === c.id && styles.activeChip]} onPress={() => setSelectedClass(c.id)}>
                            <Text style={[styles.chipText, selectedClass === c.id && styles.activeChipText]}>{c.branch} - {c.section}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    renderItem={renderStudent}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><User size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No students found</Text></View>}
                />
            )}

            <Modal visible={showModal} animationType="slide" transparent={false}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.mHeader}>
                        <Text style={styles.mTitle}>{editingStudent ? 'Edit' : 'Add'} Student</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.mBody}>
                        <Text style={styles.label}>PIN (Universal ID)</Text>
                        <TextInput style={styles.input} value={formData.pin} onChangeText={t => setFormData({ ...formData, pin: t })} placeholder="e.g. 21001" keyboardType="numeric" />

                        <Text style={styles.label}>Full Name</Text>
                        <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} placeholder="e.g. John Doe" />

                        <Text style={styles.label}>Class</Text>
                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {classes.map(c => (
                                <TouchableOpacity key={c.id} style={[styles.chip, formData.class_id === c.id && styles.activeChip]} onPress={() => setFormData({ ...formData, class_id: c.id })}>
                                    <Text style={[styles.chipText, formData.class_id === c.id && styles.activeChipText]}>{c.branch} - {c.section}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Email Address</Text>
                        <TextInput style={styles.input} value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} placeholder="e.g. john@example.com" keyboardType="email-address" autoCapitalize="none" />

                        {!editingStudent && (
                            <>
                                <Text style={styles.label}>Default Password</Text>
                                <TextInput style={styles.input} value={formData.password} onChangeText={t => setFormData({ ...formData, password: t })} placeholder="Initial password..." secureTextEntry />
                            </>
                        )}
                    </ScrollView>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Student</Text>}
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
    filterSection: { paddingHorizontal: 20, marginBottom: 12 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
    classScroll: { marginBottom: 10 },
    classChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 8 },
    activeChip: { backgroundColor: '#6366f1' },
    chipText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeChipText: { color: '#fff' },
    list: { padding: 20, paddingTop: 0 },
    studentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    cardInfo: { flex: 1 },
    nameText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    pinText: { fontSize: 12, color: '#6366f1', fontWeight: '700', marginTop: 2 },
    classText: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
    actions: { flexDirection: 'row', gap: 12 },
    actionBtn: { padding: 4 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1', marginTop: 12 },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    mTitle: { fontSize: 20, fontWeight: 'bold' },
    mBody: { padding: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    chipRow: { marginTop: 4 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8 },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default StudentManagement;
