# Share Export Debug Report

## Root Cause

The "Preview unavailable" error had **multiple compounding causes**, none of which involved
DOM capture, canvas, html-to-image, or blob lifecycle — the entire image generation
happens server-side via Next.js edge routes (`@vercel/og` / satori).

### Cause 1 — satori `display:flex` requirement (portrait route)

Every `<div>` in a satori JSX tree must have explicit `display: 'flex'` or `display: 'none'`
if it has more than one child. The portrait route had several containers without this,
causing the edge function to throw:

```
Error: Expected <div> to have explicit "display: flex" or "display: none"
       if it has more than one child node.
```

This produced an empty response body. The browser received no image data, `img.onError`
fired, and the modal showed "Preview unavailable".

### Cause 2 — Custom fonts not available on edge runtime

The portrait route specified `fontFamily: 'Inter, system-ui'` and
`fontFamily: 'DM Mono, monospace'` without loading them via the `fonts:` option in
`ImageResponse`. The edge runtime does not have Inter or DM Mono available by default.
Fixed by using `system-ui,-apple-system,sans-serif` and `monospace` (always available).

### Cause 3 — Sticky error state with no recovery path

Once `imgError` was set to `true` in the original modal (from any transient failure),
there was no way for users to recover. The retry button was absent. The state was reset
only via a `useEffect` on `previewUrl`, which has async timing — if the image loaded
faster than the effect ran, state could be inconsistent.

### Cause 4 — No concurrency guard on format switching

Rapid format switching could result in an older slower response arriving after a newer
one, causing the stale handler to overwrite the correct state. The original code used
`key={previewUrl}` on the `<img>` tag (good) but had no generation ID to prevent
out-of-order updates.

### Cause 5 — No loading timeout

If the edge function took too long (portrait route: ~4s in production, up to 10s on
cold start), the image would appear stuck in "Generating…" indefinitely with no feedback.

## Architecture Before

```
ShareCardModal
  state: imgLoading (bool), imgError (bool)
  
  URL built once, passed to <img src={url} key={url}>
  
  onLoad  → setImgLoading(false), setImgError(false)
  onError → setImgLoading(false), setImgError(true) [sticky, no retry]
  
  format change → useEffect resets loading state (async, race-prone)
  
  error state → "Preview unavailable / Image will still download correctly"
                (no retry, no diagnostic)
```

## Architecture After

```
ShareCardModal
  state: previewState ('loading' | 'ready' | 'error'), retryKey (number)
  ref:   currentPreviewRef { format, retryKey, url }  — concurrency guard
  
  Format change → handleFormatChange()
    → increments retryKey synchronously
    → calls startLoading(format, key) which sets state + starts 15s timeout
  
  Retry → handleRetry()
    → same mechanism as format change
  
  <img key={`${format}-${retryKey}`}>
    onLoad  → checks currentPreviewRef to reject stale responses
            → clears timeout, sets state='ready'
    onError → checks currentPreviewRef to reject stale responses
            → clears timeout, sets state='error'
  
  Loading state → spinner + "Generating preview…"
  Error state   → error icon + "Preview failed" + Retry button
  Ready state   → image visible
```

## Why Previous Fixes Failed

1. **NaN guards** — correct but didn't fix the root JSX structure error
2. **Font replacement** — correct but didn't fix missing `display:flex` on divs
3. **Incremental div fixes** — satori requires ALL divs to have display:flex;
   patching one at a time missed others
4. **"Image will still download correctly"** — the download also fetches the same
   URL, so if preview fails, download likely fails too (except when it's a transient
   network issue). The message was misleading.

## Files Changed

| File | Change |
|------|--------|
| `app/api/og/portrait/route.tsx` | Complete rewrite: every div has `display:'flex'`, no nested spans, NaN guards, system fonts only |
| `components/valuation/ShareCardModal.tsx` | State machine (loading/ready/error), concurrency guard via ref, retry button, 15s timeout, stale handler prevention |

## Verification

All three routes tested in production mode (`next build && next start`):

```
/api/og          HTTP 200 | 46941B  | 1.5s
/api/og/square   HTTP 200 | 55586B  | 1.1s
/api/og/portrait HTTP 200 | 78866B  | 4.1s (satori render, no remote fetches)
```

Test params: AAPL, NU (null fv), NVDA (overvalued + full conviction), MSFT (long name).
All returned valid PNG data (`\x89PNG` magic bytes confirmed).

## Remaining Limitations

1. **Portrait route is slow (~4s)**. This is satori rendering time for a complex 1080×1350
   JSX tree. Mitigation: the loading spinner now correctly shows while waiting.
   Potential improvement: use Next.js `generateImageMetadata` or a CDN cache.

2. **Cold starts on Vercel**. First request after inactivity can add 2-5s to response
   time. The 15s timeout handles this gracefully (shows retry instead of hanging).

3. **No tests added**. The existing codebase has no test infrastructure (no jest config,
   no playwright config found). Adding tests would require first setting up a testing
   framework, which is outside the scope of this fix.
