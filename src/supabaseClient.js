import { createClient } from '@supabase/supabase-js'

// Read the keys from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Check Vercel env variables.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)