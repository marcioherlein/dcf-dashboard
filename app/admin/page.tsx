'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Search, Users, BarChart3, Mail, ChevronRight, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react'

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

function UserAvatar({ email }: { email: string }) {
  const initial = email[0].toUpperCase()
  const hue = email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 select-none"
      style={{ backgroundColor: `hsl(${hue}, 38%, 46%)` }}
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ['w-44', 'w-12', 'w-16', 'w-8', 'w-20']
  return (
    <tbody className="divide-y divide-[#E5E5E5]">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className={`h-3 rounded-full bg-[#F0F0F0] animate-pulse ${widths[j] ?? 'w-16'}`} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

type Tab = 'users' | 'analytics' | 'broadcast' | 'feedback'

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'users',     label: 'Users',     Icon: Users        },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3    },
  { id: 'broadcast', label: 'Broadcast', Icon: Mail         },
  { id: 'feedback',  label: 'Feedback',  Icon: MessageSquare },
]

// ── Shared input class ────────────────────────────────────────────────────────
const INPUT_CLS =
  'w-full px-3 py-2.5 text-[16px] sm:text-sm bg-white border border-[#E5E5E5] rounded-lg text-[#111111] ' +
  'placeholder-[#C4C4C4] focus:outline-none focus:ring-2 focus:ring-[#5F790B]/20 ' +
  'focus:border-[#5F790B] transition-colors'

interface FeedbackItem {
  id: string
  user_email: string | null
  message: string
  page: string | null
  created_at: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [tab, setTab]             = useState<Tab>('users')
  const [users, setUsers]         = useState<AdminUser[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])

  const [subject, setSubject]                 = useState('')
  const [message, setMessage]                 = useState('')
  const [audience, setAudience]               = useState<'all' | 'free' | 'pro'>('all')
  const [sending, setSending]                 = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ ok?: boolean; sent?: number; error?: string } | null>(null)
  const [confirmOpen, setConfirmOpen]         = useState(false)

  const isAdmin = ADMIN_EMAILS.includes(session?.user?.email ?? '')

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/admin/feedback').then(r => r.json()),
    ]).then(([u, s, f]) => {
      setUsers(Array.isArray(u) ? u : [])
      setStats(s?.totalUsers !== undefined ? s : null)
      setFeedbackItems(Array.isArray(f) ? f : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [isAdmin])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-4 w-4 rounded-full border-2 border-[#E5E5E5] border-t-[#5F790B] animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-sm font-medium text-[#111111]">Access denied</p>
        <p className="text-xs text-[#9B9B9B]">This page is restricted to admin accounts.</p>
      </div>
    )
  }

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const recipientCount = audience === 'all'
    ? users.length
    : users.filter(u => u.plan === audience).length

  async function sendBroadcast() {
    setSending(true)
    setBroadcastResult(null)
    setConfirmOpen(false)
    try {
      const res  = await fetch('/api/admin/broadcast', {
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

  const conversionRate = stats && stats.totalUsers > 0
    ? Math.round((stats.proUsers / stats.totalUsers) * 100)
    : 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-base font-semibold text-[#111111] tracking-tight">Admin</h1>
          <p className="text-xs text-[#9B9B9B] mt-0.5">{session?.user?.email}</p>
        </div>
        {!loading && stats && (
          <div className="flex items-center gap-3 text-xs text-[#6B6B6B] pt-1">
            <span>
              <span className="font-semibold text-[#111111] tabular-nums">{stats.totalUsers.toLocaleString()}</span>
              {' '}users
            </span>
            <span className="text-[#E5E5E5] select-none">·</span>
            <span>
              <span className="font-semibold text-[#111111] tabular-nums">{stats.mau.toLocaleString()}</span>
              {' '}this month
            </span>
          </div>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 mb-6 border-b border-[#E5E5E5]">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
              tab === id
                ? 'text-[#5F790B] border-b-2 border-[#5F790B]'
                : 'text-[#6B6B6B] hover:text-[#111111] border-b-2 border-transparent',
            ].join(' ')}
          >
            <Icon size={14} strokeWidth={tab === id ? 2.2 : 1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ───────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="relative w-72">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B9B9B] pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by email or name…"
                className="w-full pl-8 pr-3 py-2 text-[16px] sm:text-sm bg-white border border-[#E5E5E5] rounded-lg text-[#111111] placeholder-[#C4C4C4] focus:outline-none focus:ring-2 focus:ring-[#5F790B]/20 focus:border-[#5F790B] transition-colors"
              />
            </div>
            {!loading && (
              <span className="text-xs text-[#9B9B9B] shrink-0 tabular-nums">
                {filtered.length.toLocaleString()} {filtered.length === 1 ? 'user' : 'users'}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-[#E5E5E5] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                  <th className="px-4 py-3 text-xs font-semibold text-[#6B6B6B] text-left">User</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#6B6B6B] text-left">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#6B6B6B] text-left">Last seen</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#6B6B6B] text-right">Views / mo.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#6B6B6B] text-left">Joined</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={8} cols={5} />
              ) : (
                <tbody className="divide-y divide-[#E5E5E5]">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar email={u.email} />
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-[#111111] truncate max-w-[200px]">
                              {u.email}
                            </div>
                            {u.name && (
                              <div className="text-xs text-[#9B9B9B] mt-0.5 truncate max-w-[200px]">
                                {u.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.plan === 'pro' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]">
                            Pro
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F5F5] text-[#6B6B6B] border border-[#E5E5E5]">
                            Free
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6B6B6B] tabular-nums">
                        {relativeTime(u.last_seen)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[13px] font-medium tabular-nums ${u.views_this_month > 0 ? 'text-[#111111]' : 'text-[#C4C4C4]'}`}>
                          {u.views_this_month > 0 ? u.views_this_month.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#9B9B9B] tabular-nums">
                        {shortDate(u.created_at)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-[#9B9B9B] text-sm">
                        {search ? `No users matching "${search}"` : 'No users yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── ANALYTICS TAB ───────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl border border-[#E5E5E5] bg-white px-5 py-4">
                  <div className="h-7 w-16 rounded-md bg-[#F0F0F0] animate-pulse mb-2" />
                  <div className="h-3 w-24 rounded-full bg-[#F0F0F0] animate-pulse" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#E5E5E5] overflow-hidden">
              <table className="w-full">
                <TableSkeleton rows={6} cols={3} />
              </table>
            </div>
          </div>
        ) : !stats ? (
          <div className="flex items-center justify-center h-40 text-[#9B9B9B] text-sm">
            No analytics data available
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: 'Total users',
                  value: stats.totalUsers,
                  sub: 'registered accounts',
                },
                {
                  label: 'Pro subscribers',
                  value: stats.proUsers,
                  sub: `${conversionRate}% conversion rate`,
                },
                {
                  label: 'Active this month',
                  value: stats.mau,
                  sub: 'unique sessions',
                },
              ].map(kpi => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-[#E5E5E5] bg-white px-5 py-4"
                >
                  <div className="text-2xl font-bold text-[#111111] tabular-nums tracking-tight">
                    {kpi.value.toLocaleString()}
                  </div>
                  <div className="text-xs font-semibold text-[#111111] mt-1.5">{kpi.label}</div>
                  <div className="text-xs text-[#9B9B9B] mt-0.5">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Top tickers */}
            <div>
              <p className="text-xs font-semibold text-[#6B6B6B] mb-3">Top tickers</p>
              <div className="rounded-xl border border-[#E5E5E5] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                      <th className="px-4 py-3 text-xs font-semibold text-[#6B6B6B] text-left w-10">#</th>
                      <th className="px-4 py-3 text-xs font-semibold text-[#6B6B6B] text-left">Ticker</th>
                      <th className="px-4 py-3 text-xs font-semibold text-[#6B6B6B] text-right">Views</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {stats.topTickers.map((t, i) => (
                      <tr key={t.ticker} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-3 text-xs text-[#C4C4C4] tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-semibold text-[#111111] tracking-tight font-mono">
                            {t.ticker}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#6B6B6B] text-right tabular-nums">
                          {t.views.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {stats.topTickers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-12 text-center text-[#9B9B9B] text-sm">
                          No view data yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── BROADCAST TAB ───────────────────────────────────────────────── */}
      {tab === 'broadcast' && (
        <div className="max-w-xl space-y-5">
          <p className="text-sm text-[#6B6B6B]">
            Send email to your users via Resend from{' '}
            <span className="font-medium text-[#111111]">team@insic.app</span>.
          </p>

          {/* Audience */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-2">Audience</label>
            <div className="flex gap-2">
              {(['all', 'free', 'pro'] as const).map(a => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize',
                    audience === a
                      ? 'bg-[#EEF4DD] text-[#5F790B] border-[#5F790B]/30'
                      : 'bg-white text-[#6B6B6B] border-[#E5E5E5] hover:border-[#C8C8C8] hover:text-[#111111]',
                  ].join(' ')}
                >
                  {a}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#9B9B9B] mt-1.5">
              <span className="font-semibold text-[#111111] tabular-nums">{recipientCount}</span>
              {' '}recipient{recipientCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1.5">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject line for this email"
              className={INPUT_CLS}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your message. Each blank line becomes a paragraph."
              rows={7}
              className={INPUT_CLS + ' resize-y'}
            />
          </div>

          {/* Result banner */}
          {broadcastResult && (
            <div className={[
              'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
              broadcastResult.ok
                ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]'
                : 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]',
            ].join(' ')}>
              {broadcastResult.ok
                ? <CheckCircle size={15} className="mt-0.5 shrink-0" />
                : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              <span>
                {broadcastResult.ok
                  ? `Sent to ${broadcastResult.sent} recipient${broadcastResult.sent !== 1 ? 's' : ''}.`
                  : `Error: ${broadcastResult.error}`}
              </span>
            </div>
          )}

          {/* Confirm step */}
          {confirmOpen ? (
            <div className="rounded-lg border border-[#F3D391] bg-[#FFF4DA] px-4 py-4">
              <p className="text-sm text-[#B56A00] mb-3">
                Send &ldquo;{subject}&rdquo; to{' '}
                <strong className="font-semibold">{recipientCount}</strong>
                {audience !== 'all' && ` ${audience}`}
                {' '}user{recipientCount !== 1 ? 's' : ''}?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={sendBroadcast}
                  disabled={sending}
                  className="px-4 py-2 rounded-lg bg-[#5F790B] hover:bg-[#526A08] text-white text-sm font-semibold disabled:opacity-40 transition-colors min-w-[120px]"
                >
                  {sending ? 'Sending…' : 'Confirm send'}
                </button>
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={sending}
                  className="px-4 py-2 rounded-lg bg-white border border-[#E5E5E5] hover:border-[#C8C8C8] text-[#6B6B6B] text-sm font-medium transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!subject.trim() || !message.trim() || recipientCount === 0 || sending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5F790B] hover:bg-[#526A08] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Review &amp; send
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── FEEDBACK TAB ────────────────────────────────────────────────── */}
      {tab === 'feedback' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#6B6B6B]">{feedbackItems.length} response{feedbackItems.length !== 1 ? 's' : ''}</p>
          </div>
          {feedbackItems.length === 0 ? (
            <div className="rounded-xl border border-[#E5E5E5] px-6 py-12 text-center text-sm text-[#9B9B9B]">
              No feedback yet. Keep shipping!
            </div>
          ) : (
            <div className="space-y-3">
              {feedbackItems.map(item => (
                <div key={item.id} className="rounded-xl border border-[#E5E5E5] bg-white px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-medium text-[#111111] truncate">
                        {item.user_email ?? 'Anonymous'}
                      </span>
                      {item.page && (
                        <span className="shrink-0 text-[11px] text-[#9B9B9B] bg-[#F4F3EF] border border-[#E5E5E5] rounded-full px-2 py-0.5 font-mono">
                          {item.page}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-[#9B9B9B] whitespace-nowrap">
                      {relativeTime(item.created_at)}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#333333] leading-relaxed whitespace-pre-wrap">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
