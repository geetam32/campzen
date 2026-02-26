import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import {
    User, Mail, Phone, MapPin, Book, FileText,
    CreditCard, Settings, Camera, Download, Shield,
    Trophy, Award, Heart, CheckCircle, Plus, X, Eye, EyeOff
} from 'lucide-react';

const StudentProfile = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState('contact');
    const [showDocModal, setShowDocModal] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Settings State
    const [showPassModal, setShowPassModal] = useState(false);
    const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
    const [notificationsEnabled, setNotificationsEnabled] = useState(userData?.notifications_enabled !== false);
    const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            alert("Passwords do not match!");
            return;
        }

        setIsUpdatingSettings(true);
        try {
            const studentRef = doc(db, 'students', userData.id);
            await updateDoc(studentRef, {
                password: passwords.new,
                must_change_password: false
            });
            alert("Password updated successfully!");
            setShowPassModal(false);
            setPasswords({ old: '', new: '', confirm: '' });
        } catch (err) {
            console.error("Error updating password:", err);
            alert("Failed to update password.");
        } finally {
            setIsUpdatingSettings(false);
        }
    };

    const toggleNotifications = async () => {
        const newValue = !notificationsEnabled;
        setNotificationsEnabled(newValue);
        try {
            const studentRef = doc(db, 'students', userData.id);
            await updateDoc(studentRef, {
                notifications_enabled: newValue
            });
        } catch (err) {
            console.error("Error updating notifications:", err);
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm("Are you sure you want to delete your account? This action is IRREVERSIBLE and will remove all your academic data.");
        if (confirmed) {
            try {
                const studentRef = doc(db, 'students', userData.id);
                await updateDoc(studentRef, {
                    status: 'deleted',
                    deleted_at: new Date().toISOString()
                });
                alert("Account deletion requested. You will be logged out.");
                window.location.reload(); // Simple way to reset state
            } catch (err) {
                console.error("Error deleting account:", err);
                alert("Failed to request account deletion.");
            }
        }
    };

    const handleAddDocument = async (e) => {
        e.preventDefault();
        if (!newDocName.trim()) return;

        setIsSaving(true);
        try {
            const studentRef = doc(db, 'students', userData.id);
            const newDoc = {
                name: newDocName,
                type: 'PDF',
                size: (Math.random() * 5 + 1).toFixed(1) + ' MB',
                status: 'Self Uploaded',
                added_at: new Date().toISOString()
            };

            await updateDoc(studentRef, {
                documents: arrayUnion(newDoc)
            });

            // Note: In a real app, we'd want to refresh userData. 
            // Since AuthContext listens to onAuthStateChanged, and we didn't update the auth user but the firestore doc,
            // we might need to manually trigger a refresh or wait for the next fetch.
            // For now, let's assume userData updates or we'll suggest a refresh.

            alert('Document added successfully!');
            setShowDocModal(false);
            setNewDocName('');
        } catch (err) {
            console.error("Error adding document:", err);
            alert("Failed to add document.");
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'contact', label: 'Contact Info', icon: User },
        { id: 'academic', label: 'Academic Info', icon: Book },
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'fees', label: 'Fee Details', icon: CreditCard },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'contact':
                return (
                    <div className="profile-section fade-in">
                        <h3 className="section-title">Personal Details</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Full Name</label>
                                <div className="info-value">{userData?.name || 'N/A'}</div>
                            </div>
                            <div className="info-item">
                                <label>Date of Birth</label>
                                <div className="info-value">01 Jan 2005</div>
                            </div>
                            <div className="info-item">
                                <label>Gender</label>
                                <div className="info-value">Male</div>
                            </div>
                            <div className="info-item">
                                <label>Blood Group</label>
                                <div className="info-value">O+</div>
                            </div>
                        </div>

                        <h3 className="section-title" style={{ marginTop: '2rem' }}>Contact Information</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Email Address</label>
                                <div className="info-value flx"><Mail size={16} color="var(--accent-primary)" /> {userData?.email || 'N/A'}</div>
                            </div>
                            <div className="info-item">
                                <label>Phone Number</label>
                                <div className="info-value flx"><Phone size={16} color="var(--accent-primary)" /> +91 98765 43210</div>
                            </div>
                            <div className="info-item full-width">
                                <label>Permanent Address</label>
                                <div className="info-value flx"><MapPin size={16} color="var(--accent-primary)" /> 123, Student Lane, Tech City, State - 500001</div>
                            </div>
                        </div>
                    </div>
                );
            case 'academic':
                return (
                    <div className="profile-section fade-in">
                        <div className="achievement-grid" style={{ marginBottom: '2rem' }}>
                            <div className="achievement-card">
                                <Trophy size={24} color="#FFD93D" />
                                <div>Rank #12</div>
                            </div>
                            <div className="achievement-card">
                                <Award size={24} color="#3B82F6" />
                                <div>Best Project</div>
                            </div>
                            <div className="achievement-card">
                                <Heart size={24} color="#FF6B6B" />
                                <div>Active Member</div>
                            </div>
                        </div>
                        <h3 className="section-title">Academic Record</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Student PIN</label>
                                <div className="info-value highlight">{userData?.pin || 'N/A'}</div>
                            </div>
                            <div className="info-item">
                                <label>Branch</label>
                                <div className="info-value">CSE</div>
                            </div>
                            <div className="info-item">
                                <label>Semester</label>
                                <div className="info-value">6th Semester</div>
                            </div>
                            <div className="info-item">
                                <label>Batch</label>
                                <div className="info-value">2023 - 2026</div>
                            </div>
                        </div>
                    </div>
                );
            case 'documents':
                return (
                    <div className="profile-section fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 className="section-title" style={{ margin: 0 }}>My Documents</h3>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => setShowDocModal(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Plus size={16} /> Add Document
                            </button>
                        </div>
                        <div className="documents-list">
                            {userData?.documents && userData.documents.length > 0 ? (
                                userData.documents.map((doc, i) => (
                                    <div key={i} className="document-item-enhanced">
                                        <div className="doc-icon"><FileText size={24} /></div>
                                        <div className="doc-info">
                                            <div className="doc-name">{doc.name}</div>
                                            <div className="doc-meta">{doc.type || 'PDF'} • {doc.size || '0.5 MB'} • {doc.status || 'Self Uploaded'} ✓</div>
                                        </div>
                                        <button className="btn btn-icon btn-secondary"><Download size={18} /></button>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                                    No documents added yet. Click 'Add Document' to get started.
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'fees':
                return (
                    <div className="profile-section fade-in">
                        <div className="fee-card-modern">
                            <div className="fee-status-badge">Payment Up-to-date</div>
                            <div className="fee-header">
                                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Total Academic Fee</div>
                                <div className="amount">₹ 45,000</div>
                            </div>
                            <div className="fee-body">
                                <div className="fee-row">
                                    <span>Paid Amount</span>
                                    <span style={{ fontWeight: 700, color: 'var(--accent-success)' }}>₹ 45,000</span>
                                </div>
                                <div className="fee-row">
                                    <span>Pending Due</span>
                                    <span>₹ 0</span>
                                </div>
                                <div className="progress-bar-bg" style={{ marginTop: '1.5rem', height: '8px' }}>
                                    <div className="progress-bar-fill" style={{ width: '100%', background: 'var(--accent-success)' }}></div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-success)', fontSize: '0.8rem', marginTop: '1rem', justifyContent: 'center' }}>
                                    <CheckCircle size={16} /> All dues clear for this semester
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'settings':
                return (
                    <div className="profile-section fade-in">
                        <h3 className="section-title">Account Settings</h3>
                        <div className="settings-list">
                            <div className="setting-item-modern">
                                <div className="setting-info">
                                    <div className="setting-label">Change Password</div>
                                    <div className="setting-desc">Update your login password regularly</div>
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowPassModal(true)}>Update</button>
                            </div>
                            <div className="setting-item-modern">
                                <div className="setting-info">
                                    <div className="setting-label">Email Notifications</div>
                                    <div className="setting-desc">Receive updates via {userData?.email}</div>
                                </div>
                                <div
                                    className={`toggle-switch ${notificationsEnabled ? 'active' : ''}`}
                                    onClick={toggleNotifications}
                                ></div>
                            </div>
                            <div className="setting-item-modern">
                                <div className="setting-info">
                                    <div className="setting-label danger">Danger Zone</div>
                                    <div className="setting-desc">Request account deletion</div>
                                </div>
                                <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount}>Delete Account</button>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="profile-page page-transition-enter">
            <div className="profile-header-card">
                <div className="profile-cover"></div>
                <div className="profile-main">
                    <div className="profile-avatar">
                        <div className="avatar-placeholder">
                            {userData?.name?.charAt(0) || 'S'}
                        </div>
                        <button className="edit-avatar-btn"><Camera size={14} /></button>
                    </div>
                    <div className="profile-identity">
                        <h1 className="profile-name">{userData?.name} ✨</h1>
                        <div className="profile-role">
                            <Shield size={14} color="var(--accent-primary)" /> Student • Final Year CSE
                        </div>
                    </div>
                </div>
            </div>

            <div className="profile-container">
                <div className="profile-sidebar">
                    <div className="sidebar-menu">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`sidebar-item-enhanced ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <div className="sidebar-icon">
                                    <tab.icon size={18} />
                                </div>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="profile-content card">
                    {renderContent()}
                </div>
            </div>

            {showDocModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Document</h3>
                            <button className="modal-close" onClick={() => setShowDocModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddDocument}>
                            <div className="modal-body" style={{ padding: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Document Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. Identity Proof"
                                        required
                                        value={newDocName}
                                        onChange={(e) => setNewDocName(e.target.value)}
                                    />
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Note: Documents are currently added as placeholders. Real file upload integration pending Storage setup.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowDocModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                    {isSaving ? 'Adding...' : 'Add Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPassModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Update Password</h3>
                            <button className="modal-close" onClick={() => setShowPassModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handlePasswordUpdate}>
                            <div className="modal-body" style={{ padding: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPass ? "text" : "password"}
                                            className="form-input"
                                            required
                                            value={passwords.new}
                                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                            style={{ paddingRight: '40px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                        >
                                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label className="form-label">Confirm Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPass ? "text" : "password"}
                                            className="form-input"
                                            required
                                            value={passwords.confirm}
                                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                            style={{ paddingRight: '40px' }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPassModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isUpdatingSettings}>
                                    {isUpdatingSettings ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .profile-header-card {
                    background-color: var(--bg-card);
                    border-radius: var(--border-radius-lg);
                    border: 1px solid var(--border-color);
                    margin-bottom: 2rem;
                    overflow: hidden;
                    position: relative;
                }
                .profile-cover {
                    height: 120px;
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
                    opacity: 0.9;
                }
                .profile-main {
                    padding: 0 2rem 1.5rem 2rem;
                    display: flex;
                    align-items: flex-end;
                    gap: 1.5rem;
                    margin-top: -60px;
                }
                .profile-avatar {
                    position: relative;
                    width: 120px;
                    height: 120px;
                    border: 4px solid var(--bg-card);
                    border-radius: 50%;
                    background: var(--bg-secondary);
                    box-shadow: var(--shadow-md);
                }
                .avatar-placeholder {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    font-weight: 700;
                    color: var(--accent-primary);
                    background-color: var(--bg-tertiary);
                }
                .edit-avatar-btn {
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border: 2px solid var(--bg-card);
                }
                .profile-name {
                    font-size: 1.75rem;
                    margin-bottom: 0.25rem;
                    font-weight: 800;
                }
                .profile-role {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-muted);
                    font-size: 0.9rem;
                }
                .profile-container {
                    display: grid;
                    grid-template-columns: 250px 1fr;
                    gap: 2rem;
                }
                .sidebar-item-enhanced {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    width: 100%;
                    padding: 1rem;
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: 12px;
                    transition: all 0.3s;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }
                .sidebar-item-enhanced:hover {
                    background: var(--bg-tertiary);
                    transform: translateX(4px);
                    color: var(--text-primary);
                }
                .sidebar-item-enhanced.active {
                    background: rgba(124, 58, 237, 0.1);
                    color: var(--accent-primary);
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.05);
                }
                .profile-content {
                    padding: 2rem;
                    min-height: 450px;
                }
                .achievement-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                }
                .achievement-card {
                    background: var(--bg-tertiary);
                    padding: 1rem;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 700;
                    font-size: 0.8rem;
                    border: 1px solid var(--border-color);
                    transition: all 0.3s;
                }
                .achievement-card:hover {
                    transform: scale(1.05);
                    background: white;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                }
                .info-item label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-bottom: 0.25rem;
                    font-weight: 600;
                }
                .info-value {
                    font-size: 1rem;
                    color: var(--text-primary);
                    font-weight: 700;
                }
                .info-value.flx {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .document-item-enhanced {
                    display: flex;
                    align-items: center;
                    padding: 1rem;
                    background: var(--bg-tertiary);
                    border-radius: 12px;
                    margin-bottom: 1rem;
                    transition: all 0.2s;
                }
                .document-item-enhanced:hover {
                    background: var(--bg-secondary);
                    transform: scale(1.01);
                    box-shadow: var(--shadow-sm);
                }
                .fee-card-modern {
                    background: linear-gradient(135deg, #7C3AED, #4F46E5);
                    padding: 2.5rem 2rem;
                    border-radius: 24px;
                    color: white;
                    max-width: 450px;
                    margin: 0 auto;
                    position: relative;
                    box-shadow: 0 20px 40px -10px rgba(124, 58, 237, 0.4);
                }
                .fee-status-badge {
                    position: absolute;
                    top: 20px; right: 20px;
                    background: rgba(255, 255, 255, 0.2);
                    padding: 4px 12px;
                    border-radius: 99px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }
                .fee-header .amount {
                    font-size: 3rem;
                    font-weight: 800;
                    margin-top: 0.5rem;
                }
                .fee-body {
                    margin-top: 2rem;
                    background: rgba(0, 0, 0, 0.1);
                    padding: 1.5rem;
                    border-radius: 16px;
                }
                .fee-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                }
                .setting-item-modern {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem;
                    background: var(--bg-tertiary);
                    border-radius: 12px;
                    margin-bottom: 1rem;
                }
                .toggle-switch {
                    width: 44px;
                    height: 24px;
                    background: #CBD5E1;
                    border-radius: 99px;
                    position: relative;
                    cursor: pointer;
                }
                .toggle-switch::after {
                    content: '';
                    position: absolute;
                    top: 2px; left: 2px;
                    width: 20px; height: 20px;
                    background: white;
                    border-radius: 50%;
                    transition: all 0.3s;
                }
                .toggle-switch.active {
                    background: var(--accent-success);
                }
                .toggle-switch.active::after {
                    transform: translateX(20px);
                }

                @media (max-width: 768px) {
                    .profile-container {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default StudentProfile;
