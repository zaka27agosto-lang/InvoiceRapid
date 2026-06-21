import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { notifyPremiumChange } from '../utils/premiumEvents';
import { setPlantillaPDF } from '../utils/settings';
import { useAuth } from './AuthContext';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

if (!REVENUECAT_API_KEY && __DEV__) {
  console.warn('[RevenueCat] EXPO_PUBLIC_REVENUECAT_API_KEY no configurada. Las compras in-app no funcionarán.');
}
const ENTITLEMENT_ID = 'RapidInvoice Pro';

interface SubscriptionContextType {
  isPremium: boolean;
  isLoading: boolean;
  offerings: any;
  comprar: (packageToBuy: any) => Promise<{ success: boolean; error?: string; cancelled?: boolean }>;
  restaurar: () => Promise<{ success: boolean; isPremium?: boolean; error?: string; cancelled?: boolean }>;
  checkPremiumStatus: () => Promise<void>;
  aumentarLimiteFacturas: () => Promise<void>;
  onPremiumExpired: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<any>(null);
  const [wasPremium, setWasPremium] = useState(false);
  const rcUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    initPurchases();
  }, []);

  // 🔄 Re-identificar con RevenueCat cuando cambia el usuario de Supabase.
  //    Esto evita que la cuenta 2 herede la suscripción Pro de la cuenta 1
  //    en el mismo dispositivo. Purchases.logIn asocia el ID de Supabase
  //    con la identidad de RevenueCat, aislando los entitlements por usuario.
  useEffect(() => {
    if (!user?.id || isLoading) return;
    if (rcUserIdRef.current === user.id) return; // Ya identificado

    const identifyRevenueCat = async () => {
      try {
        const { created } = await Purchases.logIn(user.id);
        rcUserIdRef.current = user.id;
        // Si es un usuario nuevo en RevenueCat (created=true) o existente,
        // recargar entitlements para este usuario específico
        await checkPremiumStatus();
      } catch (e: any) {
        // Error 24 = ya logueado con este usuario (ej. reconexión)
        if (e.code === 24 || e.message?.toLowerCase().includes('already')) {
          rcUserIdRef.current = user.id;
          await checkPremiumStatus();
        } else {
          // Fallback: Purchases.logIn falló por una razón desconocida.
          // NO hacer logOut() ni checkPremiumStatus() — eso devolvería
          // los entitlements del dispositivo (cuenta anterior), causando
          // fuga de suscripción entre cuentas. Forzar no-premium.
          rcUserIdRef.current = null;
          setIsPremium(false);
        }
      }
    };

    identifyRevenueCat();
  }, [user?.id, isLoading]);

  useEffect(() => {
    // Solo resetear color si premium cambia de true a false durante el uso
    // No resetear al cargar inicialmente
    if (wasPremium && !isPremium && !isLoading) {
      onPremiumExpired();
    }
    // Actualizar wasPremium después de verificar
    if (!isLoading) {
      setWasPremium(isPremium);
    }
  }, [isPremium, isLoading]);

  async function initPurchases() {
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });

      // 🔐 Identificar con RevenueCat usando el ID de Supabase.
      //    Si el usuario aún no está disponible (AuthContext sigue cargando),
      //    NO llamamos a checkPremiumStatus() todavía — el segundo useEffect
      //    se encargará cuando user.id esté listo. Llamar checkPremiumStatus
      //    sin identificar al usuario devuelve los entitlements del dispositivo
      //    (cuenta anterior), causando fuga de suscripción entre cuentas.
      if (user?.id) {
        try {
          await Purchases.logIn(user.id);
          rcUserIdRef.current = user.id;
        } catch (e: any) {
          // Error 24 = ya logueado (reconexión) — ignorar
          if (e.code !== 24 && !e.message?.toLowerCase().includes('already')) {
            // NO hacer logOut() ni checkPremiumStatus() — forzar no-premium
            // para evitar fuga de entitlements del dispositivo
            setIsPremium(false);
            return; // Salir sin llamar a checkPremiumStatus()
          } else {
            rcUserIdRef.current = user.id;
          }
        }
        await checkPremiumStatus();
      } else {
        // Usuario aún no cargado — el segundo useEffect identificará
        // y verificará premium cuando AuthContext termine de cargar
        setIsPremium(false);
      }

      const off = await Purchases.getOfferings();
      if (off.all && off.all['default']) setOfferings(off.all['default']);
    } catch {
      // No confiar en AsyncStorage — si RevenueCat falla, asumir no premium
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Defensa contra cross-account premium transfer (Bug A).
   *
   * RevenueCat `logIn(newUserId)` TRANSFIERE automaticamente las suscripciones
   * del App User ID anterior al nuevo, por diseño del SDK — no existe flag
   * para desactivarlo. Esto significa que si la Cuenta A compra Pro y luego
   * se hace `logIn(supabaseUserId-B)`, el entitlement de A acaba asociado a B.
   *
   * Este helper valida CADA resultado de RevenueCat contra el
   * `purchaser_email` guardado localmente.
   *
   * Comportamiento por escenario:
   *  - checkPremiumStatus / restaurar → modo estricto: bloqueamos premium
   *    si RevenueCat dice premium pero el email guardado NO coincide con
   *    el usuario actual.
   *  - comprar (nueva suscripcion) → modo permisivo ({allowNewPurchaser:
   *    true}): tras un cargo LEGÍTIMO en Google Play, sobrescribimos
   *    purchaser_email con el email del comprador actual. Sin esto, un
   *    comprador nuevo en un dispositivo compartido pagaba la suscripcion
   *    pero quedaba bloqueado por la validacion contra el email antiguo.
   */
  async function validateAndApplyPremium(
    customerInfo: any,
    opts?: { allowNewPurchaser?: boolean }
  ): Promise<boolean> {
    const hasEntitlement =
      customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;

    if (!hasEntitlement) {
      if (isPremium) setIsPremium(false);
      await AsyncStorage.setItem('is_premium', 'false').catch(() => {});
      return false;
    }

    // RevenueCat devolvio premium. Validar contra el comprador local.
    const purchaserEmail = await AsyncStorage.getItem('purchaser_email').catch(() => null);

    if (
      !opts?.allowNewPurchaser &&
      purchaserEmail &&
      user?.email &&
      purchaserEmail !== user.email
    ) {
      // El device tiene un purchaser con OTRO email -> bloqueamos premium
      // aunque RevenueCat haya acabado de transferir el entitlement.
      if (__DEV__) {
        console.warn(
          '[Subscription] Cross-account premium transfer bloqueado:',
          'purchaser=' + purchaserEmail,
          'current=' + user.email
        );
      }
      if (isPremium) setIsPremium(false);
      await AsyncStorage.setItem('is_premium', 'false').catch(() => {});
      return false;
    }

    // Premium valido para este usuario. Permitimos overwrite solo en
    // compras nuevas (allowNewPurchaser); en check/restaurar, el email
    // anterior se mantiene.
    if (!isPremium) setIsPremium(true);
    await AsyncStorage.setItem('is_premium', 'true').catch(() => {});
    if (user?.email) {
      await AsyncStorage.setItem('purchaser_email', user.email).catch(() => {});
    }
    return true;
  }

  async function checkPremiumStatus() {
    try {
      const info = await Purchases.getCustomerInfo();
      await validateAndApplyPremium(info);
    } catch {
      // No confiar en AsyncStorage — si RevenueCat falla, asumir no premium
      setIsPremium(false);
    }
  }

  async function comprar(packageToBuy: any) {
    try {
      
      if (!packageToBuy || !packageToBuy.identifier) {
        return { success: false, error: 'Paquete inválido' };
      }
      
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
      // En una compra nueva, el comprador actual ES legitimo: sobrescribimos
      // purchaser_email con su email para que pueda restaurar Pro desde este
      // dispositivo en sesiones futuras. Sin allowNewPurchaser=true, la
      // validacion bloquearia al comprador nuevo si hubo otro purchaser_email
      // previo guardado (caso dispositivo compartido).
      const premium = await validateAndApplyPremium(customerInfo, { allowNewPurchaser: true });
      return { success: premium };
    } catch (e: any) {
      
      if (e.userCancelled) {
        return { success: false, cancelled: true };
      }
      
      let errorMessage = e.message || 'Error al procesar la compra';
      
      // Mensajes específicos para errores comunes
      if (e.message?.includes('No such product') || e.message?.includes('Product not found')) {
        errorMessage = 'No se ha podido encontrar el elemento que intentabas comprar';
      } else if (e.message?.includes('Purchase unavailable')) {
        errorMessage = 'Compra no disponible en este momento';
      } else if (e.message?.includes('Payment cancelled')) {
        errorMessage = 'Pago cancelado';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  function restaurar() {
    return new Promise<{ success: boolean; isPremium?: boolean; error?: string; cancelled?: boolean }>((resolve) => {
      // 🔐 Solo la cuenta que realizó la compra puede restaurar.
      //    Usamos AsyncStorage en vez de hardcodear el email. La primera
      //    compra guarda el email del comprador; si otro usuario intenta
      //    restaurar, se bloquea con un mensaje claro.
      AsyncStorage.getItem('purchaser_email').then((purchaserEmail) => {
        // Si ya hay un comprador registrado y NO es este usuario, bloquear
        if (purchaserEmail && user?.email !== purchaserEmail) {
          Alert.alert(
            t('restaurar_compras'),
            t('restaurar_sin_compras'),
            [{ text: t('cancelar'), style: 'cancel', onPress: () => resolve({ success: false, cancelled: true }) }]
          );
          return;
        }

        // Sin comprador previo, o el mismo usuario → permitir
        Alert.alert(
          t('restaurar_compras'),
          t('restaurar_advertencia'),
          [
            { text: t('cancelar'), style: 'cancel', onPress: () => resolve({ success: false, cancelled: true }) },
            {
              text: t('continuar'),
              onPress: async () => {
                try {
                  const info = await Purchases.restorePurchases();
                  const premium = await validateAndApplyPremium(info);
                  resolve({ success: premium, isPremium: premium });
                } catch (e: any) {
                  resolve({ success: false, error: e.message });
                }
              }
            }
          ]
        );
      });
    });
  }

  async function aumentarLimiteFacturas() {
    // Resetear el contador mensual para pruebas
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    await AsyncStorage.setItem('monthly_invoice_counter', JSON.stringify({ month, count: 0 }));
    
    // También resetear en Supabase vía RPC (silencioso si falla)
    try {
      const { supabase } = await import('../services/supabase');
      if (supabase) {
        await supabase.rpc('reset_invoice_counter', { p_month: month });
      }
    } catch {
      // Silencioso - el reset local ya es suficiente para pruebas
    }
  }

  async function onPremiumExpired() {
    // Resetear el color a azul cuando expire premium
    try {
      await AsyncStorage.setItem('primaryColor', 'blue');
      await setPlantillaPDF('default');
    } catch {
    }
  }

  return (
    <SubscriptionContext.Provider
      value={{
        isPremium,
        isLoading,
        offerings,
        comprar,
        restaurar,
        checkPremiumStatus,
        aumentarLimiteFacturas,
        onPremiumExpired,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
