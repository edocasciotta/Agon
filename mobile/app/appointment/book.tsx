import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format, addDays } from 'date-fns'
import { appointmentServicesApi } from '../../src/api/appointmentServices'
import { instructorsApi } from '../../src/api/instructors'
import { appointmentsApi } from '../../src/api/appointments'
import { LoadingView } from '../../src/components/LoadingView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { getErrorMessage } from '../../src/lib/errorMessages'
import { useT } from '../../src/i18n'
import type { ApiError } from '../../src/api/client'
import { useTheme } from '../../src/theme/ThemeContext'

type Step = 'service' | 'instructor' | 'date' | 'slot' | 'notes'

const STEP_ORDER: Step[] = ['service', 'instructor', 'date', 'slot', 'notes']

function nextDays(count: number): string[] {
  const today = new Date()
  return Array.from({ length: count }, (_, i) => format(addDays(today, i), 'yyyy-MM-dd'))
}

export default function BookAppointmentScreen() {
  const t = useT()
  const router = useRouter()
  const { primary } = useTheme()

  const [step, setStep] = useState<Step>('service')
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [instructorId, setInstructorId] = useState<number | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [bookedSuccess, setBookedSuccess] = useState(false)

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['appointment-services'],
    queryFn: () => appointmentServicesApi.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const { data: instructors, isLoading: instructorsLoading } = useQuery({
    queryKey: ['available-instructors', serviceId],
    queryFn: () => instructorsApi.listAvailableForService(serviceId as number),
    enabled: serviceId !== null,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const { data: slots, isFetching: slotsLoading } = useQuery({
    queryKey: ['available-slots', serviceId, instructorId, date],
    queryFn: () =>
      appointmentsApi.availableSlots({
        service_id: serviceId as number,
        instructor_id: instructorId as number,
        date: date as string,
      }),
    enabled: serviceId !== null && instructorId !== null && date !== null,
  })

  const bookMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: () => {
      setApiError(null)
      setBookedSuccess(true)
      setTimeout(() => router.replace('/(tabs)/appointments'), 1200)
    },
    onError: (err: ApiError) => {
      setApiError(getErrorMessage(err.code))
    },
  })

  const selectedService = services?.find((s) => s.id === serviceId)
  const selectedInstructor = instructors?.find((i) => i.id === instructorId)

  // One clearer per step, keyed by Step so goBack can wipe a step (and everything after
  // it) generically off STEP_ORDER instead of hardcoding each transition.
  const stepClearers: Record<Step, () => void> = {
    service: () => setServiceId(null),
    instructor: () => setInstructorId(null),
    date: () => setDate(null),
    slot: () => setSelectedSlot(null),
    notes: () => setNotes(''),
  }

  function goNext() {
    const idx = STEP_ORDER.indexOf(step)
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1])
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) {
      const targetIdx = idx - 1
      // Clear the state for the step we're returning to and every step after it — those
      // choices are no longer valid once the revisited step might change.
      for (let i = targetIdx; i < STEP_ORDER.length; i++) {
        stepClearers[STEP_ORDER[i]]()
      }
      setStep(STEP_ORDER[targetIdx])
    } else {
      router.back()
    }
  }

  function handleConfirm() {
    if (!serviceId || !instructorId || !selectedSlot) return
    setApiError(null)
    bookMutation.mutate({
      service_id: serviceId,
      instructor_id: instructorId,
      starts_at: selectedSlot,
      notes: notes || undefined,
    })
  }

  if (bookedSuccess) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successText}>{t('appointments.bookingSuccess')}</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <OfflineBanner />
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={[styles.backLink, { color: primary }]}>{t('appointments.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('appointments.browseTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {step === 'service' && (
          <View>
            <Text style={styles.stepLabel}>{t('appointments.service')}</Text>
            {servicesLoading ? (
              <LoadingView />
            ) : (
              (services ?? []).map((svc) => (
                <TouchableOpacity
                  key={svc.id}
                  style={[
                    styles.optionCard,
                    serviceId === svc.id && [styles.optionCardSelected, { borderColor: primary }],
                  ]}
                  onPress={() => {
                    setServiceId(svc.id)
                    setSelectedSlot(null)
                    goNext()
                  }}
                  testID={`service-${svc.id}`}
                >
                  <Text style={styles.optionTitle}>{svc.name}</Text>
                  <Text style={styles.optionSubtitle}>
                    {svc.duration_minutes} {t('appointments.min')}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {step === 'instructor' && (
          <View>
            <Text style={styles.stepLabel}>{t('appointments.instructor')}</Text>
            {instructorsLoading ? (
              <LoadingView />
            ) : (instructors ?? []).length === 0 ? (
              <Text style={styles.emptyText}>{t('appointments.noInstructors')}</Text>
            ) : (
              (instructors ?? []).map((inst) => (
                <TouchableOpacity
                  key={inst.id}
                  style={[
                    styles.optionCard,
                    instructorId === inst.id && [styles.optionCardSelected, { borderColor: primary }],
                  ]}
                  onPress={() => {
                    setInstructorId(inst.id)
                    setSelectedSlot(null)
                    goNext()
                  }}
                  testID={`instructor-${inst.id}`}
                >
                  <Text style={styles.optionTitle}>{inst.full_name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {step === 'date' && (
          <View>
            <Text style={styles.stepLabel}>{t('appointments.selectDate')}</Text>
            {nextDays(14).map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.optionCard,
                  date === d && [styles.optionCardSelected, { borderColor: primary }],
                ]}
                onPress={() => {
                  setDate(d)
                  setSelectedSlot(null)
                  goNext()
                }}
                testID={`date-${d}`}
              >
                <Text style={styles.optionTitle}>{format(new Date(d), 'EEEE, MMM d')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 'slot' && (
          <View>
            <Text style={styles.stepLabel}>{t('appointments.availableSlots')}</Text>
            {slotsLoading ? (
              <LoadingView message={t('appointments.loadingSlots')} />
            ) : (slots ?? []).length === 0 ? (
              <Text style={styles.emptyText}>{t('appointments.noSlots')}</Text>
            ) : (
              <View style={styles.slotGrid}>
                {(slots ?? []).map((slot) => (
                  <TouchableOpacity
                    key={slot.starts_at}
                    style={[
                      styles.slotButton,
                      selectedSlot === slot.starts_at && [
                        styles.slotButtonSelected,
                        { backgroundColor: primary, borderColor: primary },
                      ],
                    ]}
                    onPress={() => {
                      setSelectedSlot(slot.starts_at)
                      goNext()
                    }}
                    testID={`slot-${slot.starts_at}`}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        selectedSlot === slot.starts_at && styles.slotTextSelected,
                      ]}
                    >
                      {format(new Date(slot.starts_at), 'HH:mm')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {step === 'notes' && (
          <View>
            <Text style={styles.stepLabel}>{t('appointments.newAppointment')}</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>{selectedService?.name}</Text>
              <Text style={styles.summarySubtext}>
                {t('appointments.with')} {selectedInstructor?.full_name}
              </Text>
              {selectedSlot && (
                <Text style={styles.summarySubtext}>
                  {format(new Date(selectedSlot), 'EEEE, MMM d · HH:mm')}
                </Text>
              )}
            </View>

            <Text style={styles.fieldLabel}>{t('appointments.notes')}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('appointments.notesPlaceholder')}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              testID="notes-input"
            />

            {apiError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{apiError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: primary }]}
              onPress={handleConfirm}
              disabled={bookMutation.isPending}
              testID="confirm-booking"
            >
              {bookMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>{t('appointments.confirmBooking')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backLink: {
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '600',
    width: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  slotButtonSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  slotText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  slotTextSelected: {
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  summarySubtext: {
    fontSize: 13,
    color: '#4338CA',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },
  confirmButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    textAlign: 'center',
  },
})
