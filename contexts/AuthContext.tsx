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

      // 🔄 1. Sincronizar datos locales a la nube ANTES de cerrar sesión.
      //    Solo si hay conexión — si no, los datos se quedan en la BD local
      //    y se sincronizarán en el próximo login de este mismo usuario.
      if (userId) {
        try {
          const NetInfo = await import('@react-native-community/netinfo');
          const { isConnected } = await NetInfo.fetch();
          if (isConnected) {
            const { syncService } = await import('../services/syncService');
            await syncService.syncAll(userId);
          }
        } catch {
          // Silencioso — los datos no se pierden
        }
      }

      // 🛑 2. Cerrar sesión en RevenueCat para evitar fuga de suscripción
      //    entre cuentas (Account 1 Pro → Account 2 hereda Pro)
      try {
        const { default: Purchases } = await import('react-native-purchases');
        await Purchases.logOut();
      } catch {
        // Purchases puede no estar inicializado si el usuario nunca
        // llegó a los tabs — no es un error crítico
      }

      // 🔒 3. Cerrar sesión en Supabase SINCRÓNICAMENTE.
      //    Esto es crítico: si se difiere, el SDK mantiene la sesión
      //    antigua y al procesar un deep link de recuperación de
      //    contraseña (verifyOtp) se producen conflictos de sesión
      //    que causan login en la cuenta equivocada o pantalla colgada.
      await supabase.auth.signOut();

      // 🔥 4. Forzar estado a null para que el layout navegue a /auth/login
      setUser(null);
      setSession(null);

      // 5. Limpiar AsyncStorage en segundo plano (no bloquea la UI)
      InteractionManager.runAfterInteractions(async () => {
        try {
          // Verificar que no haya una nueva sesión activa
          const { data } = await supabase!.auth.getSession();
          if (data.session) return;

          await AsyncStorage.multiRemove([
            'is_premium',
            'sync_queue',
            'last_user_id',
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
        } catch {
        }
      });
    } catch {
      // Si algo falla, al menos limpiamos el estado de React
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
