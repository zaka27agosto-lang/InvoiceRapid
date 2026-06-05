import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../services/supabase';

type ReferralEvent = {
  id: string;
  code_used: string;
  status: 'pending' | 'activated' | 'rejected';
  created_at: string;
  activated_at: string | null;
  referred_email?: string;
};

export default function Referral() {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [events, setEvents] = useState<ReferralEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    // Determinar userId: del usuario autenticado o del AsyncStorage (post-registro sin sesión)
    let userId: string | undefined = user?.id;
    if (!userId) {
      const stored = await AsyncStorage.getItem('pending_user_id');
      userId = stored || undefined;
    }
    if (!supabase || !userId) return;

    try {
      // Load user's referral code (con fallback RPC para usuarios existentes)
      const { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', userId)
        .maybeSingle();

      if (codeError) {
        if (__DEV__) console.log('[referral] Error loading code:', codeError.message);
      }

      if (codeData?.code) {
        setReferralCode(codeData.code);
        // Limpiar pending_user_id si existe (ya tenemos sesión)
        if (user) await AsyncStorage.removeItem('pending_user_id');
      } else {
        // Usuario sin código → generarlo vía RPC (necesita sesión)
        if (user) {
          if (__DEV__) console.log('[referral] No code found, calling ensure_referral_code RPC for', userId);
          const { data: rpcCode, error: rpcError } = await supabase
            .rpc('ensure_referral_code', { user_uuid: userId });
          if (rpcError) {
            if (__DEV__) console.log('[referral] RPC error:', rpcError.message, rpcError.details);
            Alert.alert('⚠️', 'Error al generar código: ' + rpcError.message);
          } else if (rpcCode) {
            if (__DEV__) console.log('[referral] RPC success, code:', rpcCode);
            setReferralCode(rpcCode as string);
            await AsyncStorage.removeItem('pending_user_id');
          }
        } else {
          if (__DEV__) console.log('[referral] No session - cannot call RPC. Stored userId:', userId?.substring(0,8));
        }
      }

      // Load referral events (requires session)
      if (user) {
        const { data: eventsData, error: eventsError } = await supabase
          .from('referral_events')
          .select('id, referred_id, referred_email, code_used, status, created_at, activated_at')
          .eq('referrer_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (eventsError) {
          if (__DEV__) console.log('[referral] Error loading events:', eventsError.message);
        }

        if (eventsData) {
          setEvents(eventsData);
        }
      }
    } catch (err: any) {
      if (__DEV__) console.log('[referral] loadData error:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: t('compartir_mensaje', {
          code: referralCode,
          link: 'https://invoicerapid.app',
        }),
      });
    } catch {
      // User cancelled
    }
  };

  const maskEmail = (email: string): string => {
    if (!email || email === '***@***.***') return email;
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    const visible = name.length <= 3 ? 1 : 3;
    return name.slice(0, visible) + '***@' + domain;
  };

  const activatedCount = events.filter((e) => e.status === 'activated').length;

  if (loading) {
    return (
      <View style={[styles.wrapper, styles.centered, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
          {t('invitar_amigos_titulo')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Your code section */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[styles.section, { backgroundColor: currentTheme.colors.card }]}
        >
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.textSecondary }]}>
            {t('tu_codigo')}
          </Text>

          <View style={[styles.codeContainer, { backgroundColor: currentTheme.colors.primary + '10' }]}>
            <Text style={[styles.codeText, { color: currentTheme.colors.primary }]}>
              {referralCode || '------'}
            </Text>
          </View>

          <View style={styles.codeActions}>
            <TouchableOpacity
              style={[styles.codeActionBtn, { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.primary }]}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={[styles.codeActionText, { color: '#fff' }]}>
                {t('compartir_codigo')}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Your invites section */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(150)}
          style={[styles.section, { backgroundColor: currentTheme.colors.card }]}
        >
          <View style={styles.invitesHeader}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.textSecondary }]}>
              {t('tus_invitados')}
            </Text>
            <View style={[styles.counter, { backgroundColor: currentTheme.colors.primary + '15' }]}>
              <Text style={[styles.counterText, { color: currentTheme.colors.primary }]}>
                {activatedCount}/3
              </Text>
            </View>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={currentTheme.colors.textSecondary + '40'} />
              <Text style={[styles.emptyTitle, { color: currentTheme.colors.text }]}>
                {t('sin_invitados')}
              </Text>
              <Text style={[styles.emptySub, { color: currentTheme.colors.textSecondary }]}>
                {t('sin_invitados_sub')}
              </Text>
            </View>
          ) : (
            events.map((event, index) => (
              <Animated.View
                key={event.id}
                entering={FadeInDown.duration(300).delay(200 + index * 80)}
                style={[styles.inviteItem, { borderBottomColor: currentTheme.colors.border || '#f0f0f0' }]}
              >
                <View style={styles.inviteInfo}>
                  <Text style={[styles.inviteEmail, { color: currentTheme.colors.text }]}>
                    {maskEmail(event.referred_email || '***@***.***')}
                  </Text>
                  <Text style={[styles.inviteDate, { color: currentTheme.colors.textSecondary }]}>
                    {new Date(event.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        event.status === 'activated'
                          ? '#26de8120'
                          : event.status === 'rejected'
                          ? '#FF475720'
                          : '#FF9F4320',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          event.status === 'activated'
                            ? '#26de81'
                            : event.status === 'rejected'
                            ? '#FF4757'
                            : '#FF9F43',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          event.status === 'activated'
                            ? '#26de81'
                            : event.status === 'rejected'
                            ? '#FF4757'
                            : '#FF9F43',
                      },
                    ]}
                  >
                    {event.status === 'activated'
                      ? t('estado_activado')
                      : event.status === 'rejected'
                      ? t('rechazado')
                      : t('estado_pendiente')}
                  </Text>
                </View>
              </Animated.View>
            ))
          )}
        </Animated.View>

        {/* Invite banner at bottom */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(300)}
          style={[styles.banner, { backgroundColor: currentTheme.colors.primary + '10', borderColor: currentTheme.colors.primary + '30' }]}
        >
          <Ionicons name="gift-outline" size={24} color={currentTheme.colors.primary} />
          <Text style={[styles.bannerText, { color: currentTheme.colors.primary }]}>
            {t('invitar_amigos_banner')}
          </Text>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: { flex: 1, paddingHorizontal: 16 },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  codeContainer: {
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  codeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
  },
  codeActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  invitesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  counter: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  inviteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  inviteInfo: { flex: 1 },
  inviteEmail: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  inviteDate: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
