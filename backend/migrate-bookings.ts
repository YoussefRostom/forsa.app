import { db } from './src/config/firebase';

async function migrate() {
    try {
        const bookingsSnapshot = await db.collection('bookings').get();

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const bookingDoc of bookingsSnapshot.docs) {
            const data = bookingDoc.data();

            // Skip if customerName already exists and is not 'Unknown Player'
            if (data.customerName && data.customerName !== 'Unknown Player') {
                skippedCount++;
                continue;
            }

            const userId = data.userId || data.playerId || data.parentId || data.uid;

            if (!userId) {
                skippedCount++;
                continue;
            }

            try {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const name = userData?.name || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Unknown Player';

                    await bookingDoc.ref.update({
                        customerName: name,
                        updatedAt: new Date().toISOString()
                    });

                    updatedCount++;
                } else {
                    await bookingDoc.ref.update({
                        customerName: 'Unknown Player',
                        updatedAt: new Date().toISOString()
                    });
                    updatedCount++;
                }
            } catch (err) {
                console.error(`[ERROR] Failed to update Booking ${bookingDoc.id}:`, err);
                errorCount++;
            }
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
