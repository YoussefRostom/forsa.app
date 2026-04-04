import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getBackendUrl } from '../lib/config';

interface OtpModalProps {
    visible: boolean;
    phone: string;       // E.164 format e.g. "+923001234567"
    password: string;
    role: string;
    email?: string;
    onClose: () => void;
    /** Called on successful OTP verification. Pass all form data to do role-specific Firestore saves. */
    onVerified: (uid: string, token: string, refreshToken: string) => void;
}

const RESEND_COOLDOWN = 60; // seconds

export default function OtpModal({
    visible,
    phone,
    password,
    role,
    email,
    onClose,
    onVerified,
}: OtpModalProps) {
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(RESEND_COOLDOWN);
    const inputRefs = useRef<(TextInput | null)[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Start countdown when modal becomes visible
    useEffect(() => {
        if (visible) {
            setDigits(['', '', '', '', '', '']);
            setError('');
            setTimer(RESEND_COOLDOWN);
            startTimer();
            // Focus first input after a short delay
            setTimeout(() => inputRefs.current[0]?.focus(), 300);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [visible]);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimer(RESEND_COOLDOWN);
        timerRef.current = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleDigitChange = (value: string, index: number) => {
        // Accept only single digits
        const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
        const newDigits = [...digits];
        newDigits[index] = sanitized;
        setDigits(newDigits);
        setError('');

        // Auto-advance
        if (sanitized && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
        // Auto-submit when all 6 filled
        if (sanitized && index === 5) {
            Keyboard.dismiss();
            const code = [...newDigits.slice(0, 5), sanitized].join('');
            if (code.length === 6) handleVerify(code);
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (codeOverride?: string) => {
        const code = codeOverride || digits.join('');
        if (code.length < 6) {
            setError('Please enter the 6-digit code');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const backendUrl = getBackendUrl(); // Get dynamic IP at runtime
            const response = await fetch(`${backendUrl}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp: code, password, role, email }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error?.message || 'Invalid OTP code. Please try again.');
                setDigits(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
                return;
            }

            // Client-side Firebase Sign-in
            // The frontend MUST be signed in for the subsequent Firestore/Storage calls to succeed
            try {
                const userEmail = data.data.user.email;
                await signInWithEmailAndPassword(auth, userEmail, password);
            } catch (fbErr: any) {
                console.error('Firebase Auth sign-in failed post-registration:', fbErr);
                setError('Account created, but auto-login failed. Please try logging in manually.');
                setLoading(false);
                return;
            }

            // Success — pass uid/tokens to parent
            onVerified(data.data.user.id, data.data.token, data.data.refreshToken);
        } catch (err: any) {
            setError('Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0) return;
        setResendLoading(true);
        setError('');
        try {
            const backendUrl = getBackendUrl(); // Get dynamic IP at runtime
            const response = await fetch(`${backendUrl}/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, role }),
            });
            const data = await response.json();
            if (data.success) {
                startTimer();
                setDigits(['', '', '', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 200);
                Alert.alert('OTP Resent', 'A new OTP has been sent to your phone.');
            } else {
                setError(data.error?.message || 'Failed to resend OTP');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    const maskedPhone = phone.replace(/(\+?\d{2,3})(\d+)(\d{4})$/, (_, a, b, c) => `${a}${'*'.repeat(b.length)}${c}`);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                        <View style={styles.iconWrap}>
                            <Ionicons name="shield-checkmark-outline" size={40} color="#000" />
                        </View>
                        <Text style={styles.title}>Verify Your Number</Text>
                        <Text style={styles.subtitle}>
                            Enter the 6-digit code sent to{'\n'}
                            <Text style={styles.phone}>{maskedPhone}</Text>
                        </Text>
                    </View>

                    {/* OTP Input Boxes */}
                    <View style={styles.otpRow}>
                        {digits.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => { inputRefs.current[index] = ref; }}
                                style={[styles.otpBox, digit ? styles.otpBoxFilled : null, error ? styles.otpBoxError : null]}
                                value={digit}
                                onChangeText={(v) => handleDigitChange(v, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                                editable={!loading}
                            />
                        ))}
                    </View>

                    {/* Error */}
                    {!!error && (
                        <View style={styles.errorRow}>
                            <Ionicons name="alert-circle-outline" size={16} color="#e53e3e" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Verify Button */}
                    <TouchableOpacity
                        style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
                        onPress={() => handleVerify()}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.verifyBtnText}>Verify & Create Account</Text>
                        )}
                    </TouchableOpacity>

                    {/* Resend */}
                    <View style={styles.resendRow}>
                        <Text style={styles.resendLabel}>Didn't receive it? </Text>
                        {timer > 0 ? (
                            <Text style={styles.resendTimer}>Resend in {timer}s</Text>
                        ) : (
                            <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
                                {resendLoading ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <Text style={styles.resendLink}>Resend OTP</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 28,
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 48 : 32,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 28,
        width: '100%',
    },
    closeBtn: {
        position: 'absolute',
        right: 0,
        top: 0,
        padding: 4,
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },
    phone: {
        fontWeight: '600',
        color: '#111',
    },
    otpRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    otpBox: {
        width: 48,
        height: 56,
        borderWidth: 2,
        borderColor: '#ddd',
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: '700',
        color: '#111',
        backgroundColor: '#f9f9f9',
    },
    otpBoxFilled: {
        borderColor: '#000',
        backgroundColor: '#fff',
    },
    otpBoxError: {
        borderColor: '#e53e3e',
        backgroundColor: '#fff5f5',
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 6,
    },
    errorText: {
        color: '#e53e3e',
        fontSize: 14,
    },
    verifyBtn: {
        backgroundColor: '#000',
        borderRadius: 14,
        height: 54,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    verifyBtnDisabled: {
        opacity: 0.6,
    },
    verifyBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    resendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    resendLabel: {
        fontSize: 14,
        color: '#666',
    },
    resendTimer: {
        fontSize: 14,
        color: '#999',
    },
    resendLink: {
        fontSize: 14,
        color: '#000',
        fontWeight: '700',
    },
});
