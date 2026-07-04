import { useState, useEffect, useRef } from 'react'
import { getApiBase } from '../config/apiBase'

const API_BASE = getApiBase()

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
)

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
)

const BrainIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7.5L12 22l3-5.5c2-2 4-4.5 4-7.5a7 7 0 0 0-7-7z"/></svg>
)

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
)

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  </svg>
)

const LoadingDots = () => (
  <div className="flex gap-1 items-center py-1">
    <div className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
    <div className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
    <div className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
  </div>
)

export function ChatSidebar({ tabId, appSessionId, onClose, persona = 'default' }) {
  const [sessions, setSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState('')
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('default')
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [error, setError] = useState(null)

  const messagesEndRef = useRef(null)
  const modelSelectorRef = useRef(null)

  // Fetch available models on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/context/models`)
      .then(r => r.json())
      .then(data => {
        if (data.models) {
          setModels(data.models)
          setSelectedModel(data.default || 'default')
        }
      })
      .catch(() => {})
  }, [])

  // Fetch chat sessions for this tab
  const fetchSessions = async (selectLatest = true) => {
    try {
      const response = await fetch(`${API_BASE}/api/context/chat/sessions/${tabId}`)
      if (!response.ok) throw new Error('Failed to fetch sessions')
      const data = await response.json()
      
      if (data.sessions && data.sessions.length > 0) {
        setSessions(data.sessions)
        if (selectLatest) {
          setCurrentSessionId(data.sessions[0].id)
        }
      } else {
        // Automatically create a session if none exists
        createSession()
      }
    } catch (err) {
      console.error(err)
      setError('Could not load chat sessions.')
    }
  }

  // Create a new session
  const createSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/context/chat/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab_id: tabId })
      })
      if (!response.ok) throw new Error('Failed to create session')
      const data = await response.json()
      
      // Refresh list and select the new session
      await fetchSessions(false)
      setCurrentSessionId(data.session_id)
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Could not start a new chat session.')
    }
  }

  // Delete current session
  const deleteSession = async (sid) => {
    const sessionToDelete = sid || currentSessionId
    if (!sessionToDelete) return

    try {
      const response = await fetch(`${API_BASE}/api/context/chat/session/${sessionToDelete}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete session')
      
      const updated = sessions.filter(s => s.id !== sessionToDelete)
      if (updated.length > 0) {
        setSessions(updated)
        setCurrentSessionId(updated[0].id)
      } else {
        setSessions([])
        setCurrentSessionId('')
        // Creates a new one automatically if none left
        createSession()
      }
    } catch (err) {
      console.error(err)
      setError('Failed to delete chat.')
    }
  }

  // Load messages when selected session changes
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([])
      return
    }

    const fetchMessages = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/context/chat/messages/${currentSessionId}`)
        if (!response.ok) throw new Error('Failed to fetch messages')
        const data = await response.json()
        setMessages(data.messages || [])
        setError(null)
      } catch (err) {
        console.error(err)
        setError('Could not load messages.')
      }
    }

    fetchMessages()
  }, [currentSessionId])

  // Fetch sessions on mount / tabId change
  useEffect(() => {
    fetchSessions(true)
  }, [tabId])

  // Scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Close model selector on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target)) {
        setShowModelSelector(false)
      }
    }
    if (showModelSelector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelSelector])

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || !currentSessionId) return
    const textToSend = inputText
    setInputText('')
    setIsLoading(true)
    setError(null)

    // Append user message instantly in local view
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      text: textToSend,
      sender: 'user',
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const response = await fetch(`${API_BASE}/api/context/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          message: textToSend,
          tab_id: tabId,
          model: selectedModel,
          app_session_id: appSessionId
        })
      })

      if (!response.ok) throw new Error('Chat request failed')
      const data = await response.json()

      // Reload messages list from DB to ensure sync and IDs
      const msgRes = await fetch(`${API_BASE}/api/context/chat/messages/${currentSessionId}`)
      if (msgRes.ok) {
        const msgData = await msgRes.json()
        setMessages(msgData.messages || [])
      } else {
        // Fallback: append response manually
        const reply = {
          id: `reply-${Date.now()}`,
          text: data.response || 'No response.',
          sender: 'ai',
          model: data.model_used
        }
        setMessages(prev => [...prev, reply])
      }
    } catch (err) {
      console.error(err)
      setError('Failed to send message.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading) {
        handleSend()
      }
    }
  }

  const currentModel = models.find(m => m.id === selectedModel) || { name: 'Llama 3.1 8B (Default)', id: selectedModel }

  // Format date display for session selector
  const formatSessionLabel = (session) => {
    try {
      const dt = new Date(session.created_at)
      return `Chat: ${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } catch {
      return `Chat Session (${session.id.slice(0, 5)})`
    }
  }

  return (
    <div className="w-96 flex flex-col h-full bg-[var(--bg-surface)] border-l border-[var(--border-color)] relative z-30 animate-fade-in-up">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-[var(--border-color)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--action-primary)] font-medium text-sm">
            <BrainIcon />
            <span>AI Context Assistant</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] transition-colors"
            title="Close sidebar"
          >
            <XIcon />
          </button>
        </div>

        {/* Sessions switcher & controls */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <select
              value={currentSessionId}
              onChange={(e) => setCurrentSessionId(e.target.value)}
              className="w-full text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer appearance-none pr-8 hover:bg-[var(--bg-hover)] transition-colors"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {formatSessionLabel(s)}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-[var(--text-tertiary)]">
              <ChevronDownIcon />
            </div>
          </div>

          <button
            onClick={createSession}
            className="p-1.5 rounded-lg border border-[var(--border-color)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
            title="New Chat"
          >
            <PlusIcon />
          </button>
          
          <button
            onClick={() => deleteSession()}
            className="p-1.5 rounded-lg border border-[var(--border-color)] hover:border-red-200 hover:bg-red-50 hover:text-red-600 text-[var(--text-secondary)] transition-colors"
            title="Delete Chat"
            disabled={!currentSessionId}
          >
            <TrashIcon />
          </button>
        </div>

        {/* Model selector bar */}
        <div className="relative" ref={modelSelectorRef}>
          <button 
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <span className="font-medium">Model: {currentModel.name}</span>
            <ChevronDownIcon />
          </button>
          
          {showModelSelector && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in-up">
              <div className="max-h-48 overflow-y-auto">
                {models.map(model => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model.id); setShowModelSelector(false) }}
                    className={`w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] last:border-b-0 flex flex-col ${selectedModel === model.id ? 'bg-[var(--bg-hover)]' : ''}`}
                  >
                    <span className="font-medium text-xs text-[var(--text-primary)]">{model.name}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{model.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-red-600 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03]">
          <h1 className="text-4xl font-black text-[var(--text-primary)]">AI CHAT</h1>
        </div>

        {messages.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)] opacity-60 text-center px-4">
            <BrainIcon />
            <p className="mt-2 text-xs">Start chatting! The AI will refer to searches in this tab.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user'
            return (
              <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2 text-xs leading-relaxed shadow-sm rounded-xl
                    ${isUser
                      ? 'bg-[var(--action-primary)] text-white rounded-br-sm'
                      : 'bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-bl-sm'
                    }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {!isUser && msg.model && (
                    <span className="text-[9px] text-[var(--text-tertiary)] block mt-1 uppercase tracking-tight">
                      via {msg.model.replace('-instant', '').replace('-versatile', '')}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
        
        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="max-w-[85%] px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl rounded-bl-sm shadow-sm">
              <LoadingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-full px-3 py-1.5 focus-within:border-[var(--action-primary)] transition-colors shadow-sm">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "Thinking..." : "Ask AI about this context..."}
            disabled={isLoading || !currentSessionId}
            rows={1}
            className="flex-1 bg-transparent outline-none text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 resize-none max-h-20 py-1"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading || !currentSessionId}
            className="w-7 h-7 rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)] flex items-center justify-center disabled:opacity-30 disabled:bg-[var(--border-color)] transition-all shrink-0 hover:scale-105"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
