const QUOTES = [
  {
    text: "intrinsico gives me the clarity I need to invest with discipline. The Reverse DCF is a game changer for understanding risk.",
    name: 'Michael T.',
    role: 'Self-Directed Investor',
    initial: 'M',
    color: '#2563EB',
  },
  {
    text: "I love how fast it is. I can go from idea to verdict in under a minute and focus my time on the best opportunities.",
    name: 'Sarah L.',
    role: 'Portfolio Manager',
    initial: 'S',
    color: '#7C3AED',
  },
  {
    text: "Finally, a tool that shows what the market is assuming. It's become essential to my investment process.",
    name: 'David K.',
    role: 'Independent Analyst',
    initial: 'D',
    color: '#059669',
  },
]

export default function TestimonialsSection() {
  return (
    <section style={{ background: 'white', borderBottom: '1px solid #E2E8F0' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        {/* Heading */}
        <div className="text-center mb-12">
          <p
            className="font-bold uppercase mb-3"
            style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#2563EB' }}
          >
            Trusted by investors like you
          </p>
          <h2
            style={{
              fontSize: 'clamp(30px, 3vw, 42px)',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: '#0F172A',
            }}
          >
            Built for people who do their own research.
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {QUOTES.map((q, i) => (
            <div
              key={i}
              className="rounded-[20px] bg-white border p-7 flex flex-col"
              style={{
                borderColor: '#E6ECF5',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)',
              }}
            >
              {/* Quote mark */}
              <svg width="24" height="18" viewBox="0 0 24 18" fill="none" className="mb-5 shrink-0" aria-hidden="true">
                <path
                  d="M0 18V10.5C0 4.7 3.8 1.2 11.3 0l1 2C8.2 3 6.3 5 6 8h4.5V18H0zm13.5 0V10.5C13.5 4.7 17.3 1.2 24.8 0l1 2c-4.1 1-6 3-6.3 6H24V18H13.5z"
                  fill="#BFDBFE"
                />
              </svg>

              <p
                style={{
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: '#475569',
                  flexGrow: 1,
                  marginBottom: '24px',
                }}
              >
                &ldquo;{q.text}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
                  style={{
                    width: '38px',
                    height: '38px',
                    background: q.color,
                    fontSize: '14px',
                  }}
                  aria-label={q.name}
                >
                  {q.initial}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 650, color: '#0F172A' }}>{q.name}</p>
                  <p style={{ fontSize: '12px', color: '#94A3B8' }}>{q.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-[12px] text-slate-400">
          Representative testimonials. Individual results vary.
        </p>
      </div>
    </section>
  )
}
