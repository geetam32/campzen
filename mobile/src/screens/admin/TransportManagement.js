import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import {
    ArrowLeft,
    Bus,
    Users,
    Plus,
    Edit,
    Trash2,
    ChevronRight,
    Search,
    Shield,
    Settings,
    Truck
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const TransportManagement = ({ navigation }) => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState('config'); // 'config', 'buses', 'drivers'
    const [isModuleEnabled, setIsModuleEnabled] = useState(true);
    const [buses, setBuses] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form Modals
    const [busModalVisible, setBusModalVisible] = useState(false);
    const [driverModalVisible, setDriverModalVisible] = useState(false);

    // New Bus Form
    const [newBus, setNewBus] = useState({ id: '', route: '', driver_id: '', status: 'inactive' });
    const [editingBus, setEditingBus] = useState(null);

    // New Driver Form
    const [newDriver, setNewDriver] = useState({ name: '', email: '', password: '', bus_id: '', status: 'active' });
    const [editingDriver, setEditingDriver] = useState(null);

    useEffect(() => {
        if (!userData?.college_id) return;

        setLoading(true);
        const busesRef = collection(db, 'colleges', userData.college_id, 'buses');
        const driversRef = query(collection(db, 'drivers'), where('college_id', '==', userData.college_id));

        const unsubBuses = onSnapshot(busesRef, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBuses(list);
        });

        const unsubDrivers = onSnapshot(driversRef, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDrivers(list);
            setLoading(false);
        });

        // Fetch config
        const configRef = doc(db, 'colleges', userData.college_id, 'config', 'transport');
        getDocs(query(collection(db, 'colleges', userData.college_id, 'config'))).then(() => {
            // Simple approach for now
        });

        return () => {
            unsubBuses();
            unsubDrivers();
        };
    }, [userData]);

    const toggleModule = async (val) => {
        setIsModuleEnabled(val);
        // Save to Firebase
        try {
            const configRef = doc(db, 'colleges', userData.college_id, 'config', 'transport');
            await setDoc(configRef, { enabled: val }, { merge: true });
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddBus = async () => {
        if (!newBus.id || !newBus.route) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }
        setLoading(true);
        try {
            if (editingBus) {
                await updateDoc(doc(db, 'colleges', userData.college_id, 'buses', editingBus.id), {
                    ...newBus,
                    last_updated: serverTimestamp()
                });
            } else {
                await setDoc(doc(db, 'colleges', userData.college_id, 'buses', newBus.id), {
                    ...newBus,
                    college_id: userData.college_id,
                    created_at: serverTimestamp()
                });
            }
            setBusModalVisible(false);
            setEditingBus(null);
            setNewBus({ id: '', route: '', driver_id: '', status: 'inactive' });
            Alert.alert("Success", editingBus ? "Bus updated successfully" : "Bus added successfully");
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to add bus");
        } finally {
            setLoading(false);
        }
    };

    const handleAddDriver = async () => {
        if (!newDriver.name || !newDriver.email || !newDriver.password) {
            Alert.alert("Error", "Please fill all required fields");
            return;
        }
        setLoading(true);
        try {
            if (editingDriver) {
                await updateDoc(doc(db, 'drivers', editingDriver.id), {
                    ...newDriver,
                    last_updated: serverTimestamp()
                });
            } else {
                const driverId = newDriver.email.replace(/@|\./g, '_');
                await setDoc(doc(db, 'drivers', driverId), {
                    ...newDriver,
                    role: 'driver',
                    college_id: userData.college_id,
                    created_at: serverTimestamp(),
                    uid: driverId
                });
            }

            // Update bus if assigned or changed
            if (newDriver.bus_id) {
                const driverId = editingDriver ? editingDriver.id : newDriver.email.replace(/@|\./g, '_');
                await updateDoc(doc(db, 'colleges', userData.college_id, 'buses', newDriver.bus_id), {
                    driver_id: driverId,
                    driver_name: newDriver.name
                });
            }

            setDriverModalVisible(false);
            setEditingDriver(null);
            setNewDriver({ name: '', email: '', password: '', bus_id: '', status: 'active' });
            Alert.alert("Success", editingDriver ? "Driver updated successfully" : "Driver added successfully");
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to add driver");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBus = (id) => {
        Alert.alert("Delete", "Are you sure you want to delete this bus?", [
            { text: "Cancel" },
            {
                text: "Delete", style: 'destructive', onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'colleges', userData.college_id, 'buses', id));
                        Alert.alert("Success", "Bus deleted");
                    } catch (err) {
                        Alert.alert("Error", "Failed to delete");
                    }
                }
            }
        ]);
    };

    const handleDeleteDriver = (id) => {
        Alert.alert("Delete", "Are you sure you want to delete this driver?", [
            { text: "Cancel" },
            {
                text: "Delete", style: 'destructive', onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'drivers', id));
                        Alert.alert("Success", "Driver deleted");
                    } catch (err) {
                        Alert.alert("Error", "Failed to delete");
                    }
                }
            }
        ]);
    };

    const handleEditBus = (bus) => {
        setEditingBus(bus);
        setNewBus({ id: bus.id, route: bus.route, driver_id: bus.driver_id || '', status: bus.status || 'inactive' });
        setBusModalVisible(true);
    };

    const handleEditDriver = (driver) => {
        setEditingDriver(driver);
        setNewDriver({
            name: driver.name,
            email: driver.email,
            password: driver.password || '',
            bus_id: driver.bus_id || '',
            status: driver.status || 'active'
        });
        setDriverModalVisible(true);
    };

    const renderConfig = () => (
        <View style={styles.tabContent}>
            <View style={styles.card}>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>Transport Module</Text>
                    <Text style={styles.cardDesc}>
                        {isModuleEnabled ? "Module is enabled. Students can view bus tracking." : "Module is disabled. Feature will be hidden for students."}
                    </Text>
                </View>
                <Switch
                    value={isModuleEnabled}
                    onValueChange={toggleModule}
                    trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
                />
            </View>
        </View>
    );

    const renderBuses = () => (
        <View style={styles.tabContent}>
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => setBusModalVisible(true)}
            >
                <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.addBtnGradient}>
                    <Plus size={20} color="#fff" />
                    <Text style={styles.addBtnText}>Add Bus</Text>
                </LinearGradient>
            </TouchableOpacity>

            {buses.length === 0 ? (
                <View style={styles.emptyState}>
                    <Bus size={48} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>No Buses Registered</Text>
                    <Text style={styles.emptySub}>Add your first bus to get started.</Text>
                </View>
            ) : (
                <View style={styles.list}>
                    {buses.map((bus) => (
                        <View key={bus.id} style={styles.itemCard}>
                            <View style={styles.itemHeader}>
                                <View>
                                    <Text style={styles.itemTitle}>Bus #{bus.id}</Text>
                                    <Text style={styles.itemSub}>{bus.route}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: bus.status === 'active' ? '#ecfdf5' : '#fff1f2' }]}>
                                    <View style={[styles.statusDot, { backgroundColor: bus.status === 'active' ? '#10b981' : '#f43f5e' }]} />
                                    <Text style={[styles.statusText, { color: bus.status === 'active' ? '#10b981' : '#f43f5e' }]}>
                                        {bus.status?.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.itemDetails}>
                                <View style={styles.detailRow}>
                                    <Users size={14} color="#64748b" />
                                    <Text style={styles.detailText}>Driver: {bus.driver_name || 'Not assigned'}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Edit size={14} color="#64748b" />
                                    <Text style={styles.detailText}>Route: {bus.route}</Text>
                                </View>
                            </View>
                            <View style={styles.itemActions}>
                                <TouchableOpacity style={styles.actionIconButton} onPress={() => handleEditBus(bus)}>
                                    <Edit size={16} color="#64748b" />
                                    <Text style={styles.actionIconText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionIconButton, { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }]}
                                    onPress={() => handleDeleteBus(bus.id)}
                                >
                                    <Trash2 size={16} color="#f43f5e" />
                                    <Text style={[styles.actionIconText, { color: '#f43f5e' }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    const renderDrivers = () => (
        <View style={styles.tabContent}>
            <TouchableOpacity style={styles.addButton} onPress={() => setDriverModalVisible(true)}>
                <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.addBtnGradient}>
                    <Plus size={20} color="#fff" />
                    <Text style={styles.addBtnText}>Add Driver</Text>
                </LinearGradient>
            </TouchableOpacity>

            {drivers.length === 0 ? (
                <View style={styles.emptyState}>
                    <Users size={48} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>No Drivers Added</Text>
                    <Text style={styles.emptySub}>Manage your transport staff here.</Text>
                </View>
            ) : (
                <View style={styles.list}>
                    {drivers.map((driver) => (
                        <View key={driver.id} style={styles.itemCard}>
                            <View style={styles.itemHeader}>
                                <View>
                                    <Text style={styles.itemTitle}>{driver.name}</Text>
                                    <Text style={styles.itemSub}>{driver.email}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: '#ecfdf5' }]}>
                                    <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                                    <Text style={[styles.statusText, { color: '#10b981' }]}>ACTIVE</Text>
                                </View>
                            </View>
                            <View style={styles.itemDetails}>
                                <View style={styles.detailRow}>
                                    <Bus size={14} color="#64748b" />
                                    <Text style={styles.detailText}>Assigned Bus: {driver.bus_id || 'None'}</Text>
                                </View>
                            </View>
                            <View style={styles.itemActions}>
                                <TouchableOpacity style={styles.actionIconButton} onPress={() => handleEditDriver(driver)}>
                                    <Edit size={16} color="#64748b" />
                                    <Text style={styles.actionIconText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionIconButton, { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }]}
                                    onPress={() => handleDeleteDriver(driver.id)}
                                >
                                    <Trash2 size={16} color="#f43f5e" />
                                    <Text style={[styles.actionIconText, { color: '#f43f5e' }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>🚚 Transport Management</Text>
                    <Text style={styles.subtitle}>Configure buses, drivers, and live tracking</Text>
                </View>
            </View>

            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'config' && styles.activeTab]}
                    onPress={() => setActiveTab('config')}
                >
                    <Settings size={16} color={activeTab === 'config' ? '#6366f1' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'config' && styles.activeTabText]}>Module Config</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'buses' && styles.activeTab]}
                    onPress={() => setActiveTab('buses')}
                >
                    <Bus size={16} color={activeTab === 'buses' ? '#6366f1' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'buses' && styles.activeTabText]}>Buses</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'drivers' && styles.activeTab]}
                    onPress={() => setActiveTab('drivers')}
                >
                    <Users size={16} color={activeTab === 'drivers' ? '#6366f1' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'drivers' && styles.activeTabText]}>Drivers</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
                ) : (
                    <>
                        {activeTab === 'config' && renderConfig()}
                        {activeTab === 'buses' && renderBuses()}
                        {activeTab === 'drivers' && renderDrivers()}
                    </>
                )}
            </ScrollView>

            {/* Add Bus Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={busModalVisible}
                onRequestClose={() => {
                    setBusModalVisible(false);
                    setEditingBus(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Bus size={20} color="#6366f1" />
                            <Text style={styles.modalTitle}>{editingBus ? 'Edit Bus' : 'Add New Bus'}</Text>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.inputLabel}>Bus Number</Text>
                            <TextInput
                                style={[styles.input, editingBus && { opacity: 0.6 }]}
                                placeholder="e.g. BUS-01"
                                value={newBus.id}
                                onChangeText={(val) => setNewBus({ ...newBus, id: val })}
                                editable={!editingBus}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.inputLabel}>Route Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Campus → Station"
                                value={newBus.route}
                                onChangeText={(val) => setNewBus({ ...newBus, route: val })}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => {
                                    setBusModalVisible(false);
                                    setEditingBus(null);
                                    setNewBus({ id: '', route: '', driver_id: '', status: 'inactive' });
                                }}
                            >
                                <Text style={styles.cancelBtnText}>✕ Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.submitBtn}
                                onPress={handleAddBus}
                                disabled={loading}
                            >
                                <LinearGradient colors={['#7C3AED', '#6366f1']} style={styles.submitGradient}>
                                    {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                                        <>
                                            <Shield size={16} color="#fff" />
                                            <Text style={styles.submitBtnText}>{editingBus ? 'Update' : 'Create'}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Driver Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={driverModalVisible}
                onRequestClose={() => {
                    setDriverModalVisible(false);
                    setEditingDriver(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Users size={20} color="#6366f1" />
                            <Text style={styles.modalTitle}>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</Text>
                        </View>

                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            <View style={styles.formGroup}>
                                <Text style={styles.inputLabel}>Driver Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Full name"
                                    value={newDriver.name}
                                    onChangeText={(val) => setNewDriver({ ...newDriver, name: val })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.inputLabel}>Username (Login ID)</Text>
                                <TextInput
                                    style={[styles.input, editingDriver && { opacity: 0.6 }]}
                                    placeholder="admin@cme001.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={newDriver.email}
                                    onChangeText={(val) => setNewDriver({ ...newDriver, email: val })}
                                    editable={!editingDriver}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.inputLabel}>Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    secureTextEntry
                                    value={newDriver.password}
                                    onChangeText={(val) => setNewDriver({ ...newDriver, password: val })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.inputLabel}>Assign Bus</Text>
                                <View style={styles.pickerWrapper}>
                                    <View style={styles.pickerPlaceholder}>
                                        <Text style={styles.pickerText}>
                                            {newDriver.bus_id ? `Bus #${newDriver.bus_id}` : '— None —'}
                                        </Text>
                                        <ChevronRight size={16} color="#94a3b8" style={{ transform: [{ rotate: '90deg' }] }} />
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.busSelector}>
                                        <TouchableOpacity
                                            style={[styles.busChip, !newDriver.bus_id && styles.activeBusChip]}
                                            onPress={() => setNewDriver({ ...newDriver, bus_id: '' })}
                                        >
                                            <Text style={[styles.busChipText, !newDriver.bus_id && styles.activeBusChipText]}>None</Text>
                                        </TouchableOpacity>
                                        {buses.map(bus => (
                                            <TouchableOpacity
                                                key={bus.id}
                                                style={[styles.busChip, newDriver.bus_id === bus.id && styles.activeBusChip]}
                                                onPress={() => setNewDriver({ ...newDriver, bus_id: bus.id })}
                                            >
                                                <Text style={[styles.busChipText, newDriver.bus_id === bus.id && styles.activeBusChipText]}>#{bus.id}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => {
                                    setDriverModalVisible(false);
                                    setEditingDriver(null);
                                    setNewDriver({ name: '', email: '', password: '', bus_id: '', status: 'active' });
                                }}
                            >
                                <Text style={styles.cancelBtnText}>✕ Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.submitBtn}
                                onPress={handleAddDriver}
                                disabled={loading}
                            >
                                <LinearGradient colors={['#7C3AED', '#6366f1']} style={styles.submitGradient}>
                                    {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                                        <>
                                            <Shield size={16} color="#fff" />
                                            <Text style={styles.submitBtnText}>{editingDriver ? 'Update' : 'Create'}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#fff',
    },
    backBtn: { marginRight: 15, padding: 5 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        gap: 8,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: { borderBottomColor: '#6366f1' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    activeTabText: { color: '#6366f1' },
    tabContent: { padding: 20 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardInfo: { flex: 1, paddingRight: 20 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    cardDesc: { fontSize: 13, color: '#64748b', marginTop: 4 },
    addButton: { alignSelf: 'flex-end', marginBottom: 20 },
    addBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    },
    addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
    list: { gap: 16 },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
    },
    itemTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    itemSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    itemDetails: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { fontSize: 13, color: '#475569' },
    itemActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: '#fafafa',
    },
    actionIconButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    actionIconText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b'
    },
    formGroup: {
        marginBottom: 20
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 8
    },
    input: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1e293b'
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748b'
    },
    submitBtn: {
        flex: 1.5,
        borderRadius: 12,
        overflow: 'hidden'
    },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff'
    },
    pickerWrapper: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 12
    },
    pickerPlaceholder: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    pickerText: {
        fontSize: 14,
        color: '#64748b'
    },
    busSelector: {
        flexDirection: 'row',
        gap: 8
    },
    busChip: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8
    },
    activeBusChip: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1'
    },
    busChipText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600'
    },
    activeBusChipText: {
        color: '#fff'
    }
});

export default TransportManagement;
