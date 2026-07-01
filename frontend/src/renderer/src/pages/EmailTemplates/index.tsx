import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { emailTemplatesApi } from '../../api/emailTemplates'
import type { EmailTemplateListItem, EmailTemplateResponse, EmailTemplateCreate } from '../../types'
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
  '{{invite_url}}',
  '{{reset_url}}',
]

const emptyForm: EmailTemplateCreate = { name: '', subject: '', html_body: '' }

interface TemplateModalProps {
  initial: EmailTemplateCreate
  title: string
  onSave: (data: EmailTemplateCreate) => void
  onClose: () => void
  saving: boolean
}

function TemplateModal({ initial, title, onSave, onClose, saving }: TemplateModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<EmailTemplateCreate>(initial)

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
              {t('marketing.templateName')} *
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
              {t('marketing.subject')} *
            </label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Hello {{client_name}}, your booking is confirmed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('marketing.htmlBody')} *
            </label>
            <div className="mb-2 flex flex-wrap gap-1">
              {AVAILABLE_VARS.map((v) => (
                <span
                  key={v}
                  className="inline-block bg-indigo-50 text-indigo-700 text-xs font-mono px-2 py-0.5 rounded cursor-pointer hover:bg-indigo-100"
                  title={t('marketing.availableVars')}
                  onClick={() => setForm((f) => ({ ...f, html_body: f.html_body + v }))}
                >
                  {v}
                </span>
              ))}
            </div>
            <textarea
              required
              rows={10}
              value={form.html_body}
              onChange={(e) => setForm((f) => ({ ...f, html_body: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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

export function EmailTemplatesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<EmailTemplateResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplateListItem | null>(null)

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['email-templates'],
    queryFn: emailTemplatesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: emailTemplatesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      setCreateOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmailTemplateCreate }) =>
      emailTemplatesApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      setEditItem(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => emailTemplatesApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      setDeleteTarget(null)
    },
    onError: () => {
      alert(t('marketing.deleteAssignedError'))
    },
  })

  async function handleEditClick(item: EmailTemplateListItem) {
    const full = await emailTemplatesApi.get(item.id)
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
        <h1 className="text-2xl font-bold text-gray-800">{t('marketing.templates')}</h1>
        {templates.length > 0 && (
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
          >
            {t('marketing.newTemplate')}
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          }
          title={t('marketing.noTemplates')}
          description={t('marketing.emptyDescTemplates')}
          actionLabel={t('marketing.newTemplate')}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('marketing.templateName')}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t('marketing.subject')}
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
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{tpl.subject}</td>
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
          title={t('marketing.newTemplate')}
          initial={emptyForm}
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setCreateOpen(false)}
          saving={createMutation.isPending}
        />
      )}

      {editItem && (
        <TemplateModal
          title={t('marketing.editTemplate')}
          initial={{ name: editItem.name, subject: editItem.subject, html_body: editItem.html_body }}
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
