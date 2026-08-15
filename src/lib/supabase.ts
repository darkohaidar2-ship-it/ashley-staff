import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ylttlgklfdyhmqwblaex.supabase.co';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_4isRbaASi-6q45nw5_LxbQ_5dRrAwWt';

export const supabase = createClient(supabaseUrl, supabaseKey);
