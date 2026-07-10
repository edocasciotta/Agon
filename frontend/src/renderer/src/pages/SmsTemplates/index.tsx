import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { smsApi } from '../../api/sms'
import type { SmsTemplateListItem, SmsTemplateResponse, SmsTemplateCreate } from '../../types'
import { EmptyState } from '../../components/EmptyState'

const AVAILABLE_VARS = [
  '{{client_name}}',
  '{{studio_name}}',
  '{{class_name}}',
  '{{class_date}}',
  '{{class_time}}',
  '{{instructor_name}}',
  '{{membership_type}}',
  '{{expiry_date}}',
]

const SMS_SEGMENT_LENGTH = 160

const emptyForm: SmsTemplateCreate = { name: '', body: '' }

interface TemplateModalProps {
  initial: SmsTemplateCreate
  title: string
  onSave: (data: SmsTemplateCreate) => void
  onClose: () => void
  saving: boolean
}

function TemplateModal({ initial, title, onSave, onClose, saving }: TemplateModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<SmsTemplateCreate>(initial)
  const segments = Math.max(1, Math.ceil(form.body.length / SMS_SEGMENT_LENGTH))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('sms.templateName')} *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('sms.templateBody')} *
            </label>
            <div className="mb-2 flex flex-wrap gap-1">
              {AVAILABLE_VARS.map((v) => (
                <span
                  key={v}
                  className="inline-block bg-indigo-50 text-indigo-700 text-xs font-mono px-2 py-0.5 rounded cursor-pointer hover:bg-indigo-100"
                  title={t('marketing.availableVars')}
                  onClick={() => setForm((f) => ({ ...f, body: f.body + v }))}
                >
                  {v}
                </span>
              ))}
            </div>
            <textarea
              required
              rows={6}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder={t('sms.templateBodyPlaceholder')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('sms.charCount', { count: form.body.length, segments })}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SmsTemplatesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<SmsTemplateResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SmsTemplateListItem | null>(null)

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: smsApi.listTemplates,
  })

  const createMutation = useMutation({
    mutationFn: smsApi.createTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sms-templates'] })
      setCreateOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SmsTemplateCreate }) =>
      smsApi.updateTemplate(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sms-templates'] })
      setEditItem(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => smsApi.deleteTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sms-templates'] })
      setDeleteTarget(null)
    },
    onError: () => {
      alert(t('sms.templateInUse'))
    },
  })

  async function handleEditClick(item: SmsTemplateListItem) {
    const full = await smsApi.getTemplate(item.id)
    setEditItem(full)
  }

  if (isLoading) {
    return <p className="text-gray-500 text-sm">{t('common.loading')}</p>
  }

  if (error) {
    return <p className="text-red-500 text-sm">{t('common.error')}</p>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('sms.templatesTitle')}</h1>
        {templates.length > 0 && (
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
          >
            {t('sms.createTemplate')}
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
          }
          title={t('sms.noTemplates')}
          description={t('sms.emptyTemplatesDesc')}
          actionLabel={t('sms.createTemplate')}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('sms.templateName')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('sms.templateBody')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('common.startDate')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((tpl) => (
                <tr
                  key={tpl.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => void handleEditClick(tpl)}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{tpl.name}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs max-w-xs truncate">{tpl.body}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(tpl.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(tpl)
                      }}
                      className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                    >
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <TemplateModal
          title={t('sms.createTemplate')}
          initial={emptyForm}
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setCreateOpen(false)}
          saving={createMutation.isPending}
        />
      )}

      {editItem && (
        <TemplateModal
          title={t('sms.editTemplate')}
          initial={{ name: editItem.name, body: editItem.body }}
          onSave={(data) => updateMutation.mutate({ id: editItem.id, data })}
          onClose={() => setEditItem(null)}
          saving={updateMutation.isPending}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-gray-800 mb-4">{t('marketing.deleteConfirm')}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
