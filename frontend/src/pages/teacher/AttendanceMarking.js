import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { CheckCircle, XCircle, Save, Loader2 } from 'lucide-react';

const AttendanceMarking = () => {
    const { userData } = useAuth();
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedPeriod, setSelectedPeriod] = useState('1');
    const [attendance, setAttendance] = useState({});
    const [existingRecord, setExistingRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [topic, setTopic] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');

    const periods = [1, 2, 3, 4, 5, 6, 7, 8];

    useEffect(() => {
        const fetchClassesAndSubjects = async () => {
            if (!userData?.college_id) return;

            try {
                // Fetch all classes teacher is assigned to
                const assignmentQuery = query(
                    collection(db, 'teaching_assignments'),
                    where('college_id', '==', userData.college_id),
                    where('teacher_id', '==', userData.uid)
                );
                const assignmentSnapshot = await getDocs(assignmentQuery);
                const fromAssignmentsCollection = assignmentSnapshot.docs.map(doc => doc.data().class_id);
                const fromUserDoc = (userData.subject_assignments || []).map(a => a.class_id);
                const assignedClassIds = [...new Set([...fromAssignmentsCollection, ...fromUserDoc])];

                // Add class teacher's class if applicable
                if (userData.is_class_teacher && userData.class_id_assigned) {
                    if (!assignedClassIds.includes(userData.class_id_assigned)) {
                        assignedClassIds.push(userData.class_id_assigned);
                    }
                }

                // Fetch class details
                const classesQuery = query(
                    collection(db, 'classes'),
                    where('college_id', '==', userData.college_id)
                );
                const classesSnapshot = await getDocs(classesQuery);
                const allClasses = classesSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(cls => assignedClassIds.includes(cls.id));

                setClasses(allClasses);

                // Fetch all subjects for this college
                const subjectsQuery = query(
                    collection(db, 'subjects'),
                    where('college_id', '==', userData.college_id)
                );
                const subjectsSnapshot = await getDocs(subjectsQuery);
                setSubjects(subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error('Error fetching classes and subjects:', error);
            }
        };

        fetchClassesAndSubjects();
    }, [userData]);

    useEffect(() => {
        const fetchStudentsAndRecord = async () => {
            if (!selectedClass || !selectedDate || !selectedPeriod) return;

            setLoading(true);
            try {
                // Fetch students for selected class
                const studentsQuery = query(
                    collection(db, 'students'),
                    where('college_id', '==', userData.college_id),
                    where('class_id', '==', selectedClass)
                );
                const studentsSnapshot = await getDocs(studentsQuery);
                const studentsList = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort by PIN ascending (numeric safe)
                studentsList.sort((a, b) => a.pin.localeCompare(b.pin, undefined, { numeric: true }));
                setStudents(studentsList);

                // Check for existing attendance record
                const attQuery = query(
                    collection(db, 'attendance_records'),
                    where('college_id', '==', userData.college_id),
                    where('class_id', '==', selectedClass),
                    where('date', '==', selectedDate),
                    where('period', '==', parseInt(selectedPeriod))
                );
                const attSnapshot = await getDocs(attQuery);

                if (!attSnapshot.empty) {
                    const record = { id: attSnapshot.docs[0].id, ...attSnapshot.docs[0].data() };
                    setExistingRecord(record);
                    setTopic(record.topic || '');
                    setSelectedSubject(record.subject_id || '');

                    // Pre-populate attendance
                    const attMap = {};
                    studentsList.forEach(s => {
                        if (record.present?.includes(s.pin)) {
                            attMap[s.pin] = 'present';
                        } else if (record.absent?.includes(s.pin)) {
                            attMap[s.pin] = 'absent';
                        }
                    });
                    setAttendance(attMap);
                } else {
                    setExistingRecord(null);
                    setTopic('');
                    setSelectedSubject('');
                    // Default all to present
                    const attMap = {};
                    studentsList.forEach(s => {
                        attMap[s.pin] = 'present';
                    });
                    setAttendance(attMap);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStudentsAndRecord();
    }, [selectedClass, selectedDate, selectedPeriod, userData]);

    // Fetch full day records if user is class teacher for selected class
    useEffect(() => {
        const fetchDayRecords = async () => {
            if (!selectedClass || !summaryDate || !userData.class_id_assigned || selectedClass !== userData.class_id_assigned) {
                setDayRecords({});
                return;
            }

            try {
                const q = query(
                    collection(db, 'attendance_records'),
                    where('college_id', '==', userData.college_id),
                    where('class_id', '==', selectedClass),
                    where('date', '==', summaryDate)
                );
                const snapshot = await getDocs(q);
                const records = {};
                snapshot.forEach(doc => {
                    const data = doc.data();
                    records[data.period] = data; // Map by period number
                });
                setDayRecords(records);
            } catch (e) {
                console.error("Error fetching day records:", e);
            }
        };
        fetchDayRecords();
    }, [selectedClass, summaryDate, userData, saving]); // Use summaryDate instead of selectedDate

    const toggleAttendance = (pin) => {
        // Only allow editing if teacher is class teacher or admin, or if no existing record
        if (existingRecord && !userData.is_class_teacher && userData.role !== 'admin' && existingRecord.marked_by !== userData.uid) {
            return;
        }

        setAttendance(prev => ({
            ...prev,
            [pin]: prev[pin] === 'present' ? 'absent' : 'present'
        }));
    };

    const handleSubmit = async () => {
        if (!selectedClass || !selectedDate || !selectedPeriod) {
            setMessage({ type: 'error', text: 'Please select class, date, and period.' });
            return;
        }

        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const present = Object.entries(attendance)
                .filter(([_, status]) => status === 'present')
                .map(([pin]) => pin);
            const absent = Object.entries(attendance)
                .filter(([_, status]) => status === 'absent')
                .map(([pin]) => pin);

            const sub = subjects.find(s => s.id === selectedSubject);

            const recordData = {
                college_id: userData.college_id,
                class_id: selectedClass,
                date: selectedDate,
                period: parseInt(selectedPeriod),
                present,
                absent,
                topic,
                subject_id: selectedSubject,
                subject_name: sub ? sub.name : 'General Class',
                marked_by: userData.uid,
                marked_by_name: userData.name || 'Unknown Teacher',
                updated_at: new Date()
            };

            if (existingRecord) {
                await updateDoc(doc(db, 'attendance_records', existingRecord.id), recordData);
            } else {
                recordData.marked_at = new Date();
                await addDoc(collection(db, 'attendance_records'), recordData);
            }

            setMessage({ type: 'success', text: 'Attendance and Topic saved successfully!' });

            // Refresh to show updated record
            setExistingRecord({ ...recordData, id: existingRecord?.id || 'new' });
        } catch (error) {
            console.error('Error saving attendance:', error);
            setMessage({ type: 'error', text: 'Failed to save attendance. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const canEdit = !existingRecord || userData.is_class_teacher || userData.role === 'admin';
    const presentCount = Object.values(attendance).filter(v => v === 'present').length;
    const absentCount = Object.values(attendance).filter(v => v === 'absent').length;

    return (
        <div className="attendance-marking">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Mark Attendance</h1>
                    <p className="page-description">Record period-wise attendance for your classes.</p>
                </div>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="form-row" style={{ marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Class</label>
                        <select
                            className="form-select"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="">Select Class</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.branch} - Section {cls.section}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Subject</label>
                        <select
                            className="form-select"
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                        >
                            <option value="">Select Subject (Optional)</option>
                            {subjects.map(sub => (
                                <option key={sub.id} value={sub.id}>
                                    {sub.name} {sub.code ? `(${sub.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Topic Covered</label>
                    <textarea
                        className="form-input"
                        placeholder="What chapter/topic was taught in this session?"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        rows={3}
                        disabled={!canEdit}
                        style={{ resize: 'none' }}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Period</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {periods.map(p => (
                            <button
                                key={p}
                                className={`btn btn-sm ${selectedPeriod === String(p) ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedPeriod(String(p))}
                            >
                                Period {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {existingRecord && (
                <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                    Attendance already marked by {existingRecord.marked_by}.
                    {canEdit ? ' You can edit this record.' : ' Only class teacher or admin can edit.'}
                </div>
            )}

            {loading ? (
                <div className="loading">
                    <div className="spinner"></div>
                    Loading students...
                </div>
            ) : selectedClass && students.length > 0 ? (
                <>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <span className="badge badge-success">Present: {presentCount}</span>
                        <span className="badge badge-danger">Absent: {absentCount}</span>
                    </div>

                    {/* Main Container Box for the Grid */}
                    <div style={{
                        border: '1px solid rgba(255, 255, 255, 0.1)', // Glass border
                        borderRadius: '16px',
                        padding: '1.5rem',
                        backgroundColor: 'rgba(30, 41, 59, 0.6)', // Dark glassy background
                        backdropFilter: 'blur(12px)',
                        marginTop: '1rem',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' // Glass shadow
                    }}>
                        <div style={{
                            display: 'grid',
                            // Smaller columns
                            gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
                            gap: '8px', // Smaller gap
                        }}>
                            {students.map(student => {
                                const isAbsent = attendance[student.pin] === 'absent';
                                return (
                                    <div
                                        key={student.id}
                                        onClick={() => canEdit && toggleAttendance(student.pin)}
                                        title={student.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '45px', // Smaller height
                                            padding: '2px',
                                            borderRadius: '8px', // Slightly rounder for modern theme
                                            cursor: canEdit ? 'pointer' : 'not-allowed',
                                            fontWeight: '600',
                                            fontSize: '0.75rem', // Smaller font for PIN number
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            // Bright green for present, Red for absent. Both with white text for better contrast/theme.
                                            backgroundColor: isAbsent ? '#ef4444' : '#22c55e',
                                            color: 'white',
                                            border: isAbsent ? '2px solid #b91c1c' : '2px solid #16a34a', // Darker border for depth
                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                            userSelect: 'none',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            textOverflow: 'ellipsis'
                                        }}
                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        {student.pin}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {canEdit && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 size={16} className="spinner" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        {existingRecord ? 'Update Attendance' : 'Submit Attendance'}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </>
            ) : selectedClass ? (
                <div className="empty-state">
                    <p>No students found in this class.</p>
                </div>
            ) : (
                <div className="empty-state">
                    <p>Select a class, date, and period to mark attendance.</p>
                </div>
            )}

            {/* Class Teacher Summary Section - Expandable Table */}
            {selectedClass && userData.class_id_assigned === selectedClass && students.length > 0 && (
                <div style={{ marginTop: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h2 className="page-title" style={{ fontSize: '1.5rem', marginBottom: 0 }}>Daily Attendance Overview</h2>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: 'auto', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            value={summaryDate}
                            onChange={(e) => setSummaryDate(e.target.value)}
                        />
                    </div>
                    <div style={{
                        overflowX: 'auto',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        backgroundColor: 'rgba(30, 41, 59, 0.6)',
                        backdropFilter: 'blur(12px)',
                        padding: '1rem'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', color: 'white' }}>
                            <thead>
                                <tr style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'left' }}>
                                    <th style={{ padding: '0 1rem' }}>Period</th>
                                    <th style={{ padding: '0 1rem' }}>Teacher</th>
                                    <th style={{ padding: '0 1rem' }}>Total</th>
                                    <th style={{ padding: '0 1rem' }}>Present</th>
                                    <th style={{ padding: '0 1rem' }}>Absent</th>
                                    <th style={{ padding: '0 1rem' }}>%</th>
                                    <th style={{ padding: '0 1rem' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {periods.map(p => {
                                    const rec = dayRecords[p];
                                    const isMarked = !!rec;
                                    const presentCount = rec?.present?.length || 0;
                                    const absentCount = rec?.absent?.length || 0;
                                    const totalMarked = presentCount + absentCount;
                                    const percentage = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;
                                    const isExpanded = expandedPeriod === p;

                                    return (
                                        <React.Fragment key={p}>
                                            <tr
                                                onClick={() => setExpandedPeriod(isExpanded ? null : p)}
                                                style={{
                                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s'
                                                }}
                                                className="hover:bg-white/10"
                                            >
                                                <td style={{ padding: '1rem', borderRadius: '8px 0 0 8px' }}>{p}</td>
                                                <td style={{ padding: '1rem' }}>{rec?.marked_by_name || (isMarked ? 'Teacher' : '-')}</td>
                                                <td style={{ padding: '1rem' }}>{isMarked ? totalMarked : '-'}</td>
                                                <td style={{ padding: '1rem', color: '#4ade80' }}>{isMarked ? presentCount : '-'}</td>
                                                <td style={{ padding: '1rem', color: '#f87171' }}>{isMarked ? absentCount : '-'}</td>
                                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{isMarked ? `${percentage}%` : '-'}</td>
                                                <td style={{ padding: '1rem', borderRadius: '0 8px 8px 0', textAlign: 'right' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.3s'
                                                    }}>
                                                        ▼
                                                    </span>
                                                </td>
                                            </tr>
                                            {isExpanded && isMarked && (
                                                <tr>
                                                    <td colSpan="7" style={{ padding: '0' }}>
                                                        <div style={{
                                                            padding: '1rem',
                                                            backgroundColor: 'rgba(0,0,0,0.2)',
                                                            borderRadius: '8px',
                                                            marginTop: '-4px', // Connect to row above
                                                            marginBottom: '8px',
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: '8px'
                                                        }}>
                                                            {students.map(student => {
                                                                const isPresent = rec.present?.includes(student.pin);
                                                                const isAbsent = rec.absent?.includes(student.pin);

                                                                // Skip if student status is unknown/not marked in this record
                                                                if (!isPresent && !isAbsent) return null;

                                                                const bgColor = isPresent ? '#22c55e' : '#ef4444';
                                                                const borderColor = isPresent ? '#16a34a' : '#dc2626';

                                                                return (
                                                                    <div key={student.id} style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        padding: '8px 16px',
                                                                        borderRadius: '10px',
                                                                        backgroundColor: bgColor,
                                                                        border: `2px solid ${borderColor}`,
                                                                        color: 'white',
                                                                        fontWeight: 'bold',
                                                                        fontSize: '1rem',
                                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                                    }}>
                                                                        {student.pin}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceMarking;
