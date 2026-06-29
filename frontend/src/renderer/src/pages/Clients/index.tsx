import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { clientsApi } from '../../api/clients'
import type { ClientCreateData } from '../../api/clients'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { ErrorMessage } from '../../components/ErrorMessage'
import { PageHeader } from '../../components/PageHeader'
import type { ApiError } from '../../api/client'

export function ClientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState<ClientCreateData>({ full_name: '', email: '', phone: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [warnMsg, setWarnMsg] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients', debouncedSearch],
    queryFn: () => clientsApi.list(debouncedSearch || undefined),
  })

  const apiError = error as ApiError | null

  const createMutation = useMutation({
    mutationFn: (data: ClientCreateData) => clientsApi.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      if (result.email_sent) {
        setSuccessMsg(t('clients.inviteSent', { email: result.email }))
        setWarnMsg(null)
      } else {
        setWarnMsg(t('clients.inviteNotSent'))
        setSuccessMsg(null)
      }
      setForm({ full_name: '', email: '', phone: '' })
      setTimeout(() => {
        setShowAddModal(false)
        setSuccessMsg(null)
        setWarnMsg(null)
      }, 3000)
    },
    onError: (err: ApiError) => {
      setFormError(err.message ?? t('common.error'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    createMutation.mutate({ ...form, phone: form.phone || undefined })
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setFormError(null)
    setSuccessMsg(null)
    setWarnMsg(null)
    setForm({ full_name: '', email: '', phone: '' })
  }

  return (
    <div>
      <PageHeader
        title={t('clients.title')}
        subtitle={clients ? `${clients.length} ${t('clients.title').toLowerCase()}` : undefined}
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {t('clients.addClient')}
          </button>
        }
      />

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('clients.searchPlaceholder')}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {isLoading && <LoadingSpinner />}
      {apiError && <ErrorMessage code={apiError.code} message={apiError.message} />}

      {clients && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('clients.name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('clients.email')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('clients.phone')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('clients.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('clients.joined')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{client.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{client.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{client.phone ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {client.is_active ? t('clients.active') : t('clients.inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {format(new Date(client.created_at), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    {t('clients.noClients')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('clients.modalTitle')}</h2>

            {successMsg && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 mb-4 text-sm text-green-700">
                {successMsg}
              </div>
            )}
            {warnMsg && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 mb-4 text-sm text-yellow-700">
                {warnMsg}
              </div>
            )}
            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-4 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('clients.fullName')}</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('clients.emailAddress')}</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('clients.phoneOptional')}</label>
                <input
                  type="text"
                  value={form.phone ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {createMutation.isPending ? t('common.creating') : t('clients.addClient')}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
