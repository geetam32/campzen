import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layouts/MainLayout';

// Auth pages
import Login from './pages/Login';
import AdminRegister from './pages/AdminRegister';
import SuperAdminLogin from './pages/SuperAdminLogin';
import ChangePassword from './pages/ChangePassword';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSettings from './pages/admin/AdminSettings';
import ClassManagement from './pages/admin/ClassManagement';
import TeacherManagement from './pages/admin/TeacherManagement';
import StudentManagement from './pages/admin/StudentManagement';
import TimetableManagement from './pages/admin/TimetableManagement';
import AttendanceOverview from './pages/admin/AttendanceOverview';
import ConcernsManagement from './pages/admin/ConcernsManagement';
import AdminNotices from './pages/admin/AdminNotices';
import TransportManagement from './pages/admin/TransportManagement';

// Super Admin pages
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';

// Teacher pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import AttendanceMarking from './pages/teacher/AttendanceMarking';
import TeacherQuizzes from './pages/teacher/TeacherQuizzes';
import TeacherMaterials from './pages/teacher/TeacherMaterials';
import TeacherTimetable from './pages/teacher/TeacherTimetable';
import StudentTracker from './pages/teacher/StudentTracker';
import TeacherNotices from './pages/teacher/TeacherNotices';
import MyTopics from './pages/teacher/MyTopics';


// Driver pages
import DriverDashboard from './pages/driver/DriverDashboard';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentTimetable from './pages/student/StudentTimetable';
import StudentQuizzes from './pages/student/StudentQuizzes';
import StudentMaterials from './pages/student/StudentMaterials';
import StudentConcerns from './pages/student/StudentConcerns';
import StudentProfile from './pages/student/StudentProfile';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentBusTracking from './pages/student/StudentBusTracking';
import AcademicCalendar from './pages/shared/AcademicCalendar';
import NoticeBoard from './pages/student/NoticeBoard';
import DailyReview from './pages/student/DailyReview';

import './styles/styles.css';


// Home redirector component
const HomeRedirect = () => {
  const { userData, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!userData) {
    return <Navigate to="/login" replace />;
  }

  // Custom logic: Redirect based on role
  if (userData.role === 'super_admin') return <Navigate to="/super-admin" replace />;
  return <Navigate to={`/${userData.role}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<AdminRegister />} />
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <MainLayout>
                  <Routes>
                    <Route index element={<AdminDashboard />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="classes" element={<ClassManagement />} />
                    <Route path="teachers" element={<TeacherManagement />} />
                    <Route path="students" element={<StudentManagement />} />
                    <Route path="timetables" element={<TimetableManagement />} />
                    <Route path="attendance" element={<AttendanceOverview />} />
                    <Route path="concerns" element={<ConcernsManagement />} />
                    <Route path="subjects" element={<SubjectManagement />} />
                    <Route path="transport" element={<TransportManagement />} />
                    <Route path="calendar" element={<AcademicCalendar />} />
                    <Route path="notices" element={<AdminNotices />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Teacher routes */}
          <Route
            path="/teacher/*"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <MainLayout>
                  <Routes>
                    <Route index element={<TeacherDashboard />} />
                    <Route path="attendance" element={<AttendanceMarking />} />
                    <Route path="quizzes" element={<TeacherQuizzes />} />
                    <Route path="materials" element={<TeacherMaterials />} />
                    <Route path="timetable" element={<TeacherTimetable />} />
                    <Route path="tracker" element={<StudentTracker />} />
                    <Route path="calendar" element={<AcademicCalendar />} />
                    <Route path="notices" element={<TeacherNotices />} />
                    <Route path="topics" element={<MyTopics />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Student routes */}
          <Route
            path="/student/*"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <MainLayout>
                  <Routes>
                    <Route index element={<StudentDashboard />} />
                    <Route path="attendance" element={<StudentAttendance />} />
                    <Route path="profile" element={<StudentProfile />} />
                    <Route path="timetable" element={<StudentTimetable />} />
                    <Route path="quizzes" element={<StudentQuizzes />} />
                    <Route path="materials" element={<StudentMaterials />} />
                    <Route path="concerns" element={<StudentConcerns />} />
                    <Route path="bus-tracking" element={<StudentBusTracking />} />
                    <Route path="calendar" element={<AcademicCalendar />} />
                    <Route path="notices" element={<NoticeBoard />} />
                    <Route path="daily-review" element={<DailyReview />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Driver routes */}
          <Route
            path="/driver/*"
            element={
              <ProtectedRoute allowedRoles={['driver']}>
                <MainLayout>
                  <Routes>
                    <Route index element={<DriverDashboard />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Super Admin routes */}
          <Route
            path="/super-admin/*"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <MainLayout>
                  <Routes>
                    <Route index element={<SuperAdminDashboard />} />
                    <Route path="requests" element={<SuperAdminDashboard />} />
                    <Route path="colleges" element={<div>Colleges Placeholder</div>} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Redirects */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
