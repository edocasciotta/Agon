import { getErrorMessage } from '../lib/errorMessages'

interface ErrorMessageProps { code?: string; message?: string }

export function ErrorMessage({ code, message }: ErrorMessageProps) {
  const text = code ? getErrorMessage(code) : message ?? 'An error occurred'
  return (
    <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
      {text}
    </div>
  )
}
