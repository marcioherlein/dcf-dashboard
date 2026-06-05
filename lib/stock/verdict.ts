// Single source of truth for verdict derivation.
// All stock overview components must import from here — never define locally.

export type VerdictKey = 'attractive' | 'undervalued' | 'fairly-valued' | 'overvalued' | 'expensive' | 'insufficient'

export interface VerdictResult {
  key:          VerdictKey
  word:         string
  chip:         string          // pill label e.g. "BUY"
  chipClass:    string          // Tailwind classes for the chip
  headingClass: string          // color class for the heading word
  descVerb:     string          // used to build description sentences
  // colored card background (for SummaryHeroCard-style full-bleed cards)
  bgStyle:      string
  borderClass:  string
  // for InvestorVerdictCard-style verdict strip
  verdictBg:    string
  verdictBorder:string
  verdictDot:   string
  verdictText:  string
  verdictBadge: string
  verdictDivider:string
  // upside value color
  upsideClass:  string
}

// Thresholds:
//   > +25%    → Attractive    (BUY)    green
//   > +5%     → Undervalued   (BUY)    green
//   >= -10%   → Fairly Valued (WATCH)  blue
//   >= -25%   → Overvalued    (AVOID)  red
//   < -25%    → Expensive     (AVOID)  red (deeper)
//   null/null → Insufficient Data       neutral

export function deriveVerdict(upsidePct: number | null, fv: number | null = 1): VerdictResult {
  if (upsidePct == null || fv == null) {
    return {
      key:           'insufficient',
      word:          'Uncertain',
      chip:          '—',
      chipClass:     'bg-[#F5F5F5] text-[#6B6B6B] border-[#E5E5E5]',
      headingClass:  'text-[#6B6B6B]',
      descVerb:      'insufficient data for a conviction',
      bgStyle:       '#FFFFFF',
      borderClass:   'border-[#E5E5E5]',
      verdictBg:     'bg-[#F5F5F5] border-[#E5E5E5]',
      verdictBorder: 'border-[#E5E5E5]',
      verdictDot:    'bg-[#9B9B9B]',
      verdictText:   'text-[#6B6B6B]',
      verdictBadge:  'bg-[#F5F5F5] border-[#E5E5E5] text-[#6B6B6B]',
      verdictDivider:'border-[#E5E5E5]',
      upsideClass:   'text-[#9B9B9B]',
    }
  }
  if (upsidePct > 0.25) {
    return {
      key:           'attractive',
      word:          'Attractive',
      chip:          'BUY',
      chipClass:     'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]',
      headingClass:  'text-[#11875D]',
      descVerb:      'meaningfully undervalued',
      bgStyle:       '#F0FDF4',
      borderClass:   'border-[#A3D9BE]',
      verdictBg:     'bg-[#E8F7EF] border-[#A3D9BE]',
      verdictBorder: 'border-[#A3D9BE]',
      verdictDot:    'bg-[#11875D]',
      verdictText:   'text-[#11875D]',
      verdictBadge:  'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]',
      verdictDivider:'border-[#A3D9BE]',
      upsideClass:   'text-[#11875D]',
    }
  }
  if (upsidePct > 0.05) {
    return {
      key:           'undervalued',
      word:          'Undervalued',
      chip:          'BUY',
      chipClass:     'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]',
      headingClass:  'text-[#11875D]',
      descVerb:      'modestly undervalued',
      bgStyle:       '#F0FDF4',
      borderClass:   'border-[#A3D9BE]',
      verdictBg:     'bg-[#E8F7EF] border-[#A3D9BE]',
      verdictBorder: 'border-[#A3D9BE]',
      verdictDot:    'bg-[#11875D]',
      verdictText:   'text-[#11875D]',
      verdictBadge:  'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]',
      verdictDivider:'border-[#A3D9BE]',
      upsideClass:   'text-[#11875D]',
    }
  }
  if (upsidePct >= -0.10) {
    return {
      key:           'fairly-valued',
      word:          'Fairly Valued',
      chip:          'WATCH',
      chipClass:     'bg-[#EAF1FF] text-[#2563EB] border-[#BFDBFE]',
      headingClass:  'text-[#2563EB]',
      descVerb:      'near fair value',
      bgStyle:       '#EFF6FF',
      borderClass:   'border-[#BFDBFE]',
      verdictBg:     'bg-[#EAF1FF] border-[#BFDBFE]',
      verdictBorder: 'border-[#BFDBFE]',
      verdictDot:    'bg-[#2563EB]',
      verdictText:   'text-[#2563EB]',
      verdictBadge:  'bg-[#EAF1FF] border-[#BFDBFE] text-[#2563EB]',
      verdictDivider:'border-[#BFDBFE]',
      upsideClass:   'text-[#2563EB]',
    }
  }
  if (upsidePct >= -0.25) {
    return {
      key:           'overvalued',
      word:          'Overvalued',
      chip:          'AVOID',
      chipClass:     'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]',
      headingClass:  'text-[#D83B3B]',
      descVerb:      'overvalued',
      bgStyle:       '#FEF2F2',
      borderClass:   'border-[#F0B8B8]',
      verdictBg:     'bg-[#FCEAEA] border-[#F0B8B8]',
      verdictBorder: 'border-[#F0B8B8]',
      verdictDot:    'bg-[#D83B3B]',
      verdictText:   'text-[#D83B3B]',
      verdictBadge:  'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]',
      verdictDivider:'border-[#F0B8B8]',
      upsideClass:   'text-[#D83B3B]',
    }
  }
  return {
    key:           'expensive',
    word:          'Expensive',
    chip:          'AVOID',
    chipClass:     'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]',
    headingClass:  'text-[#D83B3B]',
    descVerb:      'significantly overvalued',
    bgStyle:       '#FEF2F2',
    borderClass:   'border-[#F0B8B8]',
    verdictBg:     'bg-[#FCEAEA] border-[#F0B8B8]',
    verdictBorder: 'border-[#F0B8B8]',
    verdictDot:    'bg-[#D83B3B]',
    verdictText:   'text-[#D83B3B]',
    verdictBadge:  'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]',
    verdictDivider:'border-[#F0B8B8]',
    upsideClass:   'text-[#D83B3B]',
  }
}

export function buildVerdictDescription(upsidePct: number | null, descVerb: string): string {
  if (upsidePct == null) return 'Not enough model data to form a conviction on this stock.'
  const absPct = Math.abs(upsidePct * 100).toFixed(0)
  if (upsidePct > 0.10)  return `The stock is ${descVerb} with ${absPct}% upside to our fair value estimate.`
  if (upsidePct > 0.05)  return `The stock is ${descVerb}. Our models suggest ${absPct}% potential upside.`
  if (upsidePct >= -0.10) return 'The stock appears fairly priced — limited upside or downside from current levels.'
  return `At current price, the stock trades ${absPct}% above our intrinsic value estimate.`
}

// Short sentence for card sub-text (StockSummaryCard)
export function buildVerdictSentence(upsidePct: number | null): string {
  if (upsidePct == null) return ''
  const absPct = Math.abs(upsidePct * 100).toFixed(0)
  if (upsidePct > 0.25)  return `The stock appears meaningfully undervalued — ${absPct}% upside to our estimate.`
  if (upsidePct > 0.05)  return `Modest discount to intrinsic value — ${absPct}% potential upside.`
  if (upsidePct >= -0.10) return 'Price is close to our intrinsic estimate — limited discount or premium.'
  if (upsidePct >= -0.25) return `The stock trades ${absPct}% above our intrinsic estimate — elevated risk.`
  return `Priced ${absPct}% above intrinsic value — very limited margin of safety.`
}
