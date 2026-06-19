import { Redirect, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

/**
 * Pantalla inicial — redirige según el estado de autenticación.
 *
 * Si la app se abre desde un deep link de recuperación de contraseña
 * o verificación de email (token_hash en la URL), redirigimos a
 * /auth/callback para que procese el token. Sin esto, el Redirect
 * inmediato a /auth/login pisa el deep link antes de que expo-router
 * pueda navegar a callback.tsx.
 */
export default function Index() {
  const { user } = useAuth();
  const globalParams = useGlobalSearchParams<{ token_hash?: string; type?: string }>();

  // Deep link de recuperación/verificación → dejar que callback.tsx procese el token
  if (globalParams.token_hash) {
    return (
      <Redirect
        href={{
          pathname: '/auth/callback',
          params: {
            token_hash: globalParams.token_hash,
            type: globalParams.type || 'recovery',
          },
        }}
      />
    );
  }

  return <Redirect href={user ? '/(tabs)' : '/auth/login'} />;
}
