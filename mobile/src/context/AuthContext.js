import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../api/firebase';
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

        if (!foundUserDoc) {
            throw new Error('User not found. Check your User ID and College Code.');
        }

        if (requiresFirebaseAuth && !userEmail) {
            throw new Error('This account is not fully registered. Please contact your administrator.');
        }

        if (requiresFirebaseAuth) {
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
            const validPassword = foundUserDoc.password || (foundUserDoc.pin ? foundUserDoc.pin.toString() : '');
            if (validPassword !== password) {
                throw new Error('Incorrect password.');
            }
            setUser({ uid: foundUserDoc.id, email: foundUserDoc.email, ...foundUserDoc });
            setUserData(foundUserDoc);
        }

        return { userDoc: foundUserDoc, role: userRole, mustChangePassword: foundUserDoc.must_change_password };
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

                // Super Admin check
                if (!userDoc) {
                    const superAdminDoc = await getDoc(doc(db, 'super_admins', currentUser.uid));
                    if (superAdminDoc.exists()) {
                        userDoc = { id: superAdminDoc.id, ...superAdminDoc.data(), role: 'super_admin' };
                    }
                }

                setUser(currentUser);
                setUserData(userDoc);
            } else {
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = { user, userData, login, logout, loading };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
