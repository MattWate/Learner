const SUPABASE_URL = 'https://yvoemqckgtmedfjudkzo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2b2VtcWNrZ3RtZWRmanVka3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Mjk3ODYsImV4cCI6MjA3NjQwNTc4Nn0.tbbJT2QWg_Cpl0_FbfVxyZl1Fsord1LQKJztyGQloJo';
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app