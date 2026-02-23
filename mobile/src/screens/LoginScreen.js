import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
    Dimensions
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Shield, GraduationCap, Users, Lock, User, ArrowRight, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
    const { login } = useAuth();
    const [selectedRole, setSelectedRole] = useState(null);
    const [formData, setFormData] = useState({
        collegeCode: '',
        userId: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const roles = [
        {
            id: 'admin',
            label: 'Admin',
            icon: Shield,
            description: 'Institute Management',
            color: ['#6366f1', '#4338ca'],
            bgLight: 'rgba(99, 102, 241, 0.1)'
        },
        {
            id: 'student',
            label: 'Student',
            icon: GraduationCap,
            description: 'Learning Resources',
            color: ['#22c55e', '#15803d'],
            bgLight: 'rgba(34, 197, 94, 0.1)'
        },
        {
            id: 'teacher',
            label: 'Teacher / Staff',
            icon: Users,
            description: 'Faculty & Support Staff',
            color: ['#8b5cf6', '#6d28d9'],
            bgLight: 'rgba(139, 92, 246, 0.1)'
        }
    ];

    const handleSubmit = async () => {
        setError('');
        setLoading(true);

        try {
            const result = await login(
                formData.collegeCode,
                formData.userId,
                formData.password
            );

            const isAuthorized = result.role === selectedRole || (selectedRole === 'teacher' && result.role === 'driver');

            if (!isAuthorized) {
                setError(`Invalid credentials. This is not a ${selectedRole} account.`);
                setLoading(false);
                return;
            }

            // Navigation will be handled by App.js based on auth state
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setSelectedRole(null);
        setError('');
        setFormData({ collegeCode: '', userId: '', password: '' });
    };

    const currentRole = roles.find(r => r.id === selectedRole);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.bgCircle1} />
            <View style={styles.bgCircle2} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.brandContainer}>
                    <Text style={styles.brandTitle}>
                        Campus<Text style={styles.brandBlue}>Net</Text>
                    </Text>
                    <Text style={styles.brandTagline}>── CONNECT • LEARN • SUCCEED ──</Text>
                </View>

                {!selectedRole ? (
                    <View style={styles.roleSelectionContainer}>
                        <Text style={styles.selectionTitle}>Choose Your Identity</Text>
                        <View style={styles.roleGrid}>
                            {roles.map((role) => (
                                <TouchableOpacity
                                    key={role.id}
                                    style={styles.roleCardWrapper}
                                    onPress={() => setSelectedRole(role.id)}
                                >
                                    <View style={[styles.roleCard, { backgroundColor: role.bgLight }]}>
                                        <LinearGradient
                                            colors={role.color}
                                            style={styles.roleIconBox}
                                        >
                                            <role.icon color="#fff" size={32} />
                                        </LinearGradient>
                                        <View style={styles.roleMeta}>
                                            <Text style={styles.roleLabel}>{role.label}</Text>
                                            <Text style={styles.roleDescription}>{role.description}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={styles.formContainer}>
                        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                            <ArrowLeft size={18} color="#6366f1" />
                            <Text style={styles.backBtnText}>Change Role</Text>
                        </TouchableOpacity>

                        <View style={styles.roleHeader}>
                            <LinearGradient
                                colors={currentRole.color}
                                style={styles.roleBadgeIcon}
                            >
                                <currentRole.icon color="#fff" size={20} />
                            </LinearGradient>
                            <View>
                                <Text style={styles.roleHeaderTitle}>{currentRole.label} Entrance</Text>
                                <Text style={styles.roleHeaderSub}>Please provide credentials</Text>
                            </View>
                        </View>

                        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>College Code</Text>
                                <View style={styles.inputWrapper}>
                                    <Shield size={18} color="#94a3b8" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. PIT01"
                                        placeholderTextColor="#94a3b8"
                                        value={formData.collegeCode}
                                        onChangeText={(text) => setFormData({ ...formData, collegeCode: text.toUpperCase() })}
                                        autoCapitalize="characters"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    {selectedRole === 'student' ? 'Student ID / PIN' : 'User ID / Email'}
                                </Text>
                                <View style={styles.inputWrapper}>
                                    <User size={18} color="#94a3b8" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder={selectedRole === 'student' ? 'Enter PIN' : 'Enter ID'}
                                        placeholderTextColor="#94a3b8"
                                        value={formData.userId}
                                        onChangeText={(text) => setFormData({ ...formData, userId: text })}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Access Password</Text>
                                <View style={styles.inputWrapper}>
                                    <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={true}
                                        value={formData.password}
                                        onChangeText={(text) => setFormData({ ...formData, password: text })}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                disabled={loading}
                                onPress={handleSubmit}
                            >
                                <LinearGradient
                                    colors={currentRole.color}
                                    style={styles.submitBtn}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Text style={styles.submitBtnText}>Authorize Access</Text>
                                            <ArrowRight size={20} color="#fff" />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    bgCircle1: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
    },
    bgCircle2: {
        position: 'absolute',
        bottom: -50,
        left: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
    },
    scrollContent: {
        padding: 24,
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
    },
    brandContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    brandTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    brandBlue: {
        color: '#6366f1',
    },
    brandTagline: {
        fontSize: 10,
        color: '#64748b',
        letterSpacing: 1,
        marginTop: 8,
    },
    selectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 24,
        textAlign: 'center',
    },
    roleGrid: {
        gap: 16,
    },
    roleCardWrapper: {
        width: '100%',
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.1)',
    },
    roleIconBox: {
        width: 56,
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    roleMeta: {
        flex: 1,
    },
    roleLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    roleDescription: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 2,
    },
    formContainer: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backBtnText: {
        marginLeft: 8,
        color: '#6366f1',
        fontWeight: '600',
    },
    roleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    roleBadgeIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    roleHeaderTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    roleHeaderSub: {
        fontSize: 12,
        color: '#64748b',
    },
    errorBox: {
        backgroundColor: '#fef2f2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
    },
    errorText: {
        color: '#b91c1c',
        fontSize: 14,
    },
    form: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 48,
        color: '#1e293b',
        fontSize: 15,
    },
    submitBtn: {
        flexDirection: 'row',
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});

export default LoginScreen;
