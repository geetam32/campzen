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
import { Plus, Trash2, Edit2, X, Search, BookOpen, GraduationCap, ArrowLeft } from 'lucide-react-native';

const ClassManagement = ({ navigation }) => {
    const { userData } = useAuth();
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        branch: '',
        year: '1',
        semester: '1',
        section: 'A',
        subject_sessions: {},
        pinMin: '',
        pinMax: ''
    });

    const yearOptions = [
        { value: '1', label: '1st Year' },
        { value: '2', label: '2nd Year' },
        { value: '3', label: '3rd Year' },
        { value: '4', label: '4th Year' }
    ];

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const clQ = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
            const suQ = query(collection(db, 'subjects'), where('college_id', '==', userData.college_id));

            const [clS, suS] = await Promise.all([getDocs(clQ), getDocs(suQ)]);
            setClasses(clS.docs.map(d => ({ id: d.id, ...d.data() })));
            setSubjects(suS.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleSave = async () => {
        if (!formData.branch || !formData.section || !formData.pinMin || !formData.pinMax) {
            Alert.alert("Error", "Please fill required fields");
            return;
        }
        setSaving(true);
        try {
            const data = {
                college_id: userData.college_id,
                branch: formData.branch,
                year: formData.year,
                semester: formData.semester,
                section: formData.section,
                subject_sessions: formData.subject_sessions,
                pin_validation_rule: { type: 'range', min: parseInt(formData.pinMin), max: parseInt(formData.pinMax) }
            };

            if (editingClass) await updateDoc(doc(db, 'classes', editingClass.id), data);
            else await addDoc(collection(db, 'classes'), { ...data, status: 'active' });

            setShowModal(false);
            fetchData();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const confirmDelete = async (id) => {
        const sq = query(collection(db, 'students'), where('class_id', '==', id));
        const ss = await getDocs(sq);
        if (!ss.empty) { Alert.alert("Error", "Class has assigned students. Disable it instead."); return; }

        Alert.alert("Delete", "Are you sure?", [
            { text: "No" },
            { text: "Delete", style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'classes', id)); fetchData(); } }
        ]);
    };

    const handleSessionChange = (sid, val) => {
        setFormData({ ...formData, subject_sessions: { ...formData.subject_sessions, [sid]: parseInt(val) || 0 } });
    };

    const renderClass = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardInfo}>
                <Text style={styles.branchText}>{item.branch}</Text>
                <View style={styles.badgeRow}>
                    <View style={styles.secBadge}><Text style={styles.secText}>SECTION {item.section}</Text></View>
                    <View style={styles.yearBadge}><Text style={styles.yearText}>{yearOptions.find(y => y.value === item.year)?.label || item.year}</Text></View>
                </View>
                <Text style={styles.metaText}>Sem {item.semester} • {Object.keys(item.subject_sessions || {}).length} Subjects</Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingClass(item); setFormData({ ...item, pinMin: item.pin_validation_rule?.min?.toString() || '', pinMax: item.pin_validation_rule?.max?.toString() || '' }); setShowModal(true); }}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <ArrowLeft size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.pageTitle}>Classes</Text>
                        <Text style={styles.subTitle}>Academic units management</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingClass(null); setFormData({ branch: '', year: '1', semester: '1', section: 'A', subject_sessions: {}, pinMin: '', pinMax: '' }); setShowModal(true); }}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBox}>
                    <Search size={18} color="#94a3b8" />
                    <TextInput style={styles.searchInput} placeholder="Search branch or section..." value={searchTerm} onChangeText={setSearchTerm} />
                </View>
            </View>

            {
                loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                    <FlatList
                        data={classes.filter(c => c.branch.toLowerCase().includes(searchTerm.toLowerCase()) || c.section.toLowerCase().includes(searchTerm.toLowerCase()))}
                        keyExtractor={item => item.id}
                        renderItem={renderClass}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={<View style={styles.empty}><GraduationCap size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No classes configured</Text></View>}
                    />
                )
            }

            <Modal visible={showModal} animationType="slide" transparent={false}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.mHeader}>
                        <Text style={styles.mTitle}>{editingClass ? 'Edit' : 'Add'} Class</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.mBody}>
                        <Text style={styles.label}>Branch Name</Text>
                        <TextInput style={styles.input} value={formData.branch} onChangeText={t => setFormData({ ...formData, branch: t })} placeholder="e.g. Mechanical" />

                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Year</Text>
                                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.miniChipScroll}>
                                    {yearOptions.map(y => (
                                        <TouchableOpacity key={y.value} style={[styles.miniChip, formData.year === y.value && styles.activeMiniChip]} onPress={() => setFormData({ ...formData, year: y.value })}>
                                            <Text style={[styles.miniChipText, formData.year === y.value && styles.activeMiniChipText]}>{y.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                            <View style={{ width: 80 }}>
                                <Text style={styles.label}>Section</Text>
                                <TextInput style={styles.input} value={formData.section} onChangeText={t => setFormData({ ...formData, section: t.toUpperCase() })} placeholder="A" maxLength={1} />
                            </View>
                        </View>

                        <Text style={styles.label}>PIN Range</Text>
                        <View style={styles.row}>
                            <TextInput style={[styles.input, { flex: 1 }]} value={formData.pinMin} onChangeText={t => setFormData({ ...formData, pinMin: t })} placeholder="Min" keyboardType="numeric" />
                            <TextInput style={[styles.input, { flex: 1 }]} value={formData.pinMax} onChangeText={t => setFormData({ ...formData, pinMax: t })} placeholder="Max" keyboardType="numeric" />
                        </View>

                        <View style={styles.divider} />
                        <View style={styles.asgnHeader}>
                            <BookOpen size={16} color="#6366f1" />
                            <Text style={styles.label}>Weekly Session Credits</Text>
                        </View>

                        {subjects.map(s => (
                            <View key={s.id} style={styles.sessionRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subName}>{s.name}</Text>
                                    <Text style={styles.subCode}>{s.code} • {s.type}</Text>
                                </View>
                                <TextInput style={styles.sessionInput} value={formData.subject_sessions[s.id]?.toString() || ''} onChangeText={v => handleSessionChange(s.id, v)} placeholder="0" keyboardType="numeric" />
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Configuration</Text>}
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>
        </View >
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
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    cardInfo: { flex: 1 },
    branchText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    secBadge: { backgroundColor: '#eef2ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    secText: { fontSize: 9, fontWeight: 'bold', color: '#6366f1' },
    yearBadge: { backgroundColor: '#f8fafc', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
    yearText: { fontSize: 9, fontWeight: 'bold', color: '#64748b' },
    metaText: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
    actions: { flexDirection: 'row', gap: 12 },
    actionBtn: { padding: 4 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#cbd5e1', marginTop: 12 },
    mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    mTitle: { fontSize: 20, fontWeight: 'bold' },
    mBody: { padding: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    row: { flexDirection: 'row', gap: 10 },
    miniChipScroll: { marginTop: 4 },
    miniChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 6 },
    activeMiniChip: { backgroundColor: '#6366f1' },
    miniChipText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeMiniChipText: { color: '#fff' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 },
    asgnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    sessionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    subName: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
    subCode: { fontSize: 10, color: '#94a3b8' },
    sessionInput: { backgroundColor: '#fff', width: 50, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', textAlign: 'center', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default ClassManagement;
