// One-off: post NU Nubank analysis tweet
const BUFFER_API_KEY    = process.env.BUFFER_API_KEY
const BUFFER_CHANNEL_ID = process.env.BUFFER_CHANNEL_ID

const text = `$NU just reported $16.3B in revenue and $2.9B in net profit.

For context: that's a 17.6% net margin at fintech scale. Monzo, three times smaller, just hit profitability for the first time. Revolut is at £1.3B net.

What makes the Nubank numbers striking:
▲ Operating expenses are only 13.7% of revenue — most banks are 40%+
▲ 58% of revenue comes from credit — high margin, high growth
▲ $4.4B profit before tax on $16.3B revenue — the model is working

The risk: 58% credit concentration in Brazil. If rates move or defaults tick up, those margins compress fast.

Run the DCF model — insic.app/stock/NU

$NU #Nubank #Fintech #Investing`

if (process.env.DRY_RUN === 'true') { console.log(text); process.exit(0) }

const res = await fetch('https://api.buffer.com', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${BUFFER_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `mutation { createPost(input: { channelId: "${BUFFER_CHANNEL_ID}" text: ${JSON.stringify(text)} schedulingType: automatic mode: shareNow }) { ... on PostActionSuccess { post { id status } } ... on InvalidInputError { message } ... on UnauthorizedError { message } } }`,
  }),
})
const json = await res.json()
const result = json?.data?.createPost
if (result?.post?.status === 'sent' || result?.post?.status === 'buffer') {
  console.log('Posted — Buffer ID:', result.post.id)
} else {
  console.error('Failed:', result?.message ?? JSON.stringify(json))
  process.exit(1)
}
