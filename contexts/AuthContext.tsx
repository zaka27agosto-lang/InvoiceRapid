import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { getGoogleSignin } from '../utils/googleSignIn';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string; success?: boolean }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error?: string; success?: boolean }>;
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
        console.log('Supabase no está configurado');
        setIsLoading(false);
        return;
      }

      // Configure Google Sign In (solo en plataformas nativas)
      const { GoogleSignin: GS } = getGoogleSignin();
      if (GS) {
        (GS as any).configure({
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
          offlineAccess: true,
        });
      }

      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event: any, session: Session | null) => {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      );

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('Auth initialization error:', error);
      setIsLoading(false);
    }
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
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
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { error: error.message || 'Error al registrar' };
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }
    // Google Sign-In no está disponible en web
    const { GoogleSignin: GS, statusCodes: SC } = getGoogleSignin();
    if (Platform.OS === 'web' || !GS) {
      return { error: 'Google Sign-In no está disponible en este entorno' };
    }

    try {
      await GS.hasPlayServices();
      const userInfo = await GS.signIn();
      
      if ((userInfo as any).idToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: (userInfo as any).idToken,
        });

        if (error) throw error;
        return { success: true };
      }
      
      return { error: 'No se pudo obtener el token de Google' };
    } catch (error: any) {
      if (SC && error.code === SC.SIGN_IN_CANCELLED) {
        return { error: 'Inicio de sesión cancelado' };
      } else if (SC && error.code === SC.IN_PROGRESS) {
        return { error: 'Inicio de sesión en progreso' };
      } else if (SC && error.code === SC.PLAY_SERVICES_NOT_AVAILABLE) {
        return { error: 'Google Play Services no disponible' };
      }
      return { error: error.message || 'Error al iniciar sesión con Google' };
    } finally {
      if (GS) {
        GS.signOut();
      }
    }
  }

  async function signOut() {
    if (!supabase) {
      return;
    }
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('user_session');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  async function resetPassword(email: string) {
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'invoicerapid://auth/reset-password',
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
