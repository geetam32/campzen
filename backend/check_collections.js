const { db } = require('./firebase');

async function checkStaffCollection() {
    try {
        console.log("Checking for 'staff' collection...");
        const staffSnap = await db.collection('staff').limit(5).get();
        if (staffSnap.empty) {
            console.log("No 'staff' collection found or it is empty.");
        } else {
            console.log(`Found ${staffSnap.size} documents in 'staff' collection.`);
            staffSnap.forEach(doc => {
                console.log(`ID: ${doc.id}`);
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        }

        console.log("\nChecking for 'teachers' collection...");
        const teacherSnap = await db.collection('teachers').limit(5).get();
        if (teacherSnap.empty) {
            console.log("No 'teachers' collection found or it is empty.");
        } else {
            console.log(`Found ${teacherSnap.size} documents in 'teachers' collection.`);
        }
    } catch (err) {
        console.error("Error checking collections:", err);
    } finally {
        process.exit();
    }
}

checkStaffCollection();
