import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const maxDuration = 30

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'marciofabrizio@gmail.com')
  .split(',')[0].trim()

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// Expected modes per weekday (a representative subset — if these haven't posted,
// something is wrong even if others have)
const SENTINEL_WEEKDAY_MODES = ['morning_brief', 'dcf', 'macro', 'market_close']
const SENTINEL_WEEKEND_MODES = ['sentiment', 'etf_pulse']

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  const now = new Date()
  const todayUTC = now.toISOString().split('T')[0]
  const hourUTC  = now.getUTCHours()
  const dowUTC   = now.getUTCDay() // 0=Sun, 6=Sat

  const isWeekend = dowUTC === 0 || dowUTC === 6
  const sentinels = isWeekend ? SENTINEL_WEEKEND_MODES : SENTINEL_WEEKDAY_MODES

  // Query today's posted events
  const { data: events, error } = await sb
    .from('posted_tweet_events')
    .select('event_key, tweet_type, posted_at, tweet_text')
    .gte('posted_at', `${todayUTC}T00:00:00Z`)
    .lt('posted_at',  `${todayUTC}T23:59:59Z`)

  if (error) {
    console.error('[posting-health] Supabase query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const postedToday = new Set(
    (events ?? [])
      .filter(e => !e.event_key.endsWith(':failed'))
      .map(e => {
        // Extract mode name from key format: mode:NAME:YYYY-MM-DD or mode:NAME:YYYY-MM-DDTHH
        const parts = e.event_key.split(':')
        return parts.length >= 2 ? parts[1] : e.tweet_type
      })
  )

  const failedToday = (events ?? [])
    .filter(e => e.event_key.endsWith(':failed'))
    .map(e => ({
      mode: e.event_key.split(':')[1],
      error: e.tweet_text ?? 'unknown error',
      at: e.posted_at,
    }))

  // Check which sentinels are missing (only flag after they should have run)
  // morning_brief is at 11:00 UTC — check after 11:30 UTC
  const missingModes = SENTINEL_WEEKDAY_MODES.filter(mode => {
    if (isWeekend && !SENTINEL_WEEKEND_MODES.includes(mode)) return false
    if (!sentinels.includes(mode)) return false
    if (postedToday.has(mode)) return false
    // Only flag if enough time has passed
    const modeHours: Record<string, number> = {
      morning_brief: 12, dcf: 15, macro: 17, market_close: 21,
      sentiment: 14, etf_pulse: 14,
    }
    return hourUTC >= (modeHours[mode] ?? 12)
  })

  const totalPosted = postedToday.size
  const totalFailed = failedToday.length
  const isHealthy   = missingModes.length === 0 && failedToday.length === 0

  // Only send alert if something is wrong
  if (!isHealthy) {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#f9f9f9">
  <div style="background:#fff;border-radius:8px;padding:24px;border-left:4px solid #D83B3B">
    <h2 style="margin:0 0 16px;color:#D83B3B">⚠️ Posting Health Alert — ${todayUTC}</h2>
    <p style="color:#444;margin:0 0 16px">The automated posting system needs attention.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Posted today</td><td style="padding:8px">${totalPosted} posts</td></tr>
      <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Failed today</td><td style="padding:8px;color:${totalFailed > 0 ? '#D83B3B' : '#11875D'}">${totalFailed} failures</td></tr>
      <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Missing modes</td><td style="padding:8px;color:${missingModes.length > 0 ? '#D83B3B' : '#11875D'}">${missingModes.length > 0 ? missingModes.join(', ') : 'none'}</td></tr>
    </table>

    ${failedToday.length > 0 ? `
    <h3 style="color:#D83B3B;margin:0 0 8px">Failed posts:</h3>
    <ul style="margin:0;padding-left:20px">
      ${failedToday.map(f => `<li style="margin-bottom:6px"><strong>${f.mode}</strong> — ${f.error.slice(0, 200)}</li>`).join('')}
    </ul>
    ` : ''}

    <div style="margin-top:24px;padding:16px;background:#FFF4DA;border-radius:6px;border:1px solid #F3D391">
      <strong>What to do:</strong><br>
      1. Check GitHub Actions → X Auto-Post for red runs<br>
      2. If red: check the run log for the error message<br>
      3. To replay a failed mode: GitHub Actions → X Auto-Post → Run workflow → select mode → dry_run: false<br>
      4. Full runbook: <a href="https://insic.app/admin/posting-status">insic.app/admin/posting-status</a>
    </div>
  </div>
</body>
</html>`

    await resend.emails.send({
      from: 'insic alerts <team@insic.app>',
      to: ADMIN_EMAIL,
      subject: `[ALERT] Posting system issue — ${missingModes.length} missing, ${failedToday.length} failed — ${todayUTC}`,
      html,
    })

    console.log(`[posting-health] Alert sent to ${ADMIN_EMAIL}: ${missingModes.length} missing, ${failedToday.length} failed`)
  } else {
    console.log(`[posting-health] Healthy — ${totalPosted} posts, 0 failures, 0 missing`)
  }

  return NextResponse.json({
    healthy: isHealthy,
    date: todayUTC,
    posted: totalPosted,
    failed: totalFailed,
    missing: missingModes,
    failures: failedToday,
    alertSent: !isHealthy,
  })
}
