import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// --- ADD THESE LOGS ---
console.log("VITE_SUPABASE_URL:", supabaseUrl);
console.log("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? 'Loaded' : 'MISSING!');
// --- END LOGS ---

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key missing! Check Vercel Env Vars!")
  // Maybe even throw an error to make sure the build fails clearly
  // throw new Error("Missing Supabase config!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)