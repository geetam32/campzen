import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db } from '../api/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();
const LOCAL_SESSION_KEY = '@campzen_local_session';

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    // Track if a local (non-Firebase) session is active to prevent onAuthStateChanged from clearing it
    const isLocalSession = useRef(false);

    // Save local session (students/drivers) to AsyncStorage for APK persistence
    const saveLocalSession = async (userObj, userDataObj) => {
        try {
            const sessionData = JSON.stringify({ user: userObj, userData: userDataObj });
            await AsyncStorage.setItem(LOCAL_SESSION_KEY, sessionData);
        } catch (e) {
            console.error('Failed to save local session:', e);
        }
    };

    // Clear saved local session
    const clearLocalSession = async () => {
        try {
            await AsyncStorage.removeItem(LOCAL_SESSION_KEY);
        } catch (e) {
            console.error('Failed to clear local session:', e);
        }
    };

    // Restore local session on app startup
    const restoreLocalSession = async () => {
        try {
            const sessionStr = await AsyncStorage.getItem(LOCAL_SESSION_KEY);
            if (sessionStr) {
                const session = JSON.parse(sessionStr);
                if (session.user && session.userData) {
                    isLocalSession.current = true;
                    setUser(session.user);
                    setUserData(session.userData);
                    setLoading(false);
                    return true;
                }
            }
        } catch (e) {
            console.error('Failed to restore local session:', e);
        }
        return false;
    };

    async function login(collegeCode, userId, password) {
        const collegeQuery = query(collection(db, 'colleges'), where('code', '==', collegeCode.toUpperCase()));
        const collegeSnapshot = await getDocs(collegeQuery);

        if (collegeSnapshot.empty) {
            throw new Error('Invalid College Code');
        }

        const collegeDoc = collegeSnapshot.docs[0];
        const collegeId = collegeDoc.id;

        let foundUserDoc = null;
        let userRole = null;
        let userEmail = null;
        let requiresFirebaseAuth = true;

        // Check admins
        const adminQuery = query(
            collection(db, 'admins'),
            where('college_id', '==', collegeId)
        );
        const adminSnapshot = await getDocs(adminQuery);
        for (const docSnap of adminSnapshot.docs) {
            const data = docSnap.data();
            if (data.uid === userId || data.email === userId || data.name === userId) {
                foundUserDoc = { id: docSnap.id, ...data, college_id: collegeId };
                userRole = 'admin';
                userEmail = data.email;
                break;
            }
        }

        // Check teachers
        if (!foundUserDoc) {
            const teacherQuery = query(
                collection(db, 'teachers'),
                where('college_id', '==', collegeId)
            );
            const teacherSnapshot = await getDocs(teacherQuery);
            for (const docSnap of teacherSnapshot.docs) {
                const data = docSnap.data();
                if (data.uid === userId || data.email === userId) {
                    foundUserDoc = { id: docSnap.id, ...data, college_id: collegeId };
                    userRole = 'teacher';
                    userEmail = data.email;
                    requiresFirebaseAuth = !!userEmail;
                    break;
                }
            }
        }

        // Check students
        if (!foundUserDoc) {
            const studentQuery = query(
                collection(db, 'students'),
                where('college_id', '==', collegeId)
            );
            const studentSnapshot = await getDocs(studentQuery);
            for (const docSnap of studentSnapshot.docs) {
                const data = docSnap.data();
                if (data.pin === userId || data.uid === userId) {
                    foundUserDoc = { id: docSnap.id, ...data, college_id: collegeId };
                    userRole = 'student';
                    requiresFirebaseAuth = false;
                    break;
                }
            }
        }

        // Check drivers
        if (!foundUserDoc) {
            const driverQuery = query(
                collection(db, 'drivers'),
                where('college_id', '==', collegeId)
            );
            const driverSnapshot = await getDocs(driverQuery);
            for (const docSnap of driverSnapshot.docs) {
                const data = docSnap.data();
                if (
                    data.uid?.toLowerCase() === userId.toLowerCase() ||
                    data.email?.toLowerCase() === userId.toLowerCase() ||
                    data.username?.toLowerCase() === userId.toLowerCase()
                ) {
                    foundUserDoc = { id: docSnap.id, ...data, college_id: collegeId };
                    userRole = 'driver';
                    userEmail = data.email;
                    requiresFirebaseAuth = false;
                    break;
                }
            }
        }

        if (!foundUserDoc) {
            throw new Error('User not found. Check your User ID and College Code.');
        }

        if (requiresFirebaseAuth && !userEmail) {
            throw new Error('This account is not fully registered. Please contact your administrator.');
        }

        if (requiresFirebaseAuth) {
            // Firebase Auth login (admins, teachers with email)
            isLocalSession.current = false;
            await clearLocalSession();
            try {
                const result = await signInWithEmailAndPassword(auth, userEmail, password);
                // The onAuthStateChanged listener will handle setting the userData
            } catch (authError) {
                if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
                    throw new Error('Incorrect password.');
                }
                throw authError;
            }
        } else {
            // Local auth (students, drivers) — persist to AsyncStorage
            const validPassword = foundUserDoc.password || (foundUserDoc.pin ? foundUserDoc.pin.toString() : '');
            if (validPassword !== password) {
                throw new Error('Incorrect password.');
            }
            const localUser = { uid: foundUserDoc.id, email: foundUserDoc.email, ...foundUserDoc };
            isLocalSession.current = true;
            setUser(localUser);
            setUserData(foundUserDoc);
            await saveLocalSession(localUser, foundUserDoc);
        }

        return { userDoc: foundUserDoc, role: userRole, mustChangePassword: foundUserDoc.must_change_password };
    }

    async function logout() {
        isLocalSession.current = false;
        setUser(null);
        setUserData(null);
        await clearLocalSession();
        return signOut(auth);
    }

    useEffect(() => {
        let isMounted = true;

        const initAuth = async () => {
            // First, try to restore a saved local session (student/driver)
            const restoredLocal = await restoreLocalSession();

            // Then set up Firebase Auth listener for admin/teacher sessions
            const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
                if (!isMounted) return;

                // If a local session is active, don't let onAuthStateChanged override it
                if (isLocalSession.current) {
                    return;
                }

                setLoading(true);
                if (currentUser) {
                    let userDoc = null;

                    // Admin check
                    const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
                    if (adminDoc.exists()) {
                        userDoc = { id: adminDoc.id, ...adminDoc.data() };
                    }

                    // Teacher check
                    if (!userDoc) {
                        const teacherDoc = await getDoc(doc(db, 'teachers', currentUser.uid));
                        if (teacherDoc.exists()) {
                            userDoc = { id: teacherDoc.id, ...teacherDoc.data() };
                        }
                    }

                    // Student check
                    if (!userDoc) {
                        const studentDoc = await getDoc(doc(db, 'students', currentUser.uid));
                        if (studentDoc.exists()) {
                            userDoc = { id: studentDoc.id, ...studentDoc.data() };
                        }
                    }

                    // Driver check
                    if (!userDoc) {
                        const driverDoc = await getDoc(doc(db, 'drivers', currentUser.uid));
                        if (driverDoc.exists()) {
                            userDoc = { id: driverDoc.id, ...driverDoc.data(), role: 'driver' };
                        }
                    }

                    // Super Admin check
                    if (!userDoc) {
                        const superAdminDoc = await getDoc(doc(db, 'super_admins', currentUser.uid));
                        if (superAdminDoc.exists()) {
                            userDoc = { id: superAdminDoc.id, ...superAdminDoc.data(), role: 'super_admin' };
                        }
                    }

                    if (isMounted) {
                        setUser(currentUser);
                        setUserData(userDoc);
                    }
                } else {
                    if (isMounted && !isLocalSession.current) {
                        setUser(null);
                        setUserData(null);
                    }
                }
                if (isMounted) {
                    setLoading(false);
                }
            });

            return unsubscribe;
        };

        let unsubscribePromise = initAuth();

        return () => {
            isMounted = false;
            unsubscribePromise.then(unsub => unsub && unsub());
        };
    }, []);

    const value = { user, userData, login, logout, loading };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
