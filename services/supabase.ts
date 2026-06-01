import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Solo crear el cliente de Supabase si hay credenciales
// ⚠️ Es CRÍTICO pasar AsyncStorage como storage adapter en React Native.
// Sin esto, el token JWT solo existe en memoria y se pierde al cerrar la app,
// forzando al usuario a iniciar sesión cada vez que abre la app.
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
