# External Monitoring Setup for the Posting System

## Why External Monitoring is Needed

The posting system relies on Vercel cron jobs to schedule and execute social media posts. This creates a fundamental blind spot: **Vercel cron cannot detect its own failure**.

Specifically:

- If Vercel cron stops firing (due to a Vercel incident, misconfiguration, or plan downtime), the system goes silent — no errors are raised, no alerts are triggered, nothing is logged.
- GitHub Actions health checks that run inside the same Vercel environment are subject to the same outage. If Vercel is down, the health check also fails to run.
- Any monitoring that lives inside the system being monitored cannot serve as an independent observer. It shares the same failure modes.

The solution is an **external observer** — a third-party service or an entirely separate infrastructure that calls the `/api/admin/posting-status` endpoint from outside and raises an alert when the endpoint is unhealthy, unreachable, or returning bad data.

---

## ADMIN_STATUS_KEY Setup

Before configuring any monitor, set up the `ADMIN_STATUS_KEY` environment variable that protects the status endpoint.

### 1. Generate a secure key

```bash
openssl rand -hex 32
```

This outputs a 64-character hex string, for example:

```
a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

### 2. Add to Vercel (production)

```bash
npx vercel env add ADMIN_STATUS_KEY production
```

Paste the generated key when prompted. Redeploy the project for the variable to take effect:

```bash
npx vercel --prod
```

### 3. Add to GitHub Secrets (if using Option 3)

In your GitHub repository:

1. Go to **Settings > Secrets and variables > Actions**
2. Click **New repository secret**
3. Name: `ADMIN_STATUS_KEY`
4. Value: the same key generated above

### 4. Update your monitor

Wherever you configure the external monitor, set the `Authorization` request header to:

```
Bearer <your-generated-key>
```

---

## What the Monitor Should Alert On

The monitor must raise an alert when **any** of the following conditions are true:

| Condition | Meaning |
|---|---|
| `health` = `"failing"` | The system has detected an internal failure state |
| `failed` > `0` | One or more posts failed to publish |
| `stuck_jobs` > `0` | One or more jobs are in a stuck or hung state |
| `actual_by_now` < `expected_by_now - 2` | More than 2 posts have been missed relative to schedule |
| Status endpoint returns non-200 HTTP status | The endpoint itself is broken or returning an error |
| Status endpoint is unreachable | Vercel is down, DNS failure, or network issue |

---

## Option 1: UptimeRobot (Free — Recommended)

UptimeRobot is a free external monitoring service that checks URLs from multiple global locations every 5 minutes on the free plan.

### Step-by-step setup

**1. Create an account**

Go to [https://uptimerobot.com](https://uptimerobot.com) and sign up for a free account.

**2. Create a new monitor**

From the dashboard, click **+ Add New Monitor**.

**3. Configure the monitor**

| Field | Value |
|---|---|
| Monitor Type | HTTP(s) |
| Friendly Name | `insic posting-status` |
| URL | `https://insic.app/api/admin/posting-status` |
| Monitoring Interval | Every 5 minutes |

**4. Set the HTTP method and headers**

Under **Advanced Settings**:

- HTTP Method: `GET`
- Add a custom header:
  - Header name: `Authorization`
  - Header value: `Bearer <ADMIN_STATUS_KEY>`

**5. Set keyword monitoring**

Still under Advanced Settings, enable **Keyword Monitoring**:

- Keyword: `healthy`
- Alert when: **Keyword NOT found**

This means if the response body does not contain the string `"healthy"`, UptimeRobot fires an alert. This catches cases where `health` is `"failing"` or `"degraded"`, even if the HTTP status is 200.

**6. Configure alert contacts**

Under **Alert Contacts**, add:

- Type: Email
- Email: `marcioherlein@gmail.com`

**7. Set alert conditions**

Ensure alerts fire on both:

- Keyword not found in response
- HTTP status code is not 200

**8. Save the monitor**

Click **Create Monitor**. UptimeRobot begins checking within a few minutes. You will receive an email confirmation when the monitor goes live.

**9. Verify the monitor is working**

From the UptimeRobot dashboard, click **Test** on the new monitor. Confirm it returns a green status and that the keyword `healthy` was found in the response body. If it shows red, verify the `ADMIN_STATUS_KEY` is correct and the endpoint is deployed.

---

## Option 2: Better Uptime (Alternative)

[Better Uptime](https://betteruptime.com) offers a free tier with richer alerting features including on-call scheduling, incident timelines, and Slack/PagerDuty integrations.

### Setup summary

1. Create an account at [https://betteruptime.com](https://betteruptime.com)
2. Click **New Monitor > HTTP Monitor**
3. URL: `https://insic.app/api/admin/posting-status`
4. Method: `GET`
5. Add request header: `Authorization: Bearer <ADMIN_STATUS_KEY>`
6. Check frequency: 3 minutes (free tier)
7. Enable **Response body keyword check**: alert if body does NOT contain `healthy`
8. Alert channel: email to `marcioherlein@gmail.com`
9. Optionally configure Slack webhook under **Integrations**

Better Uptime also provides a public status page and incident management if you need to communicate outages to users.

---

## Option 3: GitHub Actions External Check (Free)

This option uses a **separate GitHub repository** — not the main insic repo — to run an independent workflow that calls the status endpoint from GitHub's infrastructure. Because it runs on GitHub's runners (not Vercel), it remains operational even if Vercel is fully down.

### Prerequisites

- A separate GitHub repository (e.g., `marcioherlein/insic-monitor`)
- `ADMIN_STATUS_KEY` added to that repository's secrets (see ADMIN_STATUS_KEY Setup above)
- Optional: `ALERT_EMAIL` and `SLACK_WEBHOOK_URL` secrets for notifications

### Full workflow YAML

Create the file `.github/workflows/posting-health-check.yml` in the separate monitoring repository:

```yaml
name: Posting System Health Check

on:
  schedule:
    # Runs every 30 minutes
    - cron: '*/30 * * * *'
  workflow_dispatch:
    # Allow manual trigger from the Actions tab

jobs:
  health-check:
    name: Check posting-status endpoint
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Call posting-status endpoint
        id: fetch
        run: |
          HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" \
            -H "Authorization: Bearer ${{ secrets.ADMIN_STATUS_KEY }}" \
            "https://insic.app/api/admin/posting-status")

          HTTP_BODY=$(echo "$HTTP_RESPONSE" | head -n -1)
          HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n 1)

          echo "http_status=$HTTP_STATUS" >> $GITHUB_OUTPUT
          echo "body=$HTTP_BODY" >> $GITHUB_OUTPUT

          echo "HTTP Status: $HTTP_STATUS"
          echo "Response body: $HTTP_BODY"

      - name: Parse and validate response
        id: validate
        run: |
          BODY='${{ steps.fetch.outputs.body }}'
          HTTP_STATUS='${{ steps.fetch.outputs.http_status }}'

          # Default to failure state
          ALERT=false
          REASONS=""

          # Check HTTP status
          if [ "$HTTP_STATUS" != "200" ]; then
            ALERT=true
            REASONS="HTTP status $HTTP_STATUS (expected 200)"
          fi

          # Parse JSON fields using python3 (available on ubuntu-latest)
          HEALTH=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('health','unknown'))" 2>/dev/null || echo "parse_error")
          FAILED=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('failed',0))" 2>/dev/null || echo "0")
          STUCK=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stuck_jobs',0))" 2>/dev/null || echo "0")
          EXPECTED=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('expected_by_now',0))" 2>/dev/null || echo "0")
          ACTUAL=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('actual_by_now',0))" 2>/dev/null || echo "0")

          # Check health status
          if [ "$HEALTH" = "failing" ] || [ "$HEALTH" = "parse_error" ] || [ "$HEALTH" = "unknown" ]; then
            ALERT=true
            REASONS="$REASONS | health=$HEALTH"
          fi

          # Check failed count
          if [ "$FAILED" -gt "0" ] 2>/dev/null; then
            ALERT=true
            REASONS="$REASONS | failed=$FAILED"
          fi

          # Check stuck jobs
          if [ "$STUCK" -gt "0" ] 2>/dev/null; then
            ALERT=true
            REASONS="$REASONS | stuck_jobs=$STUCK"
          fi

          # Check missed posts: actual_by_now < expected_by_now - 2
          THRESHOLD=$((EXPECTED - 2))
          if [ "$ACTUAL" -lt "$THRESHOLD" ] 2>/dev/null && [ "$EXPECTED" -gt "2" ]; then
            ALERT=true
            REASONS="$REASONS | missed posts: actual=$ACTUAL expected=$EXPECTED"
          fi

          echo "alert=$ALERT" >> $GITHUB_OUTPUT
          echo "reasons=$REASONS" >> $GITHUB_OUTPUT
          echo "health=$HEALTH" >> $GITHUB_OUTPUT
          echo "failed=$FAILED" >> $GITHUB_OUTPUT
          echo "stuck=$STUCK" >> $GITHUB_OUTPUT
          echo "expected=$EXPECTED" >> $GITHUB_OUTPUT
          echo "actual=$ACTUAL" >> $GITHUB_OUTPUT

          echo "Alert: $ALERT"
          echo "Reasons: $REASONS"

      - name: Fail job if alert triggered
        if: steps.validate.outputs.alert == 'true'
        run: |
          echo "ALERT: Posting system health check failed"
          echo "Reasons: ${{ steps.validate.outputs.reasons }}"
          echo "health=${{ steps.validate.outputs.health }}"
          echo "failed=${{ steps.validate.outputs.failed }}"
          echo "stuck=${{ steps.validate.outputs.stuck }}"
          echo "expected=${{ steps.validate.outputs.expected }}"
          echo "actual=${{ steps.validate.outputs.actual }}"
          exit 1

      - name: Send Slack alert on failure
        if: failure() && env.SLACK_WEBHOOK_URL != ''
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
          curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d '{
              "text": "*insic Posting System Alert*",
              "attachments": [{
                "color": "danger",
                "fields": [
                  {"title": "Timestamp", "value": "'"$TIMESTAMP"'", "short": true},
                  {"title": "Health", "value": "'"${{ steps.validate.outputs.health }}"'", "short": true},
                  {"title": "Posted / Expected", "value": "'"${{ steps.validate.outputs.actual }}"' / '"${{ steps.validate.outputs.expected }}"'", "short": true},
                  {"title": "Failed", "value": "'"${{ steps.validate.outputs.failed }}"'", "short": true},
                  {"title": "Stuck Jobs", "value": "'"${{ steps.validate.outputs.stuck }}"'", "short": true},
                  {"title": "Reasons", "value": "'"${{ steps.validate.outputs.reasons }}"'", "short": false},
                  {"title": "Dashboard", "value": "<https://insic.app/admin/posting-status|View posting status>", "short": false},
                  {"title": "Recommended Action", "value": "Check the admin dashboard, review Vercel logs, and run POST /api/admin/recover-stuck-jobs if stuck jobs > 0.", "short": false}
                ]
              }]
            }'
```

### How GitHub notifies you of failures

When the workflow fails (the `exit 1` step), GitHub automatically sends an email to the repository owner at `marcioherlein@gmail.com`. No additional configuration is needed for basic email alerts — GitHub's built-in failure notifications handle this.

To change the notification email:

1. Go to GitHub **Settings > Notifications**
2. Under **Actions**, ensure **Send notifications for failed workflows only** is checked

For Slack alerts, add `SLACK_WEBHOOK_URL` to the repository secrets. If the secret is not set, the Slack step is skipped silently.

---

## Alert Message Format

Every alert — whether from UptimeRobot, Better Uptime, or GitHub Actions — should contain the following information:

| Field | Description |
|---|---|
| **Timestamp** | UTC time the check ran, e.g. `2026-06-29T14:32:00Z` |
| **Health status** | The raw value from the `health` field: `healthy`, `failing`, or `degraded` |
| **Posted count** | `actual_by_now` — how many posts have actually gone out |
| **Expected count** | `expected_by_now` — how many posts should have gone out by this time |
| **Failed count** | `failed` — posts that attempted and failed |
| **Stuck job details** | `stuck_jobs` count and job IDs if available |
| **Dashboard link** | Direct link: `https://insic.app/admin/posting-status` |
| **Recommended action** | See below |

### Recommended actions by failure type

| Alert type | Recommended action |
|---|---|
| `health = "failing"` | Open the admin dashboard. Check Vercel logs for errors. Redeploy if needed. |
| `failed > 0` | Open the admin dashboard. Review which posts failed. Retry manually or via `/api/admin/retry-failed`. |
| `stuck_jobs > 0` | Call `POST /api/admin/recover-stuck-jobs` to unstick hung jobs. |
| Missed posts (actual < expected - 2) | Verify Vercel cron is still active in the Vercel dashboard under **Settings > Cron Jobs**. |
| Non-200 HTTP status | Check if the deployment is live. Run `npx vercel --prod` if needed. |
| Endpoint unreachable | Check [https://vercel-status.com](https://vercel-status.com) for an ongoing incident. |

---

## Quick Reference

| Setting | Value |
|---|---|
| Status endpoint | `https://insic.app/api/admin/posting-status` |
| Auth header | `Authorization: Bearer <ADMIN_STATUS_KEY>` |
| Healthy response contains | `"health":"healthy"` |
| Admin dashboard | `https://insic.app/admin/posting-status` |
| Recommended check interval | 5 minutes (UptimeRobot) or 30 minutes (GitHub Actions) |
| Alert email | `marcioherlein@gmail.com` |
