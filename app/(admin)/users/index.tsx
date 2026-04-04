import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default function UsersList() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'users'));
                const usersList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setUsers(usersList);
            } catch (error) {
                console.error("Error fetching users:", error);
                Alert.alert("Error", "Failed to fetch users");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const handleDelete = (id: string) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this user?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'users', id));
                        setUsers(users.filter(u => u.id !== id));
                    } catch (error) {
                        console.error("Error deleting user:", error);
                        Alert.alert("Error", "Failed to delete user");
                    }
                }
            }
        ]);
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const colors: any = { active: '#1cc88a', pending: '#f6c23e', suspended: '#e74a3b' };
        return (
            <View style={[styles.badge, { backgroundColor: colors[status] || '#ccc' }]}>
                <Text style={styles.badgeText}>{status}</Text>
            </View>
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        const displayName = item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown User';
        return (
            <View style={styles.userItem}>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{displayName}</Text>
                    <Text style={styles.userEmail}>{item.email || 'No email'}</Text>
                    <View style={styles.roleRow}>
                        <Text style={styles.userRole}>{item.role || 'No role'}</Text>
                        <StatusBadge status={item.status || 'pending'} />
                    </View>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity onPress={() => router.push(`/(admin)/users/${item.id}`)} style={styles.actionBtn}>
                        <Ionicons name="eye" size={20} color="#4e73df" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                        <Ionicons name="trash" size={20} color="#e74a3b" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={users}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f9' },
    list: { padding: 16 },
    userItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    userEmail: { fontSize: 14, color: '#666', marginBottom: 4 },
    roleRow: { flexDirection: 'row', alignItems: 'center' },
    userRole: { fontSize: 12, color: '#888', marginRight: 8, fontStyle: 'italic' },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    actions: { flexDirection: 'row' },
    actionBtn: { padding: 8, marginLeft: 8 }
});
