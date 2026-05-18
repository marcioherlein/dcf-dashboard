export type AnalyticsEvent =
  | 'stock_viewed'
  | 'tab_changed'
  | 'assumption_changed'
  | 'save_clicked'
  | 'paywall_seen'
  | 'upgrade_clicked'
  | 'advanced_mode_toggled'
  | 'thesis_started'
  | 'thesis_completed'
  | 'model_saved'
  | 'report_export_clicked'
  | 'alert_created'
  | 'verdict_card_viewed'
  | 'cta_clicked'
  | 'search_performed'
  | 'watchlist_viewed'
  | 'portfolio_viewed'
  | 'fair_value_calculated'

type EventProps = Record<string, string | number | boolean | null | undefined>

export function track(event: AnalyticsEvent, props?: EventProps): void {
  if (typeof window === 'undefined') return
  // eslint-disable-next-line no-console
  console.log('[analytics]', event, props)
  // TODO: replace with posthog.capture(event, props) or equivalent
}
