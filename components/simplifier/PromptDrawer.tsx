'use client'

import { useState } from 'react'

interface PromptDrawerProps {
  prompt: string
  phaseName: string
  onClose: () => void
}

export default function PromptDrawer({ prompt, phaseName, onClose }: PromptDrawerProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that block clipboard API
      const el = document.createElement('textarea')
      el.value = prompt
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" />

      {/* Drawer */}
      <div
        className="w-full max-w-xl bg-[#161b22] border-l border-[#30363d] flex flex-col h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <div>
            <p className="text-[#e6edf3] font-semibold text-sm">AI Analysis Prompt</p>
            <p className="text-[#8b949e] text-xs mt-0.5">{phaseName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors p-1 rounded hover:bg-[#30363d]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        </div>

        {/* Instructions */}
        <div className="px-5 py-3 bg-[#1f2d3d] border-b border-[#30363d]">
          <p className="text-[#79c0ff] text-xs leading-relaxed">
            Copy this prompt and paste it into Claude, ChatGPT, Gemini, or any AI assistant for a deeper analysis.
          </p>
        </div>

        {/* Prompt textarea */}
        <div className="flex-1 overflow-y-auto p-5">
          <textarea
            readOnly
            value={prompt}
            className="w-full h-full min-h-[300px] bg-[#0d1117] border border-[#30363d] rounded text-[#e6edf3] text-xs font-mono px-3 py-3 resize-none focus:outline-none focus:border-[#388bfd] transition-colors leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[#30363d] flex gap-3">
          <button
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-sm font-semibold transition-all ${
              copied
                ? 'bg-[#238636] border border-[#2ea043] text-white'
                : 'bg-[#1f6feb] border border-[#388bfd] text-white hover:bg-[#388bfd]'
            }`}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
                </svg>
                Copy to Clipboard
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded text-sm text-[#8b949e] border border-[#30363d] hover:border-[#6e7681] hover:text-[#e6edf3] transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
