'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'marcioherlein@gmail.com')
  .split(',').map(e => e.trim())

interface AdminUser {
  id: string
  email: string
  name: string | null
  plan: 'free' | 'pro'
  last_seen: string | null
  created_at: string | null
  views_this_month: number
}

interface Stats {
  totalUsers: number
  proUsers: number
  mau: number
  topTickers: { ticker: string; views: number }[]
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Tab = 'users' | 'analytics' | 'broadcast'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Broadcast state
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<'all' | 'free' | 'pro'>('all')
  const [sending, setSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ ok?: boolean; sent?: number; error?: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isAdmin = ADMIN_EMAILS.includes(session?.user?.email ?? '')

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/stats').then(r => r.json()),
    ]).then(([u, s]) => {
      setUsers(Array.isArray(u) ? u : [])
      setStats(s?.totalUsers !== undefined ? s : null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [isAdmin])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading…
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400 text-sm">Access denied.</p>
      </div>
    )
  }

  const filtered = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) || (u.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const recipientCount = audience === 'all'
    ? users.length
    : users.filter(u => u.plan === audience).length

  async function sendBroadcast() {
    setSending(true)
    setBroadcastResult(null)
    setConfirmOpen(false)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, audience }),
      })
      const data = await res.json()
      setBroadcastResult(data)
    } catch {
      setBroadcastResult({ error: 'Network error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Admin</h1>
        <span className="text-xs text-slate-500">{session?.user?.email}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-700/50 pb-0">
        {(['users', 'analytics', 'broadcast'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading data…</div>
      ) : (
        <>
          {/* USERS TAB */}
          {tab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by email or name…"
                  className="w-72 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500">{filtered.length} users</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-700/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-slate-400">User</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400">Plan</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400">Last seen</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400">Views / month</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => (
                      <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-100 truncate max-w-xs">{u.email}</div>
                          {u.name && <div className="text-xs text-slate-500 mt-0.5">{u.name}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {u.plan === 'pro' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Pro</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/30">Free</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{relativeTime(u.last_seen)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${u.views_this_month > 0 ? 'text-slate-100' : 'text-slate-600'}`}>
                            {u.views_this_month}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{shortDate(u.created_at)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No users found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {tab === 'analytics' && stats && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Total users', value: stats.totalUsers },
                  { label: 'Pro users', value: stats.proUsers },
                  { label: 'MAU (this month)', value: stats.mau },
                ].map(kpi => (
                  <div key={kpi.label} className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-6 py-5">
                    <div className="text-2xl font-bold text-slate-100">{kpi.value.toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-1">{kpi.label}</div>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-medium text-slate-300 mb-3">Top tickers (all time)</h3>
              <div className="rounded-xl border border-slate-700/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 text-left w-12">#</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 text-left">Ticker</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 text-right">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topTickers.map((t, i) => (
                      <tr key={t.ticker} className="border-b border-slate-800 last:border-0">
                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-100">{t.ticker}</td>
                        <td className="px-4 py-3 text-slate-400 text-right">{t.views.toLocaleString()}</td>
                      </tr>
                    ))}
                    {stats.topTickers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500 text-sm">No data yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BROADCAST TAB */}
          {tab === 'broadcast' && (
            <div className="max-w-2xl">
              <p className="text-sm text-slate-400 mb-6">
                Send an email to your users. Messages are sent via Resend from <span className="text-slate-300">team@insic.app</span>.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Audience</label>
                  <div className="flex gap-3">
                    {(['all', 'free', 'pro'] as const).map(a => (
                      <label key={a} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="audience"
                          value={a}
                          checked={audience === a}
                          onChange={() => setAudience(a)}
                          className="accent-blue-500"
                        />
                        <span className="text-sm text-slate-300 capitalize">{a}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Subject</label>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="What's this email about?"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Message</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Write your message here. Each blank line becomes a paragraph."
                    rows={8}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                  />
                </div>

                {broadcastResult && (
                  <div className={`rounded-lg px-4 py-3 text-sm ${broadcastResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {broadcastResult.ok
                      ? `Sent to ${broadcastResult.sent} recipient${broadcastResult.sent !== 1 ? 's' : ''}.`
                      : `Error: ${broadcastResult.error}`}
                  </div>
                )}

                {confirmOpen ? (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                    <p className="text-sm text-amber-300 mb-3">
                      Send &ldquo;{subject}&rdquo; to <strong>{recipientCount}</strong> {audience === 'all' ? '' : audience + ' '}user{recipientCount !== 1 ? 's' : ''}?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={sendBroadcast}
                        disabled={sending}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        {sending ? 'Sending…' : 'Confirm send'}
                      </button>
                      <button
                        onClick={() => setConfirmOpen(false)}
                        className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmOpen(true)}
                    disabled={!subject.trim() || !message.trim() || recipientCount === 0 || sending}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Send broadcast
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
