import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string; success?: boolean }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error?: string; success?: boolean; userId?: string; hasSession?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string; success?: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (data: { name?: string; avatar_url?: string }) => Promise<{ error?: string; success?: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      // Si Supabase no está configurado, no hacer nada
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);

      // ⚠️ Forzar isLoading=false DESPUÉS de obtener la sesión.
      // El callback onAuthStateChange puede no dispararse inmediatamente,
      // y sin esto la app se queda en el spinner de carga para siempre.
      setIsLoading(false);

      // Listen for auth changes
      supabase.auth.onAuthStateChange(
        async (_event: any, session: Session | null) => {
          setSession(session);
          setUser(session?.user ?? null);
        }
      );
    } catch {
      setIsLoading(false);
    }
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { error: error.message || 'Error al iniciar sesión' };
    }
  }

  async function signUpWithEmail(email: string, password: string, name: string) {
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
          emailRedirectTo: 'invoicerapid://auth/callback',
        },
      });

      if (error) throw error;
      
      // Si hay sesión inmediata (email confirmation desactivado), actualizar estado
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      
      return { 
        success: true, 
        userId: data.user?.id, 
        hasSession: !!data.session 
      };
    } catch (error: any) {
      return { error: error.message || 'Error al registrar' };
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }

    try {
      const redirectUrl = Linking.createURL('auth/callback');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
      if (!data?.url) {
        return { error: 'No se pudo obtener la URL de autenticación' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
        // Procesar los tokens del redirect URL.
        // Supabase con skipBrowserRedirect usa PKCE (Proof Key for Code Exchange),
        // que protege contra session fixation sin necesidad de validar state manualmente.
        // El state es consumido internamente por el SDK de Supabase durante el intercambio PKCE.
        const fragment = result.url.split('#')[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            const { data: { session } } = await supabase.auth.getSession();
            if (session) return { success: true };
          }
        }
        return { error: 'No se pudo establecer la sesión' };
      }
      
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { error: 'Inicio de sesión cancelado' };
      }

      return { error: 'Error al iniciar sesión con Google' };
    } catch (error: any) {
      return { error: error.message || 'Error al iniciar sesión con Google' };
    }
  }

  async function signOut() {
    if (!supabase) return;

    // 🔒 1. Cerrar sesión en Supabase primero.
    try {
      await supabase.auth.signOut();
    } catch {
      // Continuar aunque falle — limpiamos estado local igualmente
    }

    // 🧹 2. Limpiar AsyncStorage (best-effort).
    try {
      await AsyncStorage.multiRemove([
        'is_premium',
        'sync_queue',
        'monthly_invoice_counter',
        'datos_empresa',
        'numeracion_config',
        'primaryColor',
        'moneda',
        'plantilla_pdf',
        'formato_fecha',
        'ultimo_iva',
        'ha_creado_primera_factura',
      ]).catch(() => {});
    } catch {}

    // 🔥 3. Forzar estado a null para que el layout reaccione
    setUser(null);
    setSession(null);
  }

  async function updateProfile(data: { name?: string; avatar_url?: string }) {
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }
    try {
      const { error } = await supabase.auth.updateUser({
        data,
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { error: error.message || 'Error al actualizar perfil' };
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
