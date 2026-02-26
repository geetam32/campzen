const { db } = require('./firebase');

async function dumpAdmins() {
    try {
        const snap = await db.collection('admins').get();
        snap.forEach(doc => {
            console.log(`Admin ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });

        const collegeSnap = await db.collection('colleges').get();
        collegeSnap.forEach(doc => {
            console.log(`College ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

dumpAdmins();
