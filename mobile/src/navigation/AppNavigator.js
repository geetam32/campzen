import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Image } from 'react-native';
import { LayoutDashboard, Users, GraduationCap, Settings, ClipboardList, BookOpen, User, Bell } from 'lucide-react-native';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';

// Admin Screens
import AdminDashboard from '../screens/admin/AdminDashboard';
import ClassManagement from '../screens/admin/ClassManagement';
import TeacherManagement from '../screens/admin/TeacherManagement';
import StudentManagement from '../screens/admin/StudentManagement';
import SubjectManagement from '../screens/admin/SubjectManagement';
import AdminSettings from '../screens/admin/AdminSettings';
import ConcernsManagement from '../screens/admin/ConcernsManagement';
import AdminNotices from '../screens/admin/AdminNotices';
import AttendanceOverview from '../screens/admin/AttendanceOverview';
import TimetableManagement from '../screens/admin/TimetableManagement';
import TransportManagement from '../screens/admin/TransportManagement';

// Teacher Screens
import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import AttendanceMarking from '../screens/teacher/AttendanceMarking';
import TeacherTimetable from '../screens/teacher/TeacherTimetable';
import TeacherMaterials from '../screens/teacher/TeacherMaterials';
import TeacherQuizzes from '../screens/teacher/TeacherQuizzes';
import StudentTracker from '../screens/teacher/StudentTracker';
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

// Driver Screens
import DriverDashboard from '../screens/driver/DriverDashboard';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AdminStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="ClassManagement" component={ClassManagement} />
        <Stack.Screen name="TeacherManagement" component={TeacherManagement} />
        <Stack.Screen name="StudentManagement" component={StudentManagement} />
        <Stack.Screen name="SubjectManagement" component={SubjectManagement} />
        <Stack.Screen name="AdminSettings" component={AdminSettings} />
        <Stack.Screen name="ConcernsManagement" component={ConcernsManagement} />
        <Stack.Screen name="AdminNotices" component={AdminNotices} />
        <Stack.Screen name="AttendanceOverview" component={AttendanceOverview} />
        <Stack.Screen name="TimetableManagement" component={TimetableManagement} />
        <Stack.Screen name="TransportManagement" component={TransportManagement} />
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
        <Stack.Screen name="Notices" component={TeacherNotices} />
        <Stack.Screen name="BusSharing" component={BusSharing} />
    </Stack.Navigator>
);

const StudentTabs = () => (
    <Tab.Navigator screenOptions={{
        headerShown: false,
        tabBarStyle: { height: 65, paddingBottom: 10, paddingTop: 10, borderTopWidth: 0, elevation: 0, backgroundColor: '#fff' },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
    }}>
        <Tab.Screen
            name="DashboardTab"
            component={StudentDashboard}
            options={{
                tabBarLabel: 'Home',
                tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} />
            }}
        />
        <Tab.Screen
            name="AttendanceTab"
            component={StudentAttendance}
            options={{
                tabBarLabel: 'Attendance',
                tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} />
            }}
        />
        <Tab.Screen
            name="ProfileTab"
            component={StudentProfile}
            options={{
                tabBarLabel: 'Profile',
                tabBarIcon: ({ color }) => <User size={22} color={color} />
            }}
        />
    </Tab.Navigator>
);

const StudentStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="StudentMain" component={StudentTabs} />
        <Stack.Screen name="NoticeBoard" component={NoticeBoard} />
        <Stack.Screen name="StudentMaterials" component={StudentMaterials} />
        <Stack.Screen name="StudentQuizzes" component={StudentQuizzes} />
        <Stack.Screen name="StudentTimetable" component={StudentTimetable} />
        <Stack.Screen name="StudentConcerns" component={StudentConcerns} />
        <Stack.Screen name="BusTracking" component={BusTracking} />
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
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user ? (
                <Stack.Screen name="Login" component={LoginScreen} />
            ) : (
                <>
                    {userData?.role === 'admin' && (
                        <Stack.Screen name="AdminRoot" component={AdminStack} />
                    )}
                    {userData?.role === 'teacher' && (
                        <Stack.Screen name="TeacherRoot" component={TeacherStack} />
                    )}
                    {userData?.role === 'student' && (
                        <Stack.Screen name="StudentRoot" component={StudentStack} />
                    )}
                    {userData?.role === 'driver' && (
                        <Stack.Screen name="DriverRoot" component={DriverStack} />
                    )}
                    {!userData?.role && (
                        <Stack.Screen name="Loading" component={() => (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#6366f1" />
                            </View>
                        )} />
                    )}
                </>
            )}
        </Stack.Navigator>
    );
};

export default AppNavigator;
