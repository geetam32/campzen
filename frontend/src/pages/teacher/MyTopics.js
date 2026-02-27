import React, { useState, useEffect, useCallback } from 'react';
import {
    BookOpen,
    Calendar,
    Clock,
    Users,
    Search,
    ArrowRight,
    Loader2,
    CheckCircle2,
    XCircle,
    Layout,
    ChevronRight,
    Layers,
    GraduationCap,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    FileText,
    ClipboardList,
    Plus,
    Trash2,
    Image as ImageIcon,
    X
} from 'lucide-react';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const MyTopics = () => {
    const { userData } = useAuth();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [records, setRecords] = useState([]);
    const [classes, setClasses] = useState({});
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [materials, setMaterials] = useState({});
    const [activeTab, setActiveTab] = useState('note'); // 'note' or 'assignment'
    const [noteText, setNoteText] = useState('');
    const [assignmentText, setAssignmentText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        if (!userData?.college_id || !userData?.uid) return;

        setLoading(true);
        try {
            // 1. Fetch Classes to resolve names
            const classesQuery = query(
                collection(db, 'colleges', userData.college_id, 'classes')
            );
            const classesSnapshot = await getDocs(classesQuery);
            const classMap = {};
            classesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                classMap[doc.id] = `${data.branch} - ${data.section}`;
            });
            setClasses(classMap);

            // 2. Fetch Attendance Records (Lessons delivered by this teacher)
            const q = query(
                collection(db, 'attendance_records'),
                where('college_id', '==', userData.college_id),
                where('marked_by', '==', userData.uid),
                where('date', '==', date)
            );

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Client-side sorting by period
            const sortedData = data.sort((a, b) => a.period - b.period);
            setRecords(sortedData);
        } catch (error) {
            console.error("Error fetching my topics:", error);
        } finally {
            setLoading(false);
        }
    }, [userData, date]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // real-time listener for materials
    useEffect(() => {
        if (!userData?.college_id) return;

        const q = query(
            collection(db, 'topic_materials'),
            where('college_id', '==', userData.college_id),
            where('created_by', '==', userData.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const mats = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!mats[data.attendance_record_id]) mats[data.attendance_record_id] = [];
                mats[data.attendance_record_id].push({ id: doc.id, ...data });
            });
            setMaterials(mats);
        });

        return () => unsubscribe();
    }, [userData]);

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 800000) { // ~800KB limit for safety
                alert("Image is too large. Please select an image under 800KB.");
                return;
            }
            const base64 = await fileToBase64(file);
            setSelectedImage(base64);
        }
    };

    const handleAddMaterial = async (record) => {
        const text = activeTab === 'note' ? noteText : assignmentText;
        if (!text.trim() && !selectedImage) return;

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'topic_materials'), {
                attendance_record_id: record.id,
                college_id: userData.college_id,
                class_id: record.class_id,
                type: activeTab,
                text: text.trim(),
                image_url: selectedImage,
                created_by: userData.uid,
                created_by_name: userData.name,
                date: record.date,
                period: record.period,
                subject_name: record.subject_name || 'General Class',
                created_at: serverTimestamp()
            });

            // Reset form
            if (activeTab === 'note') setNoteText('');
            else setAssignmentText('');
            setSelectedImage(null);
        } catch (error) {
            console.error("Error adding material:", error);
            alert("Failed to save material.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteMaterial = async (id) => {
        if (!window.confirm("Delete this item?")) return;
        try {
            await deleteDoc(doc(db, 'topic_materials', id));
        } catch (error) {
            console.error("Error deleting material:", error);
        }
    };

    return (
        <div className="my-topics-container">
            <div className="page-header">
                <div className="header-left">
                    <h1 className="page-title">My Topics</h1>
                    <p className="page-subtitle">View topics you've taught across your classes.</p>
                </div>
                <div className="date-picker-section">
                    <div className="date-display-box">
                        <Calendar size={18} className="cal-icon-green" />
                        <span className="date-text">{new Date(date).toLocaleDateString('en-GB').replace(/\//g, ' - ')}</span>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="hidden-picker"
                        />
                        <CalendarDays size={18} className="picker-icon-dark" />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <Loader2 className="spinner" />
                    <p>Fetching your logs...</p>
                </div>
            ) : records.length === 0 ? (
                <div className="empty-topic-state">
                    <Layers size={48} className="empty-icon" />
                    <h3>No topics logged</h3>
                    <p>You haven't recorded any lessons for this date yet.</p>
                </div>
            ) : (
                <div className="topics-grid">
                    {records.map((record, index) => {
                        const isExpanded = expandedId === record.id;
                        const recordMaterials = materials[record.id] || [];
                        const filteredMaterials = recordMaterials.filter(m => m.type === activeTab);

                        return (
                            <div key={record.id} className={`topic-card ${isExpanded ? 'expanded' : ''}`} style={{ borderTopWidth: '4px', borderTopStyle: 'solid', borderTopColor: index % 3 === 0 ? '#BFDBFE' : index % 3 === 1 ? '#FED7AA' : '#D1FAE5' }}>
                                <div className="card-click-area" onClick={() => setExpandedId(isExpanded ? null : record.id)}>
                                    <div className="card-header-row">
                                        <div className="period-badge-lite">
                                            <Clock size={14} className="text-purple" />
                                            <span>Period {record.period}</span>
                                        </div>
                                        <div className="class-badge-lite">
                                            <GraduationCap size={14} className="text-green" />
                                            <span>{classes[record.class_id] || record.class_id}</span>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} className="expand-chevron" /> : <ChevronDown size={20} className="expand-chevron" />}
                                    </div>

                                    <div className="subject-row">
                                        <BookOpen size={18} className="subject-icon" />
                                        <h3 className="subject-title">{record.subject_name || 'General Class'}</h3>
                                    </div>

                                    <div className="topic-content-well">
                                        <span className="content-label">TOPIC TAUGHT:</span>
                                        <p className="topic-description">{record.topic || 'No topic recorded.'}</p>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="expansion-panel">
                                        <div className="tabs-header">
                                            <button
                                                className={`tab-btn ${activeTab === 'note' ? 'active' : ''}`}
                                                onClick={() => setActiveTab('note')}
                                            >
                                                <FileText size={16} />
                                                Notes
                                            </button>
                                            <button
                                                className={`tab-btn ${activeTab === 'assignment' ? 'active' : ''}`}
                                                onClick={() => setActiveTab('assignment')}
                                            >
                                                <BookOpen size={16} />
                                                Assignments
                                            </button>
                                        </div>

                                        <div className="tab-content">
                                            <div className="material-form">
                                                <textarea
                                                    placeholder={`Add an ${activeTab === 'note' ? 'note' : 'assignment'} for this topic...`}
                                                    value={activeTab === 'note' ? noteText : assignmentText}
                                                    onChange={(e) => activeTab === 'note' ? setNoteText(e.target.value) : setAssignmentText(e.target.value)}
                                                    className="material-textarea"
                                                />

                                                {selectedImage && (
                                                    <div className="image-preview-container">
                                                        <img src={selectedImage} alt="Preview" className="image-preview" />
                                                        <button className="remove-img-btn" onClick={() => setSelectedImage(null)}>
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="form-actions">
                                                    <label className="image-upload-label">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleImageChange}
                                                            className="hidden-file-input"
                                                        />
                                                        <ImageIcon size={18} className="add-img-icon" />
                                                        <span>Add Image</span>
                                                    </label>

                                                    <button
                                                        className="post-material-btn"
                                                        onClick={() => handleAddMaterial(record)}
                                                        disabled={submitting || (!noteText.trim() && !assignmentText.trim() && !selectedImage)}
                                                    >
                                                        {submitting ? <Loader2 size={16} className="spinner" /> : <Plus size={18} />}
                                                        <span>Post</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="materials-list">
                                                {filteredMaterials.length === 0 ? (
                                                    <p className="empty-mats-text">No {activeTab}s posted yet.</p>
                                                ) : (
                                                    filteredMaterials.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)).map(mat => (
                                                        <div key={mat.id} className="material-item">
                                                            <div className="mat-header">
                                                                <p className="mat-text">{mat.text}</p>
                                                                <button className="mat-delete-btn" onClick={() => handleDeleteMaterial(mat.id)}>
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                            {mat.image_url && (
                                                                <div className="mat-image-container">
                                                                    <img
                                                                        src={mat.image_url}
                                                                        alt="Material"
                                                                        className="mat-image"
                                                                        onClick={() => window.open(mat.image_url, '_blank')}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="attendance-footer">
                                    <div className="attendance-pill present">
                                        <CheckCircle2 size={14} className="icon-success" />
                                        <span>{record.present?.length || 0} present</span>
                                    </div>
                                    <span className="dot-separator">•</span>
                                    <div className="attendance-pill absent">
                                        <XCircle size={14} className="icon-danger" />
                                        <span>{record.absent?.length || 0} absent</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                .my-topics-container {
                    padding: 0.5rem 0;
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .page-title {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin: 0;
                }

                .page-subtitle {
                    color: #64748b;
                    font-size: 0.95rem;
                    margin: 0.25rem 0 0;
                }

                .date-picker-section {
                    position: relative;
                }

                .date-display-box {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    background: #f8fafc;
                    padding: 0.6rem 1.25rem;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    color: #1e293b;
                    font-weight: 600;
                    cursor: pointer;
                }

                .date-text {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    letter-spacing: 1px;
                }

                .hidden-picker {
                    position: absolute;
                    inset: 0;
                    opacity: 0;
                    cursor: pointer;
                    width: 100%;
                }

                .cal-icon-green { color: #10b981; }
                .picker-icon-dark { color: #1e293b; }

                .topics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1.5rem;
                }

                .topic-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 1.25rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    transition: all 0.2s ease;
                }

                .topic-card:hover {
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                }

                .topic-card.expanded {
                    grid-column: 1 / -1;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }

                .card-click-area {
                    cursor: pointer;
                }

                .card-header-row {
                    display: flex;
                    justify-content: flex-start;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .expand-chevron {
                    margin-left: auto;
                    color: #94a3b8;
                }

                .period-badge-lite {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: #fdf4ff;
                    color: #a855f7;
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.72rem;
                    font-weight: 800;
                }

                .class-badge-lite {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: #f0fdf4;
                    color: #10b981;
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.72rem;
                    font-weight: 800;
                }

                .text-purple { color: #8b5cf6; }
                .text-green { color: #10b981; }

                .subject-row {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }

                .subject-icon { color: #10b981; opacity: 0.8; }

                .subject-title {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0;
                }

                .topic-content-well {
                    background: #f1f5f9;
                    border-radius: 10px;
                    padding: 1rem 1.25rem;
                    margin-bottom: 1.25rem;
                    min-height: 80px;
                }

                .content-label {
                    display: block;
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                }

                .topic-description {
                    font-size: 0.9rem;
                    color: #334155;
                    font-weight: 500;
                    margin: 0;
                }

                .attendance-footer {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-top: 1.25rem;
                    padding-top: 1rem;
                    border-top: 1px dashed #e2e8f0;
                }

                .expansion-panel {
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 2px solid #f1f5f9;
                }

                .tabs-header {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                    background: #f8fafc;
                    padding: 0.4rem;
                    border-radius: 10px;
                    width: fit-content;
                }

                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.6rem 1.25rem;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    font-size: 0.85rem;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .tab-btn.active {
                    background: #fff;
                    color: #6366f1;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }

                .material-form {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 1.25rem;
                    margin-bottom: 2rem;
                    border: 1px solid #e2e8f0;
                }

                .material-textarea {
                    width: 100%;
                    min-height: 100px;
                    padding: 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    color: #1e293b;
                    resize: vertical;
                    margin-bottom: 1rem;
                    transition: border-color 0.2s;
                }

                .material-textarea:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }

                .image-preview-container {
                    position: relative;
                    width: 120px;
                    height: 120px;
                    margin-bottom: 1rem;
                }

                .image-preview {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }

                .remove-img-btn {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: #ef4444;
                    color: #fff;
                    border: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }

                .form-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .image-upload-label {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.6rem 1rem;
                    background: #f1f5f9;
                    border: none;
                    border-radius: 8px;
                    color: #10b981;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-img-icon {
                    color: #10b981;
                }

                .image-upload-label:hover {
                    background: #e2e8f0;
                }

                .hidden-file-input {
                    display: none;
                }

                .post-material-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.6rem 1.75rem;
                    background: #f97316;
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.2);
                }

                .post-material-btn:hover {
                    background: #ea580c;
                    transform: translateY(-1px);
                }

                .post-material-btn:disabled {
                    background: #cbd5e1;
                    cursor: not-allowed;
                    transform: none;
                }

                .materials-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .material-item {
                    background: #fff;
                    border: 1px solid #f1f5f9;
                    border-radius: 12px;
                    padding: 1rem;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
                }

                .mat-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    margin-bottom: 0.75rem;
                }

                .mat-text {
                    font-size: 0.95rem;
                    color: #334155;
                    margin: 0;
                    line-height: 1.5;
                    font-weight: 500;
                }

                .mat-delete-btn {
                    background: transparent;
                    color: #94a3b8;
                    border: none;
                    padding: 0.4rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .mat-delete-btn:hover {
                    color: #ef4444;
                    background: #fee2e2;
                }

                .mat-image-container {
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #f1f5f9;
                    max-width: 200px;
                }

                .mat-image {
                    max-width: 100%;
                    max-height: 150px;
                    object-fit: contain;
                    border-radius: 6px;
                    cursor: zoom-in;
                }

                .empty-mats-text {
                    text-align: center;
                    color: #94a3b8;
                    font-size: 0.9rem;
                    padding: 2rem;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 2px dashed #e2e8f0;
                }

                .attendance-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #64748b;
                }

                .icon-success { color: #10b981; }
                .icon-danger { color: #ef4444; }
                .dot-separator { color: #cbd5e1; font-size: 1rem; }

                .loading-state {
                    text-align: center;
                    padding: 4rem;
                    color: #64748b;
                }

                .spinner {
                    animation: spin 1s linear infinite;
                    color: #10b981;
                    margin-bottom: 1rem;
                }

                .empty-topic-state {
                    text-align: center;
                    padding: 4rem;
                    background: #fff;
                    border-radius: 16px;
                    border: 1px dashed #e2e8f0;
                    color: #94a3b8;
                }

                .empty-icon { color: #e2e8f0; margin-bottom: 1rem; }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 640px) {
                    .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .topics-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default MyTopics;
