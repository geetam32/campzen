import React, { useState, useRef, useCallback, useEffect } from 'react';
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
    Dimensions,
    Animated,
    StatusBar
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Shield, GraduationCap, Users, Lock, User, ArrowRight, ArrowLeft, Menu, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenCapture from 'expo-screen-capture';

const { width, height } = Dimensions.get('window');

// Animated Pressable Card with scale effect
const AnimatedCard = ({ children, onPress, style }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
        >
            <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
};

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
            bgLight: 'rgba(99, 102, 241, 0.08)',
            shadowColor: '#6366f1'
        },
        {
            id: 'student',
            label: 'Student',
            icon: GraduationCap,
            description: 'Learning Resources',
            color: ['#22c55e', '#15803d'],
            bgLight: 'rgba(34, 197, 94, 0.08)',
            shadowColor: '#22c55e'
        },
        {
            id: 'teacher',
            label: 'Teacher / Staff',
            icon: Users,
            description: 'Faculty & Support Staff',
            color: ['#8b5cf6', '#6d28d9'],
            bgLight: 'rgba(139, 92, 246, 0.08)',
            shadowColor: '#8b5cf6'
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
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* Gradient Background */}
            <LinearGradient
                colors={['#e0e7ff', '#ede9fe', '#f0f9ff', '#f8fafc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />


            {/* Top Bar: Menu only */}
            <View style={styles.topBar}>
                <View style={{ width: 44 }} />
                <TouchableOpacity style={styles.menuButton} activeOpacity={0.7}>
                    <Menu size={24} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {!selectedRole ? (
                        <>
                            {/* Brand Section */}
                            <View style={styles.brandSection}>
                                <Image
                                    source={require('../../assets/logocampzen.png')}
                                    style={styles.brandLogo}
                                    resizeMode="contain"
                                />
                                <Text style={styles.brandTitle}>
                                    Camp<Text style={styles.brandBlue}>zen</Text>
                                </Text>
                                <Text style={styles.brandTagline}>
                                    CONNECT  •  LEARN  •  SUCCEED
                                </Text>
                            </View>

                            {/* Selection Section */}
                            <View style={styles.selectionSection}>
                                <Text style={styles.selectionTitle}>Choose Your Identity</Text>
                                <Text style={styles.selectionSubtitle}>Select your role to continue</Text>
                            </View>

                            {/* Role Cards */}
                            <View style={styles.roleGrid}>
                                {roles.map((role) => (
                                    <AnimatedCard
                                        key={role.id}
                                        onPress={() => setSelectedRole(role.id)}
                                        style={[
                                            styles.roleCard,
                                            {
                                                backgroundColor: role.bgLight,
                                                shadowColor: role.shadowColor,
                                            }
                                        ]}
                                    >
                                        <LinearGradient
                                            colors={role.color}
                                            style={styles.roleIconBox}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                        >
                                            <role.icon color="#fff" size={24} />
                                        </LinearGradient>
                                        <View style={styles.roleMeta}>
                                            <Text style={styles.roleLabel}>{role.label}</Text>
                                            <Text style={styles.roleDescription}>{role.description}</Text>
                                        </View>
                                        <View style={styles.roleArrow}>
                                            <ArrowRight size={18} color="#94a3b8" />
                                        </View>
                                    </AnimatedCard>
                                ))}
                            </View>

                            {/* Footer */}
                            <Text style={styles.footerText}>
                                Powered by Campzen • v1.0
                            </Text>
                        </>
                    ) : (
                        /* Login Form */
                        <View style={styles.formSection}>
                            <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
                                <ArrowLeft size={18} color="#6366f1" />
                                <Text style={styles.backBtnText}>Change Role</Text>
                            </TouchableOpacity>

                            <View style={styles.formCard}>
                                <View style={styles.roleHeader}>
                                    <LinearGradient
                                        colors={currentRole.color}
                                        style={styles.roleBadgeIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <currentRole.icon color="#fff" size={22} />
                                    </LinearGradient>
                                    <View>
                                        <Text style={styles.roleHeaderTitle}>{currentRole.label} Login</Text>
                                        <Text style={styles.roleHeaderSub}>Provide your credentials</Text>
                                    </View>
                                </View>

                                {error ? (
                                    <View style={styles.errorBox}>
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                ) : null}

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
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={currentRole.color}
                                            style={styles.submitBtn}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
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
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Decorative Blobs
    blob1: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(99, 102, 241, 0.06)',
    },
    blob2: {
        position: 'absolute',
        bottom: 100,
        left: -40,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(34, 197, 94, 0.06)',
    },
    blob3: {
        position: 'absolute',
        top: height * 0.4,
        right: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(139, 92, 246, 0.05)',
    },

    // Top Bar
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 56 : 40,
        paddingBottom: 8,
        zIndex: 10,
    },
    cornerLogo: {
        width: 48,
        height: 48,
    },
    menuButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.06)',
        borderRadius: 14,
    },

    // Scroll
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },

    // Brand Section
    brandSection: {
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 0,
        paddingHorizontal: 20,
    },
    brandBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        marginBottom: 16,
    },
    brandBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6366f1',
        letterSpacing: 0.5,
    },
    brandTitle: {
        fontSize: 40,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -1,
    },
    brandLogo: {
        width: 220,
        height: 220,
        marginTop: -45,
        marginBottom: -80,
    },
    brandBlue: {
        color: '#6366f1',
    },
    brandTagline: {
        fontSize: 12,
        color: '#94a3b8',
        letterSpacing: 3,
        marginTop: 8,
        fontWeight: '600',
    },

    // Selection
    selectionSection: {
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 40,
        marginBottom: 8,
    },
    selectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
    },
    selectionSubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 6,
        fontWeight: '500',
    },

    // Role Grid
    roleGrid: {
        paddingHorizontal: 20,
        gap: 16,
        marginTop: 24,
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    roleIconBox: {
        width: 52,
        height: 52,
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
        fontWeight: '700',
        color: '#0f172a',
    },
    roleDescription: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 3,
        fontWeight: '500',
    },
    roleArrow: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(148, 163, 184, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Footer
    footerText: {
        textAlign: 'center',
        fontSize: 11,
        color: '#cbd5e1',
        marginTop: 40,
        fontWeight: '600',
        letterSpacing: 0.5,
    },

    // Form Section
    formSection: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.06)',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(99, 102, 241, 0.06)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    backBtnText: {
        color: '#6366f1',
        fontWeight: '700',
        fontSize: 14,
    },
    roleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 14,
    },
    roleBadgeIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    roleHeaderTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    roleHeaderSub: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 2,
        fontWeight: '500',
    },
    errorBox: {
        backgroundColor: '#fef2f2',
        padding: 14,
        borderRadius: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
    },
    errorText: {
        color: '#b91c1c',
        fontSize: 14,
        fontWeight: '500',
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
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        paddingHorizontal: 14,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: 52,
        color: '#1e293b',
        fontSize: 16,
        fontWeight: '500',
    },
    submitBtn: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});

export default LoginScreen;
