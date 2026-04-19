import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const REVENUECAT_API_KEY = 'test_VplVYrwjABypzKZDDfuMFBMvvIQ';
const ENTITLEMENT_ID = 'entl0d048aa68b';

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
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<any>(null);

  useEffect(() => {
    initPurchases();
  }, []);

  async function initPurchases() {
    try {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      await checkPremiumStatus();
      const off = await Purchases.getOfferings();
      if (off.current) setOfferings(off.current);
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
    // En modo desarrollo, activar premium directamente igual que activarPremiumTest
    await AsyncStorage.setItem('is_premium', 'true');
    setIsPremium(true);
    return { success: true };
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
  }

  async function desactivarPremiumTest() {
    setIsPremium(false);
    await AsyncStorage.setItem('is_premium', 'false');
  }

  async function aumentarLimiteFacturas() {
    // Aumentar el límite de facturas en 1 para pruebas
    try {
      const currentLimit = await AsyncStorage.getItem('limite_facturas');
      const newLimit = currentLimit ? parseInt(currentLimit) + 1 : 16;
      await AsyncStorage.setItem('limite_facturas', newLimit.toString());
    } catch (e) {
      console.log('Error aumentando límite:', e);
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
