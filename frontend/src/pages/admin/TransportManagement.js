import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import {
    collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc
} from 'firebase/firestore';
import {
    Bus, Plus, Settings, Users, Trash2, Edit, MapPin, User, KeyRound, Route, Hash, X, Save, Loader2
} from 'lucide-react';
import '../../styles/transport.css';

const TransportManagement = () => {
    const { userData } = useAuth();
    const collegeId = userData?.college_id;

    const [activeTab, setActiveTab] = useState('settings');
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

    // Settings
    const [isEnabled, setIsEnabled] = useState(false);
    const [toggling, setToggling] = useState(false);

    // Buses
    const [buses, setBuses] = useState([]);
    const [showBusForm, setShowBusForm] = useState(false);
    const [editingBus, setEditingBus] = useState(null);
    const [busForm, setBusForm] = useState({ bus_number: '', route_name: '' });

    // Drivers
    const [drivers, setDrivers] = useState([]);
    const [showDriverForm, setShowDriverForm] = useState(false);
    const [editingDriver, setEditingDriver] = useState(null);
    const [driverForm, setDriverForm] = useState({ name: '', username: '', password: '', assigned_bus_id: '' });

    const [saving, setSaving] = useState(false);

    // Fetch data
    const fetchData = useCallback(async () => {
        if (!collegeId) {
            console.warn('TransportManagement: collegeId is missing from userData');
            setLoading(false);
            return;
        }
        setLoading(true);
        console.log('TransportManagement: fetching data for college:', collegeId);
        try {
            // Settings
            const settingsDoc = await getDoc(doc(db, 'transport_settings', collegeId));
            if (settingsDoc.exists()) {
                setIsEnabled(settingsDoc.data().is_enabled || false);
            }

            // Buses
            const busQ = query(collection(db, 'buses'), where('college_id', '==', collegeId));
            const busSnap = await getDocs(busQ);
            setBuses(busSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // Drivers
            const driverQ = query(collection(db, 'drivers'), where('college_id', '==', collegeId));
            const driverSnap = await getDocs(driverQ);
            setDrivers(driverSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error fetching transport data:', err);
            setStatusMsg({ type: 'error', text: 'Failed to load transport data. Please refresh.' });
        } finally {
            setLoading(false);
        }
    }, [collegeId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Toggle module
    const toggleModule = async () => {
        if (!collegeId) {
            console.error('Cannot toggle module: collegeId is missing');
            return;
        }
        console.log('Toggling module... current state:', isEnabled);
        setToggling(true);
        setStatusMsg({ type: '', text: '' });
        try {
            await setDoc(doc(db, 'transport_settings', collegeId), {
                college_id: collegeId,
                is_enabled: !isEnabled,
                updated_at: new Date().toISOString()
            }, { merge: true });
            setIsEnabled(!isEnabled);
            setStatusMsg({ type: 'success', text: `Transport module ${!isEnabled ? 'enabled' : 'disabled'} successfully!` });
            console.log('Module toggled successfully. New state:', !isEnabled);
        } catch (err) {
            console.error('Error toggling module:', err);
            setStatusMsg({ type: 'error', text: 'Failed to update transport settings. Check console for details.' });
        } finally {
            setToggling(false);
        }
    };

    const handleTabChange = (tab) => {
        console.log('Switching to tab:', tab);
        setActiveTab(tab);
        setStatusMsg({ type: '', text: '' }); // Clear message when switching tabs
    };

    // ---- Bus CRUD ----
    const openBusForm = (bus = null) => {
        if (bus) {
            setEditingBus(bus);
            setBusForm({ bus_number: bus.bus_number, route_name: bus.route_name });
        } else {
            setEditingBus(null);
            setBusForm({ bus_number: '', route_name: '' });
        }
        setShowBusForm(true);
    };

    const saveBus = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingBus) {
                await updateDoc(doc(db, 'buses', editingBus.id), {
                    bus_number: busForm.bus_number,
                    route_name: busForm.route_name,
                    updated_at: new Date().toISOString()
                });
            } else {
                const busRef = doc(collection(db, 'buses'));
                await setDoc(busRef, {
                    college_id: collegeId,
                    bus_number: busForm.bus_number,
                    route_name: busForm.route_name,
                    assigned_driver_id: null,
                    status: 'inactive',
                    created_at: new Date().toISOString()
                });
            }
            setShowBusForm(false);
            setStatusMsg({ type: 'success', text: `Bus ${editingBus ? 'updated' : 'added'} successfully!` });
            await fetchData();
        } catch (err) {
            console.error('Error saving bus:', err);
            setStatusMsg({ type: 'error', text: 'Failed to save bus details.' });
        } finally {
            setSaving(false);
        }
    };

    const deleteBus = async (busId) => {
        if (!window.confirm('Delete this bus?')) return;
        setStatusMsg({ type: '', text: '' });
        try {
            // Unassign driver if any
            const bus = buses.find(b => b.id === busId);
            if (bus?.assigned_driver_id) {
                await updateDoc(doc(db, 'drivers', bus.assigned_driver_id), { assigned_bus_id: null });
            }
            await deleteDoc(doc(db, 'buses', busId));
            setStatusMsg({ type: 'success', text: 'Bus deleted successfully!' });
            await fetchData();
        } catch (err) {
            console.error('Error deleting bus:', err);
            setStatusMsg({ type: 'error', text: 'Failed to delete bus.' });
        }
    };

    // ---- Driver CRUD ----
    const openDriverForm = (driver = null) => {
        if (driver) {
            setEditingDriver(driver);
            setDriverForm({
                name: driver.name,
                username: driver.username,
                password: '',
                assigned_bus_id: driver.assigned_bus_id || ''
            });
        } else {
            setEditingDriver(null);
            setDriverForm({ name: '', username: '', password: '', assigned_bus_id: '' });
        }
        setShowDriverForm(true);
    };

    const saveDriver = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const assignedBusId = driverForm.assigned_bus_id || null;

            // Validate: if assigning a bus, check it's not already assigned to another driver
            if (assignedBusId) {
                const existingDriver = drivers.find(
                    d => d.assigned_bus_id === assignedBusId && d.id !== editingDriver?.id
                );
                if (existingDriver) {
                    setStatusMsg({ type: 'error', text: `Bus is already assigned to driver: ${existingDriver.name}` });
                    setSaving(false);
                    return;
                }
            }

            if (editingDriver) {
                const updateData = {
                    name: driverForm.name,
                    username: driverForm.username,
                    assigned_bus_id: assignedBusId,
                    updated_at: new Date().toISOString()
                };
                if (driverForm.password) {
                    updateData.password = driverForm.password;
                }

                // If bus assignment changed, update old and new bus docs
                if (editingDriver.assigned_bus_id && editingDriver.assigned_bus_id !== assignedBusId) {
                    await updateDoc(doc(db, 'buses', editingDriver.assigned_bus_id), {
                        assigned_driver_id: null
                    });
                }
                if (assignedBusId) {
                    await updateDoc(doc(db, 'buses', assignedBusId), {
                        assigned_driver_id: editingDriver.id
                    });
                }

                await updateDoc(doc(db, 'drivers', editingDriver.id), updateData);
                setStatusMsg({ type: 'success', text: 'Driver updated successfully!' });
            } else {
                if (!driverForm.password) {
                    setStatusMsg({ type: 'error', text: 'Password is required for new drivers.' });
                    setSaving(false);
                    return;
                }
                const driverRef = doc(collection(db, 'drivers'));
                await setDoc(driverRef, {
                    college_id: collegeId,
                    name: driverForm.name,
                    username: driverForm.username,
                    password: driverForm.password,
                    assigned_bus_id: assignedBusId,
                    role: 'driver',
                    is_active: true,
                    created_at: new Date().toISOString()
                });

                // Update bus with the new driver assignment
                if (assignedBusId) {
                    await updateDoc(doc(db, 'buses', assignedBusId), {
                        assigned_driver_id: driverRef.id
                    });
                }
            }
            setShowDriverForm(false);
            if (!editingDriver) setStatusMsg({ type: 'success', text: 'Driver added successfully!' });
            await fetchData();
        } catch (err) {
            console.error('Error saving driver:', err);
            setStatusMsg({ type: 'error', text: 'Failed to save driver details.' });
        } finally {
            setSaving(false);
        }
    };

    const deleteDriver = async (driverId) => {
        if (!window.confirm('Delete this driver?')) return;
        setStatusMsg({ type: '', text: '' });
        try {
            const driver = drivers.find(d => d.id === driverId);
            if (driver?.assigned_bus_id) {
                await updateDoc(doc(db, 'buses', driver.assigned_bus_id), {
                    assigned_driver_id: null
                });
            }
            await deleteDoc(doc(db, 'drivers', driverId));
            setStatusMsg({ type: 'success', text: 'Driver deleted successfully!' });
            await fetchData();
        } catch (err) {
            console.error('Error deleting driver:', err);
            setStatusMsg({ type: 'error', text: 'Failed to delete driver.' });
        }
    };

    // Helpers
    const getDriverName = (driverId) => drivers.find(d => d.id === driverId)?.name || '—';
    const getBusNumber = (busId) => buses.find(b => b.id === busId)?.bus_number || '—';
    const unassignedBuses = buses.filter(b => !b.assigned_driver_id || b.assigned_driver_id === editingDriver?.id);

    if (!collegeId) {
        return (
            <div className="dashboard">
                <div className="alert alert-error">
                    <strong>Configuration Error:</strong> Your account is not associated with a college ID. Please contact support.
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 className="spinner" size={48} style={{ color: 'var(--accent-primary)', marginBottom: 16 }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading transport module...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🚌 Transport Management</h1>
                    <p className="page-description">Configure buses, drivers, and live tracking</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="transport-tabs">
                <button
                    className={`transport-tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => handleTabChange('settings')}
                >
                    <Settings size={16} /> Module Config
                </button>
                <button
                    className={`transport-tab ${activeTab === 'buses' ? 'active' : ''}`}
                    onClick={() => handleTabChange('buses')}
                >
                    <Bus size={16} /> Buses
                </button>
                <button
                    className={`transport-tab ${activeTab === 'drivers' ? 'active' : ''}`}
                    onClick={() => handleTabChange('drivers')}
                >
                    <Users size={16} /> Drivers
                </button>
            </div>

            {statusMsg.text && (
                <div className={`alert alert-${statusMsg.type}`} style={{ marginBottom: 24, animation: 'slideUpFade 0.3s ease' }}>
                    {statusMsg.text}
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    <div className="module-toggle-card">
                        <div className="module-toggle-info">
                            <h3>Transport Module</h3>
                            <p>
                                {isEnabled
                                    ? 'Module is enabled. Students can view bus tracking.'
                                    : 'Module is disabled. Enable to allow bus tracking for students.'}
                            </p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={toggleModule}
                                disabled={toggling}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            )}

            {/* Buses Tab */}
            {activeTab === 'buses' && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        <button className="btn btn-primary" onClick={() => openBusForm()}>
                            <Plus size={16} /> Add Bus
                        </button>
                    </div>
                    {buses.length === 0 ? (
                        <div className="transport-empty">
                            <Bus size={48} />
                            <h4>No buses yet</h4>
                            <p>Create your first bus to get started with transport tracking.</p>
                        </div>
                    ) : (
                        <div className="transport-grid">
                            {buses.map(bus => (
                                <div key={bus.id} className="transport-card">
                                    <div className="transport-card-header">
                                        <div>
                                            <div className="transport-card-title">Bus #{bus.bus_number}</div>
                                            <div className="transport-card-subtitle">{bus.route_name}</div>
                                        </div>
                                        <span className={`status-badge ${bus.status}`}>
                                            <span className="status-dot"></span>
                                            {bus.status}
                                        </span>
                                    </div>
                                    <div className="transport-card-body">
                                        <div className="transport-card-field">
                                            <User size={14} />
                                            Driver: {bus.assigned_driver_id ? getDriverName(bus.assigned_driver_id) : 'Unassigned'}
                                        </div>
                                        <div className="transport-card-field">
                                            <MapPin size={14} />
                                            Route: {bus.route_name}
                                        </div>
                                    </div>
                                    <div className="transport-card-actions">
                                        <button className="btn btn-secondary" onClick={() => openBusForm(bus)}>
                                            <Edit size={14} /> Edit
                                        </button>
                                        <button className="btn btn-danger" onClick={() => deleteBus(bus.id)}>
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Drivers Tab */}
            {activeTab === 'drivers' && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        <button className="btn btn-primary" onClick={() => openDriverForm()}>
                            <Plus size={16} /> Add Driver
                        </button>
                    </div>
                    {drivers.length === 0 ? (
                        <div className="transport-empty">
                            <Users size={48} />
                            <h4>No drivers yet</h4>
                            <p>Create driver accounts to assign to buses.</p>
                        </div>
                    ) : (
                        <div className="transport-grid">
                            {drivers.map(driver => (
                                <div key={driver.id} className="transport-card">
                                    <div className="transport-card-header">
                                        <div>
                                            <div className="transport-card-title">{driver.name}</div>
                                            <div className="transport-card-subtitle">@{driver.username}</div>
                                        </div>
                                        <span className={`status-badge ${driver.is_active ? 'active' : 'inactive'}`}>
                                            <span className="status-dot"></span>
                                            {driver.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="transport-card-body">
                                        <div className="transport-card-field">
                                            <Bus size={14} />
                                            Bus: {driver.assigned_bus_id ? getBusNumber(driver.assigned_bus_id) : 'Unassigned'}
                                        </div>
                                    </div>
                                    <div className="transport-card-actions">
                                        <button className="btn btn-secondary" onClick={() => openDriverForm(driver)}>
                                            <Edit size={14} /> Edit
                                        </button>
                                        <button className="btn btn-danger" onClick={() => deleteDriver(driver.id)}>
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Bus Form Modal */}
            {showBusForm && (
                <div className="transport-form-overlay" onClick={() => setShowBusForm(false)}>
                    <div className="transport-form-card" onClick={e => e.stopPropagation()}>
                        <h3><Bus size={20} /> {editingBus ? 'Edit Bus' : 'Add New Bus'}</h3>
                        <form onSubmit={saveBus}>
                            <div className="form-group">
                                <label>Bus Number</label>
                                <input
                                    type="text"
                                    placeholder="e.g. BUS-01"
                                    required
                                    value={busForm.bus_number}
                                    onChange={e => setBusForm({ ...busForm, bus_number: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Route Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Campus → Station"
                                    required
                                    value={busForm.route_name}
                                    onChange={e => setBusForm({ ...busForm, route_name: e.target.value })}
                                />
                            </div>
                            <div className="transport-form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowBusForm(false)}>
                                    <X size={14} /> Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {editingBus ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Driver Form Modal */}
            {showDriverForm && (
                <div className="transport-form-overlay" onClick={() => setShowDriverForm(false)}>
                    <div className="transport-form-card" onClick={e => e.stopPropagation()}>
                        <h3><User size={20} /> {editingDriver ? 'Edit Driver' : 'Add New Driver'}</h3>
                        <form onSubmit={saveDriver}>
                            <div className="form-group">
                                <label>Driver Name</label>
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    required
                                    value={driverForm.name}
                                    onChange={e => setDriverForm({ ...driverForm, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Username (Login ID)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. driver01"
                                    required
                                    value={driverForm.username}
                                    onChange={e => setDriverForm({ ...driverForm, username: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>{editingDriver ? 'New Password (leave blank to keep)' : 'Password'}</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    required={!editingDriver}
                                    value={driverForm.password}
                                    onChange={e => setDriverForm({ ...driverForm, password: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Assign Bus</label>
                                <select
                                    value={driverForm.assigned_bus_id}
                                    onChange={e => setDriverForm({ ...driverForm, assigned_bus_id: e.target.value })}
                                >
                                    <option value="">— None —</option>
                                    {unassignedBuses.map(bus => (
                                        <option key={bus.id} value={bus.id}>
                                            Bus #{bus.bus_number} — {bus.route_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="transport-form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowDriverForm(false)}>
                                    <X size={14} /> Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {editingDriver ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransportManagement;
