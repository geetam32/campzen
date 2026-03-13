import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Image, StyleSheet, TouchableOpacity, Text, Dimensions, Platform, DeviceEventEmitter } from 'react-native';
import { LayoutDashboard, Users, GraduationCap, Settings, ClipboardList, BookOpen, User, Bell, MessageSquarePlus, Home, Search, CirclePlus, MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';

// Admin Screens
import AdminDashboard from '../screens/admin/AdminDashboard';
import ClassManagement from '../screens/admin/ClassManagement';
import TeacherManagement from '../screens/admin/TeacherManagement';
import StudentManagement from '../screens/admin/StudentManagement';
import SubjectManagement from '../screens/admin/SubjectManagement';
import ConcernsManagement from '../screens/admin/ConcernsManagement';
import AdminNotices from '../screens/admin/AdminNotices';
import AttendanceOverview from '../screens/admin/AttendanceOverview';
import TimetableManagement from '../screens/admin/TimetableManagement';
import TransportManagement from '../screens/admin/TransportManagement';
import AdminFeedback from '../screens/admin/AdminFeedback';
import AdminSettings from '../screens/admin/AdminSettings';

// Teacher Screens
import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import AttendanceMarking from '../screens/teacher/AttendanceMarking';
import TeacherTimetable from '../screens/teacher/TeacherTimetable';
import TeacherMaterials from '../screens/teacher/TeacherMaterials';
import TeacherQuizzes from '../screens/teacher/TeacherQuizzes';
import StudentTracker from '../screens/teacher/StudentTracker';
import ExamMarks from '../screens/teacher/ExamMarks';
import TeacherNotices from '../screens/teacher/TeacherNotices';
import BusSharing from '../screens/teacher/BusSharing';

// Student Screens
import StudentDashboard from '../screens/student/StudentDashboard';
import StudentAttendance from '../screens/student/StudentAttendance';
import StudentProfile from '../screens/student/StudentProfile';
import NoticeBoard from '../screens/student/NoticeBoard';
import StudentMaterials from '../screens/student/StudentMaterials';
import StudentQuizzes from '../screens/student/StudentQuizzes';
import StudentTimetable from '../screens/student/StudentTimetable';
import StudentConcerns from '../screens/student/StudentConcerns';
import BusTracking from '../screens/student/BusTracking';
import StudentFeedback from '../screens/student/StudentFeedback';

// Driver Screens
import DriverDashboard from '../screens/driver/DriverDashboard';

// AI ChatBot Component
import AIChatBot from '../components/AIChatBot';

// New Screens
import MyTopics from '../screens/teacher/MyTopics';
import DailyReview from '../screens/student/DailyReview';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const LoadingScreen = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#6366f1" />
    </View>
);

const AdminStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="ClassManagement" component={ClassManagement} />
        <Stack.Screen name="TeacherManagement" component={TeacherManagement} />
        <Stack.Screen name="StudentManagement" component={StudentManagement} />
        <Stack.Screen name="SubjectManagement" component={SubjectManagement} />

        <Stack.Screen name="ConcernsManagement" component={ConcernsManagement} />
        <Stack.Screen name="AdminNotices" component={AdminNotices} />
        <Stack.Screen name="AttendanceOverview" component={AttendanceOverview} />
        <Stack.Screen name="TimetableManagement" component={TimetableManagement} />
        <Stack.Screen name="TransportManagement" component={TransportManagement} />
        <Stack.Screen name="AdminFeedback" component={AdminFeedback} />
        <Stack.Screen name="AdminSettings" component={AdminSettings} />
    </Stack.Navigator>
);



const TeacherStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
        <Stack.Screen name="Attendance" component={AttendanceMarking} />
        <Stack.Screen name="MyTimetable" component={TeacherTimetable} />
        <Stack.Screen name="Materials" component={TeacherMaterials} />
        <Stack.Screen name="Quizzes" component={TeacherQuizzes} />
        <Stack.Screen name="Tracker" component={StudentTracker} />
        <Stack.Screen name="ExamMarks" component={ExamMarks} />
        <Stack.Screen name="MyTopics" component={MyTopics} />
        <Stack.Screen name="Notices" component={TeacherNotices} />
    </Stack.Navigator>
);

const CustomTabBar = ({ state, descriptors, navigation }) => {
    return (
        <View style={styles.tabBarContainer}>
            <LinearGradient
                colors={['#fff', '#f8fafc']}
                style={styles.floatingDock}
            >
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const Icon = options.tabBarIcon;

                    if (route.name === 'AIChatPlaceholder') {
                        return (
                            <TouchableOpacity
                                key={route.key}
                                onPress={() => DeviceEventEmitter.emit('openAIChat')}
                                style={styles.centerButtonContainer}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#6366f1', '#4f46e5']}
                                    style={styles.centerButton}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <MessageCircle size={28} color="#fff" />
                                </LinearGradient>
                                <Text style={styles.centerButtonText}>AI Chat</Text>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={styles.tabButton}
                            activeOpacity={0.7}
                        >
                            <Icon color={isFocused ? '#6366f1' : '#94a3b8'} size={24} />
                            <Text style={[styles.tabLabel, { color: isFocused ? '#6366f1' : '#94a3b8' }]}>
                                {options.tabBarLabel}
                            </Text>
                            {isFocused && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    );
                })}
            </LinearGradient>
        </View>
    );
};

const StudentTabs = () => {
    const { collegeSettings } = useAuth();
    const showProfile = collegeSettings?.module_visibility?.student?.profile !== false;

    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen
                name="DashboardTab"
                component={StudentDashboard}
                options={{
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color }) => <Home size={24} color={color} />
                }}
            />
            <Tab.Screen
                name="AIChatPlaceholder"
                component={View} // This will be intercepted
                options={{
                    tabBarLabel: 'AI Chat',
                    tabBarIcon: ({ color }) => <MessageCircle size={24} color={color} />
                }}
            />
            {showProfile && (
                <Tab.Screen
                    name="ProfileTab"
                    component={StudentProfile}
                    options={{
                        tabBarLabel: 'Profile',
                        tabBarIcon: ({ color }) => <User size={24} color={color} />
                    }}
                />
            )}
        </Tab.Navigator>
    );
};



const StudentStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="StudentMain" component={StudentTabs} />
        <Stack.Screen name="NoticeBoard" component={NoticeBoard} />
        <Stack.Screen name="StudentMaterials" component={StudentMaterials} />
        <Stack.Screen name="StudentQuizzes" component={StudentQuizzes} />
        <Stack.Screen name="StudentTimetable" component={StudentTimetable} />
        <Stack.Screen name="StudentConcerns" component={StudentConcerns} />
        <Stack.Screen name="StudentAttendance" component={StudentAttendance} />
        <Stack.Screen name="DailyReview" component={DailyReview} />
        <Stack.Screen name="BusTracking" component={BusTracking} />
        <Stack.Screen name="StudentFeedback" component={StudentFeedback} />
    </Stack.Navigator>
);

const DriverStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="DriverDashboard" component={DriverDashboard} />
    </Stack.Navigator>
);

const AppNavigator = () => {
    const { user, userData, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <Image
                    source={require('../../assets/logocampzen.png')}
                    style={{ width: 300, height: 300 }}
                    resizeMode="contain"
                />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : userData?.role === 'admin' ? (
                    <Stack.Screen name="AdminRoot" component={AdminStack} />
                ) : userData?.role === 'teacher' ? (
                    <Stack.Screen name="TeacherRoot" component={TeacherStack} />
                ) : userData?.role === 'student' ? (
                    <Stack.Screen name="StudentRoot" component={StudentStack} />
                ) : userData?.role === 'driver' ? (
                    <Stack.Screen name="DriverRoot" component={DriverStack} />
                ) : (
                    <Stack.Screen name="Login" component={LoginScreen} />
                )}
            </Stack.Navigator>
            {user && userData?.role === 'student' && <AIChatBot />}
        </View>
    );
};

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 20,
        left: 20,
        right: 20,
        height: 80,
    },
    floatingDock: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 30,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 10,
        // Premium shadows
        elevation: 15,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.1)',
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    centerButtonContainer: {
        width: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -20,
    },
    centerButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },

    centerButtonText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#6366f1',
        marginTop: 6,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -10,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#6366f1',
    }
});

export default AppNavigator;
