import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native'
import { Globe, ChevronDown, ChevronUp, Check } from 'lucide-react-native'
import { useLanguageStore } from '../store/languageStore'
import { LOCALES } from '../i18n/translations'

export function LanguagePicker() {
  const [open, setOpen] = useState(false)
  const { locale, setLocale } = useLanguageStore()
  const current = LOCALES.find((l) => l.code === locale)!

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen((o) => !o)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Globe size={14} color="#9CA3AF" strokeWidth={1.75} />
        <Text style={styles.triggerLabel}>{current.label}</Text>
        {open
          ? <ChevronUp size={13} color="#9CA3AF" strokeWidth={1.75} />
          : <ChevronDown size={13} color="#9CA3AF" strokeWidth={1.75} />
        }
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <FlatList
              data={LOCALES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, item.code === locale && styles.rowActive]}
                  onPress={() => {
                    setLocale(item.code)
                    setOpen(false)
                  }}
                >
                  <Text style={styles.rowFlag}>{item.flag}</Text>
                  <Text style={[styles.rowLabel, item.code === locale && styles.rowLabelActive]}>
                    {item.label}
                  </Text>
                  {item.code === locale && (
                    <Check size={15} color="#4338CA" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  triggerLabel: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Inter-Medium',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginTop: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 12,
  },
  rowActive: {
    backgroundColor: '#EEF2FF',
  },
  rowFlag: {
    fontSize: 20,
    lineHeight: 24,
  },
  rowLabel: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter-Regular',
  },
  rowLabelActive: {
    color: '#4338CA',
    fontFamily: 'Inter-SemiBold',
  },
})
