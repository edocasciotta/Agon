import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { smsApi } from '../../api/sms'

export function SmsEventsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['sms-events'],
    queryFn: smsApi.listEvents,
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: smsApi.listTemplates,
  })

  const assignMutation = useMutation({
    mutationFn: ({ eventType, templateId }: { eventType: string; templateId: number | null }) =>
      smsApi.assignEventTemplate(eventType, templateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sms-events'] })
    },
  })

  if (eventsLoading) {
    return <p className="text-gray-500 text-sm">{t('common.loading')}</p>
  }

  if (eventsError) {
    return <p className="text-red-500 text-sm">{t('common.error')}</p>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('sms.eventsTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('sms.eventsDesc')}</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                {t('marketing.eventType')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                {t('marketing.assignedTemplate')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((ev) => (
              <tr key={ev.event_type}>
                <td className="px-4 py-3 text-gray-800 font-medium">{ev.label}</td>
                <td className="px-4 py-3">
                  <select
                    value={ev.template?.id ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      assignMutation.mutate({
                        eventType: ev.event_type,
                        templateId: val === '' ? null : Number(val),
                      })
                    }}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-48"
                  >
                    <option value="">{t('sms.noTemplateAssigned')}</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
