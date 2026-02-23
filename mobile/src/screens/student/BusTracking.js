import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Platform,
    TextInput,
    ScrollView,
    FlatList
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { db } from '../../api/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
    Search,
    Bus,
    ArrowLeft,
    Navigation,
    Target,
    Info,
    MapPin,
    Clock
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

const BusTracking = ({ navigation }) => {
    const { userData } = useAuth();
    const [buses, setBuses] = useState([]);
    const [filteredBuses, setFilteredBuses] = useState([]);
    const [selectedBus, setSelectedBus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [mapRegion, setMapRegion] = useState(null);

    useEffect(() => {
        if (!userData?.college_id) return;

        // Listen to all buses for this college
        // For simplicity, we assume bus location docs are in a collection 'bus_locations'
        // where each doc has college_id field.
        const q = query(
            collection(db, 'bus_locations'),
            where('college_id', '==', userData.college_id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                lastUpdated: doc.data().last_updated?.toDate() || new Date()
            }));

            setBuses(list);
            setFilteredBuses(list);

            if (list.length > 0 && !mapRegion) {
                // Focus on first active bus or just first bus
                const focus = list.find(b => b.status === 'active') || list[0];
                setMapRegion({
                    latitude: focus.latitude,
                    longitude: focus.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                });
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching bus locations:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData]);

    useEffect(() => {
        const filtered = buses.filter(bus =>
            bus.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bus.route?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bus.driver_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredBuses(filtered);
    }, [searchQuery, buses]);

    const centerMapOnBus = (bus) => {
        setSelectedBus(bus);
        setMapRegion({
            latitude: bus.latitude,
            longitude: bus.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        });
    };

    const renderBusCard = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.busCard,
                selectedBus?.id === item.id && styles.selectedBusCard,
                item.status !== 'active' && styles.inactiveBusCard
            ]}
            onPress={() => centerMapOnBus(item)}
        >
            <View style={[styles.busIconCircle, { backgroundColor: item.status === 'active' ? '#f0fdf4' : '#f8fafc' }]}>
                <Bus size={20} color={item.status === 'active' ? '#10b981' : '#94a3b8'} />
            </View>
            <View style={styles.busCardInfo}>
                <Text style={styles.busCardId}>Bus #{item.id}</Text>
                <Text style={styles.busCardSub} numberOfLines={1}>{item.route} • {item.driver_name || 'Driver'}</Text>
            </View>
            {item.status === 'active' && (
                <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Fetching Live Bus Data...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>🚌 Bus Tracking</Text>
                    <Text style={styles.subtitle}>View live bus locations</Text>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Search size={20} color="#94a3b8" />
                    <TextInput
                        placeholder="Search by bus number, route, or driver..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <View style={{ height: 100 }}>
                <FlatList
                    horizontal
                    data={filteredBuses}
                    renderItem={renderBusCard}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.busListContent}
                    showsHorizontalScrollIndicator={false}
                    ListEmptyComponent={<Text style={styles.emptyList}>No buses found</Text>}
                />
            </View>

            <View style={styles.mapContainer}>
                <MapView
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                    style={styles.map}
                    region={mapRegion}
                    onRegionChangeComplete={setMapRegion}
                >
                    {buses.map(bus => (
                        <Marker
                            key={bus.id}
                            coordinate={{ latitude: bus.latitude, longitude: bus.longitude }}
                            onPress={() => setSelectedBus(bus)}
                        >
                            <View style={[styles.markerContainer, bus.status !== 'active' && styles.inactiveMarker]}>
                                <Bus size={16} color="#fff" />
                            </View>
                        </Marker>
                    ))}
                </MapView>

                {selectedBus && (
                    <View style={styles.detailsFloating}>
                        <View style={styles.detailsHeader}>
                            <View>
                                <Text style={styles.detailsTitle}>Bus #{selectedBus.id}</Text>
                                <Text style={styles.detailsSub}>{selectedBus.route}</Text>
                            </View>
                            <TouchableOpacity onPress={() => centerMapOnBus(selectedBus)} style={styles.targetBtn}>
                                <Target size={18} color="#6366f1" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.detailsBody}>
                            <View style={styles.detailRow}>
                                <Clock size={14} color="#64748b" />
                                <Text style={styles.detailText}>Updated: {selectedBus.lastUpdated.toLocaleTimeString()}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Navigation size={14} color="#64748b" />
                                <Text style={styles.detailText}>Status: {selectedBus.status === 'active' ? 'Moving' : 'Stationary'}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 40 : 10,
        paddingBottom: 15,
        backgroundColor: '#fff',
    },
    backBtn: { marginRight: 15, padding: 5 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    searchContainer: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff' },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 15,
        borderRadius: 12,
        height: 44,
        gap: 10,
    },
    searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
    busListContent: { paddingHorizontal: 20, gap: 12, paddingTop: 10, paddingBottom: 10 },
    busCard: {
        width: 200,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 12,
    },
    selectedBusCard: { borderColor: '#6366f1', backgroundColor: '#f5f3ff' },
    inactiveBusCard: { opacity: 0.7 },
    busIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    busCardInfo: { flex: 1 },
    busCardId: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    busCardSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10b981' },
    liveText: { fontSize: 9, fontWeight: 'bold', color: '#10b981' },
    emptyList: { color: '#94a3b8', fontSize: 12, alignSelf: 'center', marginTop: 20 },
    mapContainer: { flex: 1, position: 'relative' },
    map: { ...StyleSheet.absoluteFillObject },
    markerContainer: {
        backgroundColor: '#6366f1',
        padding: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 5,
    },
    inactiveMarker: { backgroundColor: '#94a3b8' },
    detailsFloating: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    detailsTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    detailsSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    targetBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center' },
    detailsBody: { gap: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { fontSize: 13, color: '#475569' },
});

export default BusTracking;
