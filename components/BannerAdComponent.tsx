import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { adsService } from '../services/adsService';
import { onPremiumChange } from '../utils/premiumEvents';

// Solo importar BannerAd en plataformas nativas
let BannerAd: any = null;
let BannerAdSize: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ads = require('react-native-google-mobile-ads');
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
  } catch (e) {
    // Módulo no disponible
  }
}

interface BannerAdComponentProps {
  isPremium: boolean;
}

export default function BannerAdComponent({ isPremium }: BannerAdComponentProps) {
  const [canShowAds, setCanShowAds] = useState(() => adsService.getCanShowAds());
  const [adKey, setAdKey] = useState(0);
  const wasPremiumRef = useRef(isPremium);

  // Detectar transición: premium → free → forzar remount del BannerAd nativo
  useEffect(() => {
    if (wasPremiumRef.current && !isPremium) {
      setAdKey(k => k + 1);
    }
    wasPremiumRef.current = isPremium;
  }, [isPremium]);

  // Safety net: escuchar eventos de premiumEvents para cuando el cambio
  // de premium no propague correctamente el isPremium como prop
  useEffect(() => {
    const unsubscribe = onPremiumChange((isPremiumNow: boolean) => {
      if (!isPremiumNow) {
        setCanShowAds(adsService.getCanShowAds());
        setAdKey(k => k + 1);
      }
    });
    return () => { unsubscribe(); };
  }, []);

  // Sincronizar estado inicial y suscribirse siempre al listener
  useEffect(() => {
    setCanShowAds(adsService.getCanShowAds());
    const unsubscribe = adsService.addListener(() => {
      setCanShowAds(adsService.getCanShowAds());
    });
    return unsubscribe;
  }, []);

  // No renderizar en web, si es premium, o si no hay anuncios disponibles
  if (Platform.OS === 'web' || isPremium || !canShowAds || !BannerAd) {
    return null;
  }

  const adUnitId = adsService.getBannerAdUnitId();
  if (!adUnitId) return null;

  return (
    <BannerAd
      key={adKey}
      unitId={adUnitId}
      size={BannerAdSize?.ADAPTIVE_BANNER || 'BANNER'}
      requestOptions={{
        requestNonPersonalizedAdsOnly: !adsService.getConsentGiven(),
      }}
    />
  );
}
