import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  error: string | null;
}

export function usePremium() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PremiumStatus>({
    isPremium: false,
    isLoading: true,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    error: null,
  });

  useEffect(() => {
    if (user) {
      checkPremiumStatus();
    } else {
      setStatus({
        isPremium: false,
        isLoading: false,
        subscriptionStatus: null,
        currentPeriodEnd: null,
        error: null,
      });
    }
  }, [user]);

  async function checkPremiumStatus(): Promise<void> {
    try {
      if (!supabase) {
        setStatus({
          isPremium: false,
          isLoading: false,
          subscriptionStatus: null,
          currentPeriodEnd: null,
          error: 'Supabase no está configurado',
        });
        return;
      }
      setStatus(prev => ({ ...prev, isLoading: true }));

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        // No subscription found
        setStatus({
          isPremium: false,
          isLoading: false,
          subscriptionStatus: null,
          currentPeriodEnd: null,
          error: null,
        });
        return;
      }

      const isActive = data.status === 'active' || data.status === 'trialing';
      const isExpired = data.current_period_end 
        ? new Date(data.current_period_end) < new Date()
        : false;

      setStatus({
        isPremium: isActive && !isExpired,
        isLoading: false,
        subscriptionStatus: data.status,
        currentPeriodEnd: data.current_period_end,
        error: null,
      });
    } catch (error: any) {
      setStatus({
        isPremium: false,
        isLoading: false,
        subscriptionStatus: null,
        currentPeriodEnd: null,
        error: error.message,
      });
    }
  }

  async function createCheckoutSession(priceId: string): Promise<{ url?: string; error?: string }> {
    if (!user) {
      return { error: 'Usuario no autenticado' };
    }
    if (!supabase) {
      return { error: 'Supabase no está configurado' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('checkout', {
        body: {
          priceId,
          userId: user.id,
          email: user.email,
        },
      });

      if (error) throw error;

      return { url: data.url };
    } catch (error: any) {
      return { error: error.message || 'Error al crear sesión de pago' };
    }
  }

  async function cancelSubscription(): Promise<{ success: boolean; error?: string }> {
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' };
    }
    if (!supabase) {
      return { success: false, error: 'Supabase no está configurado' };
    }

    try {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', user.id)
        .single();

      if (!subscription?.stripe_subscription_id) {
        return { success: false, error: 'No hay suscripción activa' };
      }

      // Call Supabase function to cancel subscription
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: {
          subscriptionId: subscription.stripe_subscription_id,
        },
      });

      if (error) throw error;

      await checkPremiumStatus();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al cancelar suscripción' };
    }
  }

  async function restorePurchase(): Promise<{ success: boolean; error?: string }> {
    try {
      await checkPremiumStatus();
      return { success: status.isPremium };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  return {
    ...status,
    checkPremiumStatus,
    createCheckoutSession,
    cancelSubscription,
    restorePurchase,
  };
}
