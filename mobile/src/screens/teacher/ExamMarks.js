import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { ArrowLeft, Check, Save } from 'lucide-react-native';

const ExamMarks = ({ route, navigation }) => {
    const { exam } = route.params;
    const [students, setStudents] = useState([]);
    const [marks, setMarks] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchStudentsAndMarks = async () => {
            try {
                // 1. Fetch Students
                const studentsQuery = query(
                    collection(db, 'students'),
                    where('college_id', '==', exam.college_id),
                    where('class_id', '==', exam.class_id)
                );
                const studentsSnap = await getDocs(studentsQuery);
                const studentsList = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setStudents(studentsList);

                // 2. Fetch Existing Marks for this Exam
                const marksQuery = query(
                    collection(db, 'exam_marks'),
                    where('exam_id', '==', exam.id)
                );
                const marksSnap = await getDocs(marksQuery);
                const marksData = {};
                marksSnap.docs.forEach(doc => {
                    const data = doc.data();
                    marksData[data.student_pin] = data.marks;
                });
                setMarks(marksData);
            } catch (error) {
                console.error("Error fetching exam data:", error);
                Alert.alert("Error", "Failed to load student list.");
            } finally {
                setLoading(false);
            }
        };

        fetchStudentsAndMarks();
    }, [exam]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const batchPromises = students.map(student => {
                const markId = `${exam.id}_${student.pin}`;
                const markValue = marks[student.pin] || "";

                return setDoc(doc(db, 'exam_marks', markId), {
                    exam_id: exam.id,
                    student_pin: student.pin,
                    marks: markValue,
                    college_id: exam.college_id,
                    updated_at: new Date()
                });
            });

            await Promise.all(batchPromises);
            Alert.alert("Success", "Marks saved successfully!");
            navigation.goBack();
        } catch (error) {
            console.error("Error saving marks:", error);
            Alert.alert("Error", "Failed to save marks.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>Update Marks</Text>
                    <Text style={styles.subtitle}>{exam.name} • {exam.subject}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={20} color="#fff" />}
                </TouchableOpacity>
            </View>

            <View style={styles.instruction}>
                <Text style={styles.instructionText}>Enter marks obtained out of {exam.max_marks}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
                {students.map((student) => (
                    <View key={student.id} style={styles.studentRow}>
                        <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{student.name}</Text>
                            <Text style={styles.studentPin}>{student.pin}</Text>
                        </View>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            placeholder="0"
                            value={String(marks[student.pin] || "")}
                            onChangeText={(val) => setMarks({ ...marks, [student.pin]: val })}
                        />
                    </View>
                ))}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#f1f5f9'
    },
    backBtn: { marginRight: 15 },
    title: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    subtitle: { fontSize: 13, color: '#64748b' },
    saveBtn: {
        marginLeft: 'auto',
        backgroundColor: '#6366f1',
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8
    },
    instruction: { padding: 15, backgroundColor: '#f8fafc', alignItems: 'center' },
    instructionText: { fontSize: 12, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' },
    list: { padding: 20 },
    studentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9'
    },
    studentInfo: { flex: 1 },
    studentName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    studentPin: { fontSize: 12, color: '#6366f1', fontWeight: '800', marginTop: 2 },
    input: {
        width: 80,
        height: 45,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b'
    }
});

export default ExamMarks;
