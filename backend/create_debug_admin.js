const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function createDebugTestUser() {
    const collegeId = 'PIT01'; // Common test college ID from previous sessions
    const adminUid = 'debug-admin-123';
    const email = 'admin@debug.com';
    const password = 'admin123';

    try {
        // Create in Firebase Auth
        await admin.auth().createUser({
            uid: adminUid,
            email: email,
            password: password
        });
        console.log('Firebase Auth user created');
    } catch (err) {
        if (err.code === 'auth/uid-already-exists' || err.code === 'auth/email-already-exists') {
            console.log('User already exists in Auth');
        } else {
            throw err;
        }
    }

    // Create admin doc
    await db.collection('admins').doc(adminUid).set({
        name: 'Debug Admin',
        email: email,
        uid: adminUid,
        college_id: collegeId,
        role: 'admin',
        created_at: new Date().toISOString()
    });

    console.log('Debug admin Firestore doc updated');
    process.exit(0);
}

createDebugTestUser().catch(console.error);
