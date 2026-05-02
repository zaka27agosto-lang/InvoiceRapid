
// Google Sign-In no está disponible en Expo Go sin configuración nativa
// Esta función siempre retorna null por ahora

export function getGoogleSignin() {
  return { GoogleSignin: null, statusCodes: null };
}

export function isGoogleSigninAvailable() {
  return false;
}
