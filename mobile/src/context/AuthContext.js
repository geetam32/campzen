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
    const [collegeSettings, setCollegeSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    // Track if a local (non-Firebase) session is active to prevent onAuthStateChanged from clearing it
    const isLocalSession = useRef(false);

    // Listener for college settings
    useEffect(() => {
        let unsub = null;
        if (userData?.college_id) {
            const collegeRef = doc(db, 'colleges', userData.college_id);
            unsub = onSnapshot(collegeRef, (docSnap) => {
                if (docSnap.exists()) {
                    setCollegeSettings(docSnap.data().settings || {});
                }
            });
        } else {
            setCollegeSettings(null);
        }
        return () => unsub && unsub();
    }, [userData?.college_id]);

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

    async function login(collegeCode, userIdRaw, password, preferredRole = null) {
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

        // Find which query returned a result, prioritize preferredRole
        let bestMatchIdx = -1;
        for (let i = 0; i < results.length; i++) {
            if (!results[i].empty) {
                // If we found a match that aligns with user's selection, take it immediately
                let currentMatchRole = '';
                if (i <= 2) currentMatchRole = 'admin';
                else if (i <= 6) currentMatchRole = 'teacher';
                else if (i <= 8) currentMatchRole = 'student';
                else currentMatchRole = 'driver';

                if (preferredRole && currentMatchRole === preferredRole) {
                    bestMatchIdx = i;
                    break;
                }
                // Otherwise keep the first match we found
                if (bestMatchIdx === -1) bestMatchIdx = i;
            }
        }

        if (bestMatchIdx !== -1) {
            const docSnap = results[bestMatchIdx].docs[0];
            const data = docSnap.data();
            foundUserDoc = { id: docSnap.id, ...data, college_id: collegeId };

            if (bestMatchIdx <= 2) userRole = 'admin';
            else if (bestMatchIdx <= 6) userRole = 'teacher';
            else if (bestMatchIdx <= 8) userRole = 'student';
            else userRole = 'driver';

            userEmail = data.email;
        }

        if (!foundUserDoc) {
            throw new Error('User not found. Check your User ID and College Code.');
        }

        // Determine auth type
        // Drivers and Students NEVER use Firebase Auth (always local PIN/Password)
        // Teachers only use Firebase Auth IF they have an email set
        // Admins use Firebase Auth IF they have an email set
        requiresFirebaseAuth = (
            (userRole === 'admin' || userRole === 'teacher') &&
            !!userEmail &&
            userEmail.includes('@')
        );

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

            // Sign out of Firebase if a local session is starting
            try {
                await signOut(auth);
            } catch (signOutErr) {
                console.log("No Firebase session to clear");
            }

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

            // Clean up previous user data listener
            if (userDataUnsubscribe) {
                userDataUnsubscribe();
                userDataUnsubscribe = null;
            }

            try {
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

                    // Optimization: If userData is already set (from login process), skip the heavy search.
                    if (userData && (userData.id === currentUser.uid || userData.email === currentUser.email)) {
                        setUser(currentUser);
                        const colObj = collections.find(c => c.role === userData.role) || collections[0];
                        const targetDocRef = doc(db, colObj.name, userData.id);
                        userDataUnsubscribe = onSnapshot(targetDocRef, (docSnap) => {
                            if (isMounted && docSnap.exists()) {
                                const data = docSnap.data();
                                setUserData({ id: docSnap.id, ...data, role: data.role || colObj.role });
                            }
                        });
                        setLoading(false);
                        return;
                    }

                    setLoading(true);
                    let userFound = false;
                    for (const colObj of collections) {
                        try {
                            const docRef = doc(db, colObj.name, currentUser.uid);
                            const snap = await getDoc(docRef);
                            let targetDocRef = null;
                            let initialData = null;

                            if (snap.exists()) {
                                targetDocRef = docRef;
                                initialData = { id: snap.id, ...snap.data(), role: snap.data().role || colObj.role };
                            } else if (currentUser.email) {
                                const emailQuery = query(collection(db, colObj.name), where('email', '==', currentUser.email));
                                const emailSnap = await getDocs(emailQuery);
                                if (!emailSnap.empty) {
                                    const d = emailSnap.docs[0];
                                    targetDocRef = doc(db, colObj.name, d.id);
                                    initialData = { id: d.id, ...d.data(), role: d.data().role || colObj.role };
                                }
                            }

                            if (targetDocRef) {
                                setUserData(initialData);
                                userDataUnsubscribe = onSnapshot(targetDocRef, (docSnap) => {
                                    if (isMounted && docSnap.exists()) {
                                        setUserData({ id: docSnap.id, ...docSnap.data(), role: docSnap.data().role || colObj.role });
                                    }
                                }, (error) => console.error(`Error in ${colObj.name} listener:`, error));
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
                                const data = docSnap.data();
                                const forcedRole = col === 'drivers' ? 'driver' : 'student';
                                const newData = { id: docSnap.id, ...data, role: data.role || forcedRole };
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

    const value = { user, userData, collegeSettings, login, logout, loading };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
