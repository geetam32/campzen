import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Linking,
    FlatList
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FileText, Download, Search, Book, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const StudentMaterials = () => {
    const { userData } = useAuth();
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        if (!userData?.college_id || !userData?.class_id) return;
        setLoading(true);
        try {
            const qM = query(collection(db, 'materials'),
                where('college_id', '==', userData.college_id),
                where('class_id', '==', userData.class_id));
            const snap = await getDocs(qM);
            setMaterials(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [userData]);

    const filtered = materials.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: item.file_type === 'pdf' ? '#fee2e2' : '#e0f2fe' }]}>
                <FileText size={24} color={item.file_type === 'pdf' ? '#ef4444' : '#0ea5e9'} />
            </View>
            <View style={styles.cardInfo}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subject}>{item.subject}</Text>
                {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.cardFooter}>
                    <View style={styles.typeBadge}><Text style={styles.typeText}>{item.file_type?.toUpperCase()}</Text></View>
                    <TouchableOpacity style={styles.downBtn} onPress={() => Linking.openURL(item.file_url)}>
                        <Download size={14} color="#6366f1" />
                        <Text style={styles.downText}>Access</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Study Materials</Text>
                <Text style={styles.subTitle}>Download lecture notes and resources</Text>
            </View>

            <View style={styles.searchBar}>
                <Search size={18} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by title or subject..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
            </View>

            {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<View style={styles.empty}><Book size={48} color="#cbd5e1" /><Text style={styles.emptyText}>No materials found</Text></View>}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subTitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#1e293b' },
    list: { padding: 20, paddingTop: 0 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#e2e8f0' },
    iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardInfo: { flex: 1, marginLeft: 16 },
    title: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    subject: { fontSize: 12, color: '#6366f1', fontWeight: 'bold', marginTop: 2 },
    desc: { fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 18 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    typeBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    typeText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
    downBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    downText: { fontSize: 13, fontWeight: 'bold', color: '#6366f1' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94a3b8', fontSize: 16, marginTop: 12 }
});

export default StudentMaterials;
