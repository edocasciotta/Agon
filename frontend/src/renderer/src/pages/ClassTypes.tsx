import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { classTemplatesApi, type ClassTemplateCreate } from '../api/classTemplates'
import { instructorsApi } from '../api/instructors'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PageHeader } from '../components/PageHeader'
import type { ClassTemplate } from '../types'
import type { ApiError } from '../api/client'

interface ClassTypeFormData {
  name: string
  description: string
  duration_minutes: number
  default_capacity: number
  color: string
  default_instructor_id: string
}

const DEFAULT_FORM: ClassTypeFormData = {
  name: '',
  description: '',
  duration_minutes: 60,
  default_capacity: 20,
  color: '#4F46E5',
  default_instructor_id: '',
}

export function ClassTypesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ClassTemplate | null>(null)
  const [formData, setFormData] = useState<ClassTypeFormData>(DEFAULT_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['class-templates'],
    queryFn: classTemplatesApi.list,
  })

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: instructorsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: ClassTemplateCreate) => classTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-templates'] })
      handleCloseForm()
    },
    onError: (err: ApiError) => {
      setFormError(err.message ?? t('classTypes.failedCreate'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ClassTemplateCreate }) =>
      classTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-templates'] })
      handleCloseForm()
    },
    onError: (err: ApiError) => {
      setFormError(err.message ?? t('classTypes.failedUpdate'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => classTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-templates'] })
    },
  })

  const handleOpenNew = () => {
    setEditingTemplate(null)
    setFormData(DEFAULT_FORM)
    setFormError(null)
    setShowForm(true)
  }

  const handleOpenEdit = (template: ClassTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description ?? '',
      duration_minutes: template.duration_minutes,
      default_capacity: template.default_capacity,
      color: template.color,
      default_instructor_id: template.default_instructor_id
        ? String(template.default_instructor_id)
        : '',
    })
    setFormError(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingTemplate(null)
    setFormData(DEFAULT_FORM)
    setFormError(null)
  }

  const handleDelete = (template: ClassTemplate) => {
    if (window.confirm(t('classTypes.deleteConfirm'))) {
      deleteMutation.mutate(template.id)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formData.name.trim()) {
      setFormError(t('classTypes.nameRequired'))
      return
    }
    const payload: ClassTemplateCreate = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      duration_minutes: formData.duration_minutes,
      default_capacity: formData.default_capacity,
      color: formData.color,
      default_instructor_id: formData.default_instructor_id
        ? Number(formData.default_instructor_id)
        : undefined,
    }
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <PageHeader
        title={t('classTypes.title')}
        action={
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {t('classTypes.newClassType')}
          </button>
        }
      />

      {/* Inline form panel */}
      {showForm && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingTemplate ? t('classTypes.editClassType') : t('classTypes.newClassType')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('classTypes.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('classTypes.namePlaceholder')}
                />
              </div>

              {/* Description */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('classTypes.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder={t('classTypes.descriptionPlaceholder')}
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('classTypes.durationMin')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({ ...formData, duration_minutes: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Default capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('classTypes.defaultCapacity')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.default_capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, default_capacity: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('classTypes.color')} <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-9 w-16 cursor-pointer rounded border border-gray-300 p-0.5"
                  />
                  <span className="text-sm text-gray-500 font-mono">{formData.color}</span>
                </div>
              </div>

              {/* Default instructor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('classTypes.defaultInstructor')}
                </label>
                <select
                  value={formData.default_instructor_id}
                  onChange={(e) =>
                    setFormData({ ...formData, default_instructor_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('classTypes.noDefaultInstructor')}</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isPending
                  ? t('classTypes.saving')
                  : editingTemplate
                    ? t('classTypes.updateClassType')
                    : t('classTypes.saveClassType')}
              </button>
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {isLoading && <LoadingSpinner />}

      {/* Empty state */}
      {!isLoading && (!templates || templates.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-500 mb-4">{t('classTypes.noClassTypes')}</p>
          {!showForm && (
            <button
              onClick={handleOpenNew}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('classTypes.newClassType')}
            </button>
          )}
        </div>
      )}

      {/* Cards grid */}
      {!isLoading && templates && templates.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm flex"
            >
              {/* Colored left border */}
              <div
                className="w-1.5 flex-shrink-0"
                style={{ backgroundColor: template.color }}
              />
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm">{template.name}</h3>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 ml-2 mt-0.5"
                    style={{ backgroundColor: template.color }}
                  />
                </div>
                <p className="text-xs text-gray-500 mb-1">{template.duration_minutes} {t('classTypes.minLabel')}</p>
                <p className="text-xs text-gray-500 mb-2">{t('classTypes.maxLabel')} {template.default_capacity}</p>
                {template.description && (
                  <p className="text-xs text-gray-400 truncate mb-3">{template.description}</p>
                )}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => handleOpenEdit(template)}
                    className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
