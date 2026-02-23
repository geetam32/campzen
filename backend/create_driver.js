const { db, auth } = require('./firebase');

async function createDriver() {
    const driver = {
        uid: "DRIVER01",
        name: "Bus Driver John",
        email: "driver@pit01.edu",
        college_id: "college_001",
        role: "teacher",
        is_driver: true,
        created_at: new Date()
    };

    try {
        await auth.createUser({
            uid: driver.uid,
            email: driver.email,
            password: "driverpassword123",
            displayName: driver.name
        });
        console.log(`✓ Auth user created: ${driver.email}`);
    } catch (e) {
        console.log(`- Auth user status: ${e.message}`);
    }

    await db.collection('teachers').doc(driver.uid).set(driver);
    console.log(`✓ Firestore record: ${driver.name}`);
    process.exit();
}

createDriver();
