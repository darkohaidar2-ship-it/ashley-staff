import { createClient } from '@supabase/supabase-js';

// Hardcoded to ensure Vercel's old environment variables don't override the new project URL
export const supabaseUrl = 'https://ylttlgklfdyhmqwblaex.supabase.co';
export const supabaseKey = 'sb_publishable_4isRbaASi-6q45nw5_LxbQ_5dRrAwWt';

export const supabase = createClient(supabaseUrl, supabaseKey);
