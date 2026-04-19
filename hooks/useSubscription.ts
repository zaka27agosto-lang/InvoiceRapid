import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const REVENUECAT_API_KEY = 'test_VplVYrwjABypzKZDDfuMFBMvvIQ';
const ENTITLEMENT_ID = 'entl0d048aa68b';

export function useSubscription() {
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
      // En desarrollo sin Apple account, usar mock
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
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
      const premium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      console.log('✅ Compra exitosa, premium:', premium);
      setIsPremium(premium);
      await AsyncStorage.setItem('is_premium', premium ? 'true' : 'false');
      return { success: true };
    } catch (e: any) {
      console.log('❌ Error en compra:', e);
      if (!e.userCancelled) {
        return { success: false, error: e.message };
      }
      return { success: false, cancelled: true };
    }
  }

  async function restaurar() {
    try {
      const info = await Purchases.restorePurchases();
      const premium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      console.log('✅ Estado premium después de restaurar:', premium);
      setIsPremium(premium);
      await AsyncStorage.setItem('is_premium', premium ? 'true' : 'false');
      return { success: true, isPremium: premium };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Solo para desarrollo sin Apple account
  async function activarPremiumTest() {
    console.log('');
    setIsPremium(true);
    await AsyncStorage.setItem('is_premium', 'true');
  }

  async function desactivarPremiumTest() {
    console.log('');
    setIsPremium(false);
    await AsyncStorage.setItem('is_premium', 'false');
  }

  return { isPremium, isLoading, offerings, comprar, restaurar, activarPremiumTest, desactivarPremiumTest, checkPremiumStatus };
}