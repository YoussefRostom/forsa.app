import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { subscribeAdminCheckIns, CheckIn, CheckInFilters } from '../../services/CheckInService';
import { isAdmin } from '../../services/ModerationService';
import { formatTimestamp } from '../../lib/dateUtils';

export default function AdminCheckInsScreen() {
    const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
    const [loading, setLoading] = useState(true);
    const [todayOnly, setTodayOnly] = useState(false);
    const [locationFilter, setLocationFilter] = useState<'academy' | 'clinic' | null>(null);
    const [isUserAdmin, setIsUserAdmin] = useState(false);
    const router = useRouter();

    useEffect(() => {
        checkAdminAccess();
    }, []);

    useEffect(() => {
        if (!isUserAdmin) return;

        setLoading(true);
        const filters: CheckInFilters = {
            todayOnly: todayOnly || undefined,
            locationRole: locationFilter || undefined,
        };

        const unsubscribe = subscribeAdminCheckIns(filters, (checkInsData) => {
            setCheckIns(checkInsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [todayOnly, locationFilter, isUserAdmin]);

    const checkAdminAccess = async () => {
        try {
            const admin = await isAdmin();
            setIsUserAdmin(admin);
            if (!admin) {
                Alert.alert('Access Denied', 'You must be an admin to access this screen.');
                router.back();
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            Alert.alert('Error', 'Failed to verify permissions');
            router.back();
        }
    };

    const formatDate = (timestamp: unknown) =>
        formatTimestamp(timestamp, { withTime: true, fallback: 'Unknown' });

    const renderItem = ({ item }: { item: CheckIn }) => (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons
                        name={item.locationRole === 'academy' ? 'school' : 'medical'}
                        size={24}
                        color={item.locationRole === 'academy' ? '#4e73df' : '#1cc88a'}
                    />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                            {item.userName || `User ${item.userId.substring(0, 8)}`}
                        </Text>
                        <Text style={styles.userRole}>
                            {item.userRole === 'player' ? 'Player' : 'Parent'}
                        </Text>
                    </View>
                </View>
                <View style={[styles.locationBadge, item.locationRole === 'academy' ? styles.academyBadge : styles.clinicBadge]}>
                    <Text style={styles.locationBadgeText}>
                        {item.locationRole === 'academy' ? 'Academy' : 'Clinic'}
                    </Text>
                </View>
            </View>
            
            <View style={styles.details}>
                <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                        {item.locationName || `Location ${item.locationId.substring(0, 8)}`}
                    </Text>
                </View>
                <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Ionicons name="qr-code-outline" size={16} color="#666" />
                    <Text style={styles.codeText}>{item.userCheckInCode}</Text>
                </View>
            </View>
        </View>
    );

    if (!isUserAdmin) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Checking permissions...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.filters}>
                <TouchableOpacity
                    style={[styles.filterButton, todayOnly && styles.filterButtonActive]}
                    onPress={() => setTodayOnly(!todayOnly)}
                >
                    <Text style={[styles.filterText, todayOnly && styles.filterTextActive]}>
                        Today Only
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, locationFilter === 'academy' && styles.filterButtonActive]}
                    onPress={() => setLocationFilter(locationFilter === 'academy' ? null : 'academy')}
                >
                    <Text style={[styles.filterText, locationFilter === 'academy' && styles.filterTextActive]}>
                        Academy
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, locationFilter === 'clinic' && styles.filterButtonActive]}
                    onPress={() => setLocationFilter(locationFilter === 'clinic' ? null : 'clinic')}
                >
                    <Text style={[styles.filterText, locationFilter === 'clinic' && styles.filterTextActive]}>
                        Clinic
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading check-ins...</Text>
                </View>
            ) : checkIns.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="qr-code-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>No check-ins found</Text>
                </View>
            ) : (
                <FlatList
                    data={checkIns}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    filters: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    filterButtonActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    filterText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#999',
    },
    list: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    userRole: {
        fontSize: 12,
        color: '#666',
        textTransform: 'capitalize',
    },
    locationBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    academyBadge: {
        backgroundColor: '#e3f2fd',
    },
    clinicBadge: {
        backgroundColor: '#e8f5e9',
    },
    locationBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
    },
    details: {
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#666',
    },
    codeText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '600',
        fontFamily: 'monospace',
    },
});
