import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function AdminLayout() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    if (!user || user.role !== 'admin') {
        return <Redirect href="/welcome" />;
    }

    return (
        <Stack screenOptions={{
            headerStyle: { backgroundColor: '#f8f9fa' },
            headerTintColor: '#333',
            headerTitleStyle: { fontWeight: 'bold' },
        }}>
            <Stack.Screen name="dashboard" options={{ title: 'Admin Dashboard' }} />
            <Stack.Screen name="users/index" options={{ title: 'User Management' }} />
            <Stack.Screen name="users/[id]" options={{ title: 'User Details' }} />
            <Stack.Screen name="bookings/index" options={{ title: 'Bookings' }} />
            <Stack.Screen name="bookings/[id]" options={{ title: 'Booking Details' }} />
            <Stack.Screen name="checkins" options={{ title: 'Check-ins' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="qr-display" options={{ title: 'QR Code' }} />
            <Stack.Screen name="reports" options={{ title: 'Reports & Moderation' }} />
            <Stack.Screen name="upload-media" options={{ title: 'Upload Media' }} />
            <Stack.Screen name="my-media" options={{ title: 'My Media' }} />
        </Stack>
    );
}
