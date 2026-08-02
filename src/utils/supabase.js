import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rpkputnpkevmypioyixh.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwa3B1dG5wa2V2bXlwaW95aXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODgyNzQsImV4cCI6MjEwMTA2NDI3NH0.FIq5Hpf4tIZCaODtUJRSSo4JiWJClO73xF78rNnx8PM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
