import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Solo crear el cliente de Supabase si hay credenciales
// 🔐 Usa expo-secure-store (Keychain/Keystore) para proteger los tokens JWT
// en lugar de AsyncStorage. AsyncStorage es texto plano — en dispositivos
// rooteados, otras apps pueden leer el token y suplantar al usuario.
// SecureStore usa cifrado hardware (Keychain en iOS, Keystore en Android).
// Fallback a AsyncStorage si SecureStore no está disponible.
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
