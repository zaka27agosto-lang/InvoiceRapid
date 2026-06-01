import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

/**
 * Pantalla inicial — redirige según el estado de autenticación.
 *
 * El Redirect se ejecuta en el primer render (antes de effects),
 * manejando el salto inicial desde / hacia el destino correcto.
 * Para cambios de auth durante la sesión (signIn, signOut),
 * RootNavigator en app/_layout.tsx usa useSegments + useEffect.
 *
 * Ambos mecanismos coexisten sin conflicto:
 *   - Redirect for the initial / → destination jump
 *   - useEffect for in-session auth state transitions
 */
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? "/(tabs)" : "/auth/login"} />;
}
