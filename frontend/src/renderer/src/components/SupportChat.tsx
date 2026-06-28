import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { supportApi, type ChatMessage } from '../api/support'
import { LoadingSpinner } from './LoadingSpinner'

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
}

const STORAGE_KEY = 'agon-chat-sessions'

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function createEmptySession(): ChatSession {
  return { id: generateId(), title: 'New Chat', messages: [] }
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ChatSession[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // ignore
  }
  return [createEmptySession()]
}

function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // ignore
  }
}

export function SupportChat() {
  const { t } = useTranslation()

  const [isOpen, setIsOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [activeSessionId, setActiveSessionId] = useState<string>(() => loadSessions()[0].id)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0]

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  useEffect(() => {
    if (isOpen && messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeSession?.messages, isOpen])

  const updateSession = (id: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)))
  }

  const handleNewChat = () => {
    const newSession = createEmptySession()
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    setInputValue('')
  }

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (next.length === 0) {
        const empty = createEmptySession()
        if (activeSessionId === id) setActiveSessionId(empty.id)
        return [empty]
      }
      if (activeSessionId === id) setActiveSessionId(next[0].id)
      return next
    })
  }

  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isLoading || !activeSession) return

    const userMessage: ChatMessage = { role: 'user', content: text }
    const isFirstUserMessage = activeSession.messages.filter((m) => m.role === 'user').length === 0
    const newTitle = isFirstUserMessage ? text.slice(0, 30) : activeSession.title

    const updatedMessages = [...activeSession.messages, userMessage]

    updateSession(activeSession.id, (s) => ({
      ...s,
      title: newTitle,
      messages: updatedMessages,
    }))
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await supportApi.chat(updatedMessages, i18n.language)
      updateSession(activeSession.id, (s) => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', content: response.reply }],
      }))
    } catch {
      updateSession(activeSession.id, (s) => ({
        ...s,
        messages: [
          ...s.messages,
          { role: 'assistant', content: t('support.errorConnect') },
        ],
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-3 flex w-[540px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Sidebar */}
          <div className="w-[160px] flex flex-col border-r border-gray-200 bg-gray-50">
            <div className="p-2 border-b border-gray-200">
              <button
                onClick={handleNewChat}
                className="w-full px-2 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t('support.newChat')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-1 px-2 py-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${
                    session.id === activeSessionId ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  <span
                    className={`flex-1 text-xs truncate ${
                      session.id === activeSessionId
                        ? 'text-indigo-700 font-medium'
                        : 'text-gray-600'
                    }`}
                  >
                    {session.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSession(session.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-xs leading-none"
                    aria-label="Delete session"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <span className="font-semibold text-sm">{t('support.title')}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t('support.close')}
                className="text-indigo-200 hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeSession?.messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-400 text-center px-4">
                    {t('support.emptyHint')}
                  </p>
                </div>
              )}
              {activeSession?.messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm">
                    <LoadingSpinner size="sm" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-3 py-3 border-t border-gray-200 flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('support.placeholder')}
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isLoading}
                className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('support.send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? t('support.close') : t('support.open')}
        className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center text-2xl"
      >
        {isOpen ? '✕' : '💬'}
      </button>
    </div>
  )
}
