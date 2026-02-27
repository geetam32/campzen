import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Switch, ScrollView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { db } from '../../api/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Navigation, Bus, ArrowLeft, Power, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const BusSharing = ({ navigation }) => {
    const { userData } = useAuth();
    const [isSharing, setIsSharing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [busId, setBusId] = useState(userData?.bus_id || '001');
    const locationSubscription = useRef(null);

    const startSharing = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Location permission is required to share bus position.");
                setLoading(false);
                return;
            }

            // Optional background permission
            try {
                let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
                if (bgStatus !== 'granted') {
                    console.log("Background location permission not granted.");
                }
            } catch (bgErr) {
                console.log("Background permission request failed (might be on web or not supported in this environment)");
            }

            setIsSharing(true);

            // Initial location update
            const curLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setLocation(curLoc);
            await updateFirebaseLocation(curLoc.coords);

            // Subscribe to location updates
            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (newLocation) => {
                    setLocation(newLocation);
                    updateFirebaseLocation(newLocation.coords);
                }
            );

        } catch (error) {
            console.error("Error starting location sharing:", error);
            setErrorMsg(error.message);
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

            // Mark as inactive in Firebase
            if (userData?.college_id) {
                const docId = userData.college_id + '_' + busId;
                const busDocRef = doc(db, 'bus_locations', docId);
                await updateDoc(busDocRef, {
                    status: 'inactive',
                    last_updated: serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Error stopping location sharing:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateFirebaseLocation = async (coords) => {
        if (!userData?.college_id) return;

        try {
            const docId = userData.college_id + '_' + busId;
            const busDocRef = doc(db, 'bus_locations', docId);
            await setDoc(busDocRef, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                status: 'active',
                last_updated: serverTimestamp(),
                college_id: userData.college_id,
                bus_id: busId,
                driver_id: userData.uid || userData.id,
                driver_name: userData.name
            }, { merge: true });
        } catch (err) {
            console.error("Firebase update failed:", err);
        }
    };

    useEffect(() => {
        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
        };
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.title}>Bus Location Sharing</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.statusCard}>
                    <LinearGradient
                        colors={isSharing ? ['#10b981', '#059669'] : ['#64748b', '#475569']}
                        style={styles.statusBadge}
                    >
                        <Bus size={32} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.statusTitle}>{isSharing ? 'Live Tracking Active' : 'Tracking is Offline'}</Text>
                    <Text style={styles.statusSub}>
                        {isSharing ? 'Students can now see your bus location in real-time.' : 'Start sharing to let students track the college bus.'}
                    </Text>
                </View>

                {errorMsg && (
                    <View style={styles.errorBox}>
                        <AlertCircle size={20} color="#ef4444" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                )}

                <View style={styles.controls}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.controlLabel}>Bus Number / ID</Text>
                        <TextInput
                            style={styles.busInput}
                            value={busId}
                            onChangeText={setBusId}
                            placeholder="e.g. 001"
                            disabled={isSharing}
                        />
                    </View>

                    <View style={styles.controlRow}>
                        <View>
                            <Text style={styles.controlLabel}>Share Location</Text>
                            <Text style={styles.controlMeta}>Broadcast GPS to students</Text>
                        </View>
                        <Switch
                            value={isSharing}
                            onValueChange={(val) => val ? startSharing() : stopSharing()}
                            trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
                            thumbColor={Platform.OS === 'ios' ? '#fff' : isSharing ? '#fff' : '#f4f3f4'}
                            disabled={loading}
                        />
                    </View>
                </View>

                {isSharing && location && (
                    <View style={styles.locationInfo}>
                        <Text style={styles.infoTitle}>Current Coords</Text>
                        <Text style={styles.infoValue}>Lat: {location.coords.latitude.toFixed(6)}</Text>
                        <Text style={styles.infoValue}>Long: {location.coords.longitude.toFixed(6)}</Text>
                        <View style={styles.liveIndicator}>
                            <View style={styles.pulse} />
                            <Text style={styles.liveText}>Broadcasting Live...</Text>
                        </View>
                    </View>
                )}

                <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>Important Note:</Text>
                    <Text style={styles.warningText}>
                        Please keep the app open or running in the background while sharing. Battery consumption may increase during active tracking.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backBtn: { marginRight: 15 },
    title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    content: { padding: 20 },
    statusCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
    },
    statusBadge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    statusTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    statusSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
    controls: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
    },
    controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    controlLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    controlMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    inputGroup: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    busInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 50,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        fontSize: 16,
        color: '#1e293b',
    },
    locationInfo: {
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
    },
    infoTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 },
    infoValue: { fontSize: 14, color: '#1e293b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 5 },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginRight: 8 },
    liveText: { fontSize: 14, color: '#10b981', fontWeight: 'bold' },
    errorBox: {
        flexDirection: 'row',
        backgroundColor: '#fef2f2',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        alignItems: 'center',
        gap: 12,
    },
    errorText: { color: '#ef4444', fontSize: 14, flex: 1 },
    warningBox: { padding: 20, backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: 20, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
    warningTitle: { fontSize: 14, fontWeight: 'bold', color: '#b45309', marginBottom: 5 },
    warningText: { fontSize: 13, color: '#d97706', lineHeight: 18 },
});

export default BusSharing;
