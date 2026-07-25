/**
 * Supabase client — single shared instance.
 * The anon key is a publishable client-side key; all authorization is
 * enforced server-side via Row Level Security policies.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://crcghkwschlppnopycvx.supabase.co'
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyY2doa3dzY2hscHBub3B5Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTgyNDksImV4cCI6MjEwMDIzNDI0OX0.yAkeEj78FO6pv6jVEIFrQuC1OJPFuoJDO-nGWuVPFWE'

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}
