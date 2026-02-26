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
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X, Play, Square, FileText, ChevronRight, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const TeacherQuizzes = ({ navigation }) => {
    const { userData } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        class_id: '',
        subject: '',
        status: 'draft'
    });

    useEffect(() => {
        if (!userData?.college_id) return;

        setLoading(true);

        const qQ = query(collection(db, 'quizzes'),
            where('college_id', '==', userData.college_id),
            where('created_by', '==', userData.uid));

        const qC = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
        const qS = query(collection(db, 'subjects'), where('college_id', '==', userData.college_id));

        const unsubQuizzes = onSnapshot(qQ, (snapQ) => {
            setQuizzes(snapQ.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        const unsubClasses = onSnapshot(qC, (snapC) => {
            setClasses(snapC.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubSubjects = onSnapshot(qS, (snapS) => {
            setSubjects(snapS.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubQuizzes();
            unsubClasses();
            unsubSubjects();
        };
    }, [userData]);

    const fetchQuestions = async (quizId) => {
        const qQs = query(collection(db, 'quiz_questions'), where('quiz_id', '==', quizId));
        const snap = await getDocs(qQs);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const openModal = async (quiz = null) => {
        if (quiz) {
            setEditingQuiz(quiz);
            setFormData({ title: quiz.title, class_id: quiz.class_id, subject: quiz.subject, status: quiz.status });
            const qs = await fetchQuestions(quiz.id);
            setQuestions(qs);
        } else {
            setEditingQuiz(null);
            setFormData({ title: '', class_id: '', subject: '', status: 'draft' });
            setQuestions([]);
        }
        setShowModal(true);
    };

    const addQuestion = () => {
        setQuestions([...questions, { question: '', options: ['', '', '', ''], correct_answer: 0 }]);
    };

    const removeQuestion = (idx) => {
        setQuestions(questions.filter((_, i) => i !== idx));
    };

    const updateQuestion = (idx, field, val) => {
        const updated = [...questions];
        updated[idx][field] = val;
        setQuestions(updated);
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.class_id || !formData.subject) {
            Alert.alert("Error", "Please fill all required fields");
            return;
        }
        if (questions.length === 0) {
            Alert.alert("Error", "Please add at least one question");
            return;
        }

        setSaving(true);
        try {
            const quizData = {
                college_id: userData.college_id,
                class_id: formData.class_id,
                title: formData.title,
                subject: formData.subject,
                status: formData.status,
                created_by: userData.uid,
                created_at: Timestamp.now()
            };

            let quizId;
            if (editingQuiz) {
                await updateDoc(doc(db, 'quizzes', editingQuiz.id), quizData);
                quizId = editingQuiz.id;
                // Delete existing questions
                const oldQs = await fetchQuestions(quizId);
                for (const q of oldQs) await deleteDoc(doc(db, 'quiz_questions', q.id));
            } else {
                const docRef = await addDoc(collection(db, 'quizzes'), quizData);
                quizId = docRef.id;
            }

            // Add new questions
            for (const q of questions) {
                await addDoc(collection(db, 'quiz_questions'), {
                    quiz_id: quizId,
                    question: q.question,
                    options: q.options,
                    correct_answer: q.correct_answer
                });
            }

            // Also add a notification if it's a new quiz
            if (!editingQuiz) {
                await addDoc(collection(db, 'notifications'), {
                    college_id: userData.college_id,
                    type: 'quiz',
                    title: `New Quiz: ${formData.title}`,
                    content: `A new quiz for ${formData.subject} has been posted.`,
                    target_type: 'class',
                    target_id: formData.class_id,
                    created_at: Timestamp.now(),
                    author_name: userData.name
                });
            }

            setShowModal(false);
        } catch (error) { console.error(error); }
        finally { setSaving(false); }
    };

    const toggleStatus = async (quiz) => {
        const newStatus = quiz.status === 'draft' ? 'active' : quiz.status === 'active' ? 'ended' : 'draft';
        await updateDoc(doc(db, 'quizzes', quiz.id), { status: newStatus });
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'active': return { bg: '#dcfce7', text: '#15803d' };
            case 'ended': return { bg: '#fee2e2', text: '#b91c1c' };
            default: return { bg: '#f1f5f9', text: '#475569' };
        }
    };

    const renderQuizItem = ({ item }) => {
        const statusStyle = getStatusStyle(item.status);
        const cls = classes.find(c => c.id === item.class_id);

        return (
            <View style={styles.quizCard}>
                <View style={styles.quizMain}>
                    <Text style={styles.quizTitle}>{item.title}</Text>
                    <Text style={styles.quizMeta}>{item.subject} • {cls ? `${cls.branch} ${cls.section}` : '-'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <StatusBarIcon status={item.status} size={12} color={statusStyle.text} />
                        <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>
                <View style={styles.itemActions}>
                    <TouchableOpacity style={styles.actionIcon} onPress={() => toggleStatus(item)}>
                        {item.status === 'active' ? <Square size={18} color="#f59e0b" /> : <Play size={18} color="#10b981" />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionIcon} onPress={() => openModal(item)}>
                        <Edit2 size={18} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionIcon} onPress={() => {
                        Alert.alert("Delete", "Are you sure?", [
                            { text: "No" },
                            {
                                text: "Delete", style: 'destructive', onPress: async () => {
                                    await deleteDoc(doc(db, 'quizzes', item.id));
                                }
                            }
                        ]);
                    }}>
                        <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
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
                        <Text style={styles.pageTitle}>Quizzes</Text>
                        <Text style={styles.subTitle}>Create and manage MCQ tests</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
                    <Plus size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={quizzes}
                    keyExtractor={item => item.id}
                    renderItem={renderQuizItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><FileText size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No quizzes yet</Text></View>}
                />
            )}

            <Modal visible={showModal} animationType="slide" transparent={false}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{editingQuiz ? 'Edit Quiz' : 'Create Quiz'}</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color="#1e293b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Quiz Title</Text>
                            <TextInput style={styles.input} value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} placeholder="e.g. Unit Test 1" />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Subject</Text>
                                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                                    {subjects.map(s => (
                                        <TouchableOpacity
                                            key={s.id}
                                            style={[styles.chip, formData.subject === s.name && styles.activeChip]}
                                            onPress={() => setFormData({ ...formData, subject: s.name })}
                                        >
                                            <Text style={[styles.chipText, formData.subject === s.name && styles.activeChipText]}>{s.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Target Class</Text>
                            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                                {classes.map(c => (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[styles.chip, formData.class_id === c.id && styles.activeChip]}
                                        onPress={() => setFormData({ ...formData, class_id: c.id })}
                                    >
                                        <Text style={[styles.chipText, formData.class_id === c.id && styles.activeChipText]}>{c.branch} - {c.section}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.qHeader}>
                            <Text style={styles.qTitle}>Questions ({questions.length})</Text>
                            <TouchableOpacity style={styles.qAddBtn} onPress={addQuestion}>
                                <Plus size={16} color="#6366f1" />
                                <Text style={styles.qAddText}>Add Question</Text>
                            </TouchableOpacity>
                        </View>

                        {questions.map((q, qIdx) => (
                            <View key={qIdx} style={styles.qCard}>
                                <View style={styles.qCardHeader}>
                                    <Text style={styles.qNum}>Q {qIdx + 1}</Text>
                                    <TouchableOpacity onPress={() => removeQuestion(qIdx)}><Trash2 size={16} color="#ef4444" /></TouchableOpacity>
                                </View>
                                <TextInput
                                    style={[styles.input, { marginBottom: 12 }]}
                                    value={q.question}
                                    onChangeText={t => updateQuestion(qIdx, 'question', t)}
                                    placeholder="Enter question"
                                    multiline={true}
                                />
                                {q.options.map((opt, optIdx) => (
                                    <View key={optIdx} style={styles.optRow}>
                                        <TouchableOpacity
                                            style={[styles.radio, q.correct_answer === optIdx && styles.radioActive]}
                                            onPress={() => updateQuestion(qIdx, 'correct_answer', optIdx)}
                                        />
                                        <TextInput
                                            style={styles.optInput}
                                            value={opt}
                                            onChangeText={t => {
                                                const newOpts = [...q.options];
                                                newOpts[optIdx] = t;
                                                updateQuestion(qIdx, 'options', newOpts);
                                            }}
                                            placeholder={`Option ${optIdx + 1}`}
                                        />
                                    </View>
                                ))}
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Quiz</Text>}
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const StatusBarIcon = ({ status, size, color }) => {
    if (status === 'active') return <Play size={size} color={color} />;
    if (status === 'ended') return <Square size={size} color={color} />;
    return <FileText size={size} color={color} />;
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    addBtn: { backgroundColor: '#6366f1', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 20 },
    quizCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    quizMain: { flex: 1 },
    quizTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    quizMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4, marginTop: 8 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    itemActions: { flexDirection: 'row', gap: 12 },
    actionIcon: { padding: 4 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94a3b8', marginTop: 12, fontSize: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalBody: { padding: 20 },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b' },
    chipsRow: { flexDirection: 'row', marginBottom: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
    activeChip: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
    chipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    activeChipText: { color: '#6366f1', fontWeight: 'bold' },
    qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 16 },
    qTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    qAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    qAddText: { fontSize: 14, color: '#6366f1', fontWeight: '600' },
    qCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    qCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    qNum: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
    optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1' },
    radioActive: { borderColor: '#6366f1', backgroundColor: '#6366f1' },
    optInput: { flex: 1, fontSize: 14, color: '#475569', paddingVertical: 4 },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default TeacherQuizzes;
