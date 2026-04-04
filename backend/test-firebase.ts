import { db } from './src/config/firebase';

async function test() {
    try {
        const snapshot = await db.collection('bookings').limit(3).get();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
        });

        const usersSnapshot = await db.collection('users').limit(3).get();
        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
        });
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        process.exit(0);
    }
}

test();
