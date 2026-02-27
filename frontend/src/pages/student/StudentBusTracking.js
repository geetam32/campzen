import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Bus, Search, MapPin, AlertCircle, WifiOff, Loader2 } from 'lucide-react';
import '../../styles/transport.css';

const GOOGLE_MAPS_API_KEY = "AIzaSyBXg6_zStGAkOUd5KQo6mbnfe0u6-_u30Q";

const mapContainerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '16px'
};

const defaultCenter = {
    lat: 20.5937, // Default center (India)
    lng: 78.9629
};

// Custom dark theme for Google Maps (Optional, to match CampZen vibes)
const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    styles: [
        { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
        { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
        { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
        { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
        { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
        { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
        { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
        { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
        { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
        { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
        { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
    ]
};

const StudentBusTracking = () => {
    const { userData } = useAuth();
    const collegeId = userData?.college_id;

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        id: 'google-map-script'
    });

    const [moduleEnabled, setModuleEnabled] = useState(false);
    const [buses, setBuses] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBus, setSelectedBus] = useState(null);
    const [busLocation, setBusLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [checkingModule, setCheckingModule] = useState(true);
    const [showInfoWindow, setShowInfoWindow] = useState(true);

    // Check if module is enabled
    useEffect(() => {
        const check = async () => {
            if (!collegeId) return;
            try {
                const settingsDoc = await getDoc(doc(db, 'transport_settings', collegeId));
                setModuleEnabled(settingsDoc.exists() && settingsDoc.data().is_enabled);
            } catch (err) { console.error('Error checking module:', err); }
            finally { setCheckingModule(false); }
        };
        check();
    }, [collegeId]);

    // Fetch buses and drivers
    useEffect(() => {
        const fetchData = async () => {
            if (!collegeId || !moduleEnabled) { setLoading(false); return; }
            try {
                const busQ = query(collection(db, 'buses'), where('college_id', '==', collegeId));
                const busSnap = await getDocs(busQ);
                const busData = busSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setBuses(busData);

                const driverQ = query(collection(db, 'drivers'), where('college_id', '==', collegeId));
                const driverSnap = await getDocs(driverQ);
                setDrivers(driverSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                // Check tracking status for all buses
                for (const bus of busData) {
                    const locDoc = await getDoc(doc(db, 'bus_locations', bus.id));
                    if (locDoc.exists()) {
                        const data = locDoc.data();
                        bus.is_tracking = data.is_tracking;
                        bus.last_lat = data.latitude;
                        bus.last_lng = data.longitude;
                    }
                }
                setBuses([...busData]);
            } catch (err) { console.error('Error fetching buses:', err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [collegeId, moduleEnabled]);

    // Subscribe to selected bus location
    useEffect(() => {
        if (!selectedBus) { setBusLocation(null); return; }
        const unsub = onSnapshot(doc(db, 'bus_locations', selectedBus.id), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.is_tracking && data.latitude && data.longitude) {
                    setBusLocation({ lat: data.latitude, lng: data.longitude, timestamp: data.timestamp });
                } else {
                    setBusLocation(null);
                }
                // Update bus tracking status in list
                setBuses(prev => prev.map(b => b.id === selectedBus.id ? { ...b, is_tracking: data.is_tracking } : b));
            }
        });
        return () => unsub();
    }, [selectedBus]);

    const getDriverName = (driverId) => drivers.find(d => d.id === driverId)?.name || 'Unknown';

    const filteredBuses = buses.filter(bus => {
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        const driverName = bus.assigned_driver_id ? getDriverName(bus.assigned_driver_id) : '';
        return bus.bus_number.toLowerCase().includes(term) ||
            bus.route_name.toLowerCase().includes(term) ||
            driverName.toLowerCase().includes(term);
    });

    if (checkingModule || loading) {
        return (
            <div className="dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 className="spinner" size={48} style={{ color: 'var(--accent-primary)', marginBottom: 16 }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading bus tracking...</p>
                </div>
            </div>
        );
    }

    if (!moduleEnabled) {
        return (
            <div className="dashboard">
                <div className="page-header"><div><h1 className="page-title">🚌 Bus Tracking</h1></div></div>
                <div className="module-disabled">
                    <WifiOff size={60} />
                    <h3>Transport Module Not Available</h3>
                    <p>The transport tracking module is not enabled for your college. Contact your admin.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🚌 Bus Tracking</h1>
                    <p className="page-description">View live bus locations</p>
                </div>
            </div>

            <div className="card bus-tracking-unified-card">
                <div className="bus-tracking-sidebar">
                    <div className="bus-search-bar">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search bus, route..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="bus-list-compact">
                        {filteredBuses.length === 0 ? (
                            <div className="transport-empty">
                                <Bus size={30} />
                                <p>No buses found</p>
                            </div>
                        ) : (
                            filteredBuses.map(bus => (
                                <div
                                    key={bus.id}
                                    className={`bus-compact-item ${selectedBus?.id === bus.id ? 'selected' : ''}`}
                                    onClick={() => { setSelectedBus(bus); setShowInfoWindow(true); }}
                                >
                                    <div className={`bus-status-indicator ${bus.is_tracking ? 'live' : ''}`}></div>
                                    <div className="bus-compact-info">
                                        <div className="bus-num">Bus #{bus.bus_number}</div>
                                        <div className="bus-route">{bus.route_name}</div>
                                    </div>
                                    {bus.is_tracking && <span className="live-tag">LIVE</span>}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bus-tracking-main">
                    {loadError ? (
                        <div className="map-placeholder">
                            <AlertCircle size={40} color="var(--accent-danger)" />
                            <p>Error loading Google Maps</p>
                        </div>
                    ) : !isLoaded ? (
                        <div className="map-placeholder">
                            <Loader2 className="spinner" size={40} />
                            <p>Loading Google Map...</p>
                        </div>
                    ) : !selectedBus ? (
                        <div className="map-placeholder">
                            <MapPin size={40} />
                            <p>Select a bus from the list to track</p>
                        </div>
                    ) : !busLocation ? (
                        <div className="bus-not-active-msg">
                            <AlertCircle size={40} />
                            <h4>Bus Not Active</h4>
                            <p>Bus #{selectedBus.bus_number} is not currently sharing its location.</p>
                        </div>
                    ) : (
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={busLocation}
                            zoom={15}
                            options={mapOptions}
                        >
                            <Marker
                                position={busLocation}
                                title={`Bus #${selectedBus.bus_number}`}
                                onClick={() => setShowInfoWindow(true)}
                                icon={{
                                    url: "https://maps.google.com/mapfiles/kml/shapes/bus.png",
                                    scaledSize: new window.google.maps.Size(32, 32)
                                }}
                            />
                            {showInfoWindow && (
                                <InfoWindow
                                    position={busLocation}
                                    onCloseClick={() => setShowInfoWindow(false)}
                                >
                                    <div style={{ color: '#333', padding: '4px' }}>
                                        <h4 style={{ margin: '0 0 4px 0' }}>Bus #{selectedBus.bus_number}</h4>
                                        <p style={{ margin: 0, fontSize: '0.85rem' }}>{selectedBus.route_name}</p>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#666' }}>
                                            Updated: {new Date(busLocation.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
                    )}
                </div>
            </div>

            <style>{`
                .bus-tracking-unified-card {
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    height: 600px;
                    padding: 0 !important;
                    overflow: hidden;
                    background: var(--bg-card);
                }

                .bus-tracking-sidebar {
                    border-right: 1px solid var(--border-color);
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-primary);
                }

                .bus-tracking-sidebar .bus-search-bar {
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--border-color);
                }

                .bus-list-compact {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.5rem;
                }

                .bus-compact-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 0.25rem;
                    position: relative;
                }

                .bus-compact-item:hover {
                    background: var(--bg-tertiary);
                }

                .bus-compact-item.selected {
                    background: rgba(124, 58, 237, 0.08);
                    border: 1px solid rgba(124, 58, 237, 0.2);
                }

                .bus-status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--text-placeholder);
                    flex-shrink: 0;
                }

                .bus-status-indicator.live {
                    background: var(--accent-success);
                    box-shadow: 0 0 8px var(--accent-success);
                }

                .bus-compact-info {
                    flex: 1;
                    min-width: 0;
                }

                .bus-num {
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: var(--text-primary);
                }

                .bus-route {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .live-tag {
                    font-size: 10px;
                    font-weight: 800;
                    color: var(--accent-success);
                    background: rgba(16, 185, 129, 0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                .bus-tracking-main {
                    position: relative;
                    background: var(--bg-tertiary);
                }

                @media (max-width: 900px) {
                    .bus-tracking-unified-card {
                        grid-template-columns: 1fr;
                        height: auto;
                        min-height: 800px;
                    }
                    .bus-tracking-sidebar {
                        border-right: none;
                        border-bottom: 1px solid var(--border-color);
                        height: 350px;
                    }
                    .bus-tracking-main {
                        height: 450px;
                    }
                }
            `}</style>
        </div>
    );
};

export default StudentBusTracking;
