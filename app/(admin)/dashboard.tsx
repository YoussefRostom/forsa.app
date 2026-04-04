import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, FlatList } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getCountFromServer, query, where, getDocs, limit, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getOrCreateConversation, sendMessage } from '../../services/MessagingService';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [commission, setCommission] = useState('15');
    const [savingCommission, setSavingCommission] = useState(false);
    const { logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Basic Counts
            const usersCount = await getCountFromServer(collection(db, 'users'));
            const bookingsCount = await getCountFromServer(collection(db, 'bookings'));
            const checkinsSnapshot = await getCountFromServer(collection(db, 'checkins'));

            // 2. Role Breakdown
            // Important: Check if roles are stored in uppercase or lowercase in DB
            const playersCount = await getCountFromServer(query(collection(db, 'users'), where('role', 'in', ['player', 'PLAYER'])));
            const academiesCount = await getCountFromServer(query(collection(db, 'users'), where('role', 'in', ['academy', 'ACADEMY'])));
            const clinicsCount = await getCountFromServer(query(collection(db, 'users'), where('role', 'in', ['clinic', 'CLINIC'])));
            const agentsCount = await getCountFromServer(query(collection(db, 'users'), where('role', 'in', ['agent', 'AGENT'])));
            const parentsCount = await getCountFromServer(query(collection(db, 'users'), where('role', 'in', ['parent', 'PARENT'])));

            // 3. Pending Approvals
            const pendingCount = await getCountFromServer(query(collection(db, 'users'), where('status', 'in', ['pending', 'PENDING'])));

            // 4. Revenue & Provider Ranking
            const bookingsSnap = await getDocs(query(collection(db, 'bookings'), where('status', 'in', ['completed', 'COMPLETED'])));
            let totalRevenue = 0;
            const providerRevenue: { [key: string]: number } = {};

            bookingsSnap.forEach(doc => {
                const data = doc.data();
                const price = Number(data.price) || 0;
                totalRevenue += price;
                const pName = data.providerName || 'Unknown Provider';
                providerRevenue[pName] = (providerRevenue[pName] || 0) + price;
            });

            const topProviders = Object.entries(providerRevenue)
                .map(([name, revenue]) => ({ name, revenue }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            // 5. Performance
            const totalBookingsNum = bookingsCount.data().count;
            const totalCheckinsNum = checkinsSnapshot.data().count;
            const conversionRate = totalBookingsNum > 0 ? ((totalCheckinsNum / totalBookingsNum) * 100).toFixed(1) : '0';
            const activeProvidersCount = await getCountFromServer(query(collection(db, 'users'), where('role', 'in', ['academy', 'clinic', 'ACADEMY', 'CLINIC']), where('status', 'in', ['active', 'ACTIVE'])));

            // 6. Recent Activity
            const activitySnap = await getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(5)));
            const activities = activitySnap.docs.map(doc => ({
                id: doc.id,
                title: 'New Booking',
                message: `${doc.data().playerName || 'A user'} booked ${doc.data().service || 'a service'}`,
                time: 'Recent'
            }));

            // 7. Settings
            const settingsDoc = await getDoc(doc(db, 'settings', 'admin'));
            if (settingsDoc.exists()) {
                setCommission(settingsDoc.data().commissionRate || '15');
            }

            setStats({
                totalUsers: usersCount.data().count,
                totalBookings: totalBookingsNum,
                pendingApprovals: pendingCount.data().count,
                totalRevenue,
                totalCheckIns: totalCheckinsNum,
                conversionRate,
                activeProviders: activeProvidersCount.data().count,
                topProviders,
                roles: {
                    player: playersCount.data().count,
                    academy: academiesCount.data().count,
                    clinic: clinicsCount.data().count,
                    agent: agentsCount.data().count,
                    parent: parentsCount.data().count
                },
                activities: activities.length > 0 ? activities : []
            });
        } catch (error) {
            console.error("Error fetching admin stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateCommission = async () => {
        setSavingCommission(true);
        try {
            await setDoc(doc(db, 'settings', 'admin'), { commissionRate: commission }, { merge: true });
            Alert.alert("Success", "Commission rate updated");
        } catch (error) {
            Alert.alert("Error", "Failed to update commission");
        } finally {
            setSavingCommission(false);
        }
    };

    // Messaging modal state (select a user to open chat)
    const [messageModalVisible, setMessageModalVisible] = useState(false);
    const [usersList, setUsersList] = useState<any[]>([]);

    const openMessageModal = async () => {
        setMessageModalVisible(true);
        setUsersList([]);
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const list = querySnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            setUsersList(list);
        } catch (error) {
            console.error('Error fetching users for messaging:', error);
            Alert.alert('Error', 'Failed to load users');
        }
    };

    // Selecting a user opens the admin chat screen for that user

    const StatCard = ({ title, value, icon, color }: any) => (
        <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 5 }]}>
            <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardValue}>{value ?? '0'}</Text>
            </View>
            <Ionicons name={icon} size={28} color={color} />
        </View>
    );

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>;

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <Text style={styles.welcome}>Admin Panel</Text>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            {/* Core Metrics */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
                <View style={styles.statsGrid}>
                    <StatCard title="Total Users" value={stats?.totalUsers} icon="people" color="#4e73df" />
                    <StatCard title="Total Bookings" value={stats?.totalBookings} icon="calendar" color="#1cc88a" />
                    <StatCard title="Total Check-ins" value={stats?.totalCheckIns} icon="qr-code" color="#36b9cc" />
                    <StatCard title="Total Revenue" value={`${stats?.totalRevenue} EGP`} icon="cash" color="#e74a3b" />
                </View>
            </View>

            {/* Performance */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Operations Control</Text>
                <View style={styles.statsGrid}>
                    <StatCard title="Pending Approvals" value={stats?.pendingApprovals} icon="time" color="#f6c23e" />
                    <StatCard title="Conv. Rate" value={`${stats?.conversionRate}%`} icon="trending-up" color="#4e73df" />
                    <StatCard title="Active Prov." value={stats?.activeProviders} icon="business" color="#20c9a6" />
                </View>
            </View>

            {/* User Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Users by Role</Text>
                <View style={styles.breakdownCard}>
                    <View style={styles.breakdownRow}>
                        <View style={styles.breakdownItem}><Text style={styles.bLabel}>Players</Text><Text style={styles.bValue}>{stats?.roles.player}</Text></View>
                        <View style={styles.breakdownItem}><Text style={styles.bLabel}>Academies</Text><Text style={styles.bValue}>{stats?.roles.academy}</Text></View>
                        <View style={styles.breakdownItem}><Text style={styles.bLabel}>Clinics</Text><Text style={styles.bValue}>{stats?.roles.clinic}</Text></View>
                    </View>
                    <View style={[styles.breakdownRow, { marginTop: 15 }]}>
                        <View style={styles.breakdownItem}><Text style={styles.bLabel}>Agents</Text><Text style={styles.bValue}>{stats?.roles.agent}</Text></View>
                        <View style={styles.breakdownItem}><Text style={styles.bLabel}>Parents</Text><Text style={styles.bValue}>{stats?.roles.parent}</Text></View>
                        <View style={styles.breakdownItem} />
                    </View>
                </View>
            </View>

            {/* Top Providers */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Revenue per Provider</Text>
                <View style={styles.listCard}>
                    {(stats?.topProviders || []).map((p: any, idx: number) => (
                        <View key={idx} style={styles.listItem}>
                            <Text style={styles.itemText}>{p.name}</Text>
                            <Text style={styles.itemValue}>{p.revenue} EGP</Text>
                        </View>
                    ))}
                    {(!stats?.topProviders || stats.topProviders.length === 0) && <Text style={styles.emptyText}>No revenue data available</Text>}
                </View>
            </View>

            {/* Commission Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Platform Settings</Text>
                <View style={styles.settingsCard}>
                    <Text style={styles.label}>Global Commission Rate (%)</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            value={commission}
                            onChangeText={setCommission}
                            keyboardType="numeric"
                        />
                        <TouchableOpacity style={styles.saveBtn} onPress={updateCommission} disabled={savingCommission}>
                            {savingCommission ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Recent Activity */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                {(stats?.activities || []).map((act: any) => (
                    <View key={act.id} style={styles.activityCard}>
                        <Ionicons name="notifications" size={18} color="#4e73df" />
                        <View style={styles.activityContent}>
                            <Text style={styles.activityTitle}>{act.title}</Text>
                            <Text style={styles.activityMsg}>{act.message}</Text>
                        </View>
                    </View>
                ))}
                {(!stats?.activities || stats.activities.length === 0) && <Text style={styles.emptyText}>No recent activity</Text>}
            </View>

            {/* Admin messaging */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Admin Messages</Text>
                <View style={styles.listCard}>
                    <TouchableOpacity style={[styles.saveBtn, { alignSelf: 'stretch', paddingVertical: 12 }]} onPress={openMessageModal}>
                        <Text style={styles.saveBtnText}>Send Message to User</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Message modal */}
            <Modal visible={messageModalVisible} animationType="slide" transparent>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Send Message</Text>
                        <Text style={{ marginBottom: 8, color: '#666' }}>Select recipient</Text>
                                    <FlatList
                                        data={usersList}
                                        keyExtractor={item => item.id}
                                        style={{ maxHeight: 320, marginBottom: 8 }}
                                        renderItem={({ item }) => (
                                                <TouchableOpacity onPress={() => router.push(`/(admin)/user-chat?otherUserId=${item.id}&name=${encodeURIComponent((item.name || `${item.firstName || ''} ${item.lastName || ''}`).trim() || item.email || 'User')}`)} style={[styles.userRow]}>
                                                    <Text style={styles.itemText}>{item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email || 'Unknown'}</Text>
                                                    <Text style={{ color: '#888', fontSize: 12 }}>{item.role || ''}</Text>
                                                </TouchableOpacity>
                                        )}
                                    />

                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#ccc', paddingHorizontal: 16 }]} onPress={() => setMessageModalVisible(false)}>
                                            <Text style={styles.saveBtnText}>Close</Text>
                                        </TouchableOpacity>
                                    </View>
                    </View>
                </View>
            </Modal>

            <View style={styles.navigation}>
                <View style={styles.navRow}>
                    <TouchableOpacity 
                        style={styles.navBtn} 
                        onPress={() => router.push('/(admin)/users')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.navIconContainer}>
                            <Ionicons name="people" size={22} color="#fff" />
                        </View>
                        <Text style={styles.navText}>Users</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.navBtn} 
                        onPress={() => router.push('/(admin)/bookings')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.navIconContainer}>
                            <Ionicons name="calendar" size={22} color="#fff" />
                        </View>
                        <Text style={styles.navText}>Bookings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.navBtn} 
                        onPress={() => router.push('/(admin)/checkins')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.navIconContainer}>
                            <Ionicons name="qr-code" size={22} color="#fff" />
                        </View>
                        <Text style={styles.navText}>Check-ins</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.navRow}>
                    <TouchableOpacity 
                        style={styles.navBtn} 
                        onPress={() => router.push('/(admin)/reports')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.navIconContainer}>
                            <Ionicons name="flag" size={22} color="#fff" />
                        </View>
                        <Text style={styles.navText}>Reports</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.navBtn} 
                        onPress={() => router.push('/(admin)/notifications')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.navIconContainer}>
                            <Ionicons name="notifications" size={22} color="#fff" />
                        </View>
                        <Text style={styles.navText}>Notifications</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.navBtn} 
                        onPress={() => router.push('/(admin)/upload-media')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.navIconContainer}>
                            <Ionicons name="cloud-upload" size={22} color="#fff" />
                        </View>
                        <Text style={styles.navText}>Upload</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.navRow}>
                    <TouchableOpacity 
                        style={styles.navBtn}
                        onPress={() => router.push('/(admin)/my-media')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.navIconContainer}>
                            <Ionicons name="images" size={22} color="#fff" />
                        </View>
                        <Text style={styles.navText}>My Media</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.navBtn}
                        onPress={() => router.push('/(admin)/see-media')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.navIconContainer}>
                            <Ionicons name="images-outline" size={22} color="#fff" />
                        </View>
                        <Text style={styles.navText}>All Media</Text>
                    </TouchableOpacity>
                    <View style={[styles.navBtn, { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 }]} />
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#f4f6f9', 
        padding: 16 
    },
    center: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        paddingTop: 8
    },
    welcome: { 
        fontSize: 28, 
        fontWeight: 'bold', 
        color: '#1a1a1a' 
    },
    logoutBtn: { 
        backgroundColor: '#e74a3b', 
        paddingHorizontal: 16, 
        paddingVertical: 8, 
        borderRadius: 8,
        shadowColor: '#e74a3b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3
    },
    logoutText: { 
        color: '#fff', 
        fontWeight: '600', 
        fontSize: 13 
    },
    section: { 
        marginBottom: 28 
    },
    sectionTitle: { 
        fontSize: 18, 
        fontWeight: '700', 
        color: '#2c3e50', 
        marginBottom: 16,
        letterSpacing: 0.5
    },
    statsGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'space-between',
    },
    card: { 
        backgroundColor: '#fff', 
        borderRadius: 12, 
        padding: 16, 
        marginBottom: 12, 
        width: '48%',
        minWidth: 150,
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    cardInfo: { 
        flex: 1 
    },
    cardTitle: { 
        fontSize: 11, 
        color: '#7f8c8d', 
        marginBottom: 4, 
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    cardValue: { 
        fontSize: 20, 
        fontWeight: 'bold', 
        color: '#2c3e50' 
    },
    breakdownCard: { 
        backgroundColor: '#fff', 
        borderRadius: 12, 
        padding: 20, 
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    breakdownRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        marginBottom: 12
    },
    breakdownItem: { 
        flex: 1, 
        alignItems: 'center' 
    },
    bLabel: { 
        fontSize: 12, 
        color: '#7f8c8d', 
        marginBottom: 6,
        fontWeight: '500'
    },
    bValue: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        color: '#2c3e50' 
    },
    listCard: { 
        backgroundColor: '#fff', 
        borderRadius: 12, 
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    listItem: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        padding: 14, 
        borderBottomWidth: 1, 
        borderBottomColor: '#ecf0f1' 
    },
    itemText: { 
        fontSize: 15, 
        color: '#34495e',
        fontWeight: '500'
    },
    itemValue: { 
        fontSize: 15, 
        fontWeight: 'bold', 
        color: '#1cc88a' 
    },
    settingsCard: { 
        backgroundColor: '#fff', 
        borderRadius: 12, 
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    label: { 
        fontSize: 14, 
        color: '#34495e', 
        marginBottom: 12,
        fontWeight: '600'
    },
    inputRow: { 
        flexDirection: 'row', 
        gap: 12 
    },
    input: { 
        flex: 1, 
        backgroundColor: '#f8f9fa', 
        borderRadius: 10, 
        padding: 14, 
        borderWidth: 1, 
        borderColor: '#e1e8ed',
        fontSize: 15
    },
    saveBtn: { 
        backgroundColor: '#4e73df', 
        borderRadius: 10, 
        paddingHorizontal: 24, 
        justifyContent: 'center',
        shadowColor: '#4e73df',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3
    },
    saveBtnText: { 
        color: '#fff', 
        fontWeight: '600',
        fontSize: 14
    },
    activityCard: { 
        flexDirection: 'row', 
        backgroundColor: '#fff', 
        padding: 16, 
        borderRadius: 12, 
        marginBottom: 10, 
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2
    },
    activityContent: { 
        marginLeft: 14,
        flex: 1
    },
    activityTitle: { 
        fontSize: 14, 
        fontWeight: '600', 
        color: '#2c3e50',
        marginBottom: 2
    },
    activityMsg: { 
        fontSize: 13, 
        color: '#7f8c8d' 
    },
    emptyText: { 
        textAlign: 'center', 
        color: '#95a5a6', 
        padding: 24, 
        fontSize: 14 
    },
    navigation: { 
        marginTop: 24,
        marginBottom: 40,
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 10,
    },
    navBtn: { 
        flex: 1,
        backgroundColor: '#2e59d9', 
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 12, 
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2e59d9',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
        minHeight: 75,
        maxWidth: '32%',
    },
    navBtnFull: {
        maxWidth: '100%',
    },
    navIconContainer: {
        marginBottom: 6,
    },
    navText: { 
        color: '#fff', 
        fontWeight: '600', 
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 14,
    }
    ,
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
    },
    userRow: {
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f3f5',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    selectedUser: {
        backgroundColor: '#eef3ff'
    }
});
