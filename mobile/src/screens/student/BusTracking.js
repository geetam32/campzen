import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    TextInput,
    ScrollView,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
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
    Clock,
    User
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
    const [locations, setLocations] = useState([]);
    const [busMetadata, setBusMetadata] = useState({});
    const [userLocation, setUserLocation] = useState(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            let location = await Location.getCurrentPositionAsync({});
            setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
        })();
    }, []);

    useEffect(() => {
        if (!userData?.college_id) return;

        const busesRef = collection(db, 'colleges', userData.college_id, 'buses');
        const locationsRef = query(collection(db, 'bus_locations'), where('college_id', '==', userData.college_id));

        const unsubBuses = onSnapshot(busesRef, (snapshot) => {
            const meta = {};
            snapshot.docs.forEach(doc => {
                meta[doc.id] = doc.data();
            });
            setBusMetadata(meta);
        });

        const unsubLocations = onSnapshot(locationsRef, (snapshot) => {
            const locationData = snapshot.docs.map(doc => {
                const data = doc.data();
                // Support both composite IDs (college_bus) and simple legacy IDs (college)
                const docId = doc.id;
                const extraction = docId.includes('_') ? docId.split('_').pop() : (data.bus_id || 'Primary');

                return {
                    id: extraction,
                    ...data,
                    lastUpdated: data.last_updated?.toDate() || new Date()
                };
            });
            setLocations(locationData);
            setLoading(false);
        });

        return () => {
            unsubBuses();
            unsubLocations();
        };
    }, [userData?.college_id]);

    useEffect(() => {
        const merged = locations.map(loc => {
            // Check meta by bus_id or the extracted id
            const meta = busMetadata[loc.bus_id] || busMetadata[loc.id] || {};
            return {
                ...loc,
                route: meta.route || loc.route || 'Route',
                driver_name: meta.driver_name || loc.driver_name || 'Driver',
            };
        });

        setBuses(merged);
        setFilteredBuses(merged);

        if (merged.length > 0 && !mapRegion) {
            const focus = merged.find(b => b.status === 'active') || merged[0];
            if (focus.latitude && focus.longitude) {
                setMapRegion({
                    latitude: focus.latitude,
                    longitude: focus.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                });
            }
        }
    }, [locations, busMetadata]);

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

            <View style={styles.unifiedBox}>
                <View style={styles.boxHeader}>
                    <View style={styles.searchBar}>
                        <Search size={18} color="#94a3b8" />
                        <TextInput
                            placeholder="Search bus or route..."
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <FlatList
                        horizontal
                        data={filteredBuses}
                        renderItem={renderBusCard}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.busListContent}
                        showsHorizontalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.emptyList}>No buses found</Text>}
                        style={styles.busList}
                    />
                </View>

                <View style={styles.mapFrame}>
                    <MapView
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                        style={styles.map}
                        region={mapRegion}
                        onRegionChangeComplete={setMapRegion}
                    >
                        {userLocation && (
                            <Marker coordinate={userLocation} title="My Location">
                                <View style={styles.userMarkerContainer}>
                                    <User size={16} color="#fff" />
                                </View>
                            </Marker>
                        )}

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

                        {selectedBus && userLocation && (
                            <Polyline
                                coordinates={[
                                    userLocation,
                                    { latitude: selectedBus.latitude, longitude: selectedBus.longitude }
                                ]}
                                strokeColor="#6366f1"
                                strokeWidth={3}
                                lineDashPattern={[5, 5]}
                            />
                        )}
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
                                {userLocation && (
                                    <View style={styles.detailRow}>
                                        <MapPin size={14} color="#64748b" />
                                        <Text style={styles.detailText}>
                                            {(function calculateDistance(lat1, lon1, lat2, lon2) {
                                                const R = 6371;
                                                const dLat = (lat2 - lat1) * Math.PI / 180;
                                                const dLon = (lon2 - lon1) * Math.PI / 180;
                                                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                                                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                                return (R * c).toFixed(2);
                                            })(userLocation.latitude, userLocation.longitude, selectedBus.latitude, selectedBus.longitude)} km away
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: { marginRight: 15, padding: 8, backgroundColor: '#fff', borderRadius: 12 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },

    unifiedBox: {
        flex: 1,
        margin: 16,
        marginTop: 0,
        backgroundColor: '#fff',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    boxHeader: {
        paddingTop: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        marginHorizontal: 16,
        paddingHorizontal: 16,
        borderRadius: 16,
        height: 50,
        gap: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchInput: { flex: 1, fontSize: 15, color: '#1e293b' },
    busList: {
        marginTop: 12,
        height: 90,
    },
    busListContent: { paddingHorizontal: 16, gap: 12, paddingBottom: 16 },
    busCard: {
        width: 180,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 10,
    },
    selectedBusCard: { borderColor: '#6366f1', backgroundColor: '#f5f3ff' },
    inactiveBusCard: { opacity: 0.6 },
    busIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    busCardInfo: { flex: 1 },
    busCardId: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    busCardSub: { fontSize: 10, color: '#64748b', marginTop: 1 },
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
    emptyList: { color: '#94a3b8', fontSize: 12, alignSelf: 'center', marginTop: 10 },

    mapFrame: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    map: { ...StyleSheet.absoluteFillObject },
    markerContainer: {
        backgroundColor: '#6366f1',
        padding: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
    },
    userMarkerContainer: {
        backgroundColor: '#10b981',
        padding: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
    },
    inactiveMarker: { backgroundColor: '#94a3b8' },
    detailsFloating: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
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
