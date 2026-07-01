import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

// 🔐 NOTA DE SEGURIDAD sobre las credenciales hardcodeadas:
// La SUPABASE_ANON_KEY es una clave pública: por diseño de Supabase, está
// pensada para ser embebida en el cliente. La protección real de los
// datos viene de las políticas RLS del backend (ver supabase/rls-policies.sql),
// NO de mantener la anon key en secreto. La razón de tenerla como fallback
// es únicamente operativa: si las variables de entorno EXPO_PUBLIC_*
// no se inyectan en el build de producción (EAS), el cliente Supabase
// sería null y todo el flujo de auth caería silenciosamente en producción.
// En cuanto se configuren EXPO_PUBLIC_SUPABASE_URL y
// EXPO_PUBLIC_SUPABASE_ANON_KEY como EAS secrets, basta con ponerlas y
// el || caerá a esos valores automáticamente (no hace falta editar este
// archivo). Las credenciales fallback actuales son del proyecto
// rvolqqtlmdyggrhfzwip y son seguras siempre que las RLS estén activas.
const SUPABASE_FALLBACK_URL = 'https://rvolqqtlmdyggrhfzwip.supabase.co';
const SUPABASE_FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2xxcXRsbWR5Z2dyaGZ6d2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTQzNDksImV4cCI6MjA5NTY3MDM0OX0.PX3kg2CAeG3YNqpgqUcR7t8hhMBPxrJ3C0hDDyKsyvs';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_FALLBACK_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_FALLBACK_ANON_KEY;

// 🔐 Usa expo-secure-store (Keychain/Keystore) para proteger los tokens JWT
// en lugar de AsyncStorage. AsyncStorage es texto plano — en dispositivos
// rooteados, otras apps pueden leer el token y suplantar al usuario.
// SecureStore usa cifrado hardware (Keychain en iOS, Keystore en Android).
// Fallback a AsyncStorage si SecureStore no está disponible.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
