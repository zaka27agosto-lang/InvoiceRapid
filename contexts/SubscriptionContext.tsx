import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { notifyPremiumChange } from '../utils/premiumEvents';
import { resetMonthlyCounter } from '../utils/subscription';

const REVENUECAT_API_KEY = 'goog_LDnwkOlgqirTVPkaDRbvvGQWEHz';
const ENTITLEMENT_ID = 'RapidInvoice Pro';

interface SubscriptionContextType {
  isPremium: boolean;
  isLoading: boolean;
  offerings: any;
  comprar: (packageToBuy: any) => Promise<{ success: boolean; error?: string; cancelled?: boolean }>;
  restaurar: () => Promise<{ success: boolean; isPremium?: boolean; error?: string }>;
  activarPremiumTest: () => Promise<void>;
  desactivarPremiumTest: () => Promise<void>;
  checkPremiumStatus: () => Promise<void>;
  aumentarLimiteFacturas: () => Promise<void>;
  onPremiumExpired: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<any>(null);
  const [wasPremium, setWasPremium] = useState(false);

  useEffect(() => {
    initPurchases();
  }, []);

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
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      await checkPremiumStatus();
      const off = await Purchases.getOfferings();
      if (off.all && off.all['default']) setOfferings(off.all['default']);
    } catch (e) {
      console.log('RevenueCat error:', e);
      const cached = await AsyncStorage.getItem('is_premium');
      setIsPremium(cached === 'true');
    } finally {
      setIsLoading(false);
    }
  }

  async function checkPremiumStatus() {
    try {
      const info = await Purchases.getCustomerInfo();
      const premium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(premium);
      await AsyncStorage.setItem('is_premium', premium ? 'true' : 'false');
    } catch (e) {
      const cached = await AsyncStorage.getItem('is_premium');
      setIsPremium(cached === 'true');
    }
  }

  async function comprar(packageToBuy: any) {
    try {
      console.log('🎯 Comprando paquete:', packageToBuy);
      console.log('📦 Paquete identifier:', packageToBuy?.identifier);
      console.log('📦 Paquete product:', packageToBuy?.product);
      
      if (!packageToBuy || !packageToBuy.identifier) {
        console.error('❌ Paquete inválido o sin identifier');
        return { success: false, error: 'Paquete inválido' };
      }
      
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
      const premium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(premium);
      await AsyncStorage.setItem('is_premium', premium ? 'true' : 'false');
      return { success: true };
    } catch (e: any) {
      console.error('❌ Error en compra:', e);
      console.error('❌ Error details:', {
        message: e.message,
        code: e.code,
        userCancelled: e.userCancelled,
        underlyingError: e.underlyingError
      });
      
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

  async function restaurar() {
    try {
      const info = await Purchases.restorePurchases();
      const premium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(premium);
      await AsyncStorage.setItem('is_premium', premium ? 'true' : 'false');
      return { success: true, isPremium: premium };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async function activarPremiumTest() {
    setIsPremium(true);
    await AsyncStorage.setItem('is_premium', 'true');
    notifyPremiumChange(true);
  }

  async function desactivarPremiumTest() {
    setIsPremium(false);
    await AsyncStorage.setItem('is_premium', 'false');
    notifyPremiumChange(false);
  }

  async function aumentarLimiteFacturas() {
    // Resetear el contador mensual para pruebas
    await resetMonthlyCounter();
  }

  async function onPremiumExpired() {
    // Resetear el color a azul cuando expire premium
    try {
      await AsyncStorage.setItem('primaryColor', 'blue');
    } catch (e) {
      console.log('Error reseteando color:', e);
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
        activarPremiumTest,
        desactivarPremiumTest,
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
