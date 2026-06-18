import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
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
  resetPassword: (email: string) => Promise<{ error?: string; success?: boolean }>;
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

    try {
      const userId = user?.id;

      // 🔥 Forzar estado a null INMEDIATAMENTE para que el layout
      // navegue a /auth/login ANTES de cualquier limpieza de BD.
      // Así evitamos que las pantallas actuales se rompan al perder
      // los datos de la BD mientras están montadas.
      setUser(null);
      setSession(null);

      // Ejecutar limpieza en segundo plano DESPUÉS de que React
      // haya procesado el cambio de estado y la navegación.
      InteractionManager.runAfterInteractions(async () => {
        try {
          // Si ya hay sesión activa (otro usuario inició sesión), abortar limpieza
          const { data } = await supabase!.auth.getSession();
          if (data.session) {
            return;
          }
          // 🔄 Sincronizar datos locales a la nube antes de cerrar sesión
          if (userId) {
            try {
              const { syncService } = await import('../services/syncService');
              await syncService.syncAll(userId);
            } catch {
            }
          }

          // Cerrar sesión en Supabase y limpiar estado local
          // Limpiamos AsyncStorage (cola de sync, premium, last_user_id)
          // para evitar que el siguiente usuario herede datos del anterior.
          // La BD local NO se limpia aquí — se limpia en SyncContext
          // cuando detecta que el nuevo usuario es diferente.
          await Promise.all([
            supabase!.auth.signOut().catch(() => {}),
            AsyncStorage.multiRemove([
              'is_premium',
              'sync_queue',
              'last_user_id',
              'monthly_invoice_counter',
            ]).catch(() => {}),
          ]);

        } catch {
        }
      });
    } catch {
      setUser(null);
      setSession(null);
    }
  }

  async function resetPassword(email: string) {
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'invoicerapid://auth/callback',
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { error: error.message || 'Error al enviar email de recuperación' };
    }
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
        resetPassword,
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
