import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    Switch
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
    User, Mail, Phone, MapPin, Book, FileText,
    CreditCard, Settings, Camera, Download, Shield,
    Trophy, Award, Heart, CheckCircle, ChevronRight
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const StudentProfile = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState('contact');

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
                        <Text style={styles.sectionTitle}>My Documents</Text>
                        {['Aadhar Card', 'SSC Marksheet', 'Bonafide Certificate'].map((doc, i) => (
                            <View key={i} style={styles.docItem}>
                                <View style={styles.docIcon}><FileText size={20} color="#6366f1" /></View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.docName}>{doc}</Text>
                                    <Text style={styles.docMeta}>PDF • 2.5 MB • Verified ✓</Text>
                                </View>
                                <TouchableOpacity><Download size={20} color="#94a3b8" /></TouchableOpacity>
                            </View>
                        ))}
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
                        <SettingItem title="Change Password" desc="Update your login password" />
                        <SettingItem title="Notifications" desc="Push & Email updates" toggle />
                        <SettingItem title="Delete Account" desc="Request deletion" danger />
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
                        <View style={styles.avatar}><Text style={styles.avatarText}>{userData?.name?.charAt(0)}</Text></View>
                        <TouchableOpacity style={styles.cameraBtn}><Camera size={14} color="#fff" /></TouchableOpacity>
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

const SettingItem = ({ title, desc, toggle, danger }) => (
    <View style={styles.settingItem}>
        <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, danger && { color: '#ef4444' }]}>{title}</Text>
            <Text style={styles.settingDesc}>{desc}</Text>
        </View>
        {toggle ? <Switch value={true} trackColor={{ false: '#e2e8f0', true: '#10b981' }} thumbColor="#fff" /> : <ChevronRight size={18} color="#cbd5e1" />}
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerCard: { backgroundColor: '#fff', marginBottom: 20 },
    cover: { height: 120 },
    profileMain: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: -60, gap: 16, paddingBottom: 20 },
    avatarContainer: { position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 40, fontWeight: 'bold', color: '#6366f1' },
    cameraBtn: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#6366f1', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
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
    settingDesc: { fontSize: 11, color: '#64748b', marginTop: 2 }
});

export default StudentProfile;
