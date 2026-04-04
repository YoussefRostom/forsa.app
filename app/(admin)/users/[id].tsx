import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default function UserDetails() {
    const { id } = useLocalSearchParams();
    const [user, setUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchUser = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, 'users', id as string);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setUser({ id: docSnap.id, ...docSnap.data() });
                } else {
                    Alert.alert("Error", "User not found");
                }
            } catch (error) {
                console.error("Error fetching user details:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [id]);

    const handleStatusChange = (newStatus: string) => {
        Alert.alert("Update Status", `Change user status to ${newStatus}?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Update", onPress: async () => {
                    try {
                        const docRef = doc(db, 'users', id as string);
                        await updateDoc(docRef, { status: newStatus });
                        setUser((prev: any) => prev ? { ...prev, status: newStatus } : null);
                    } catch (error) {
                        console.error("Error updating status:", error);
                        Alert.alert("Error", "Failed to update status");
                    }
                }
            }
        ]);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>;
    if (!user) return <View style={styles.center}><Text>User not found</Text></View>;

    const getDisplayName = () => {
        if (user.name) return user.name;
        if (user.firstName || user.lastName) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No Name Provided';
        }
        return 'Unknown User';
    };

    const displayName = getDisplayName();
    const role = user.role || 'No Role';
    const status = user.status || 'pending';

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{displayName[0] ? displayName[0].toUpperCase() : '?'}</Text>
                </View>
                <Text style={styles.name}>{displayName}</Text>
                <Text style={styles.role}>{role.toUpperCase()}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.infoRow}>
                    <Ionicons name="mail-outline" size={20} color="#666" />
                    <Text style={styles.infoText}>{user.email || 'No Email'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={20} color="#666" />
                    <Text style={styles.infoText}>{user.phone || user.phoneNumber || 'No Phone'}</Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Status</Text>
                <View style={styles.statusContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: status === 'active' ? '#1cc88a' : status === 'suspended' ? '#e74a3b' : '#f6c23e' }]}>
                        <Text style={styles.statusText}>{status.toUpperCase()}</Text>
                    </View>
                </View>
                <Text style={styles.instr}>Update Account Status:</Text>
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => handleStatusChange('active')}>
                        <Text style={styles.btnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.suspendBtn]} onPress={() => handleStatusChange('suspended')}>
                        <Text style={styles.btnText}>Suspend</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => handleStatusChange('pending')}>
                        <Text style={styles.btnText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f9' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    profileHeader: { alignItems: 'center', backgroundColor: '#fff', padding: 30, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
    avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#4e73df', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    avatarText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
    name: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 4 },
    role: { fontSize: 13, color: '#4e73df', fontWeight: 'bold', letterSpacing: 1 },
    section: { backgroundColor: '#fff', padding: 20, marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#555', marginBottom: 15, textTransform: 'uppercase' },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    infoText: { marginLeft: 15, fontSize: 16, color: '#444' },
    statusContainer: { marginBottom: 15 },
    statusBadge: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
    statusText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    instr: { fontSize: 13, color: '#888', marginBottom: 12 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
    btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
    approveBtn: { backgroundColor: '#1cc88a' },
    suspendBtn: { backgroundColor: '#e74a3b' },
    rejectBtn: { backgroundColor: '#f6c23e' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});
