import React, { useState, useEffect, useCallback } from 'react';
import {
    BookOpen,
    Calendar,
    Clock,
    User,
    Search,
    Info,
    ArrowRight,
    Loader2,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    FileText,
    ClipboardList
} from 'lucide-react';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const DailyReview = () => {
    const { userData } = useAuth();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [materials, setMaterials] = useState({});

    const fetchDailyTopics = useCallback(async () => {
        if (!userData?.college_id || !userData?.class_id) return;

        setLoading(true);
        try {
            const q = query(
                collection(db, 'attendance_records'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id),
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
            console.error("Error fetching daily reviews:", error);
        } finally {
            setLoading(false);
        }
    }, [userData, date]);

    useEffect(() => {
        fetchDailyTopics();
    }, [fetchDailyTopics]);

    // real-time listener for materials
    useEffect(() => {
        if (!userData?.college_id || !userData?.class_id) return;

        const q = query(
            collection(db, 'topic_materials'),
            where('college_id', '==', userData.college_id),
            where('class_id', '==', userData.class_id),
            where('date', '==', date)
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
    }, [userData, date]);

    return (
        <div className="daily-review-container">
            <div className="page-header">
                <div className="header-left">
                    <h1 className="page-title">Daily Review</h1>
                    <p className="page-subtitle">Track topics taught in your classes today.</p>
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
                    <p>Fetching lessons...</p>
                </div>
            ) : records.length === 0 ? (
                <div className="empty-topic-state">
                    <BookOpen size={48} className="empty-icon" />
                    <h3>No recorded lessons</h3>
                    <p>There are no lesson records for this date yet.</p>
                </div>
            ) : (
                <div className="topics-grid">
                    {records.map((record, index) => {
                        const isExpanded = expandedId === record.id;
                        const recordMaterials = materials[record.id] || [];
                        const notes = recordMaterials.filter(m => m.type === 'note');
                        const assignments = recordMaterials.filter(m => m.type === 'assignment');

                        return (
                            <div key={record.id} className={`topic-card ${isExpanded ? 'expanded' : ''}`} style={{ borderTop: `4px solid ${index % 2 === 0 ? '#BFDBFE' : '#D1FAE5'}` }}>
                                <div className="card-clickable" onClick={() => setExpandedId(isExpanded ? null : record.id)}>
                                    <div className="card-header-row">
                                        <div className="period-indicator">
                                            <Clock size={16} className="text-purple" />
                                            <span>Period {record.period}</span>
                                        </div>
                                        <div className="class-indicator">
                                            <BookOpen size={16} className="text-green" />
                                            <span>{record.subject_name || 'General Class'}</span>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} className="expand-chevron" /> : <ChevronDown size={20} className="expand-chevron" />}
                                    </div>

                                    <div className="topic-content-well">
                                        <span className="content-label">TOPIC TAUGHT:</span>
                                        <p className="topic-description">{record.topic || 'No topic details provided.'}</p>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="materials-expansion">
                                        <div className="materials-section">
                                            <div className="section-label-row">
                                                <FileText size={16} />
                                                <h4>STUDY NOTES</h4>
                                            </div>
                                            {notes.length === 0 ? (
                                                <p className="empty-mat-text">No notes provided for this topic.</p>
                                            ) : (
                                                <div className="mat-list">
                                                    {notes.map(note => (
                                                        <div key={note.id} className="mat-card">
                                                            {note.text && <p className="mat-text">{note.text}</p>}
                                                            {note.image_url && (
                                                                <img
                                                                    src={note.image_url}
                                                                    alt="Note material"
                                                                    className="mat-image"
                                                                    onClick={() => window.open(note.image_url, '_blank')}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="materials-section">
                                            <div className="section-label-row">
                                                <ClipboardList size={16} />
                                                <h4>ASSIGNMENTS</h4>
                                            </div>
                                            {assignments.length === 0 ? (
                                                <p className="empty-mat-text">No assignments for this topic.</p>
                                            ) : (
                                                <div className="mat-list">
                                                    {assignments.map(asgn => (
                                                        <div key={asgn.id} className="mat-card assignment">
                                                            {asgn.text && <p className="mat-text">{asgn.text}</p>}
                                                            {asgn.image_url && (
                                                                <img
                                                                    src={asgn.image_url}
                                                                    alt="Assignment material"
                                                                    className="mat-image"
                                                                    onClick={() => window.open(asgn.image_url, '_blank')}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="teacher-footer">
                                    <User size={14} className="user-icon" />
                                    <span>Taught by: {record.marked_by_name}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                .daily-review-container {
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

                .card-clickable {
                    cursor: pointer;
                }

                .card-header-row {
                    display: flex;
                    justify-content: flex-start;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1.25rem;
                }

                .expand-chevron {
                    margin-left: auto;
                    color: #94a3b8;
                }

                .period-indicator {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: #f5f3ff;
                    color: #8b5cf6;
                    padding: 0.3rem 0.75rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                .class-indicator {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #1e293b;
                    font-size: 0.9rem;
                    font-weight: 700;
                }

                .text-purple { color: #8b5cf6; }
                .text-green { color: #10b981; }

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
                    font-size: 0.95rem;
                    color: #334155;
                    font-weight: 500;
                    margin: 0;
                }

                .teacher-footer {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 0 0;
                    margin-top: 1.25rem;
                    border-top: 1px dashed #e2e8f0;
                    font-size: 0.75rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .materials-expansion {
                    margin-top: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }

                .materials-section h4 {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                    margin: 0;
                    letter-spacing: 0.5px;
                }

                .section-label-row {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    margin-bottom: 1rem;
                    color: #64748b;
                }

                .mat-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .mat-card {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 1rem;
                    border: 1px solid #e2e8f0;
                }

                .mat-card.assignment {
                    border-left: 4px solid #f97316;
                }

                .mat-text {
                    font-size: 0.9rem;
                    color: #334155;
                    margin: 0;
                    line-height: 1.5;
                    font-weight: 500;
                }

                .mat-image {
                    margin-top: 1rem;
                    max-width: 100%;
                    max-height: 300px;
                    border-radius: 8px;
                    object-fit: contain;
                    cursor: zoom-in;
                    border: 1px solid #e2e8f0;
                }

                .empty-mat-text {
                    font-size: 0.85rem;
                    color: #94a3b8;
                    font-style: italic;
                    margin: 0;
                }

                .user-icon { color: #cbd5e1; }

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

export default DailyReview;
