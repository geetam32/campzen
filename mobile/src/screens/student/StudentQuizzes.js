import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    Alert,
    Dimensions
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { FileText, CheckCircle, X, Play, ChevronRight, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const StudentQuizzes = () => {
    const { userData } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [attempts, setAttempts] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        if (!userData?.college_id || !userData?.class_id) return;
        setLoading(true);
        try {
            const quizQuery = query(collection(db, 'quizzes'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id),
                where('status', '==', 'active'));
            const snapQ = await getDocs(quizQuery);
            const quizList = snapQ.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setQuizzes(quizList);

            const attMap = {};
            for (const b of quizList) {
                const attQ = query(collection(db, 'quiz_attempts'),
                    where('quiz_id', '==', b.id),
                    where('student_id', '==', userData.pin));
                const snapA = await getDocs(attQ);
                if (!snapA.empty) attMap[b.id] = snapA.docs[0].data();
            }
            setAttempts(attMap);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const startQuiz = async (quiz) => {
        try {
            const qQ = query(collection(db, 'quiz_questions'), where('quiz_id', '==', quiz.id));
            const snap = await getDocs(qQ);
            setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setActiveQuiz(quiz);
            setAnswers({});
            setSubmitted(false);
            setScore(null);
        } catch (error) { console.error(error); }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        let correct = 0;
        questions.forEach(q => { if (answers[q.id] === q.correct_answer) correct++; });
        const scorePerc = Math.round((correct / questions.length) * 100);

        try {
            await addDoc(collection(db, 'quiz_attempts'), {
                quiz_id: activeQuiz.id,
                student_id: userData.pin,
                answers,
                score: scorePerc,
                attempted_at: new Date()
            });
            setScore(scorePerc);
            setSubmitted(true);
            fetchData();
        } catch (error) { console.error(error); }
        finally { setSubmitting(false); }
    };

    if (activeQuiz && !submitted) {
        return (
            <View style={styles.quizEngine}>
                <View style={styles.quizHeader}>
                    <View>
                        <Text style={styles.quizEngineTitle}>{activeQuiz.title}</Text>
                        <Text style={styles.quizEngineMeta}>{activeQuiz.subject} • {questions.length} questions</Text>
                    </View>
                    <TouchableOpacity onPress={() => setActiveQuiz(null)}><X size={24} color="#1e293b" /></TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.quizBody}>
                    {questions.map((q, idx) => (
                        <View key={q.id} style={styles.qCard}>
                            <Text style={styles.qText}>Q{idx + 1}. {q.question}</Text>
                            <View style={styles.optList}>
                                {q.options.map((opt, optIdx) => (
                                    <TouchableOpacity
                                        key={optIdx}
                                        style={[styles.optItem, answers[q.id] === optIdx && styles.optSelected]}
                                        onPress={() => setAnswers({ ...answers, [q.id]: optIdx })}
                                    >
                                        <View style={[styles.radio, answers[q.id] === optIdx && styles.radioActive]} />
                                        <Text style={[styles.optText, answers[q.id] === optIdx && styles.optTextActive]}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.engineFooter}>
                    <TouchableOpacity
                        style={[styles.submitBtn, Object.keys(answers).length < questions.length && styles.submitDisabled]}
                        onPress={handleSubmit}
                        disabled={Object.keys(answers).length < questions.length || submitting}
                    >
                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Quiz</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (submitted) {
        return (
            <View style={styles.resultView}>
                <LinearGradient colors={['#6366f1', '#a855f7']} style={styles.resultCard}>
                    <Award size={60} color="#fff" />
                    <Text style={styles.resultHead}>Quiz Completed!</Text>
                    <View style={styles.scoreCircle}>
                        <Text style={styles.scoreVal}>{score}%</Text>
                    </View>
                    <Text style={styles.resultMsg}>Well done! Your score has been recorded.</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={() => { setSubmitted(false); setActiveQuiz(null); }}>
                        <Text style={styles.backBtnText}>Continue</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Quizzes</Text>
                <Text style={styles.subTitle}>Available tests for your class</Text>
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <ScrollView contentContainerStyle={styles.list}>
                    {quizzes.length === 0 ? (
                        <View style={styles.empty}><FileText size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No active quizzes</Text></View>
                    ) : (
                        quizzes.map(quiz => {
                            const attempted = attempts[quiz.id];
                            return (
                                <View key={quiz.id} style={styles.quizListItem}>
                                    <View style={styles.quizInfo}>
                                        <Text style={styles.quizListTitle}>{quiz.title}</Text>
                                        <Text style={styles.quizListMeta}>{quiz.subject}</Text>
                                    </View>
                                    {attempted ? (
                                        <View style={styles.completedBadge}>
                                            <CheckCircle size={14} color="#10b981" />
                                            <Text style={styles.scoreBadgeText}>{attempted.score}%</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.startBtn} onPress={() => startQuiz(quiz)}>
                                            <Play size={14} color="#fff" />
                                            <Text style={styles.startBtnText}>Start</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    list: { padding: 20 },
    quizListItem: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0' },
    quizInfo: { flex: 1 },
    quizListTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    quizListMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    scoreBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#15803d' },
    startBtn: { backgroundColor: '#6366f1', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    startBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94a3b8', fontSize: 16, marginTop: 12 },

    quizEngine: { flex: 1, backgroundColor: '#f8fafc' },
    quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    quizEngineTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    quizEngineMeta: { fontSize: 12, color: '#64748b' },
    quizBody: { padding: 20 },
    qCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    qText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 20, lineHeight: 22 },
    optList: { gap: 10 },
    optItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    optSelected: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1' },
    radioActive: { borderColor: '#6366f1', backgroundColor: '#6366f1' },
    optText: { fontSize: 14, color: '#475569', flex: 1 },
    optTextActive: { color: '#6366f1', fontWeight: 'bold' },
    engineFooter: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    submitBtn: { backgroundColor: '#6366f1', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    submitDisabled: { backgroundColor: '#cbd5e1' },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    resultView: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 20 },
    resultCard: { borderRadius: 30, padding: 40, alignItems: 'center' },
    resultHead: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20 },
    scoreCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginVertical: 30 },
    scoreVal: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
    resultMsg: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontSize: 14, marginBottom: 30 },
    backBtn: { backgroundColor: '#fff', width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    backBtnText: { color: '#6366f1', fontWeight: 'bold', fontSize: 16 }
});

export default StudentQuizzes;
