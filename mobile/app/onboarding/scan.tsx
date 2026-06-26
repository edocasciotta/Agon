import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useStudioStore } from '../../src/store/studioStore'

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [showManual, setShowManual] = useState(false)
  const router = useRouter()

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return
    setScanned(true)
    try {
      const parsed = JSON.parse(data) as { url: string; name: string }
      if (!parsed.url || !parsed.name) {
        Alert.alert('Invalid QR Code', 'This QR code is not from an Agon studio.')
        setScanned(false)
        return
      }
      useStudioStore.getState().setStudio(parsed.url, parsed.name)
      router.replace('/onboarding/login')
    } catch {
      Alert.alert('Invalid QR Code', 'Could not parse studio information.')
      setScanned(false)
    }
  }

  const handleManualConnect = () => {
    const url = manualUrl.trim() || 'http://localhost:8000'
    useStudioStore.getState().setStudio(url, 'Agon Studio')
    router.replace('/onboarding/login')
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Requesting camera permission...</Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Access Needed</Text>
        <Text style={styles.subtitle}>Allow camera access to scan your studio's QR code.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => setShowManual(true)}>
          <Text style={styles.linkText}>Enter URL manually</Text>
        </TouchableOpacity>
        {showManual && (
          <View style={styles.manualContainer}>
            <TextInput
              style={styles.input}
              placeholder="http://localhost:8000"
              value={manualUrl}
              onChangeText={setManualUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity style={styles.button} onPress={handleManualConnect}>
              <Text style={styles.buttonText}>Connect manually</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.title}>Scan Studio QR Code</Text>
      <Text style={styles.subtitle}>Point your camera at the QR code provided by your studio.</Text>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.overlay}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
        </View>
      </View>

      {scanned && (
        <TouchableOpacity style={styles.button} onPress={() => setScanned(false)}>
          <Text style={styles.buttonText}>Scan Again</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.linkButton} onPress={() => setShowManual(!showManual)}>
        <Text style={styles.linkText}>Enter URL manually</Text>
      </TouchableOpacity>

      {showManual && (
        <View style={styles.manualContainer}>
          <TextInput
            style={styles.input}
            placeholder="http://localhost:8000"
            value={manualUrl}
            onChangeText={setManualUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity style={styles.button} onPress={handleManualConnect}>
            <Text style={styles.buttonText}>Connect manually</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const CORNER_SIZE = 20
const CORNER_THICKNESS = 3

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  cameraContainer: {
    width: 280,
    height: 280,
    marginBottom: 24,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#4F46E5',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    padding: 8,
  },
  linkText: {
    color: '#4F46E5',
    fontSize: 14,
  },
  manualContainer: {
    width: '100%',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
})
