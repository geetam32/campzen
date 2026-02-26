import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Edit2, X, Search, UserCheck } from 'lucide-react';

const TeacherManagement = () => {
    const { userData } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        uid: '',
        name: '',
        email: '',
        password: '',
        is_class_teacher: false,
        class_id_assigned: '',
        subject_assignments: [] // Array of { subject_id, class_id }
    });

    const fetchData = async () => {
        if (!userData?.college_id) return;
        setLoading(true);
        try {
            // Fetch teachers and staff
            console.log("Web TeacherManagement: Fetching for college_id:", userData.college_id);
            const tQ = query(collection(db, 'teachers'), where('college_id', '==', userData.college_id));
            const staffQ = query(collection(db, 'staff'), where('college_id', '==', userData.college_id));

            const [tS, staffS] = await Promise.all([getDocs(tQ), getDocs(staffQ)]);

            console.log("Web TeacherManagement: Found", tS.size, "teachers and", staffS.size, "staff");

            const tList = tS.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sList = staffS.docs.map(doc => ({ id: doc.id, ...doc.data(), origin: 'staff' }));

            const merged = [...tList];
            sList.forEach(s => {
                const exists = merged.find(m => m.id === s.id || (m.uid && s.uid && m.uid === s.uid));
                if (!exists) merged.push(s);
            });

            setTeachers(merged);

            // Fetch classes for dropdown
            const classesQuery = query(collection(db, 'classes'), where('college_id', '==', userData.college_id));
            const classesSnapshot = await getDocs(classesQuery);
            const classesList = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(classesList);

            // Fetch subjects for dropdown
            const subjectsQuery = query(collection(db, 'subjects'), where('college_id', '==', userData.college_id));
            const subjectsSnapshot = await getDocs(subjectsQuery);
            const subjectsList = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSubjects(subjectsList);
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [userData]);

    const generateUID = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let uid = '';
        for (let i = 0; i < 3; i++) {
            uid += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return uid;
    };

    const resetForm = () => {
        setFormData({
            uid: generateUID(),
            name: '',
            email: '',
            password: '',
            is_class_teacher: false,
            class_id_assigned: '',
            subject_assignments: []
        });
        setEditingTeacher(null);
    };

    const openModal = (teacher = null) => {
        if (teacher) {
            setEditingTeacher(teacher);
            setFormData({
                uid: teacher.uid,
                name: teacher.name,
                email: teacher.email,
                password: '',
                is_class_teacher: teacher.is_class_teacher || false,
                class_id_assigned: teacher.class_id_assigned || '',
                subject_assignments: teacher.subject_assignments || []
            });
        } else {
            resetForm();
        }
        setShowModal(true);
    };

    const handleAddAssignment = () => {
        setFormData({
            ...formData,
            subject_assignments: [...formData.subject_assignments, { subject_id: '', class_id: '' }]
        });
    };

    const handleRemoveAssignment = (index) => {
        const newAssignments = [...formData.subject_assignments];
        newAssignments.splice(index, 1);
        setFormData({ ...formData, subject_assignments: newAssignments });
    };

    const handleUpdateAssignment = (index, field, value) => {
        const newAssignments = [...formData.subject_assignments];
        newAssignments[index][field] = value;
        setFormData({ ...formData, subject_assignments: newAssignments });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const teacherData = {
                college_id: userData.college_id,
                uid: formData.uid,
                name: formData.name,
                email: formData.email,
                role: 'teacher',
                is_class_teacher: formData.is_class_teacher,
                class_id_assigned: formData.is_class_teacher ? formData.class_id_assigned : null,
                subject_assignments: formData.subject_assignments.filter(a => a.subject_id && a.class_id)
            };

            if (formData.password) {
                teacherData.password = formData.password;
            }

            if (editingTeacher) {
                await updateDoc(doc(db, 'teachers', editingTeacher.id), teacherData);
            } else {
                if (!formData.password) {
                    alert('Password is required for new teachers');
                    return;
                }

                const q = query(collection(db, 'teachers'), where('college_id', '==', userData.college_id), where('uid', '==', formData.uid));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    alert('This UID is already assigned to another teacher.');
                    return;
                }

                await addDoc(collection(db, 'teachers'), {
                    ...teacherData,
                    status: 'active',
                    created_at: new Date()
                });
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (err) {
            console.error("Error saving teacher:", err);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure? Deleting a teacher may break timetable and history. We recommend deactivating instead.")) {
            await deleteDoc(doc(db, 'teachers', id));
            fetchData();
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        await updateDoc(doc(db, 'teachers', id), { status: newStatus });
        fetchData();
    };

    const getClassName = (classId) => {
        const cls = classes.find(c => c.id === classId);
        return cls ? `${cls.branch} - ${cls.section}` : '-';
    };

    const getSubjectName = (subjectId) => {
        const sub = subjects.find(s => s.id === subjectId);
        return sub ? sub.name : '-';
    };

    const filteredTeachers = teachers.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.uid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                Loading teachers...
            </div>
        );
    }

    return (
        <div className="teacher-management">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Teacher Management</h1>
                    <p className="page-description">Manage teachers and their class assignments.</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <Plus size={16} />
                    New Teacher
                </button>
            </div>

            <div className="filters">
                <div className="filter-group" style={{ flex: 1, maxWidth: '300px' }}>
                    <Search size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search by name or UID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {filteredTeachers.length === 0 ? (
                <div className="empty-state">
                    <p>No teachers found. Add your first teacher to get started.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>UID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Class Teacher</th>
                                <th>Assignments</th>
                                <th style={{ width: '100px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTeachers.map(teacher => (
                                <tr key={teacher.id}>
                                    <td><code style={{ color: 'var(--accent-primary)' }}>{teacher.uid}</code></td>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{teacher.name}</td>
                                    <td>{teacher.email}</td>
                                    <td>
                                        {teacher.is_class_teacher ? (
                                            <span className="badge badge-success">
                                                <UserCheck size={12} style={{ marginRight: '4px' }} />
                                                {getClassName(teacher.class_id_assigned)}
                                            </span>
                                        ) : (
                                            <span className="badge badge-secondary" style={{ opacity: 0.5 }}>No</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {(teacher.subject_assignments || []).map((asgn, i) => (
                                                <span key={i} className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                                                    {getSubjectName(asgn.subject_id)} ({getClassName(asgn.class_id)})
                                                </span>
                                            ))}
                                            {(!teacher.subject_assignments || teacher.subject_assignments.length === 0) && '-'}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className={`btn btn-icon btn-sm ${teacher.status === 'inactive' ? 'btn-success' : 'btn-secondary'}`}
                                                onClick={() => handleToggleStatus(teacher.id, teacher.status || 'active')}
                                                title={teacher.status === 'inactive' ? 'Activate' : 'Deactivate'}
                                            >
                                                <X size={14} style={{ transform: teacher.status === 'inactive' ? 'rotate(45deg)' : 'none' }} />
                                            </button>
                                            <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openModal(teacher)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(teacher.id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingTeacher ? 'Edit Teacher' : 'Create New Teacher'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Teacher UID (3 letters)</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            required
                                            maxLength={3}
                                            placeholder="e.g. ABC"
                                            value={formData.uid}
                                            onChange={(e) => setFormData({ ...formData, uid: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            required
                                            placeholder="Full Name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        required
                                        placeholder="teacher@college.edu"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Password {editingTeacher && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(leave blank to keep current)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        required={!editingTeacher}
                                        placeholder={editingTeacher ? "Leave blank to keep current" : "Enter password"}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>

                                <div className="assignments-section" style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <label className="form-label" style={{ marginBottom: 0 }}>Subject & Class Assignments</label>
                                        <button type="button" className="btn btn-sm btn-secondary" onClick={handleAddAssignment}>
                                            <Plus size={14} /> Add Assignment
                                        </button>
                                    </div>

                                    {formData.subject_assignments.length === 0 ? (
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', py: '1rem' }}>
                                            No assignments added yet.
                                        </p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {formData.subject_assignments.map((asgn, index) => (
                                                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '0.5rem', alignItems: 'end' }}>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Subject</label>
                                                        <select
                                                            className="form-select"
                                                            required
                                                            value={asgn.subject_id}
                                                            onChange={(e) => handleUpdateAssignment(index, 'subject_id', e.target.value)}
                                                        >
                                                            <option value="">Select Subject</option>
                                                            {subjects.map(sub => (
                                                                <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Class</label>
                                                        <select
                                                            className="form-select"
                                                            required
                                                            value={asgn.class_id}
                                                            onChange={(e) => handleUpdateAssignment(index, 'class_id', e.target.value)}
                                                        >
                                                            <option value="">Select Class</option>
                                                            {classes.map(cls => (
                                                                <option key={cls.id} value={cls.id}>{cls.branch} - {cls.section}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <button type="button" className="btn btn-icon btn-danger btn-sm" onClick={() => handleRemoveAssignment(index)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                    <label className="checkbox-group">
                                        <input
                                            type="checkbox"
                                            className="checkbox"
                                            checked={formData.is_class_teacher}
                                            onChange={(e) => setFormData({ ...formData, is_class_teacher: e.target.checked })}
                                        />
                                        <span>Assign as Class Teacher</span>
                                    </label>
                                </div>

                                {formData.is_class_teacher && (
                                    <div className="form-group">
                                        <label className="form-label">Assigned Class</label>
                                        <select
                                            className="form-select"
                                            required={formData.is_class_teacher}
                                            value={formData.class_id_assigned}
                                            onChange={(e) => setFormData({ ...formData, class_id_assigned: e.target.value })}
                                        >
                                            <option value="">Select a class</option>
                                            {classes.map(cls => (
                                                <option key={cls.id} value={cls.id}>
                                                    {cls.branch} - Sec {cls.section} (Year {cls.year}, Sem {cls.semester})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingTeacher ? 'Update Teacher' : 'Create Teacher'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherManagement;
