import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { ChevronLeft, QrCode, Link } from 'lucide-react-native'
import { useStudioStore } from '../../src/store/studioStore'
import { LanguagePicker } from '../../src/components/LanguagePicker'
import { validateStudioUrl } from '../../src/lib/validateStudioUrl'
import { useT } from '../../src/i18n'
import { useTheme } from '../../src/theme/ThemeContext'

type Mode = null | 'qr' | 'manual'

const CORNER_SIZE = 20
const CORNER_THICKNESS = 3

export default function ScanScreen() {
  const [mode, setMode] = useState<Mode>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const router = useRouter()
  const t = useT()
  // No studio is connected yet at this screen, so this only ever reflects a
  // previously-cached color from a prior session (ThemeContext's SecureStore cache)
  // — otherwise it's the same default indigo as before.
  const { primary } = useTheme()

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return
    setScanned(true)
    try {
      const parsed = JSON.parse(data) as { url: string; name: string }
      if (!parsed.url || !parsed.name) {
        Alert.alert(t('onboarding.invalidQr'), t('onboarding.invalidQrMsg'))
        setScanned(false)
        return
      }
      const validated = validateStudioUrl(parsed.url)
      if (!validated.ok) {
        Alert.alert(t('onboarding.invalidQr'), t('onboarding.invalidUrlMsg'))
        setScanned(false)
        return
      }
      useStudioStore.getState().setStudio(validated.url, parsed.name)
      router.replace('/onboarding/login')
    } catch {
      Alert.alert(t('onboarding.invalidQr'), t('onboarding.parseError'))
      setScanned(false)
    }
  }

  const handleManualConnect = () => {
    const validated = validateStudioUrl(manualUrl.trim() || 'http://localhost:8000')
    if (!validated.ok) {
      Alert.alert(t('onboarding.invalidQr'), t('onboarding.invalidUrlMsg'))
      return
    }
    useStudioStore.getState().setStudio(validated.url, 'Agon Studio')
    router.replace('/onboarding/login')
  }

  const goBack = () => {
    setMode(null)
    setScanned(false)
  }

  // --- Mode selection screen ---
  if (mode === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <LanguagePicker />
        </View>
        <View style={styles.selectionContent}>
          <Text style={[styles.logo, { color: primary }]}>Agon</Text>
          <Text style={styles.title}>{t('onboarding.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
          <View style={styles.cardsContainer}>
            <TouchableOpacity style={styles.card} onPress={() => setMode('qr')}>
              <QrCode size={36} color={primary} />
              <Text style={styles.cardTitle}>{t('onboarding.scanQr')}</Text>
              <Text style={styles.cardDesc}>{t('onboarding.scanQrDesc')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => setMode('manual')}>
              <Link size={36} color={primary} />
              <Text style={styles.cardTitle}>{t('onboarding.manualUrl')}</Text>
              <Text style={styles.cardDesc}>{t('onboarding.manualUrlDesc')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // --- Camera permission: loading ---
  if (mode === 'qr' && !permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={28} color={primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredContent}>
          <Text style={styles.subtitle}>{t('onboarding.requestingPerm')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  // --- Camera permission: denied ---
  if (mode === 'qr' && permission && !permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={28} color={primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredContent}>
          <Text style={styles.title}>{t('onboarding.cameraPermTitle')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.cameraPermDesc')}</Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primary }]} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>{t('onboarding.grantPerm')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // --- QR scan mode ---
  if (mode === 'qr') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={28} color={primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredContent}>
          <Text style={styles.subtitle}>{t('onboarding.pointCamera')}</Text>
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            <View style={styles.overlay}>
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.cornerTopLeft, { borderColor: primary }]} />
                <View style={[styles.corner, styles.cornerTopRight, { borderColor: primary }]} />
                <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: primary }]} />
                <View style={[styles.corner, styles.cornerBottomRight, { borderColor: primary }]} />
              </View>
            </View>
          </View>
          {scanned && (
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primary }]} onPress={() => setScanned(false)}>
              <Text style={styles.primaryButtonText}>{t('onboarding.scanAgain')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // --- Manual URL mode ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={28} color={primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.centeredContent}>
        <Text style={styles.title}>{t('onboarding.manualUrl')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.manualUrlDesc')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('onboarding.urlPlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={manualUrl}
          onChangeText={setManualUrl}
          autoCapitalize="none"
          keyboardType="url"
          autoFocus
        />
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primary }]} onPress={handleManualConnect}>
          <Text style={styles.primaryButtonText}>{t('onboarding.connect')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 50,
  },
  backButton: {
    padding: 4,
  },
  selectionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 40,
    fontFamily: 'Inter-Bold',
    color: '#4F46E5',
    letterSpacing: -1,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  cardsContainer: {
    width: '100%',
    gap: 16,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  cameraContainer: {
    width: 280,
    height: 280,
    marginBottom: 24,
    position: 'relative',
    borderRadius: 12,
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
})
