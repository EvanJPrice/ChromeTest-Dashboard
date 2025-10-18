import { createClient } from '@supabase/supabase-js'

// Paste your public URL and anon key here
const supabaseUrl = 'https://puhutwfwaxohanpbsmtd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aHV0d2Z3YXhvaGFucGJzbXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MjU4OTAsImV4cCI6MjA3NjIwMTg5MH0.K--sv4BJ52W4wui2lDkBlTcIw6RZN7xFvod4DPz42B8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)