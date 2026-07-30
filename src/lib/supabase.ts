import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oytuwzrbqevzpbjbbeem.supabase.co';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_anon_public_key';

export const supabase = createClient(supabaseUrl, supabaseKey);
