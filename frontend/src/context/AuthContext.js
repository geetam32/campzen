import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Multi-tenant login: validate college code and find user across collections
    async function login(collegeCode, userId, password) {
        // 1. Resolve college from code
        const collegeQuery = query(collection(db, 'colleges'), where('code', '==', collegeCode.toUpperCase()));
        const collegeSnapshot = await getDocs(collegeQuery);

        if (collegeSnapshot.empty) {
            throw new Error('Invalid College Code');
        }

        const collegeDoc = collegeSnapshot.docs[0];
        const collegeId = collegeDoc.id;

        // 2. Find user in admins, teachers, or students collection with matching college_id
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
                    // If teacher has an email, they should use Firebase Auth (like admins)
                    // If they don't, they used local Firestore auth (usually legacy/seeded or specific config)
                    requiresFirebaseAuth = !!userEmail;
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
                if (data.username === userId || data.uid === userId) {
                    foundUserDoc = { id: docSnap.id, ...data, college_id: collegeId };
                    userRole = 'driver';
                    requiresFirebaseAuth = false;
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
                    // Students use Firestore password (no Firebase Auth)
                    requiresFirebaseAuth = false;
                    break;
                }
            }
        }

        if (!foundUserDoc) {
            throw new Error('User not found. Check your User ID and College Code.');
        }

        // 3. Ensure the found user has an associated email for Firebase Auth
        if (requiresFirebaseAuth && !userEmail) {
            throw new Error('This account is not fully registered (missing email address). Please contact your administrator.');
        }

        // 4. Sign in
        if (requiresFirebaseAuth) {
            // Sign in with Firebase Auth using the resolved email
            try {
                await signInWithEmailAndPassword(auth, userEmail, password);
            } catch (authError) {
                if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
                    throw new Error('Incorrect password for this user.');
                }
                if (authError.code === 'auth/user-not-found') {
                    throw new Error('No authentication account found for this email. Registration may be incomplete.');
                }
                throw authError;
            }
        } else {
            // Verify password directly from Firestore document (for Students/Teachers using direct auth)
            // If password is missing (csv import/seeded), default to PIN (for students)
            const validPassword = foundUserDoc.password || (foundUserDoc.pin ? foundUserDoc.pin.toString() : '');

            if (validPassword !== password) {
                console.log("Password mismatch details:", {
                    hasStoredPassword: !!foundUserDoc.password,
                    storedPassword: foundUserDoc.password,
                    expectedDefault: foundUserDoc.pin,
                    inputReceived: password
                });
                throw new Error('Incorrect password for this user.');
            }

            // Manually set state for non-Firebase auth users
            setUser({ uid: foundUserDoc.id, email: foundUserDoc.email, ...foundUserDoc });
            setUserData(foundUserDoc);
        }

        if (foundUserDoc.must_change_password) {
            // We can return this info to the login page to handle redirect
            return { userDoc: foundUserDoc, role: userRole, mustChangePassword: true };
        }

        return { userDoc: foundUserDoc, role: userRole };
    }

    // Standard Firebase Auth login (for direct email login)
    async function loginWithEmail(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }



    // Create new user with Firebase Auth
    async function register(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function logout() {
        setUser(null);
        setUserData(null);
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setLoading(true);
            if (currentUser) {
                // Try to fetch user data from Firestore across all role collections
                let userDoc = null;

                // Check admins
                const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
                if (adminDoc.exists()) {
                    userDoc = { id: adminDoc.id, ...adminDoc.data() };
                }

                // Check teachers
                if (!userDoc) {
                    const teacherDoc = await getDoc(doc(db, 'teachers', currentUser.uid));
                    if (teacherDoc.exists()) {
                        userDoc = { id: teacherDoc.id, ...teacherDoc.data() };
                    }
                }

                // Check drivers
                if (!userDoc) {
                    const driverQuery = query(collection(db, 'drivers'), where('uid', '==', currentUser.uid));
                    const driverSnapshot = await getDocs(driverQuery);
                    if (!driverSnapshot.empty) {
                        const data = driverSnapshot.docs[0].data();
                        userDoc = { id: driverSnapshot.docs[0].id, ...data };
                    }
                }

                // Check students
                if (!userDoc) {
                    const studentDoc = await getDoc(doc(db, 'students', currentUser.uid));
                    if (studentDoc.exists()) {
                        userDoc = { id: studentDoc.id, ...studentDoc.data() };
                    }
                }

                // If not found by UID, search by email
                if (!userDoc) {
                    // Try to find by email in admins
                    const adminQuery = query(collection(db, 'admins'), where('email', '==', currentUser.email));
                    const adminSnapshot = await getDocs(adminQuery);
                    if (!adminSnapshot.empty) {
                        const data = adminSnapshot.docs[0].data();
                        userDoc = { id: adminSnapshot.docs[0].id, ...data };
                    }
                }

                if (!userDoc) {
                    // Try to find by email in teachers
                    const teacherQuery = query(collection(db, 'teachers'), where('email', '==', currentUser.email));
                    const teacherSnapshot = await getDocs(teacherQuery);
                    if (!teacherSnapshot.empty) {
                        const data = teacherSnapshot.docs[0].data();
                        userDoc = { id: teacherSnapshot.docs[0].id, ...data };
                    }
                }

                if (!userDoc) {
                    // Check super_admins
                    const superAdminDoc = await getDoc(doc(db, 'super_admins', currentUser.uid));
                    if (superAdminDoc.exists()) {
                        userDoc = { id: superAdminDoc.id, ...superAdminDoc.data(), role: 'super_admin' };
                    }
                }

                setUser(currentUser);
                setUserData(userDoc);
            } else if (!user) {
                // Only clear if not using Firestore-only auth
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        user,
        userData,
        login,
        loginWithEmail,
        register,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
