import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    Platform,
    StatusBar
} from 'react-native';
import * as Location from 'expo-location';
import { db } from '../../api/firebase';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import {
    Bus,
    Play,
    Square,
    Navigation,
    MapPin,
    LogOut,
    Bell,
    LayoutDashboard
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const DriverDashboard = ({ navigation }) => {
    const { userData, logout } = useAuth();
    const [isSharing, setIsSharing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState(null);
    const [busData, setBusData] = useState(null);
    const locationSubscription = useRef(null);

    useEffect(() => {
        if (!userData?.bus_id || !userData?.college_id) return;

        const busRef = doc(db, 'colleges', userData.college_id, 'buses', userData.bus_id);
        const unsubscribe = onSnapshot(busRef, (snap) => {
            if (snap.exists()) {
                setBusData(snap.data());
            }
        });

        return () => unsubscribe();
    }, [userData]);

    const startSharing = async () => {
        setLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Location permission is required to share bus position.");
                return;
            }

            // Foreground service configuration (optional, better for real production)
            setIsSharing(true);

            // Initial location update
            const curLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setLocation(curLoc);
            await updateFirebaseLocation(curLoc.coords, 'active');

            // Subscribe to location updates
            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (newLocation) => {
                    setLocation(newLocation);
                    updateFirebaseLocation(newLocation.coords, 'active');
                }
            );

        } catch (error) {
            console.error("Error:", error);
            setIsSharing(false);
        } finally {
            setLoading(false);
        }
    };

    const stopSharing = async () => {
        setLoading(true);
        try {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
                locationSubscription.current = null;
            }
            setIsSharing(false);

            if (userData?.college_id) {
                const busDocRef = doc(db, 'bus_locations', userData.college_id + '_' + userData.bus_id);
                await updateDoc(busDocRef, {
                    status: 'inactive',
                    last_updated: serverTimestamp()
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const updateFirebaseLocation = async (coords, status) => {
        if (!userData?.college_id || !userData?.bus_id) return;
        try {
            // Document ID is combo of college and bus
            const docId = userData.college_id + '_' + userData.bus_id;
            const busDocRef = doc(db, 'bus_locations', docId);
            await setDoc(busDocRef, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                status: status,
                last_updated: serverTimestamp(),
                college_id: userData.college_id,
                bus_id: userData.bus_id,
                driver_id: userData.uid || userData.id,
                driver_name: userData.name,
                route: busData?.route || 'Route'
            }, { merge: true });
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel" },
            { text: "Logout", style: 'destructive', onPress: logout }
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Top Navigation Bar */}
            <View style={styles.topBar}>
                <View style={styles.brand}>
                    <View style={styles.logoBox}>
                        <Bus size={20} color="#fff" />
                    </View>
                </View>
                <View style={styles.topRight}>
                    <View style={styles.headerTitle}>
                        <Text style={styles.brandText}>Campzen</Text>
                        <Text style={styles.roleText}>Driver Console</Text>
                    </View>
                    <TouchableOpacity style={styles.topIcon}>
                        <Bell size={20} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <LogOut size={18} color="#1e293b" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.mainLayout}>
                {/* Sidebar Menu (Web-style on Desktop, simplified here) */}
                <View style={styles.sidebar}>
                    <View style={styles.menuItemActive}>
                        <LayoutDashboard size={20} color="#6366f1" />
                        <Text style={styles.menuTextActive}>Dashboard</Text>
                    </View>
                </View>

                {/* Main Content */}
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.pageHeader}>
                        <View>
                            <Text style={styles.pageTitle}>🚛 Driver Dashboard</Text>
                            <Text style={styles.pageSubtitle}>Manage your ride</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: isSharing ? '#ecfdf5' : '#fff1f2' }]}>
                            <View style={[styles.statusDot, { backgroundColor: isSharing ? '#10b981' : '#f43f5e' }]} />
                            <Text style={[styles.statusTabText, { color: isSharing ? '#10b981' : '#f43f5e' }]}>
                                {isSharing ? '• ACTIVE' : '• INACTIVE'}
                            </Text>
                        </View>
                    </View>

                    {/* Main Drive Control Card */}
                    <View style={styles.mainCard}>
                        <View style={styles.busIconContainer}>
                            <Bus size={40} color="#6366f1" />
                        </View>
                        <Text style={styles.busNumber}>Bus #{userData?.bus_id || '001'}</Text>
                        <View style={styles.routeBox}>
                            <MapPin size={16} color="#64748b" />
                            <Text style={styles.routeName}>{busData?.route || 'Fetching route...'}</Text>
                        </View>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.startBtn, isSharing && styles.btnDisabled]}
                                onPress={startSharing}
                                disabled={isSharing || loading}
                            >
                                <Play size={20} color="#fff" />
                                <Text style={styles.btnText}>Start Ride</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.stopBtn, !isSharing && styles.btnDisabled]}
                                onPress={stopSharing}
                                disabled={!isSharing || loading}
                            >
                                <Square size={20} color="#fff" />
                                <Text style={styles.btnText}>Stop Ride</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Info Cards */}
                    <View style={styles.infoGrid}>
                        <View style={styles.infoCard}>
                            <View style={[styles.infoIconBox, { backgroundColor: '#f5f3ff' }]}>
                                <Navigation size={20} color="#6366f1" />
                            </View>
                            <View>
                                <Text style={styles.infoVal}>{isSharing ? 'On' : 'Off'}</Text>
                                <Text style={styles.infoLab}>GPS Status</Text>
                            </View>
                        </View>
                        <View style={styles.infoCard}>
                            <View style={[styles.infoIconBox, { backgroundColor: '#f0fdf4' }]}>
                                <MapPin size={20} color="#10b981" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.infoVal} numberOfLines={1}>{busData?.route || 'Route'}</Text>
                                <Text style={styles.infoLab}>Route</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    topBar: {
        height: 70,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
    brandText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    topRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    userInfo: { alignItems: 'right', alignItems: 'flex-end' },
    userName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    userRole: { fontSize: 12, color: '#64748b' },
    topIcon: { padding: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 10
    },
    logoutText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
    mainLayout: { flex: 1, flexDirection: 'row' },
    sidebar: {
        width: 140,
        backgroundColor: '#fff',
        borderRightWidth: 1,
        borderRightColor: '#f1f5f9',
        paddingTop: 20,
        paddingHorizontal: 10,
        display: Platform.OS === 'web' ? 'flex' : 'none' // Only show on web/desktop view
    },
    menuItemActive: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f5f3ff',
        borderRadius: 12,
        gap: 10
    },
    menuTextActive: { fontSize: 14, fontWeight: 'bold', color: '#6366f1' },
    content: { flex: 1, padding: 30 },
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    pageSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusTabText: { fontSize: 12, fontWeight: 'bold' },
    mainCard: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 40,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5
    },
    busIconContainer: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    busNumber: { fontSize: 32, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
    routeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 40 },
    routeName: { fontSize: 16, color: '#64748b' },
    buttonRow: { flexDirection: 'row', gap: 20, width: '100%' },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16, gap: 10 },
    startBtn: { backgroundColor: '#10b981' },
    stopBtn: { backgroundColor: '#f43f5e' },
    btnDisabled: { opacity: 0.5 },
    btnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    infoGrid: { flexDirection: 'row', gap: 20 },
    infoCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 15
    },
    infoIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    infoVal: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    infoLab: { fontSize: 12, color: '#64748b', marginTop: 2 },
});

export default DriverDashboard;
