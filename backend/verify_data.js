const { db } = require('./firebase');

async function verifyData() {
    try {
        console.log("--- Checking Colleges ---");
        const collegeSnap = await db.collection('colleges').get();
        if (collegeSnap.empty) {
            console.log("No colleges found!");
        } else {
            collegeSnap.forEach(doc => {
                console.log(`College: ${doc.data().name} | Code: ${doc.data().code} | ID: ${doc.id}`);
            });
        }

        console.log("\n--- Checking Admins ---");
        const adminSnap = await db.collection('admins').get();
        if (adminSnap.empty) {
            console.log("No admins found!");
        } else {
            adminSnap.forEach(doc => {
                const data = doc.data();
                console.log(`Admin: ${data.name} | Email: ${data.email} | UID: ${data.uid} | College: ${data.college_id}`);
            });
        }

        console.log("\n--- Checking Teachers ---");
        const teacherSnap = await db.collection('teachers').get();
        if (teacherSnap.empty) {
            console.log("No teachers found!");
        } else {
            teacherSnap.forEach(doc => {
                const data = doc.data();
                console.log(`Teacher: ${data.name} | Email: ${data.email} | UID: ${data.uid} | College: ${data.college_id}`);
            });
        }
    } catch (error) {
        console.error("Error verifying data:", error);
    } finally {
        process.exit();
    }
}

verifyData();
