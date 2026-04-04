import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createCheckInFromScan } from '../services/CheckInService';
import { getCurrentUserRole } from '../services/UserRoleService';

// Try to import expo-camera
// Silently fallback to manual input if not available (no warnings)
let CameraView: any = null;
let CameraType: any = null;
let useCameraPermissions: any = null;
let hasCameraModule = false;

try {
  const expoCamera = require('expo-camera');
  if (expoCamera && expoCamera.CameraView && expoCamera.CameraType && expoCamera.useCameraPermissions) {
    CameraView = expoCamera.CameraView;
    CameraType = expoCamera.CameraType;
    useCameraPermissions = expoCamera.useCameraPermissions;
    hasCameraModule = true;
  } else {
    console.warn('expo-camera module loaded but components are missing');
    hasCameraModule = false;
  }
} catch (error) {
  // Silent fallback - UI will show manual input option with installation instructions
  hasCameraModule = false;
}

// Manual input component (no camera hooks)
function ManualCheckInScreen({ onCheckIn, processing }: { onCheckIn: (code: string) => void; processing: boolean }) {
  const router = useRouter();
  const [manualCode, setManualCode] = useState('');

  const handleSubmit = () => {
    if (!manualCode.trim()) {
      Alert.alert('Error', 'Please enter a check-in code');
      return;
    }
    onCheckIn(manualCode.trim());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check-in</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.manualInputContainer}>
        <Ionicons name="qr-code-outline" size={64} color="#fff" />
        <Text style={styles.manualInputTitle}>Enter Check-in Code</Text>
        <Text style={styles.manualInputText}>
          Enter the check-in code manually (e.g., FC-XXXXXXXXXX)
        </Text>
        <TextInput
          style={styles.codeInput}
          placeholder="FC-XXXXXXXXXX"
          placeholderTextColor="#999"
          value={manualCode}
          onChangeText={setManualCode}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!processing}
        />
        <TouchableOpacity
          style={[styles.submitButton, processing && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={processing || !manualCode.trim()}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Check In</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.installNote}>
          Install expo-camera for QR code scanning:{'\n'}npx expo install expo-camera
        </Text>
      </View>
    </View>
  );
}

// Camera-based scanner component (uses camera hooks)
// This component should only be rendered when useCameraPermissions is available
function CameraScannerScreen({ onCheckIn, processing }: { onCheckIn: (code: string) => void; processing: boolean }) {
  const router = useRouter();
  const [scanned, setScanned] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  
  // Always call the hook - this component should only render when module is available
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    // Check if camera components are valid and set ready immediately
    if (CameraView && CameraType) {
      setCameraReady(true);
    } else {
      // If components aren't available, use fallback after short delay
      const timer = setTimeout(() => {
        setUseFallback(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;
    
    setScanned(true);

    try {
      if (!data.startsWith('forsa_checkin:')) {
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not a valid check-in code.',
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
        return;
      }

      const code = data.replace('forsa_checkin:', '');
      if (!code || code.length < 5) {
        throw new Error('Invalid check-in code format');
      }

      await onCheckIn(code);
      setScanned(false);
    } catch (error: any) {
      Alert.alert('Check-in Failed', error.message || 'Failed to process check-in.');
      setScanned(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      Alert.alert('Error', 'Please enter a check-in code');
      return;
    }
    setShowManualInput(false);
    onCheckIn(manualCode.trim());
    setManualCode('');
  };

  // Check if camera components are available and ready
  const isCameraAvailable = !useFallback && cameraReady && CameraView && CameraType;
  
  // If fallback is needed, show manual input
  if (useFallback) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check-in</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.manualInputContainer}>
          <Ionicons name="qr-code-outline" size={64} color="#fff" />
          <Text style={styles.manualInputTitle}>Enter Check-in Code</Text>
          <Text style={styles.manualInputText}>
            Camera unavailable. Enter the check-in code manually (e.g., FC-XXXXXXXXXX)
          </Text>
          <TextInput
            style={styles.codeInput}
            placeholder="FC-XXXXXXXXXX"
            placeholderTextColor="#999"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!processing}
          />
          <TouchableOpacity
            style={[styles.submitButton, processing && styles.submitButtonDisabled]}
            onPress={handleManualSubmit}
            disabled={processing || !manualCode.trim()}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Check In</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // If camera components aren't available, show manual input
  if (!isCameraAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check-in</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.manualInputContainer}>
          <Ionicons name="qr-code-outline" size={64} color="#fff" />
          <Text style={styles.manualInputTitle}>Enter Check-in Code</Text>
          <Text style={styles.manualInputText}>
            Camera not available. Enter the check-in code manually (e.g., FC-XXXXXXXXXX)
          </Text>
          <TextInput
            style={styles.codeInput}
            placeholder="FC-XXXXXXXXXX"
            placeholderTextColor="#999"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!processing}
          />
          <TouchableOpacity
            style={[styles.submitButton, processing && styles.submitButtonDisabled]}
            onPress={handleManualSubmit}
            disabled={processing || !manualCode.trim()}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Check In</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (permission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Check-in</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Checking camera permissions...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Check-in</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#fff" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need access to your camera to scan QR codes for check-ins.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={async () => {
              if (requestPermission) {
                const result = await requestPermission();
                // Permission state will update via the hook
              }
            }}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <View style={styles.manualFallback}>
            <Text style={styles.manualFallbackText}>Or enter code manually:</Text>
            <TextInput
              style={styles.codeInputSmall}
              placeholder="FC-XXXXXXXXXX"
              placeholderTextColor="#999"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!processing}
            />
            <TouchableOpacity
              style={[styles.submitButtonSmall, (processing || !manualCode.trim()) && styles.submitButtonDisabled]}
              onPress={() => {
                if (!manualCode.trim()) {
                  Alert.alert('Error', 'Please enter a check-in code');
                  return;
                }
                setShowManualInput(false);
                onCheckIn(manualCode.trim());
                setManualCode('');
              }}
              disabled={processing || !manualCode.trim()}
            >
              {processing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonTextSmall}>Check In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Check-in</Text>
        <View style={{ width: 40 }} />
      </View>

      {isCameraAvailable && permission?.granted ? (
        <CameraView
          style={styles.camera}
          facing={CameraType.back}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={styles.corner} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.instructionText}>
              Position the QR code within the frame
            </Text>
          </View>
        </CameraView>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>
            {!permission?.granted ? 'Waiting for camera permission...' : 'Camera not available'}
          </Text>
          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={() => setShowManualInput(true)}
          >
            <Text style={styles.fallbackButtonText}>Enter Code Manually</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.manualInputButton}
        onPress={() => setShowManualInput(true)}
      >
        <Ionicons name="keypad-outline" size={20} color="#fff" />
        <Text style={styles.manualInputButtonText}>Enter Code Manually</Text>
      </TouchableOpacity>

      {/* Manual Input Modal */}
      <Modal
        visible={showManualInput}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Check-in Code</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowManualInput(false);
                  setManualCode('');
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Enter the check-in code manually (e.g., FC-XXXXXXXXXX)
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="FC-XXXXXXXXXX"
              placeholderTextColor="#999"
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!processing}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalSubmitButton, (processing || !manualCode.trim()) && styles.submitButtonDisabled]}
              onPress={handleManualSubmit}
              disabled={processing || !manualCode.trim()}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSubmitButtonText}>Check In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ScanCheckInScreen() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const role = await getCurrentUserRole();
      setUserRole(role);
      
      if (role !== 'academy' && role !== 'clinic') {
        Alert.alert(
          'Access Denied',
          'Only academy and clinic staff can scan check-in codes.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      Alert.alert('Error', 'Failed to verify permissions');
      router.back();
    }
  };

  const processCheckInCode = async (code: string) => {
    if (processing) return;
    
    setProcessing(true);

    try {
      // Handle both formats: "forsa_checkin:FC-XXXXXXXXXX" or just "FC-XXXXXXXXXX"
      let cleanCode = code.trim();
      
      // Remove "forsa_checkin:" prefix if present
      if (cleanCode.startsWith('forsa_checkin:')) {
        cleanCode = cleanCode.replace('forsa_checkin:', '');
      }
      
      // Validate code format (should be FC-XXXXXXXXXX)
      if (!cleanCode || cleanCode.length < 5 || !cleanCode.startsWith('FC-')) {
        throw new Error('Invalid check-in code format. Code should start with "FC-" (e.g., FC-XXXXXXXXXX)');
      }

      // Create check-in - this will track the record in Firestore
      const checkIn = await createCheckInFromScan(cleanCode);
      
      // Get user name for success message
      const userName = checkIn.userName || 'User';
      
      Alert.alert(
        'Check-in Successful',
        `${userName} has been checked in successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setProcessing(false);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error processing check-in:', error);
      Alert.alert(
        'Check-in Failed',
        error.message || 'Failed to process check-in. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              setProcessing(false);
            },
          },
        ]
      );
    }
  };

  if (userRole && userRole !== 'academy' && userRole !== 'clinic') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Check-in</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#fff" />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>
            Only academy and clinic staff can scan check-in codes.
          </Text>
        </View>
      </View>
    );
  }

  // Show manual input if camera module is not available, otherwise show camera scanner
  // Check if all required camera components are available
  const canUseCamera = hasCameraModule && CameraView && CameraType && useCameraPermissions;
  
  if (!canUseCamera) {
    return <ManualCheckInScreen onCheckIn={processCheckInCode} processing={processing} />;
  }

  return (
    <>
      <CameraScannerScreen onCheckIn={processCheckInCode} processing={processing} />
      {processing && (
        <Modal transparent visible={processing} animationType="fade">
          <View style={styles.processingOverlay}>
            <View style={styles.processingBox}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.processingText}>Processing check-in...</Text>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#007AFF',
    borderWidth: 4,
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    left: 'auto',
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderBottomWidth: 0,
    borderTopWidth: 4,
  },
  bottomLeft: {
    top: 'auto',
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderBottomWidth: 4,
    borderRightWidth: 0,
  },
  bottomRight: {
    top: 'auto',
    bottom: 0,
    right: 0,
    left: 'auto',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructionText: {
    marginTop: 40,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  manualInputContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  manualInputTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
  },
  manualInputText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 32,
  },
  codeInput: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 20,
  },
  codeInputSmall: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  submitButtonSmall: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  installNote: {
    marginTop: 24,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  manualFallback: {
    marginTop: 32,
    width: '100%',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  manualFallbackText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 12,
    textAlign: 'center',
  },
  manualInputButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  manualInputButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fallbackButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    borderRadius: 8,
  },
  fallbackButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalSubmitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  modalSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
