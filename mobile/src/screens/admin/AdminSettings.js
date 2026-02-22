import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Alert,
    Switch
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { doc, getDoc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { Save, Settings, Info, Clock, Calendar } from 'lucide-react-native';

const AdminSettings = () => {
    const { userData } = useAuth();
    const [settings, setSettings] = useState({
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        periods_per_day: 8,
        lunch_after_period: 4,
        study_hour_period: 8
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    useEffect(() => {
        const fetchSettings = async () => {
            if (!userData?.college_id) return;
            try {
                const collegeDoc = await getDoc(doc(db, 'colleges', userData.college_id));
                if (collegeDoc.exists() && collegeDoc.data().settings) {
                    setSettings(collegeDoc.data().settings);
                }
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchSettings();
    }, [userData]);

    const handleDayToggle = (day) => {
        const days = settings.working_days.includes(day)
            ? settings.working_days.filter(d => d !== day)
            : [...settings.working_days, day];
        setSettings({ ...settings, working_days: days });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const ttQ = query(collection(db, 'timetables'), where('college_id', '==', userData.college_id));
            const ttS = await getDocs(ttQ);
            if (!ttS.empty) {
                const proceed = await new Promise(res => {
                    Alert.alert("Caution", "Changing settings may invalidate the current timetable. Proceed?", [{ text: "Cancel", onPress: () => res(false) }, { text: "Yes", onPress: () => res(true) }]);
                });
                if (!proceed) { setSaving(false); return; }
            }
            await updateDoc(doc(db, 'colleges', userData.college_id), { settings });
            Alert.alert("Success", "Settings updated!");
        } catch (error) { console.error(error); }
        finally { setSaving(false); }
    };

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6366f1" /></View>;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Settings</Text>
                <Text style={styles.subTitle}>Configure academic schedule</Text>
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Calendar size={18} color="#6366f1" />
                    <Text style={styles.sectionTitle}>Working Days</Text>
                </View>
                <View style={styles.dayGrid}>
                    {allDays.map(day => (
                        <TouchableOpacity key={day} style={[styles.dayItem, settings.working_days.includes(day) && styles.dayActive]} onPress={() => handleDayToggle(day)}>
                            <Text style={[styles.dayText, settings.working_days.includes(day) && styles.dayTextActive]}>{day}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Clock size={16} color="#6366f1" />
                    <Text style={styles.sectionTitle}>Period Configuration</Text>
                </View>

                <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Periods Per Day</Text>
                    <TextInput style={styles.numInput} value={settings.periods_per_day.toString()} onChangeText={t => setSettings({ ...settings, periods_per_day: parseInt(t) || 0 })} keyboardType="numeric" />
                </View>

                <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Lunch After Period</Text>
                    <TextInput style={styles.numInput} value={settings.lunch_after_period.toString()} onChangeText={t => setSettings({ ...settings, lunch_after_period: parseInt(t) || 0 })} keyboardType="numeric" />
                </View>

                <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Study Hour Period</Text>
                    <TextInput style={styles.numInput} value={settings.study_hour_period.toString()} onChangeText={t => setSettings({ ...settings, study_hour_period: parseInt(t) || 0 })} keyboardType="numeric" />
                </View>

                <View style={styles.infoBox}>
                    <Info size={14} color="#64748b" />
                    <Text style={styles.infoText}>These settings define the timetable generator's boundaries.</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : (
                    <View style={styles.btnContent}><Save size={18} color="#fff" /><Text style={styles.saveBtnText}>Save Settings</Text></View>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    section: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 20, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
    dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dayItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
    dayActive: { backgroundColor: '#6366f1' },
    dayText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
    dayTextActive: { color: '#fff' },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    inputLabel: { fontSize: 14, color: '#475569' },
    numInput: { backgroundColor: '#f8fafc', width: 60, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', textAlign: 'center', fontWeight: 'bold' },
    infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, marginTop: 4 },
    infoText: { flex: 1, fontSize: 11, color: '#64748b' },
    saveBtn: { backgroundColor: '#6366f1', margin: 20, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default AdminSettings;
