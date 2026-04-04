import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function QRDisplay() {
    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>Mock QR Code</Text>
                <Text style={styles.subtitle}>Scan to verify check-in</Text>

                <View style={styles.qrPlaceholder}>
                    <Ionicons name="qr-code" size={200} color="#333" />
                </View>

                <View style={styles.info}>
                    <Text style={styles.infoLabel}>User Code</Text>
                    <Text style={styles.infoValue}>FORSA-X92-2024</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#4e73df', justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', elevation: 5 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
    subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
    qrPlaceholder: { padding: 20, borderWidth: 2, borderColor: '#eee', borderRadius: 16, marginBottom: 32 },
    info: { alignItems: 'center' },
    infoLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase' },
    infoValue: { fontSize: 20, fontWeight: 'bold', color: '#333' }
});
