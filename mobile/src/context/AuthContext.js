import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db } from '../api/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
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

    async function login(collegeCode, userIdRaw, password) {
        const userId = userIdRaw?.trim();
        const collegeQuery = query(collection(db, 'colleges'), where('code', '==', collegeCode.toUpperCase().trim()));
        const collegeSnapshot = await getDocs(collegeQuery);

        if (collegeSnapshot.empty) {
            throw new Error('Invalid College Code');
        }

        const collegeId = collegeSnapshot.docs[0].id;
        let foundUserDoc = null;
        let userRole = null;
        let userEmail = null;
        let requiresFirebaseAuth = true;

        // Optimized Targeted Queries
        const queries = [
            // Admin (Email, UID, Name)
            getDocs(query(collection(db, 'admins'), where('college_id', '==', collegeId), where('email', '==', userId))),
            getDocs(query(collection(db, 'admins'), where('college_id', '==', collegeId), where('uid', '==', userId))),
            getDocs(query(collection(db, 'admins'), where('college_id', '==', collegeId), where('name', '==', userId))),

            // Teacher (Email, UID)
            getDocs(query(collection(db, 'teachers'), where('college_id', '==', collegeId), where('email', '==', userId))),
            getDocs(query(collection(db, 'teachers'), where('college_id', '==', collegeId), where('uid', '==', userId))),

            // Staff (Email, UID)
            getDocs(query(collection(db, 'staff'), where('college_id', '==', collegeId), where('email', '==', userId))),
            getDocs(query(collection(db, 'staff'), where('college_id', '==', collegeId), where('uid', '==', userId))),

            // Student (PIN, UID)
            getDocs(query(collection(db, 'students'), where('college_id', '==', collegeId), where('pin', '==', userId))),
            getDocs(query(collection(db, 'students'), where('college_id', '==', collegeId), where('uid', '==', userId))),

            // Driver (Email, Username, UID)
            getDocs(query(collection(db, 'drivers'), where('college_id', '==', collegeId), where('email', '==', userId))),
            getDocs(query(collection(db, 'drivers'), where('college_id', '==', collegeId), where('username', '==', userId))),
            getDocs(query(collection(db, 'drivers'), where('college_id', '==', collegeId), where('uid', '==', userId)))
        ];

        const results = await Promise.all(queries);

        // Find which query returned a result
        for (let i = 0; i < results.length; i++) {
            if (!results[i].empty) {
                const docSnap = results[i].docs[0];
                const data = docSnap.data();
                foundUserDoc = { id: docSnap.id, ...data, college_id: collegeId };

                if (i <= 2) userRole = 'admin';
                else if (i <= 6) userRole = 'teacher';
                else if (i <= 8) userRole = 'student';
                else userRole = 'driver';

                userEmail = data.email;
                break;
            }
        }

        if (!foundUserDoc) {
            throw new Error('User not found. Check your User ID and College Code.');
        }

        // Determine auth type
        requiresFirebaseAuth = (userRole === 'admin' || (userRole === 'teacher' && !!userEmail));

        if (requiresFirebaseAuth) {
            isLocalSession.current = false;
            await clearLocalSession();
            try {
                const result = await signInWithEmailAndPassword(auth, userEmail, password);
                // Set userData immediately — don't wait for onAuthStateChanged to find it
                const userDataWithRole = { ...foundUserDoc, role: userRole };
                setUser(result.user);
                setUserData(userDataWithRole);
            } catch (authError) {
                if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
                    throw new Error('Incorrect password.');
                }
                throw authError;
            }
        } else {
            const validPassword = foundUserDoc.password || (foundUserDoc.pin ? foundUserDoc.pin.toString() : '');
            if (validPassword !== password) {
                throw new Error('Incorrect password.');
            }
            const userDataWithRole = { ...foundUserDoc, role: userRole };
            const localUser = { uid: foundUserDoc.id, email: foundUserDoc.email, ...userDataWithRole };
            isLocalSession.current = true;
            setUser(localUser);
            setUserData(userDataWithRole);
            await saveLocalSession(localUser, userDataWithRole);
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
        let userDataUnsubscribe = null;

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!isMounted) return;

            // If a local session is active, don't let onAuthStateChanged override it
            if (isLocalSession.current && !currentUser) {
                return;
            }

            setLoading(true);
            try {
                // Clean up previous user data listener
                if (userDataUnsubscribe) {
                    userDataUnsubscribe();
                    userDataUnsubscribe = null;
                }

                if (currentUser) {
                    // Determine potential user collection
                    let collections = [
                        { name: 'admins', role: 'admin' },
                        { name: 'teachers', role: 'teacher' },
                        { name: 'staff', role: 'teacher' },
                        { name: 'students', role: 'student' },
                        { name: 'drivers', role: 'driver' },
                        { name: 'super_admins', role: 'admin' }
                    ];

                    // Try to find which collection the user belongs to
                    let userFound = false;
                    for (const colObj of collections) {
                        try {
                            // Method 1: Precise lookup by Document ID (Fastest)
                            const docRef = doc(db, colObj.name, currentUser.uid);
                            const snap = await getDoc(docRef);

                            let targetDocRef = null;
                            let initialData = null;

                            if (snap.exists()) {
                                targetDocRef = docRef;
                                initialData = {
                                    id: snap.id,
                                    ...snap.data(),
                                    role: snap.data().role || colObj.role
                                };
                            } else if (currentUser.email) {
                                // Method 2: Lookup by Email field (Fallback for custom doc IDs)
                                const emailQuery = query(collection(db, colObj.name), where('email', '==', currentUser.email));
                                const emailSnap = await getDocs(emailQuery);
                                if (!emailSnap.empty) {
                                    const d = emailSnap.docs[0];
                                    targetDocRef = doc(db, colObj.name, d.id);
                                    initialData = {
                                        id: d.id,
                                        ...d.data(),
                                        role: d.data().role || colObj.role
                                    };
                                }
                            }

                            if (targetDocRef) {
                                // IMPORTANT: Set data immediately before the listener fires
                                setUserData(initialData);

                                // Set up real-time listener for future changes
                                userDataUnsubscribe = onSnapshot(targetDocRef, (docSnap) => {
                                    if (isMounted && docSnap.exists()) {
                                        setUserData({
                                            id: docSnap.id,
                                            ...docSnap.data(),
                                            role: docSnap.data().role || colObj.role
                                        });
                                    }
                                }, (error) => {
                                    console.error(`Error in ${colObj.name} listener:`, error);
                                });

                                setUser(currentUser);
                                userFound = true;
                                break;
                            }
                        } catch (err) {
                            console.error(`Error checking collection ${colObj.name}:`, err);
                        }
                    }

                    if (!userFound) {
                        console.warn("User authenticated but not found in any collection. Logging out...");
                        await signOut(auth);
                        setUser(null);
                        setUserData(null);
                    }
                } else if (!isLocalSession.current) {
                    setUser(null);
                    setUserData(null);
                }
            } catch (globalError) {
                console.error("Critical error in onAuthStateChanged:", globalError);
            } finally {
                setLoading(false);
            }
        });

        // Handle local session sync (students/drivers)
        const initLocalAuth = async () => {
            const restored = await restoreLocalSession();
            if (restored && isMounted) {
                const sessionStr = await AsyncStorage.getItem(LOCAL_SESSION_KEY);
                const session = JSON.parse(sessionStr);

                // Find user collection for local user
                let collections = ['students', 'drivers'];
                for (const col of collections) {
                    const docRef = doc(db, col, session.user.uid);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        // Set up listener for local user
                        userDataUnsubscribe = onSnapshot(docRef, (docSnap) => {
                            if (isMounted && docSnap.exists()) {
                                const newData = { id: docSnap.id, ...docSnap.data() };
                                setUserData(newData);
                                saveLocalSession(session.user, newData);
                            }
                        });
                        break;
                    }
                }
            }
        };

        initLocalAuth();

        return () => {
            isMounted = false;
            unsubscribe();
            if (userDataUnsubscribe) userDataUnsubscribe();
        };
    }, []);

    const value = { user, userData, login, logout, loading };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
