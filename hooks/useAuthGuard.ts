import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export function useAuthGuard() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAuth = async (action: () => void | Promise<void>) => {
    if (!user) {
      setPendingAction(() => action);
      setShowAuthModal(true);
      return;
    }
    await action();
  };

  const handleLogin = () => {
    setShowAuthModal(false);
    router.push('/auth/login');
  };

  const handleRegister = () => {
    setShowAuthModal(false);
    router.push('/auth/register');
  };

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();
    if (result.success) {
      setShowAuthModal(false);
      // Ejecutar acción pendiente si la hay
      if (pendingAction) {
        handleCloseModal();
        await pendingAction();
      }
    } else {
      // Mostrar el error al usuario
      Alert.alert('Error', result.error || 'Error al iniciar sesión con Google');
    }
  };

  const handleCloseModal = () => {
    setShowAuthModal(false);
    setPendingAction(null);
  };

  const executePendingAction = async () => {
    if (pendingAction && user) {
      handleCloseModal();
      await pendingAction();
    }
  };

  return {
    user,
    requireAuth,
    showAuthModal,
    handleCloseModal,
    handleLogin,
    handleRegister,
    handleGoogleSignIn,
    executePendingAction,
  };
}
