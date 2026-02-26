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
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Star, Send, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const StudentFeedback = ({ navigation }) => {
    const { userData } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [rating, setRating] = useState(0);
    const [remark, setRemark] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!userData?.college_id) return;

        const collegeId = userData.college_id;

        // Fetch teachers and staff
        const fetchTeachers = async () => {
            try {
                const tQ = query(collection(db, 'teachers'), where('college_id', '==', collegeId));
                const staffQ = query(collection(db, 'staff'), where('college_id', '==', collegeId));

                const [tSnap, staffSnap] = await Promise.all([getDocs(tQ), getDocs(staffQ)]);

                const tList = tSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'Teacher' }));
                const staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'Staff' }));

                setTeachers([...tList, ...staffList]);
            } catch (error) {
                console.error("Error fetching teachers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeachers();
    }, [userData]);

    const handleSubmit = async () => {
        if (!selectedTeacher) {
            Alert.alert("Error", "Please select a teacher");
            return;
        }
        if (rating === 0) {
            Alert.alert("Error", "Please provide a star rating");
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'teacher_feedback'), {
                collegeId: userData.college_id,
                teacherId: selectedTeacher.id,
                teacherName: selectedTeacher.name,
                rating: rating,
                remark: remark.trim(),
                createdAt: serverTimestamp()
            });

            Alert.alert("Success", "Feedback Submitted Successfully", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error("Error submitting feedback:", error);
            Alert.alert("Error", "Failed to submit feedback. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const renderStars = () => {
        const labels = ["Bad", "Poor", "Average", "Good", "Excellent"];
        return (
            <View style={styles.ratingContainer}>
                <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                            key={star}
                            onPress={() => setRating(star)}
                            style={styles.starBtn}
                        >
                            <Star
                                size={32}
                                color={star <= rating ? "#f59e0b" : "#cbd5e1"}
                                fill={star <= rating ? "#f59e0b" : "transparent"}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
                {rating > 0 && <Text style={styles.ratingLabel}>{labels[rating - 1]}</Text>}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.title}>Teacher Feedback</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>Your feedback is completely anonymous. We do not store any information that can identify you.</Text>
                </View>

                {/* Teacher Selection */}
                <Text style={styles.sectionTitle}>Select Teacher</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teacherScroll}>
                    {teachers.map((teacher) => (
                        <TouchableOpacity
                            key={teacher.id}
                            style={[
                                styles.teacherChip,
                                selectedTeacher?.id === teacher.id && styles.selectedTeacherChip
                            ]}
                            onPress={() => setSelectedTeacher(teacher)}
                        >
                            <User size={16} color={selectedTeacher?.id === teacher.id ? "#fff" : "#64748b"} />
                            <Text style={[
                                styles.teacherChipText,
                                selectedTeacher?.id === teacher.id && styles.selectedTeacherChipText
                            ]}>
                                {teacher.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {selectedTeacher && (
                    <View style={styles.formContainer}>
                        <Text style={styles.sectionTitle}>Rate Teacher</Text>
                        {renderStars()}

                        <Text style={styles.sectionTitle}>Write Remark (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Share your thoughts about teaching style, clariy, etc..."
                            multiline
                            numberOfLines={4}
                            value={remark}
                            onChangeText={setRemark}
                            textAlignVertical="top"
                        />

                        <TouchableOpacity
                            style={styles.submitBtn}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            <LinearGradient
                                colors={['#6366f1', '#4f46e5']}
                                style={styles.submitGradient}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.submitBtnText}>Submit Feedback</Text>
                                        <Send size={18} color="#fff" style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backBtn: { marginRight: 15, padding: 4 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    scrollContent: { padding: 20 },
    infoBox: {
        backgroundColor: '#eff6ff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        marginBottom: 24,
    },
    infoText: { fontSize: 13, color: '#1e40af', lineHeight: 18, textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12, marginTop: 12 },
    teacherScroll: { flexDirection: 'row', marginBottom: 20 },
    teacherChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    selectedTeacherChip: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    teacherChipText: { fontSize: 14, color: '#475569', fontWeight: '600' },
    selectedTeacherChipText: { color: '#fff' },
    formContainer: { marginTop: 10 },
    ratingContainer: { alignItems: 'center', backgroundColor: '#fff', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24 },
    starsRow: { flexDirection: 'row', gap: 10 },
    starBtn: { padding: 4 },
    ratingLabel: { fontSize: 16, fontWeight: 'bold', color: '#f59e0b', marginTop: 12 },
    input: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        fontSize: 14,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minHeight: 120,
        marginBottom: 30,
    },
    submitBtn: { borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default StudentFeedback;
