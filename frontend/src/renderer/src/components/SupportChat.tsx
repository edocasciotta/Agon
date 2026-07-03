import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import type { ChatMessage } from '../api/support'
import { agentApi, type AgentDraft, type AgentUsage } from '../api/agent'
import { LoadingSpinner } from './LoadingSpinner'
import {
  MessageCircle,
  X,
  Trash2,
  Plus,
  Send,
  Bot,
  CheckCircle2,
} from 'lucide-react'

interface DisplayMessage extends ChatMessage {
  actionType?: string
}

const CONTEXT_WINDOW_TOKENS = 128_000 // llama-3.3-70b-versatile

interface ChatSession {
  id: string
  title: string
  messages: DisplayMessage[]
  lastUsage: AgentUsage | null
}

function toApiMessages(messages: DisplayMessage[]): ChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

const STORAGE_KEY = 'agon-chat-sessions'

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function createEmptySession(): ChatSession {
  return { id: generateId(), title: 'New Chat', messages: [], lastUsage: null }
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
  const [{ initialSessions, initialActiveId }] = useState(() => {
    const saved = loadSessions()
    if (saved[0] && saved[0].messages.length === 0) {
      return { initialSessions: saved, initialActiveId: saved[0].id }
    }
    const fresh = createEmptySession()
    return { initialSessions: [fresh, ...saved], initialActiveId: fresh.id }
  })
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState<string>(initialActiveId)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [agentDraft, setAgentDraft] = useState<AgentDraft | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0]

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
      requestAnimationFrame(() => inputRef.current?.focus())
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
    setAgentDraft(null)
  }

  const handleDeleteSession = (id: string) => {
    if (activeSessionId === id) setAgentDraft(null)
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
      const response = await agentApi.act(toApiMessages(updatedMessages), i18n.language, agentDraft)
      setAgentDraft(response.action ? null : response.draft)
      updateSession(activeSession.id, (s) => ({
        ...s,
        lastUsage: response.usage ?? s.lastUsage,
        messages: [
          ...s.messages,
          { role: 'assistant', content: response.reply, actionType: response.action?.type },
        ],
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
      requestAnimationFrame(() => inputRef.current?.focus())
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
        <div className="mb-3 flex w-[560px] h-[520px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Sidebar */}
          <div className="w-[164px] flex flex-col border-r border-gray-100 bg-gray-50/60">
            <div className="p-2.5 border-b border-gray-100">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus size={13} strokeWidth={2} />
                {t('support.newChat')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-start gap-1.5 px-2.5 py-2 cursor-pointer border-b border-gray-100/60 transition-colors ${
                    session.id === activeSessionId
                      ? 'bg-white border-l-2 border-l-indigo-400'
                      : 'hover:bg-gray-100/60'
                  }`}
                  onClick={() => {
                    setActiveSessionId(session.id)
                    setAgentDraft(null)
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs truncate leading-tight ${
                        session.id === activeSessionId
                          ? 'text-gray-900 font-medium'
                          : 'text-gray-500'
                      }`}
                    >
                      {session.title}
                    </p>
                    {(() => {
                      const lastAsst = session.messages.findLast((m) => m.role === 'assistant')
                      return lastAsst ? (
                        <p className="text-[10px] truncate text-gray-400 leading-tight mt-0.5">
                          {lastAsst.content}
                        </p>
                      ) : null
                    })()}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSession(session.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
                    aria-label={t('support.deleteSession')}
                  >
                    <Trash2 size={12} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-100">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50">
                    <Bot size={15} strokeWidth={1.75} className="text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">{t('support.title')}</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label={t('support.close')}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <X size={15} strokeWidth={1.75} />
                </button>
              </div>
              {/* Token usage bar */}
              {activeSession?.lastUsage && (() => {
                const used = activeSession.lastUsage.prompt_tokens
                const pct = Math.min((used / CONTEXT_WINDOW_TOKENS) * 100, 100)
                const color =
                  pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-amber-400' : 'bg-indigo-400'
                return (
                  <div className="px-4 pb-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-gray-400">
                        {t('support.contextUsed', {
                          used: used.toLocaleString(),
                          max: (CONTEXT_WINDOW_TOKENS / 1000).toFixed(0) + 'K',
                        })}
                      </span>
                      <span className="text-[10px] text-gray-400">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {pct >= 80 && (
                      <p className="text-[10px] text-amber-600 mt-0.5">
                        {t('support.contextNearLimit')}
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeSession?.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <MessageCircle size={18} strokeWidth={1.5} className="text-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400 text-center px-6 leading-relaxed">
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
                    className={`max-w-[80%] px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-xl rounded-br-sm'
                        : msg.actionType
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-xl rounded-bl-sm'
                          : 'bg-gray-100 text-gray-800 rounded-xl rounded-bl-sm'
                    }`}
                  >
                    {msg.actionType && (
                      <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 mb-1">
                        <CheckCircle2 size={12} strokeWidth={2} />
                        {t('support.actionExecuted')}
                      </div>
                    )}
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
            <div className="px-3 py-2.5 border-t border-gray-100 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('support.placeholder')}
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 focus:bg-white disabled:opacity-50 transition-all"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isLoading}
                aria-label={t('support.send')}
                className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={15} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? t('support.close') : t('support.open')}
        className="w-12 h-12 rounded-xl bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center hover:shadow-xl"
      >
        {isOpen ? (
          <X size={18} strokeWidth={1.75} />
        ) : (
          <MessageCircle size={18} strokeWidth={1.75} />
        )}
      </button>
    </div>
  )
}
