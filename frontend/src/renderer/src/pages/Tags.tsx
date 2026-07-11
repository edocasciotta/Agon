import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { tagsApi } from '../api/tags'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import type { Tag, AutoTagRule } from '../types'
import { tagSchema, autoTagRuleSchema } from '../lib/formSchemas'
import { resolveApiError } from '../lib/errorMessages'

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#78716c',
]

const EMPTY_TAG_FORM = { name: '', color: '#6366f1' }

const TRIGGER_EVENTS = [
  'booking_created',
  'booking_cancelled',
  'membership_purchased',
  'membership_expired',
  'no_show',
  'checkin',
] as const

export function TagsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Tag state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [tagForm, setTagForm] = useState(EMPTY_TAG_FORM)

  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [editTagForm, setEditTagForm] = useState(EMPTY_TAG_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // Rule state
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [ruleForm, setRuleForm] = useState({ tag_id: 0, trigger_event: 'booking_created' as string, is_active: true })

  const [editingRule, setEditingRule] = useState<AutoTagRule | null>(null)
  const [editRuleForm, setEditRuleForm] = useState({ tag_id: 0, trigger_event: 'booking_created' as string, is_active: true })
  const [editRuleError, setEditRuleError] = useState<string | null>(null)

  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<number | null>(null)

  // Active tab
  const [activeTab, setActiveTab] = useState<'tags' | 'rules'>('tags')

  // Queries
  const { data: tags, isLoading: tagsLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  })

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['auto-tag-rules'],
    queryFn: () => tagsApi.listRules(),
    enabled: activeTab === 'rules',
  })

  // Tag mutations
  const createTagMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setShowCreateModal(false)
      setCreateError(null)
      setTagForm(EMPTY_TAG_FORM)
    },
    onError: (err: unknown) => {
      setCreateError(resolveApiError(err, t('tags.failedCreate')))
    },
  })

  const editTagMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Tag> }) =>
      tagsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setEditingTag(null)
      setEditError(null)
    },
    onError: (err: unknown) => {
      setEditError(resolveApiError(err, t('tags.failedEdit')))
    },
  })

  const deleteTagMutation = useMutation({
    mutationFn: (id: number) => tagsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setConfirmDeleteId(null)
    },
  })

  // Rule mutations
  const createRuleMutation = useMutation({
    mutationFn: tagsApi.createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-tag-rules'] })
      setShowRuleModal(false)
      setRuleError(null)
    },
    onError: (err: unknown) => {
      setRuleError(resolveApiError(err, t('tags.failedCreateRule')))
    },
  })

  const editRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AutoTagRule> }) =>
      tagsApi.updateRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-tag-rules'] })
      setEditingRule(null)
      setEditRuleError(null)
    },
    onError: (err: unknown) => {
      setEditRuleError(resolveApiError(err, t('tags.failedEditRule')))
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => tagsApi.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-tag-rules'] })
      setConfirmDeleteRuleId(null)
    },
  })

  // Handlers
  const handleCreateTag = () => {
    const result = tagSchema.safeParse(tagForm)
    if (!result.success) {
      setCreateError(result.error.errors[0].message)
      return
    }
    createTagMutation.mutate({ name: tagForm.name.trim(), color: tagForm.color })
  }

  const openEditTag = (tag: Tag) => {
    setEditingTag(tag)
    setEditTagForm({ name: tag.name, color: tag.color })
    setEditError(null)
  }

  const handleEditTag = () => {
    if (!editingTag) return
    const result = tagSchema.safeParse(editTagForm)
    if (!result.success) {
      setEditError(result.error.errors[0].message)
      return
    }
    editTagMutation.mutate({
      id: editingTag.id,
      data: { name: editTagForm.name.trim(), color: editTagForm.color },
    })
  }

  const handleCreateRule = () => {
    const result = autoTagRuleSchema.safeParse(ruleForm)
    if (!result.success) {
      setRuleError(result.error.errors[0].message)
      return
    }
    createRuleMutation.mutate({
      tag_id: ruleForm.tag_id,
      trigger_event: ruleForm.trigger_event as typeof TRIGGER_EVENTS[number],
      is_active: ruleForm.is_active,
    })
  }

  const openEditRule = (rule: AutoTagRule) => {
    setEditingRule(rule)
    setEditRuleForm({ tag_id: rule.tag_id, trigger_event: rule.trigger_event, is_active: rule.is_active })
    setEditRuleError(null)
  }

  const handleEditRule = () => {
    if (!editingRule) return
    const result = autoTagRuleSchema.safeParse(editRuleForm)
    if (!result.success) {
      setEditRuleError(result.error.errors[0].message)
      return
    }
    editRuleMutation.mutate({
      id: editingRule.id,
      data: {
        tag_id: editRuleForm.tag_id,
        trigger_event: editRuleForm.trigger_event as typeof TRIGGER_EVENTS[number],
        is_active: editRuleForm.is_active,
      },
    })
  }

  const confirmDeleteTag = tags?.find((t) => t.id === confirmDeleteId)
  const confirmDeleteRule = rules?.find((r) => r.id === confirmDeleteRuleId)

  const getTagName = (tagId: number) => tags?.find((t) => t.id === tagId)?.name ?? `#${tagId}`
  const getTagColor = (tagId: number) => tags?.find((t) => t.id === tagId)?.color ?? '#6366f1'

  return (
    <div>
      <PageHeader
        title={t('tags.title')}
        action={
          activeTab === 'tags' && tags && tags.length > 0 ? (
            <button
              onClick={() => { setShowCreateModal(true); setCreateError(null); setTagForm(EMPTY_TAG_FORM) }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('tags.create')}
            </button>
          ) : activeTab === 'rules' && tags && tags.length > 0 ? (
            <button
              onClick={() => { setShowRuleModal(true); setRuleError(null); setRuleForm({ tag_id: tags[0]?.id ?? 0, trigger_event: 'booking_created', is_active: true }) }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('tags.createRule')}
            </button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('tags')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tags'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tags.tagsTab')}
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rules'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tags.rulesTab')}
          </button>
        </div>
      </div>

      {/* Tags Tab */}
      {activeTab === 'tags' && (
        <>
          {tagsLoading ? (
            <LoadingSpinner />
          ) : !tags || tags.length === 0 ? (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
              }
              title={t('tags.noTags')}
              description={t('tags.emptyDesc')}
              actionLabel={t('tags.create')}
              onAction={() => { setShowCreateModal(true); setCreateError(null); setTagForm(EMPTY_TAG_FORM) }}
            />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('tags.color')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('tags.name')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('tags.createdAt')}</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tags.map((tag) => (
                    <tr key={tag.id}>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{tag.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(tag.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditTag(tag)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(tag.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <>
          {rulesLoading ? (
            <LoadingSpinner />
          ) : !rules || rules.length === 0 ? (
            <EmptyState
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              }
              title={t('tags.noRules')}
              description={t('tags.emptyDescRules')}
              actionLabel={t('tags.createRule')}
              onAction={() => {
                if (!tags || tags.length === 0) return
                setShowRuleModal(true)
                setRuleError(null)
                setRuleForm({ tag_id: tags[0]?.id ?? 0, trigger_event: 'booking_created', is_active: true })
              }}
            />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('tags.ruleTag')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('tags.triggerEvent')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rules.map((rule) => (
                    <tr key={rule.id} className={!rule.is_active ? 'bg-gray-50 opacity-60' : ''}>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: getTagColor(rule.tag_id) }}
                        >
                          {getTagName(rule.tag_id)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {t(`tags.trigger.${rule.trigger_event}`)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {rule.is_active ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditRule(rule)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteRuleId(rule.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create Tag Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setShowCreateModal(false); setCreateError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('tags.create')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tags.name')}</label>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('tags.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tags.color')}</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTagForm({ ...tagForm, color: c })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        tagForm.color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: tagForm.color }}
                  >
                    {tagForm.name || t('tags.preview')}
                  </span>
                </div>
              </div>
              {createError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{createError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateTag}
                  disabled={createTagMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {createTagMutation.isPending ? t('common.creating') : t('tags.create')}
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); setCreateError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setEditingTag(null); setEditError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('tags.edit')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tags.name')}</label>
                <input
                  type="text"
                  value={editTagForm.name}
                  onChange={(e) => setEditTagForm({ ...editTagForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('tags.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tags.color')}</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditTagForm({ ...editTagForm, color: c })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        editTagForm.color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: editTagForm.color }}
                  >
                    {editTagForm.name || t('tags.preview')}
                  </span>
                </div>
              </div>
              {editError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{editError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleEditTag}
                  disabled={editTagMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {editTagMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
                <button
                  onClick={() => { setEditingTag(null); setEditError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tag Confirmation */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{t('tags.deleteConfirm')}</h2>
            {confirmDeleteTag && (
              <div className="mb-3">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: confirmDeleteTag.color }}
                >
                  {confirmDeleteTag.name}
                </span>
              </div>
            )}
            <p className="text-sm text-gray-600 mb-4">{t('tags.deleteDesc')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteTagMutation.mutate(confirmDeleteId)}
                disabled={deleteTagMutation.isPending}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteTagMutation.isPending ? t('common.loading') : t('common.delete')}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setShowRuleModal(false); setRuleError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('tags.createRule')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tags.ruleTag')}</label>
                <select
                  value={ruleForm.tag_id}
                  onChange={(e) => setRuleForm({ ...ruleForm, tag_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(tags ?? []).map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tags.triggerEvent')}</label>
                <select
                  value={ruleForm.trigger_event}
                  onChange={(e) => setRuleForm({ ...ruleForm, trigger_event: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {TRIGGER_EVENTS.map((event) => (
                    <option key={event} value={event}>{t(`tags.trigger.${event}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rule_is_active"
                  checked={ruleForm.is_active}
                  onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="rule_is_active" className="text-sm text-gray-700">{t('tags.ruleActive')}</label>
              </div>
              {ruleError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{ruleError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRule}
                  disabled={createRuleMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {createRuleMutation.isPending ? t('common.creating') : t('tags.createRule')}
                </button>
                <button
                  onClick={() => { setShowRuleModal(false); setRuleError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => { setEditingRule(null); setEditRuleError(null) }}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('tags.editRule')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tags.ruleTag')}</label>
                <select
                  value={editRuleForm.tag_id}
                  onChange={(e) => setEditRuleForm({ ...editRuleForm, tag_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(tags ?? []).map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('tags.triggerEvent')}</label>
                <select
                  value={editRuleForm.trigger_event}
                  onChange={(e) => setEditRuleForm({ ...editRuleForm, trigger_event: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {TRIGGER_EVENTS.map((event) => (
                    <option key={event} value={event}>{t(`tags.trigger.${event}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_rule_is_active"
                  checked={editRuleForm.is_active}
                  onChange={(e) => setEditRuleForm({ ...editRuleForm, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="edit_rule_is_active" className="text-sm text-gray-700">{t('tags.ruleActive')}</label>
              </div>
              {editRuleError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{editRuleError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleEditRule}
                  disabled={editRuleMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {editRuleMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
                <button
                  onClick={() => { setEditingRule(null); setEditRuleError(null) }}
                  className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Rule Confirmation */}
      {confirmDeleteRuleId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setConfirmDeleteRuleId(null)}>
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-2">{t('tags.deleteRuleConfirm')}</h2>
            {confirmDeleteRule && (
              <p className="text-sm text-gray-600 mb-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white mr-1"
                  style={{ backgroundColor: getTagColor(confirmDeleteRule.tag_id) }}
                >
                  {getTagName(confirmDeleteRule.tag_id)}
                </span>
                {t(`tags.trigger.${confirmDeleteRule.trigger_event}`)}
              </p>
            )}
            <p className="text-sm text-gray-600 mb-4">{t('tags.deleteRuleDesc')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteRuleMutation.mutate(confirmDeleteRuleId)}
                disabled={deleteRuleMutation.isPending}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteRuleMutation.isPending ? t('common.loading') : t('common.delete')}
              </button>
              <button
                onClick={() => setConfirmDeleteRuleId(null)}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
