import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    setDoc
} from 'firebase/firestore';
import {
    Users,
    TrendingUp,
    AlertTriangle,
    Plus,
    Edit2,
    Trash2,
    ArrowLeft,
    BarChart2,
    Layout,
    BookOpen,
    Info,
    CheckCircle,
    X,
    MoreHorizontal,
    Search
} from 'lucide-react';

const StudentTracker = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'exams', 'analytics'
    const [loading, setLoading] = useState(true);

    // Data states
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [exams, setExams] = useState([]);
    const [allMarks, setAllMarks] = useState([]);

    // UI states
    const [showExamModal, setShowExamModal] = useState(false);
    const [editingExam, setEditingExam] = useState(null);
    const [examFormData, setExamFormData] = useState({ name: '', subject: '', max_marks: '' });

    const [enteringMarksFor, setEnteringMarksFor] = useState(null); // exam object
    const [tempMarks, setTempMarks] = useState({}); // { studentPin: marks }

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showMarksModal, setShowMarksModal] = useState(false);

    const fetchData = useCallback(async () => {
        if (!userData?.college_id || !userData?.class_id_assigned) return;
        setLoading(true);
        try {
            const config = { college_id: userData.college_id, class_id: userData.class_id_assigned };

            // 1. Fetch Students
            const studentsQuery = query(
                collection(db, 'students'),
                where('college_id', '==', config.college_id),
                where('class_id', '==', config.class_id)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            const studentsList = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(studentsList);

            // 2. Fetch Subjects
            const subjectsQuery = query(
                collection(db, 'subjects'),
                where('college_id', '==', config.college_id)
            );
            const subjectsSnapshot = await getDocs(subjectsQuery);
            setSubjects(subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // 3. Fetch Attendance
            const attQuery = query(
                collection(db, 'attendance_records'),
                where('college_id', '==', config.college_id),
                where('class_id', '==', config.class_id)
            );
            const attSnapshot = await getDocs(attQuery);
            setAttendanceRecords(attSnapshot.docs.map(doc => doc.data()));

            // 4. Fetch Exams
            const examsQuery = query(
                collection(db, 'exams'),
                where('college_id', '==', config.college_id),
                where('class_id', '==', config.class_id)
            );
            const examsSnapshot = await getDocs(examsQuery);
            const examsList = examsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setExams(examsList);

            // 5. Fetch Marks
            const marksQuery = query(
                collection(db, 'exam_marks'),
                where('college_id', '==', config.college_id)
            );
            const marksSnapshot = await getDocs(marksQuery);
            setAllMarks(marksSnapshot.docs.map(doc => doc.data()));

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Memoized Analytics Calculations
    const analytics = useMemo(() => {
        const studentStats = {};
        const subjectStats = {};
        const examStats = {};

        // A. Attendance Calculations
        const totalAttendanceDays = attendanceRecords.length;
        students.forEach(student => {
            const presentCount = attendanceRecords.filter(rec => rec.present?.includes(student.pin)).length;
            const percentage = totalAttendanceDays > 0 ? (presentCount / totalAttendanceDays) * 100 : 100;
            studentStats[student.pin] = {
                attendance: Math.round(percentage),
                present: presentCount,
                absent: totalAttendanceDays - presentCount,
                totalAttendanceDays,
                scores: [], // To be filled in B
                overallPerf: 0
            };
        });

        // B. Exam & Marks Calculations
        exams.forEach(exam => {
            const examMarks = allMarks.filter(m => m.exam_id === exam.id);
            const totalMax = Number(exam.max_marks);

            let totalClassMarks = 0;
            let studentsWithMarks = 0;

            examMarks.forEach(m => {
                const scorePerc = (Number(m.marks) / totalMax) * 100;
                if (studentStats[m.student_pin]) {
                    studentStats[m.student_pin].scores.push({
                        examId: exam.id,
                        examName: exam.name,
                        subject: exam.subject,
                        score: Number(m.marks),
                        max: totalMax,
                        percentage: scorePerc
                    });
                }
                totalClassMarks += scorePerc;
                studentsWithMarks++;
            });

            examStats[exam.id] = {
                average: studentsWithMarks > 0 ? Math.round(totalClassMarks / studentsWithMarks) : 0,
                enteredCount: studentsWithMarks
            };
        });

        // Calculate Average Performance per student
        students.forEach(student => {
            const studentScores = studentStats[student.pin]?.scores || [];
            if (studentScores.length > 0) {
                const totalPerc = studentScores.reduce((acc, curr) => acc + curr.percentage, 0);
                studentStats[student.pin].overallPerf = Math.round(totalPerc / studentScores.length);
            } else {
                studentStats[student.pin].overallPerf = 0;
            }
        });

        // C. Subject-wise aggregation
        subjects.forEach(sub => {
            const subjectExams = exams.filter(e => e.subject === sub.name);
            let totalSubPerc = 0;
            let totalExamCount = 0;

            subjectExams.forEach(e => {
                const avg = examStats[e.id]?.average || 0;
                totalSubPerc += avg;
                totalExamCount++;
            });

            subjectStats[sub.name] = {
                average: totalExamCount > 0 ? Math.round(totalSubPerc / totalExamCount) : 0,
                exams: subjectExams.map(e => ({
                    name: e.name,
                    average: examStats[e.id]?.average || 0
                }))
            };
        });

        const subjectList = Object.keys(subjectStats).map(name => ({
            name,
            ...subjectStats[name]
        })).sort((a, b) => b.average - a.average);

        return {
            studentStats,
            subjectStats: subjectList,
            examStats,
            topSubjects: subjectList.slice(0, 2).filter(s => s.average >= 75),
            needsAttention: subjectList.filter(s => s.average < 50)
        };
    }, [students, exams, allMarks, attendanceRecords, subjects]);

    // Exam Handlers
    const handleSaveExam = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...examFormData,
                max_marks: Number(examFormData.max_marks),
                college_id: userData.college_id,
                class_id: userData.class_id_assigned,
                created_by: userData.uid,
                created_at: new Date()
            };

            if (editingExam) {
                await updateDoc(doc(db, 'exams', editingExam.id), data);
            } else {
                await addDoc(collection(db, 'exams'), data);
            }

            setShowExamModal(false);
            setEditingExam(null);
            setExamFormData({ name: '', subject: '', max_marks: '' });
            fetchData();
        } catch (error) {
            console.error("Error saving exam:", error);
        }
    };

    const handleDeleteExam = async (examId) => {
        if (!window.confirm("Are you sure? This will also delete all marks for this exam.")) return;
        try {
            await deleteDoc(doc(db, 'exams', examId));
            const marksQuery = query(collection(db, 'exam_marks'), where('exam_id', '==', examId));
            const marksSnap = await getDocs(marksQuery);
            const deletePromises = marksSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);
            fetchData();
        } catch (error) {
            console.error("Error deleting exam:", error);
        }
    };

    const handleEnterMarks = (exam) => {
        setEnteringMarksFor(exam);
        const existingMarks = {};
        allMarks.filter(m => m.exam_id === exam.id).forEach(m => {
            existingMarks[m.student_pin] = m.marks;
        });
        setTempMarks(existingMarks);
        setShowMarksModal(true);
    };

    const handleSaveMarks = async () => {
        try {
            for (const pin of Object.keys(tempMarks)) {
                const markVal = Number(tempMarks[pin]);
                const existingMarkDoc = allMarks.find(m => m.exam_id === enteringMarksFor.id && m.student_pin === pin);

                const markData = {
                    exam_id: enteringMarksFor.id,
                    student_pin: pin,
                    marks: markVal,
                    college_id: userData.college_id
                };

                if (existingMarkDoc) {
                    // We need the doc ID. Finding it again from Firestore to be safe or map it.
                    const q = query(
                        collection(db, 'exam_marks'),
                        where('exam_id', '==', enteringMarksFor.id),
                        where('student_pin', '==', pin)
                    );
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        await updateDoc(snap.docs[0].ref, { marks: markVal });
                    }
                } else {
                    await addDoc(collection(db, 'exam_marks'), markData);
                }
            }
            setEnteringMarksFor(null);
            setShowMarksModal(false);
            fetchData();
        } catch (error) {
            console.error("Error saving marks:", error);
        }
    };

    const getProgressColor = (perc) => {
        if (perc >= 75) return '#10b981'; // Green
        if (perc >= 50) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    };

    if (!userData?.is_class_teacher) {
        return (
            <div className="restricted-container">
                <style>{`
                    .restricted-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: var(--text-muted); }
                    .restricted-card { background: var(--bg-secondary); padding: 3rem; border-radius: 1rem; text-align: center; border: 1px solid var(--border-color); box-shadow: var(--shadow-xl); }
                    .restricted-icon { color: #ef4444; margin-bottom: 1.5rem; }
                `}</style>
                <div className="restricted-card">
                    <AlertTriangle size={64} className="restricted-icon" />
                    <h2>Access Restricted</h2>
                    <p>Only Class Teachers can access the Student Tracker dashboard.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <style>{`
                .dashboard-container { padding: 2rem; color: var(--text-main); font-family: 'Inter', sans-serif; }
                .tab-nav { display: flex; gap: 2.5rem; margin-bottom: 2.5rem; border-bottom: 1px solid var(--border-color); }
                .tab-btn { padding: 0.75rem 0; cursor: pointer; transition: all 0.2s; border: none; background: transparent; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.6rem; position: relative; font-size: 0.95rem; }
                .tab-btn.active { color: var(--accent-primary); }
                .tab-btn.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 3px; background: var(--accent-primary); border-radius: 3px 3px 0 0; }
                .tab-btn:hover:not(.active) { color: var(--text-main); }

                .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
                .stat-card { background: var(--bg-secondary); padding: 1.5rem 2rem; border-radius: 1.25rem; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 1.5rem; box-shadow: var(--shadow-md); transition: transform 0.2s; }
                .stat-card:hover { transform: translateY(-4px); }
                .stat-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
                .stat-val { font-size: 2rem; font-weight: 800; margin: 0; color: var(--text-main); }
                .stat-lab { font-size: 0.9rem; color: var(--text-muted); margin: 0.2rem 0 0 0; font-weight: 500; }

                .table-card { background: var(--bg-secondary); border-radius: 1rem; border: 1px solid var(--border-color); overflow: hidden; box-shadow: var(--shadow-md); }
                .table-responsive { overflow-x: auto; }
                table { width: 100%; border-collapse: collapse; }
                th { background: rgba(0,0,0,0.02); padding: 1rem; text-align: left; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; }
                td { padding: 1.25rem 1rem; border-top: 1px solid var(--border-color); vertical-align: middle; }
                
                .badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
                .badge-success { background: #d1fae5; color: #065f46; }
                .badge-warning { background: #fef3c7; color: #92400e; }
                .badge-danger { background: #fee2e2; color: #991b1b; }
                
                .performance-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; width: 100px; display: inline-block; vertical-align: middle; margin-right: 8px; }
                .performance-fill { height: 100%; transition: width 0.3s ease; }

                .exam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
                .exam-card { background: var(--bg-secondary); border-radius: 1rem; border: 1px solid var(--border-color); padding: 1.5rem; position: relative; display: flex; flex-direction: column; gap: 1rem; }
                .exam-subject-tag { align-self: flex-start; background: var(--bg-primary); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; color: var(--accent-primary); border: 1px solid var(--accent-primary); }
                .exam-name { font-size: 1.1rem; font-weight: 600; margin: 0; }
                .exam-meta { color: var(--text-muted); font-size: 0.8rem; }
                .exam-actions { position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.5rem; }
                .icon-btn { cursor: pointer; color: var(--text-muted); transition: color 0.2s; border: none; background: transparent; padding: 4px; }
                .icon-btn:hover { color: var(--accent-primary); }
                .icon-btn.delete:hover { color: #ef4444; }

                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; backdrop-filter: blur(4px); }
                .modal-content { background: var(--bg-secondary); border-radius: 1.5rem; width: 100%; max-width: 500px; padding: 2rem; border: 1px solid var(--border-color); animation: modalIn 0.3s ease-out; }
                @keyframes modalIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                
                .form-group { margin-bottom: 1.5rem; }
                .form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; }
                .form-control { width: 100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-main); }
                
                .btn { padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600; border: none; transition: all 0.2s; }
                .btn-primary { background: var(--accent-primary); color: white; }
                .btn-primary:hover { opacity: 0.9; }
                .btn-secondary { background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-main); }

                .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                @media (max-width: 900px) { .analytics-grid { grid-template-columns: 1fr; } }
                
                .chart-card { background: var(--bg-secondary); border-radius: 1rem; padding: 1.5rem; border: 1px solid var(--border-color); }
                .chart-bar-container { margin-bottom: 1rem; }
                .chart-label { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem; }
                .chart-track { height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; }
                .chart-fill { height: 100%; border-radius: 6px; }

                .insights-box { padding: 1rem; border-radius: 0.75rem; display: flex; align-items: flex-start; gap: 1rem; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); }
                .insights-box.warning { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); }

                .student-modal { max-width: 800px; display: grid; grid-template-columns: 300px 1fr; gap: 2rem; }
                .marks-modal { max-width: 850px; }
                .marks-table-container { max-height: 450px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 0.75rem; }
                @media (max-width: 700px) { .student-modal { grid-template-columns: 1fr; } }
                .gauge-container { display: flex; flex-direction: column; align-items: center; }
                .gauge-svg { transform: rotate(-90deg); }
                .gauge-text { position: absolute; font-size: 1.5rem; font-weight: 700; transform: translate(0, 0); }

                .subject-chip { display: inline-flex; align-items: center; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border-color); margin: 2px; }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800' }}>Class Analytics & Tracker</h1>
                    <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Manage exams, marks and monitor student performance.</p>
                </div>
                {activeTab === 'exams' && (
                    <button className="btn btn-primary" onClick={() => setShowExamModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> Create Exam
                    </button>
                )}
            </div>

            <div className="tab-nav">
                <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                    <Layout size={18} /> Overview
                </button>
                <button className={`tab-btn ${activeTab === 'exams' || activeTab === 'marks-entry' ? 'active' : ''}`} onClick={() => setActiveTab('exams')}>
                    <BookOpen size={18} /> Exams & Marks
                </button>
                <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
                    <TrendingUp size={18} /> Analytics
                </button>
            </div>

            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>Loading dashboard data...</div>
            ) : (
                <>
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div>
                            <div className="stats-row">
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}><Users size={28} /></div>
                                    <div>
                                        <h3 className="stat-val">{students.length}</h3>
                                        <p className="stat-lab">Total Students</p>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><AlertTriangle size={28} /></div>
                                    <div>
                                        <h3 className="stat-val">{Object.values(analytics.studentStats).filter(s => s.attendance < 75).length}</h3>
                                        <p className="stat-lab">Low Attendance</p>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><TrendingUp size={28} /></div>
                                    <div>
                                        <h3 className="stat-val">{exams.length}</h3>
                                        <p className="stat-lab">Exams Created</p>
                                    </div>
                                </div>
                            </div>

                            <div className="table-card">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>PIN</th>
                                                <th>Name</th>
                                                <th>Attendance</th>
                                                <th>Performance</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map(student => {
                                                const stats = analytics.studentStats[student.pin] || { attendance: 0, overallPerf: 0 };
                                                return (
                                                    <tr key={student.id}>
                                                        <td><code style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{student.pin}</code></td>
                                                        <td><strong>{student.name}</strong></td>
                                                        <td>
                                                            <span className={`badge ${stats.attendance >= 75 ? 'badge-success' : 'badge-danger'}`}>
                                                                {stats.attendance}%
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="performance-bar">
                                                                <div className="performance-fill" style={{ width: `${stats.overallPerf}%`, background: getProgressColor(stats.overallPerf) }}></div>
                                                            </div>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{stats.overallPerf}%</span>
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setSelectedStudent(student)}>
                                                                View Details
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EXAMS TAB */}
                    {activeTab === 'exams' && (
                        <div className="exam-grid">
                            {exams.length === 0 ? (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', background: 'var(--bg-secondary)', borderRadius: '1rem' }}>
                                    <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                                    <h3>No exams created yet</h3>
                                    <p>Start by creating an exam to track student marks.</p>
                                </div>
                            ) : (
                                exams.map(exam => {
                                    const stats = analytics.examStats[exam.id] || { average: 0, enteredCount: 0 };
                                    const progressArr = (stats.enteredCount / students.length) * 100;
                                    return (
                                        <div className="exam-card" key={exam.id}>
                                            <div className="exam-actions">
                                                <button className="icon-btn" onClick={() => { setEditingExam(exam); setExamFormData({ name: exam.name, subject: exam.subject, max_marks: exam.max_marks }); setShowExamModal(true); }}><Edit2 size={16} /></button>
                                                <button className="icon-btn delete" onClick={() => handleDeleteExam(exam.id)}><Trash2 size={16} /></button>
                                            </div>
                                            <span className="exam-subject-tag">{exam.subject}</span>
                                            <h3 className="exam-name">{exam.name}</h3>
                                            <div className="exam-meta">
                                                <div>Max Marks: <strong>{exam.max_marks}</strong></div>
                                                <div style={{ marginTop: '0.4rem' }}>Class Average: <strong style={{ color: getProgressColor(stats.average) }}>{stats.average}%</strong></div>
                                            </div>
                                            <div style={{ marginTop: 'auto' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                                                    <span>Marks Entry Progress</span>
                                                    <span>{stats.enteredCount} / {students.length}</span>
                                                </div>
                                                <div className="chart-track" style={{ height: '6px' }}>
                                                    <div className="chart-fill" style={{ width: `${progressArr}%`, background: 'var(--accent-primary)' }}></div>
                                                </div>
                                                <button className="btn btn-primary" onClick={() => handleEnterMarks(exam)} style={{ width: '100%', marginTop: '1rem', fontSize: '0.85rem' }}>
                                                    {stats.enteredCount === 0 ? 'Enter Marks' : 'Update Marks'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}


                    {/* ANALYTICS TAB */}
                    {activeTab === 'analytics' && (
                        <div className="analytics-content">
                            <style>{`
                                .analytics-options-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
                                .option-card { background: var(--bg-secondary); padding: 2rem; border-radius: 1rem; border: 2px dashed var(--border-color); text-align: center; color: var(--text-muted); transition: all 0.3s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; }
                                .option-card:hover { border-color: var(--accent-primary); color: var(--accent-primary); background: rgba(var(--accent-primary-rgb), 0.05); }
                                .option-icon { width: 60px; height: 60px; border-radius: 50%; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
                            `}</style>

                            <div className="analytics-options-row">
                                <div className="option-card">
                                    <div className="option-icon"><BarChart2 size={32} /></div>
                                    <h3 style={{ margin: 0 }}>Performance Option 1</h3>
                                    <p style={{ fontSize: '0.85rem', margin: 0 }}>Feature description placeholder</p>
                                </div>
                                <div className="option-card">
                                    <div className="option-icon"><TrendingUp size={32} /></div>
                                    <h3 style={{ margin: 0 }}>Attendance Option 2</h3>
                                    <p style={{ fontSize: '0.85rem', margin: 0 }}>Feature description placeholder</p>
                                </div>
                                <div className="option-card">
                                    <div className="option-icon"><Plus size={32} /></div>
                                    <h3 style={{ margin: 0 }}>Custom Report 3</h3>
                                    <p style={{ fontSize: '0.85rem', margin: 0 }}>Feature description placeholder</p>
                                </div>
                            </div>

                            <div className="analytics-grid">
                                <div className="chart-card">
                                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart2 size={20} /> Subject-wise Performance</h3>
                                    {analytics.subjectStats.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No data available.</p> : (
                                        analytics.subjectStats.map(sub => (
                                            <div className="chart-bar-container" key={sub.name}>
                                                <div className="chart-label">
                                                    <span>{sub.name}</span>
                                                    <span style={{ fontWeight: 600 }}>{sub.average}%</span>
                                                </div>
                                                <div className="chart-track">
                                                    <div className="chart-fill" style={{ width: `${sub.average}%`, background: getProgressColor(sub.average) }}></div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    <div className="chart-card">
                                        <h3 style={{ marginBottom: '1rem' }}>Quick Insights</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div className="insights-box">
                                                <CheckCircle size={20} color="#10b981" />
                                                <div>
                                                    <strong style={{ display: 'block', fontSize: '0.85rem' }}>Top Performing</strong>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                                                        {analytics.topSubjects.length > 0 ? analytics.topSubjects.map(s => <span className="badge badge-success" key={s.name}>{s.name}</span>) : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="insights-box warning">
                                                <AlertTriangle size={20} color="#ef4444" />
                                                <div>
                                                    <strong style={{ display: 'block', fontSize: '0.85rem' }}>Needs Attention</strong>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                                                        {analytics.needsAttention.length > 0 ? analytics.needsAttention.map(s => <span className="badge badge-danger" key={s.name}>{s.name}</span>) : 'All subjects performing well'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="chart-card">
                                        <h3 style={{ marginBottom: '1rem' }}>Exam Breakdown</h3>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                            {analytics.subjectStats.map(sub => (
                                                <div key={sub.name} style={{ marginBottom: '1.25rem' }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem' }}>{sub.name}</div>
                                                    {sub.exams.map((e, idx) => (
                                                        <div key={idx} style={{ marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                <span>{e.name}</span>
                                                                <span>{e.average}%</span>
                                                            </div>
                                                            <div className="chart-track" style={{ height: '4px', marginTop: '3px' }}>
                                                                <div className="chart-fill" style={{ width: `${e.average}%`, background: getProgressColor(e.average) }}></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* CREATE/EDIT EXAM MODAL */}
            {showExamModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>{editingExam ? 'Edit Exam' : 'New Exam'}</h2>
                            <button className="icon-btn" onClick={() => setShowExamModal(false)}><X /></button>
                        </div>
                        <form onSubmit={handleSaveExam}>
                            <div className="form-group">
                                <label>Exam Name</label>
                                <input required className="form-control" placeholder="e.g. Midterm 1" value={examFormData.name} onChange={e => setExamFormData({ ...examFormData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Subject</label>
                                <select required className="form-control" value={examFormData.subject} onChange={e => setExamFormData({ ...examFormData, subject: e.target.value })}>
                                    <option value="">Select Subject</option>
                                    {subjects.map(s => <option key={s.id} value={s.name}>{s.name} ({s.code})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Maximum Marks</label>
                                <input required type="number" className="form-control" placeholder="e.g. 100" value={examFormData.max_marks} onChange={e => setExamFormData({ ...examFormData, max_marks: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowExamModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingExam ? 'Update Exam' : 'Create Exam'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MARKS ENTRY MODAL */}
            {showMarksModal && enteringMarksFor && (
                <div className="modal-overlay">
                    <div className="modal-content marks-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>Enter Marks: {enteringMarksFor.name}</h2>
                                <p style={{ margin: '0.4rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    Subject: <strong>{enteringMarksFor.subject}</strong> | Max Marks: <strong>{enteringMarksFor.max_marks}</strong>
                                </p>
                            </div>
                            <button className="icon-btn" onClick={() => setShowMarksModal(false)}><X /></button>
                        </div>

                        <div className="marks-table-container">
                            <table>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
                                    <tr>
                                        <th style={{ padding: '1rem' }}>PIN</th>
                                        <th style={{ padding: '1rem' }}>Student Name</th>
                                        <th style={{ padding: '1rem' }}>Marks (/{enteringMarksFor.max_marks})</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => (
                                        <tr key={student.id}>
                                            <td style={{ padding: '0.75rem 1rem' }}><code>{student.pin}</code></td>
                                            <td style={{ padding: '0.75rem 1rem' }}><strong>{student.name}</strong></td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    style={{ width: '120px' }}
                                                    max={enteringMarksFor.max_marks}
                                                    min={0}
                                                    placeholder="0"
                                                    value={tempMarks[student.pin] || ''}
                                                    onChange={(e) => setTempMarks({ ...tempMarks, [student.pin]: e.target.value })}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" style={{ minWidth: '120px' }} onClick={() => setShowMarksModal(false)}>Cancel</button>
                            <button type="button" className="btn btn-primary" style={{ minWidth: '160px' }} onClick={handleSaveMarks}>Save All Marks</button>
                        </div>
                    </div>
                </div>
            )}

            {/* STUDENT DETAIL MODAL */}
            {selectedStudent && (
                <div className="modal-overlay">
                    <div className="modal-content student-modal">
                        <div className="gauge-container">
                            <h3>Attendance</h3>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="160" height="160" className="gauge-svg">
                                    <circle cx="80" cy="80" r="70" fill="transparent" stroke="#e5e7eb" strokeWidth="12" />
                                    <circle cx="80" cy="80" r="70" fill="transparent" stroke={getProgressColor(analytics.studentStats[selectedStudent.pin]?.attendance)} strokeWidth="12"
                                        strokeDasharray={440} strokeDashoffset={440 - (440 * (analytics.studentStats[selectedStudent.pin]?.attendance || 0)) / 100}
                                        strokeLinecap="round" />
                                </svg>
                                <div className="gauge-text">{analytics.studentStats[selectedStudent.pin]?.attendance}%</div>
                            </div>
                            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{analytics.studentStats[selectedStudent.pin]?.present} Present / {analytics.studentStats[selectedStudent.pin]?.absent} Absent</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Total: {analytics.studentStats[selectedStudent.pin]?.totalAttendanceDays} Days</div>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ margin: 0 }}>{selectedStudent.name}</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>PIN: {selectedStudent.pin}</p>
                                </div>
                                <button className="icon-btn" onClick={() => setSelectedStudent(null)}><X /></button>
                            </div>

                            <div style={{ marginTop: '2rem' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Subject-wise Performance</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    {subjects.map(sub => {
                                        const studentScores = (analytics.studentStats[selectedStudent.pin]?.scores || []).filter(s => s.subject === sub.name);
                                        const subAvg = studentScores.length > 0 ? Math.round(studentScores.reduce((acc, s) => acc + s.percentage, 0) / studentScores.length) : 0;

                                        return (
                                            <div key={sub.id}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                                                    <strong>{sub.name}</strong>
                                                    <span>{subAvg}%</span>
                                                </div>
                                                <div className="chart-track" style={{ height: '8px' }}>
                                                    <div className="chart-fill" style={{ width: `${subAvg}%`, background: getProgressColor(subAvg) }}></div>
                                                </div>
                                                <div style={{ marginTop: '0.4rem' }}>
                                                    {studentScores.map((sc, i) => (
                                                        <span className="subject-chip" key={i}>
                                                            {sc.examName}: {sc.score}/{sc.max}
                                                        </span>
                                                    ))}
                                                    {studentScores.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No marks entered</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentTracker;
