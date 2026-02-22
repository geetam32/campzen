import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Bus, Play, Square, MapPin, Navigation, AlertTriangle, Loader2 } from 'lucide-react';
import '../../styles/transport.css';

const UPDATE_INTERVAL = 15000;
const INACTIVITY_TIMEOUT = 120000;

const DriverDashboard = () => {
    const { userData } = useAuth();
    const [busInfo, setBusInfo] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [gpsStatus, setGpsStatus] = useState('idle');
    const [gpsError, setGpsError] = useState('');
    const [lastUpdate, setLastUpdate] = useState(null);
    const [loading, setLoading] = useState(true);

    const watchIdRef = useRef(null);
    const intervalRef = useRef(null);
    const lastPosRef = useRef(null);
    const lastSentPosRef = useRef(null);
    const inactivityRef = useRef(null);
    const stabilizationTimerRef = useRef(null);

    // Haversine formula to calculate distance in meters
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    useEffect(() => {
        const fetchBus = async () => {
            if (!userData?.assigned_bus_id) { setLoading(false); return; }
            try {
                const busDoc = await getDoc(doc(db, 'buses', userData.assigned_bus_id));
                if (busDoc.exists()) setBusInfo({ id: busDoc.id, ...busDoc.data() });
                const locDoc = await getDoc(doc(db, 'bus_locations', userData.assigned_bus_id));
                if (locDoc.exists() && locDoc.data().is_tracking) {
                    setIsTracking(true);
                    setGpsStatus('sending');
                }
            } catch (err) { console.error('Error fetching bus:', err); }
            finally { setLoading(false); }
        };
        fetchBus();
    }, [userData]);

    const stopRide = useCallback(async () => {
        if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null; }
        if (stabilizationTimerRef.current) { clearTimeout(stabilizationTimerRef.current); stabilizationTimerRef.current = null; }

        if (userData?.assigned_bus_id) {
            try {
                const ref = doc(db, 'bus_locations', userData.assigned_bus_id);
                const snap = await getDoc(ref);
                if (snap.exists()) await setDoc(ref, { ...snap.data(), is_tracking: false, timestamp: new Date().toISOString() });
            } catch (err) { console.error('Stop ride error:', err); }
        }
        setIsTracking(false);
        setGpsStatus('idle');
        lastPosRef.current = null;
        lastSentPosRef.current = null;
    }, [userData]);

    const writeLocation = useCallback(async (lat, lng, accuracy) => {
        if (!userData?.assigned_bus_id) return;

        // Rate limiting and movement threshold
        if (lastSentPosRef.current) {
            const distance = getDistance(
                lastSentPosRef.current.latitude,
                lastSentPosRef.current.longitude,
                lat,
                lng
            );
            if (distance < 10) {
                console.log(`Skipping update: moved only ${distance.toFixed(1)}m (threshold: 10m)`);
                return;
            }
        }

        try {
            console.log(`Sending update: Lat ${lat}, Lng ${lng}, Accuracy ${accuracy.toFixed(1)}m`);
            await setDoc(doc(db, 'bus_locations', userData.assigned_bus_id), {
                bus_id: userData.assigned_bus_id,
                latitude: lat,
                longitude: lng,
                accuracy: accuracy,
                timestamp: new Date().toISOString(),
                is_tracking: true
            });

            lastSentPosRef.current = { latitude: lat, longitude: lng };
            setGpsStatus('sending');
            setLastUpdate(new Date());
            setGpsError('');

            if (inactivityRef.current) clearTimeout(inactivityRef.current);
            inactivityRef.current = setTimeout(() => {
                console.warn('Inactivity timeout: stopping ride');
                stopRide();
            }, INACTIVITY_TIMEOUT);
        } catch (err) {
            console.error('Location write error:', err);
            setGpsStatus('error');
            setGpsError('Failed to send location');
        }
    }, [userData, stopRide]);

    const startRide = () => {
        if (!navigator.geolocation) { setGpsError('Geolocation not supported'); setGpsStatus('error'); return; }

        setIsTracking(true);
        setGpsStatus('sending');
        setGpsError('');

        console.log('Starting GPS tracking...');

        // Initial fetch to get moving quickly
        navigator.geolocation.getCurrentPosition(
            (p) => {
                const { latitude, longitude, accuracy } = p.coords;
                console.log(`Initial reading: Accuracy ${accuracy.toFixed(1)}m`);
                lastPosRef.current = { latitude, longitude, accuracy };
                writeLocation(latitude, longitude, accuracy);
            },
            (e) => {
                setGpsError(geoErr(e));
                setGpsStatus('error');
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        // Start watching position
        watchIdRef.current = navigator.geolocation.watchPosition(
            (p) => {
                const { latitude, longitude, accuracy } = p.coords;
                console.log(`Watch update: Accuracy ${accuracy.toFixed(1)}m`);
                lastPosRef.current = { latitude, longitude, accuracy };
                // Also update Firestore on every accurate watch event if significantly moved
                // (writeLocation handles the 10m threshold)
                writeLocation(latitude, longitude, accuracy);
            },
            (e) => {
                console.warn('Watch error:', e.message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        // Periodic fallback update every 15s (if watchPosition is quiet)
        intervalRef.current = setInterval(() => {
            if (lastPosRef.current) {
                writeLocation(lastPosRef.current.latitude, lastPosRef.current.longitude, lastPosRef.current.accuracy);
            }
        }, UPDATE_INTERVAL);

        inactivityRef.current = setTimeout(() => stopRide(), INACTIVITY_TIMEOUT);
    };

    useEffect(() => () => {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (inactivityRef.current) clearTimeout(inactivityRef.current);
    }, []);

    const geoErr = (e) => { switch (e.code) { case 1: return 'Location permission denied.'; case 2: return 'Location unavailable.'; case 3: return 'Request timed out.'; default: return 'Unknown GPS error.'; } };

    if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

    if (!busInfo) return (
        <div className="dashboard">
            <div className="page-header"><div><h1 className="page-title">🚌 Driver Dashboard</h1><p className="page-description">No bus assigned</p></div></div>
            <div className="transport-empty"><Bus size={60} /><h4>No Bus Assigned</h4><p>Contact your admin to get a bus assigned.</p></div>
        </div>
    );

    return (
        <div className="dashboard">
            <div className="page-header">
                <div><h1 className="page-title">🚌 Driver Dashboard</h1><p className="page-description">Manage your ride</p></div>
                <span className={`status-badge ${isTracking ? 'tracking' : 'inactive'}`}><span className="status-dot"></span>{isTracking ? 'Tracking' : 'Inactive'}</span>
            </div>
            <div className="driver-dashboard">
                <div className="driver-bus-card">
                    <div className="driver-bus-icon"><Bus size={40} /></div>
                    <div className="driver-bus-number">Bus #{busInfo.bus_number}</div>
                    <div className="driver-route-name"><MapPin size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} />{busInfo.route_name}</div>
                    <div className="driver-ride-controls">
                        <button className="ride-btn start" onClick={startRide} disabled={isTracking}><Play size={20} />Start Ride</button>
                        <button className="ride-btn stop" onClick={stopRide} disabled={!isTracking}><Square size={20} />Stop Ride</button>
                    </div>
                    {isTracking && gpsStatus === 'sending' && (
                        <div className="gps-status sending">
                            <div className="gps-pulse"></div> Sharing location...
                            {lastUpdate && <span style={{ opacity: 0.6, marginLeft: 8 }}>Last update: {lastUpdate.toLocaleTimeString()}</span>}
                        </div>
                    )}
                    {gpsStatus === 'error' && <div className="gps-status error"><AlertTriangle size={14} /> {gpsError}</div>}
                </div>
                <div className="stats-grid">
                    <div className="stat-card"><div className="stat-icon primary"><Navigation size={20} /></div><div className="stat-value">{isTracking ? 'Live' : 'Off'}</div><div className="stat-label">GPS Status</div></div>
                    <div className="stat-card"><div className="stat-icon success"><MapPin size={20} /></div><div className="stat-value">{busInfo.route_name}</div><div className="stat-label">Route</div></div>
                </div>
            </div>
        </div>
    );
};

export default DriverDashboard;
