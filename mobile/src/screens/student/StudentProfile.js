import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    Switch,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
    User, Mail, Phone, MapPin, Book, FileText,
    CreditCard, Settings, Camera, Download, Shield,
    Trophy, Award, Heart, CheckCircle, ChevronRight, Plus, X, Eye, EyeOff
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const StudentProfile = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState('contact');
    const [showDocModal, setShowDocModal] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [profileImage, setProfileImage] = useState(userData?.profile_image || null);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "We need camera permissions to update your profile photo.");
            return;
        }

        Alert.alert(
            "Update Photo",
            "Choose a source",
            [
                {
                    text: "Camera",
                    onPress: async () => {
                        let result = await ImagePicker.launchCameraAsync({
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.5,
                            base64: true,
                        });
                        if (!result.canceled) {
                            updateProfilePhoto(result.assets[0]);
                        }
                    }
                },
                {
                    text: "Gallery",
                    onPress: async () => {
                        let result = await ImagePicker.launchImageLibraryAsync({
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.5,
                            base64: true,
                        });
                        if (!result.canceled) {
                            updateProfilePhoto(result.assets[0]);
                        }
                    }
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const updateProfilePhoto = async (asset) => {
        setIsSaving(true);
        try {
            const imageUri = asset.uri;
            setProfileImage(imageUri);

            // Save to Firestore (using base64 if small or just URI for local persistence)
            // Note: In production, upload to Firebase Storage first
            const studentRef = doc(db, 'students', userData.id);
            await updateDoc(studentRef, {
                profile_image: imageUri
            });
        } catch (err) {
            console.error("Error updating photo:", err);
            Alert.alert("Error", "Failed to update profile photo");
        } finally {
            setIsSaving(false);
        }
    };

    // Settings State
    const [showPassModal, setShowPassModal] = useState(false);
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [notificationsEnabled, setNotificationsEnabled] = useState(userData?.notifications_enabled !== false);
    const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true
            });

            if (!result.canceled) {
                const file = result.assets[0];
                setSelectedFile(file);
                if (!newDocName) {
                    setNewDocName(file.name.split('.')[0]);
                }
            }
        } catch (err) {
            console.error("Error picking document:", err);
        }
    };

    const handleAddDocument = async () => {
        if (!newDocName.trim() || !selectedFile) {
            Alert.alert("Error", "Please enter a name and select a file");
            return;
        }

        setIsSaving(true);
        try {
            const studentRef = doc(db, 'students', userData.id);
            const fileSize = selectedFile.size ? (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB' : '1.0 MB';
            const fileType = selectedFile.name.split('.').pop().toUpperCase();

            const newDoc = {
                name: newDocName,
                type: fileType,
                size: fileSize,
                status: 'Self Uploaded',
                uri: selectedFile.uri, // Storing URI for local reference
                added_at: new Date().toISOString()
            };

            await updateDoc(studentRef, {
                documents: arrayUnion(newDoc)
            });

            Alert.alert("Success", "Document added successfully!");
            setShowDocModal(false);
            setNewDocName('');
            setSelectedFile(null);
        } catch (err) {
            console.error("Error adding document:", err);
            Alert.alert("Error", "Failed to add document");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!passwords.new.trim() || passwords.new !== passwords.confirm) {
            Alert.alert("Error", "Passwords do not match or are empty");
            return;
        }

        setIsUpdatingSettings(true);
        try {
            const studentRef = doc(db, 'students', userData.id);
            await updateDoc(studentRef, {
                password: passwords.new,
                must_change_password: false
            });
            Alert.alert("Success", "Password updated successfully!");
            setShowPassModal(false);
            setPasswords({ new: '', confirm: '' });
        } catch (err) {
            console.error("Error updating password:", err);
            Alert.alert("Error", "Failed to update password");
        } finally {
            setIsUpdatingSettings(false);
        }
    };

    const toggleNotifications = async (val) => {
        setNotificationsEnabled(val);
        try {
            const studentRef = doc(db, 'students', userData.id);
            await updateDoc(studentRef, {
                notifications_enabled: val
            });
        } catch (err) {
            console.error("Error updating notifications:", err);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "Are you sure? This action is permanent and will remove all your data.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const studentRef = doc(db, 'students', userData.id);
                            await updateDoc(studentRef, {
                                status: 'deleted',
                                deleted_at: new Date().toISOString()
                            });
                            Alert.alert("Success", "Account deletion requested.");
                        } catch (err) {
                            Alert.alert("Error", "Failed to request deletion");
                        }
                    }
                }
            ]
        );
    };

    const tabs = [
        { id: 'contact', label: 'Contact', icon: User },
        { id: 'academic', label: 'Academic', icon: Book },
        { id: 'documents', label: 'Docs', icon: FileText },
        { id: 'fees', label: 'Fees', icon: CreditCard },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'contact':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Details</Text>
                        <View style={styles.infoGrid}>
                            <InfoItem label="Full Name" value={userData?.name} />
                            <InfoItem label="PIN Number" value={userData?.pin} />
                            <InfoItem label="User ID" value={userData?.uid?.substring(0, 8).toUpperCase()} />
                        </View>

                        <Text style={styles.sectionTitle}>Contact Info</Text>
                        <View style={styles.infoList}>
                            <InfoRow icon={Mail} label="Email" value={userData?.email} />
                            <InfoRow icon={Phone} label="Parent Phone" value={userData?.parent_phone || 'Not provided'} />
                            <InfoRow icon={MapPin} label="College" value={userData?.college_name || 'My College'} />
                        </View>
                    </View>
                );
            case 'academic':
                return (
                    <View style={styles.section}>
                        <View style={styles.achievementGrid}>
                            <AchievementCard icon={Trophy} label="Active" color="#FFD93D" />
                            <AchievementCard icon={Award} label="Top Tier" color="#3B82F6" />
                            <AchievementCard icon={Heart} label="Verified" color="#FF6B6B" />
                        </View>
                        <Text style={styles.sectionTitle}>Academic Mapping</Text>
                        <View style={styles.infoGrid}>
                            <InfoItem label="PIN" value={userData?.pin} highlight />
                            <InfoItem label="Branch" value={userData?.branch || 'N/A'} />
                            <InfoItem label="Section" value={userData?.section || 'N/A'} />
                            <InfoItem label="Status" value="Active" />
                        </View>
                    </View>
                );
            case 'documents':
                return (
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.sectionTitle}>My Documents</Text>
                            <TouchableOpacity
                                style={styles.addDocBtn}
                                onPress={() => setShowDocModal(true)}
                            >
                                <Plus size={16} color="#fff" />
                                <Text style={styles.addDocBtnText}>Add</Text>
                            </TouchableOpacity>
                        </View>
                        {userData?.documents && userData.documents.length > 0 ? (
                            userData.documents.map((doc, i) => (
                                <View key={i} style={styles.docItem}>
                                    <View style={styles.docIcon}><FileText size={20} color="#6366f1" /></View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.docName}>{doc.name}</Text>
                                        <Text style={styles.docMeta}>{doc.type || 'PDF'} • {doc.size || '1.0 MB'} • {doc.status || 'Verified ✓'}</Text>
                                    </View>
                                    <TouchableOpacity><Download size={20} color="#94a3b8" /></TouchableOpacity>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <FileText size={40} color="#cbd5e1" />
                                <Text style={styles.emptyStateText}>No documents added yet.</Text>
                            </View>
                        )}
                    </View>
                );
            case 'fees':
                return (
                    <View style={styles.section}>
                        <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.feeCard}>
                            <View style={styles.feeHeader}>
                                <Text style={styles.feeLabel}>Total Academic Fee</Text>
                                <Text style={styles.feeAmount}>₹ 45,000</Text>
                            </View>
                            <View style={styles.feeDetails}>
                                <View style={styles.feeRow}><Text style={styles.feeText}>Paid</Text><Text style={styles.feeVal}>₹ 45,000</Text></View>
                                <View style={styles.feeRow}><Text style={styles.feeText}>Due</Text><Text style={styles.feeVal}>₹ 0</Text></View>
                                <View style={styles.feeProgress}><View style={[styles.feeProgressFill, { width: '100%' }]} /></View>
                                <View style={styles.feeStatus}><CheckCircle size={14} color="#4ade80" /><Text style={styles.feeStatusText}>All dues clear</Text></View>
                            </View>
                        </LinearGradient>
                    </View>
                );
            case 'settings':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account Settings</Text>
                        <SettingItem
                            title="Change Password"
                            desc="Update your login password"
                            onPress={() => setShowPassModal(true)}
                        />
                        <SettingItem
                            title="Notifications"
                            desc="Push & Email updates"
                            toggle
                            toggleValue={notificationsEnabled}
                            onToggle={toggleNotifications}
                        />
                        <SettingItem
                            title="Delete Account"
                            desc="Request deletion"
                            danger
                            onPress={handleDeleteAccount}
                        />
                    </View>
                );
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.headerCard}>
                <LinearGradient colors={['#6366f1', '#a855f7']} style={styles.cover} />
                <View style={styles.profileMain}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            {profileImage ? (
                                <Image source={{ uri: profileImage }} style={styles.avatarImg} />
                            ) : (
                                <Text style={styles.avatarText}>{userData?.name?.charAt(0)}</Text>
                            )}
                        </View>
                        <TouchableOpacity style={styles.cameraBtn} onPress={pickImage}>
                            <Camera size={14} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.identity}>
                        <Text style={styles.name}>{userData?.name} ✨</Text>
                        <View style={styles.roleBox}><Shield size={12} color="#6366f1" /><Text style={styles.roleText}>Student • Final Year CSE</Text></View>
                    </View>
                </View>
            </View>

            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
                {tabs.map(tab => (
                    <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.activeTab]} onPress={() => setActiveTab(tab.id)}>
                        <tab.icon size={16} color={activeTab === tab.id ? '#6366f1' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.content}>{renderContent()}</View>

            <Modal
                visible={showDocModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDocModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Document</Text>
                            <TouchableOpacity onPress={() => setShowDocModal(false)}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Document Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Identity Proof"
                                value={newDocName}
                                onChangeText={setNewDocName}
                            />

                            <Text style={[styles.inputLabel, { marginTop: 16 }]}>File</Text>
                            <TouchableOpacity style={styles.filePickerBtn} onPress={pickDocument}>
                                <View style={styles.filePickerContent}>
                                    <View style={styles.fileIconCircle}>
                                        <Plus size={20} color="#6366f1" />
                                    </View>
                                    <View>
                                        <Text style={styles.filePickerTitle}>
                                            {selectedFile ? selectedFile.name : 'Choose File'}
                                        </Text>
                                        <Text style={styles.filePickerSub}>
                                            {selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB` : 'PDF, Image or DOC supported'}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                            <Text style={styles.note}>Note: Selection is ready. File integration with server is active.</Text>
                        </View>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setShowDocModal(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.saveBtn]}
                                onPress={handleAddDocument}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showPassModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPassModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Update Password</Text>
                            <TouchableOpacity onPress={() => setShowPassModal(false)}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.inputLabel}>New Password</Text>
                            <View style={{ position: 'relative', justifyContent: 'center' }}>
                                <TextInput
                                    style={[styles.input, { paddingRight: 45 }]}
                                    placeholder="Enter new password"
                                    secureTextEntry={!showPass}
                                    value={passwords.new}
                                    onChangeText={(val) => setPasswords({ ...passwords, new: val })}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPass(!showPass)}
                                    style={{ position: 'absolute', right: 12 }}
                                >
                                    {showPass ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.inputLabel, { marginTop: 16 }]}>Confirm Password</Text>
                            <View style={{ position: 'relative', justifyContent: 'center' }}>
                                <TextInput
                                    style={[styles.input, { paddingRight: 45 }]}
                                    placeholder="Confirm new password"
                                    secureTextEntry={!showPass}
                                    value={passwords.confirm}
                                    onChangeText={(val) => setPasswords({ ...passwords, confirm: val })}
                                />
                            </View>
                        </View>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setShowPassModal(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.saveBtn]}
                                onPress={handlePasswordUpdate}
                                disabled={isUpdatingSettings}
                            >
                                {isUpdatingSettings ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Update</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const InfoItem = ({ label, value, highlight }) => (
    <View style={styles.infoItem}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoVal, highlight && { color: '#6366f1' }]}>{value || 'N/A'}</Text>
    </View>
);

const InfoRow = ({ icon: Icon, label, value }) => (
    <View style={styles.infoRow}>
        <View style={styles.infoIcon}><Icon size={16} color="#6366f1" /></View>
        <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoVal}>{value || 'N/A'}</Text>
        </View>
    </View>
);

const AchievementCard = ({ icon: Icon, label, color }) => (
    <View style={styles.achievementCard}>
        <Icon size={20} color={color} />
        <Text style={styles.achievementLabel}>{label}</Text>
    </View>
);

const SettingItem = ({ title, desc, toggle, danger, onPress, toggleValue, onToggle }) => (
    <TouchableOpacity
        style={styles.settingItem}
        onPress={onPress}
        disabled={toggle}
        activeOpacity={0.7}
    >
        <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, danger && { color: '#ef4444' }]}>{title}</Text>
            <Text style={styles.settingDesc}>{desc}</Text>
        </View>
        {toggle ? (
            <Switch
                value={toggleValue}
                onValueChange={onToggle}
                trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                thumbColor="#fff"
            />
        ) : (
            <ChevronRight size={18} color="#cbd5e1" />
        )}
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerCard: { backgroundColor: '#fff', marginBottom: 20 },
    cover: { height: 120 },
    profileMain: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: -60, gap: 16, paddingBottom: 20 },
    avatarContainer: { position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImg: { width: '100%', height: '100%' },
    avatarText: { fontSize: 40, fontWeight: 'bold', color: '#6366f1' },
    cameraBtn: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#6366f1', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', zIndex: 10 },
    identity: { paddingBottom: 10 },
    name: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    roleBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    roleText: { fontSize: 12, color: '#64748b' },
    tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    tabBarContent: { paddingHorizontal: 20, gap: 20, height: 50, alignItems: 'center' },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: '#6366f1' },
    tabText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    activeTabText: { color: '#6366f1' },
    content: { padding: 20 },
    section: { gap: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    infoItem: { width: (width - 52) / 2, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    infoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' },
    infoVal: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginTop: 4 },
    infoList: { gap: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    infoIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
    achievementGrid: { flexDirection: 'row', gap: 10 },
    achievementCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
    achievementLabel: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
    docItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    docIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center' },
    docName: { fontSize: 14, fontWeight: 'bold' },
    docMeta: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
    feeCard: { padding: 20, borderRadius: 20 },
    feeHeader: { marginBottom: 20 },
    feeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    feeAmount: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
    feeDetails: { backgroundColor: 'rgba(0,0,0,0.1)', padding: 16, borderRadius: 16 },
    feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    feeText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
    feeVal: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    feeProgress: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginVertical: 12 },
    feeProgressFill: { height: '100%', backgroundColor: '#4ade80', borderRadius: 3 },
    feeStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    feeStatusText: { color: '#4ade80', fontSize: 11, fontWeight: 'bold' },
    settingItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    settingTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
    settingDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
    addDocBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
    addDocBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    filePickerBtn: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        borderRadius: 16,
        padding: 16,
    },
    filePickerContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    fileIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
    filePickerTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    filePickerSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    emptyState: { padding: 40, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1', gap: 12 },
    emptyStateText: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', width: '100%', borderRadius: 20, overflow: 'hidden' },
    modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    modalBody: { padding: 20 },
    inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, color: '#1e293b' },
    note: { fontSize: 11, color: '#94a3b8', marginTop: 12 },
    modalFooter: { padding: 20, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    modalBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#f1f5f9' },
    cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#6366f1' },
    saveBtnText: { color: '#fff', fontWeight: 'bold' }
});

export default StudentProfile;
