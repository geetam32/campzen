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
    Linking
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X, FileText, Download, Link, BookOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const TeacherMaterials = () => {
    const { userData } = useAuth();
    const [materials, setMaterials] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        class_id: '',
        subject: '',
        file_url: '',
        file_type: 'pdf'
    });

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            const qM = query(collection(db, 'materials'), where('college_id', '==', userData.college_id), where('uploaded_by', '==', userData.uid));
            const snapM = await getDocs(qM);
            setMaterials(snapM.docs.map(d => ({ id: d.id, ...d.data() })));

            const qC = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
            const snapC = await getDocs(qC);
            setClasses(snapC.docs.map(d => ({ id: d.id, ...d.data() })));

            const qS = query(collection(db, 'subjects'), where('college_id', '==', userData.college_id));
            const snapS = await getDocs(qS);
            setSubjects(snapS.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const handleSave = async () => {
        if (!formData.title || !formData.class_id || !formData.subject || !formData.file_url) {
            Alert.alert("Error", "Please fill all required fields");
            return;
        }

        setSaving(true);
        try {
            const materialData = {
                college_id: userData.college_id,
                class_id: formData.class_id,
                title: formData.title,
                description: formData.description,
                subject: formData.subject,
                file_url: formData.file_url,
                file_type: formData.file_type,
                uploaded_by: userData.uid,
                created_at: new Date()
            };

            if (editingMaterial) {
                await updateDoc(doc(db, 'materials', editingMaterial.id), materialData);
            } else {
                await addDoc(collection(db, 'materials'), materialData);
                // Also add a notification
                await addDoc(collection(db, 'notifications'), {
                    college_id: userData.college_id,
                    type: 'material',
                    title: `New Material: ${formData.title}`,
                    content: `New study material for ${formData.subject} is available.`,
                    target_type: 'class',
                    target_id: formData.class_id,
                    created_at: new Date(),
                    author_name: userData.name
                });
            }
            setShowModal(false);
            fetchData();
        } catch (error) { console.error(error); }
        finally { setSaving(false); }
    };

    const confirmDelete = (id) => {
        Alert.alert("Delete", "Are you sure?", [
            { text: "Cancel" },
            {
                text: "Delete", style: 'destructive', onPress: async () => {
                    await deleteDoc(doc(db, 'materials', id));
                    fetchData();
                }
            }
        ]);
    };

    const renderMaterialItem = ({ item }) => {
        const cls = classes.find(c => c.id === item.class_id);
        return (
            <View style={styles.materialCard}>
                <View style={[styles.fileIcon, { backgroundColor: item.file_type === 'pdf' ? '#fee2e2' : '#e0f2fe' }]}>
                    <FileText size={24} color={item.file_type === 'pdf' ? '#ef4444' : '#0ea5e9'} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.materialTitle}>{item.title}</Text>
                    <Text style={styles.materialMeta}>{item.subject} • {cls ? `${cls.branch} - ${cls.section}` : '-'}</Text>
                    {item.description ? <Text style={styles.descText} numberOfLines={1}>{item.description}</Text> : null}
                </View>
                <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(item.file_url)}>
                        <Download size={18} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingMaterial(item); setFormData({ ...item }); setShowModal(true); }}>
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
                    <Text style={styles.pageTitle}>Study Materials</Text>
                    <Text style={styles.subTitle}>Upload resources for students</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingMaterial(null); setFormData({ title: '', description: '', class_id: '', subject: '', file_url: '', file_type: 'pdf' }); setShowModal(true); }}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={materials}
                    keyExtractor={item => item.id}
                    renderItem={renderMaterialItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><BookOpen size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No materials uploaded</Text></View>}
                />
            )}

            <Modal visible={showModal} animationType="slide" transparent={false}>
                <View style={styles.modalView}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{editingMaterial ? 'Edit' : 'Upload'} Material</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <Text style={styles.label}>Title</Text>
                        <TextInput style={styles.input} value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} placeholder="e.g. Algorithms Lecture Notes" />

                        <Text style={styles.label}>Description</Text>
                        <TextInput style={[styles.input, { height: 80 }]} value={formData.description} onChangeText={t => setFormData({ ...formData, description: t })} placeholder="Optional details..." multiline={true} />

                        <Text style={styles.label}>Subject</Text>
                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {subjects.map(s => (
                                <TouchableOpacity key={s.id} style={[styles.chip, formData.subject === s.name && styles.activeChip]} onPress={() => setFormData({ ...formData, subject: s.name })}>
                                    <Text style={[styles.chipText, formData.subject === s.name && styles.activeChipText]}>{s.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Target Class</Text>
                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {classes.map(c => (
                                <TouchableOpacity key={c.id} style={[styles.chip, formData.class_id === c.id && styles.activeChip]} onPress={() => setFormData({ ...formData, class_id: c.id })}>
                                    <Text style={[styles.chipText, formData.class_id === c.id && styles.activeChipText]}>{c.branch} - {c.section}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.row}>
                            <View style={{ flex: 1.5 }}>
                                <Text style={styles.label}>File URL</Text>
                                <TextInput style={styles.input} value={formData.file_url} onChangeText={t => setFormData({ ...formData, file_url: t })} placeholder="https://drive.google.com/..." />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.label}>Type</Text>
                                <View style={styles.typeRow}>
                                    {['pdf', 'docx', 'pptx'].map(type => (
                                        <TouchableOpacity key={type} style={[styles.typeBtn, formData.file_type === type && styles.activeType]} onPress={() => setFormData({ ...formData, file_type: type })}>
                                            <Text style={[styles.typeText, formData.file_type === type && styles.activeTypeText]}>{type.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Material</Text>}
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
    list: { padding: 20 },
    materialCard: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    fileIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardInfo: { flex: 1, marginLeft: 12 },
    materialTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    materialMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    descText: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
    cardActions: { flexDirection: 'row', gap: 4 },
    actionBtn: { padding: 8 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94a3b8', marginTop: 12, fontSize: 16 },
    modalView: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalBody: { paddingHorizontal: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    chipScroll: { marginBottom: 4 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
    activeChip: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
    chipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    activeChipText: { color: '#6366f1', fontWeight: 'bold' },
    row: { flexDirection: 'row', marginTop: 16 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
    activeType: { backgroundColor: '#6366f1' },
    typeText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    activeTypeText: { color: '#fff' },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default TeacherMaterials;
