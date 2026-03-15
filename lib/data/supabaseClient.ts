import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url === '' || key === '') return null
  if (!_client) _client = createClient(url, key)
  return _client
}

export interface ValuationSnapshot {
  id?: string
  ticker: string
  company: string
  saved_at?: string
  price_at_save: number
  fair_value: number
  wacc: number
  beta: number
  terminal_g: number
  cagr: number
  upside_pct: number
  inputs: Record<string, number>
  scenarios: { bull: number; base: number; bear: number }
}

export async function saveValuation(snapshot: ValuationSnapshot): Promise<ValuationSnapshot> {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
  const { data, error } = await client.from('valuations').insert([snapshot]).select().single()
  if (error) throw error
  return data
}

export async function getValuations(ticker: string): Promise<ValuationSnapshot[]> {
  const client = getClient()
  if (!client) return []
  const { data, error } = await client
    .from('valuations')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .order('saved_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}
