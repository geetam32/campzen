import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    FlatList,
    Animated,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    DeviceEventEmitter,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Send,
    Bot,
    Sparkles,
    ChevronDown,
    MessageCircle,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// FLOWISE CONFIGURATION
const FLOWISE_API_URL = 'https://cloud.flowiseai.com/api/v1/prediction/18ea1625-b52f-4d69-9b1b-118cc48a1c3c';

// ─── Typing Indicator Component ────────────────────────────────────
const TypingIndicator = () => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateDot = (dot, delay) => {
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                    Animated.delay(600 - delay),
                ])
            ).start();
        };
        animateDot(dot1, 0);
        animateDot(dot2, 200);
        animateDot(dot3, 400);
    }, []);

    const getDotStyle = (anim) => ({
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
    });

    return (
        <View style={styles.typingContainer}>
            <View style={styles.typingBubble}>
                <View style={styles.typingDots}>
                    {[dot1, dot2, dot3].map((dot, i) => (
                        <Animated.View key={i} style={[styles.typingDot, getDotStyle(dot)]} />
                    ))}
                </View>
            </View>
        </View>
    );
};

// ─── Main AIChatBot Component ──────────────────────────────────────
const AIChatBot = () => {
    const { userData } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: '1',
            text: userData?.role === 'teacher'
                ? `Hi Prof. ${userData?.name?.split(' ')[0]}! 👋 I'm your **CampZen Assistant**.\n\nI can help you with attendance, notices, and class management. How can I assist you today?`
                : `Hi ${userData?.name?.split(' ')[0] || 'there'}! 👋 I'm your **CampZen AI Assistant**.\n\nI can help you with attendance, timetable, quizzes, and more! How can I help you today?`,
            isBot: true,
            timestamp: new Date(),
            suggestions: userData?.role === 'teacher'
                ? ['Daily Schedule', 'Class Attendance', 'My Materials', 'Recent Notices']
                : ['My Attendance', 'Today\'s Timetable', 'Upcoming Quizzes', 'Study Materials'],
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fabScaleAnim = useRef(new Animated.Value(1)).current;
    const [unreadCount, setUnreadCount] = useState(1);
    const [chatId, setChatId] = useState(null); // Flowise Session ID

    // Pulse animation for FAB
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('openAIChat', handleOpen);
        return () => sub.remove();
    }, []);

    const handleSend = async (text) => {
        const messageText = text || inputText.trim();
        if (!messageText) return;

        const userMsg = {
            id: Date.now().toString(),
            text: messageText,
            isBot: false,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        try {
            const response = await fetch(FLOWISE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: messageText,
                    chatId: chatId, // Maintain session
                    overrideConfig: {
                        vars: {
                            userName: userData?.name || 'Unknown',
                            userRole: userData?.role || 'student',
                            branch: userData?.branch || 'N/A',
                            section: userData?.section || 'N/A',
                            pin: userData?.pin || 'N/A',
                            collegeId: userData?.college_id || 'N/A'
                        }
                    }
                }),
            });

            const data = await response.json();

            // Store chatId from response if available
            if (data.chatId && !chatId) {
                setChatId(data.chatId);
            }

            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: data.text || "I'm sorry, I couldn't process that request.",
                isBot: true,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error('Flowise Error:', error);
            const errorMsg = {
                id: (Date.now() + 1).toString(),
                text: "⚠️ Sorry, I'm having trouble connecting to my brain right now. Please try again later.",
                isBot: true,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
        setUnreadCount(0);
        Animated.sequence([
            Animated.timing(fabScaleAnim, { toValue: 0.8, duration: 100, useNativeDriver: true }),
            Animated.timing(fabScaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // ─── Message Bubble ────────────────────────────────────────────
    const renderMessage = ({ item }) => {
        const isBot = item.isBot;
        return (
            <View style={{ marginBottom: 8 }}>
                <View style={[styles.messageBubbleRow, isBot ? styles.botRow : styles.userRow]}>
                    {isBot && (
                        <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.botAvatar}>
                            <Sparkles size={14} color="#fff" />
                        </LinearGradient>
                    )}
                    <View style={[styles.messageBubble, isBot ? styles.botBubble : styles.userBubble]}>
                        <Text style={[styles.messageText, isBot ? styles.botText : styles.userText]}>
                            {item.text}
                        </Text>
                        <Text style={[styles.timeText, isBot ? styles.botTimeText : styles.userTimeText]}>
                            {formatTime(item.timestamp)}
                        </Text>
                    </View>
                </View>
                {/* Suggestion Chips */}
                {isBot && item.suggestions && (
                    <View style={styles.suggestionsContainer}>
                        {item.suggestions.map((suggestion, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.suggestionChip}
                                onPress={() => handleSend(suggestion)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.suggestionText}>{suggestion}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <>
            <Modal
                visible={isOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalContainer}
                    >
                        <View style={styles.chatContainer}>
                            {/* ─── Chat Header ─────────────────────── */}
                            <LinearGradient
                                colors={['#6366f1', '#8b5cf6']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.chatHeader}
                            >
                                <View style={styles.headerLeft}>
                                    <View style={styles.headerAvatarBox}>
                                        <Bot size={20} color="#6366f1" />
                                    </View>
                                    <View>
                                        <Text style={styles.headerTitle}>CampZen AI</Text>
                                        <View style={styles.onlineRow}>
                                            <View style={styles.onlineDot} />
                                            <Text style={styles.onlineText}>{isTyping ? 'Typing...' : 'Online'}</Text>
                                        </View>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
                                    <ChevronDown size={24} color="#fff" />
                                </TouchableOpacity>
                            </LinearGradient>

                            {/* ─── Messages List ───────────────────── */}
                            <FlatList
                                ref={flatListRef}
                                data={messages}
                                keyExtractor={(item) => item.id}
                                renderItem={renderMessage}
                                contentContainerStyle={styles.messagesList}
                                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                                ListFooterComponent={isTyping ? <TypingIndicator /> : null}
                                showsVerticalScrollIndicator={false}
                            />

                            {/* ─── Input Bar ──────────────────────── */}
                            <View style={styles.inputContainer}>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Type a message..."
                                        placeholderTextColor="#94a3b8"
                                        value={inputText}
                                        onChangeText={setInputText}
                                        onSubmitEditing={() => handleSend()}
                                        returnKeyType="send"
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleSend()}
                                    disabled={!inputText.trim()}
                                >
                                    <LinearGradient
                                        colors={inputText.trim() ? ['#6366f1', '#8b5cf6'] : ['#cbd5e1', '#cbd5e1']}
                                        style={styles.sendBtn}
                                    >
                                        <Send size={18} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    fabContainer: { position: 'absolute', bottom: 85, right: 20, zIndex: 999, alignItems: 'center', justifyContent: 'center' },
    pulseRing: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(99, 102, 241, 0.2)' },
    fabTouchable: { elevation: 12, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, borderRadius: 30 },
    fab: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
    unreadBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 },
    unreadText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    chatContainer: { height: SCREEN_HEIGHT * 0.85, backgroundColor: '#f8fafc', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
    chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 50 : 16, paddingBottom: 16, paddingHorizontal: 20 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerAvatarBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
    onlineText: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    messagesList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    messageBubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
    botRow: { justifyContent: 'flex-start' },
    userRow: { justifyContent: 'flex-end' },
    botAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 2 },
    messageBubble: { maxWidth: '78%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
    botBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    userBubble: { backgroundColor: '#6366f1', borderBottomRightRadius: 6, elevation: 2, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
    messageText: { fontSize: 14.5, lineHeight: 21 },
    botText: { color: '#1e293b' },
    userText: { color: '#fff' },
    timeText: { fontSize: 10, marginTop: 6 },
    botTimeText: { color: '#94a3b8' },
    userTimeText: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
    suggestionsContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 38, marginTop: 6, gap: 6 },
    suggestionChip: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#c7d2fe' },
    suggestionText: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
    typingContainer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
    typingBubble: { backgroundColor: '#fff', borderRadius: 20, borderBottomLeftRadius: 6, paddingHorizontal: 18, paddingVertical: 14, marginLeft: 38, borderWidth: 1, borderColor: '#e2e8f0' },
    typingDots: { flexDirection: 'row', gap: 5 },
    typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 10 },
    inputWrapper: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 24, paddingHorizontal: 18, paddingVertical: Platform.OS === 'ios' ? 12 : 4, borderWidth: 1, borderColor: '#e2e8f0' },
    textInput: { fontSize: 15, color: '#1e293b', maxHeight: 80 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});

export default AIChatBot;
