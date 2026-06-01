import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Solo importar Google Mobile Ads en plataformas nativas
let mobileAds: any = null;
let AdEventType: any = null;
let AdsConsent: any = null;
let AdsConsentStatus: any = null;
let BannerAdSize: any = null;
let InterstitialAd: any = null;
let MaxAdContentRating: any = null;
let TestIds: any = null;
let RewardedAd: any = null;
let RewardedAdEventType: any = null;

if (Platform.OS !== 'web') {
  const ads = require('react-native-google-mobile-ads');
  mobileAds = ads.mobileAds;
  AdEventType = ads.AdEventType;
  AdsConsent = ads.AdsConsent;
  AdsConsentStatus = ads.AdsConsentStatus;
  BannerAdSize = ads.BannerAdSize;
  InterstitialAd = ads.InterstitialAd;
  MaxAdContentRating = ads.MaxAdContentRating;
  TestIds = ads.TestIds;
  RewardedAd = ads.RewardedAd;
  RewardedAdEventType = ads.RewardedAdEventType;
}

const CONSENT_KEY = 'ads_consent_given';
const CONSENT_STATUS_KEY = 'ads_consent_status';

type AdsListener = () => void;

export class AdsService {
  private static instance: AdsService;
  private consentGiven = false;
  private canShowAds = false;
  private interstitialAd: any = null;
  private isInterstitialLoaded = false;
  private rewardedAd: any = null;
  private isRewardedLoaded = false;
  private rewardedAdResolve: ((rewarded: boolean) => void) | null = null;
  private listeners: AdsListener[] = [];
  /** Último error del rewarded ad: 'no_fill', 'load_error', 'show_error', o null si no hay error */
  lastRewardedError: string | null = null;

  addListener(listener: AdsListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  static getInstance(): AdsService {
    if (!AdsService.instance) {
      AdsService.instance = new AdsService();
    }
    return AdsService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Check if consent was previously given
      const savedConsent = await AsyncStorage.getItem(CONSENT_KEY);
      this.consentGiven = savedConsent === 'true';

      // Configure ads
      await mobileAds().setRequestConfiguration({
        // Configure ad content rating
        maxAdContentRating: MaxAdContentRating.G,
        // Configure for test devices (remove in production)
        testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
      });

      // Initialize Mobile Ads SDK
      await mobileAds().initialize();

      // Request consent if not given
      if (!this.consentGiven) {
        await this.requestConsent();
      } else {
        this.canShowAds = true;
        this.notifyListeners();
      }

      // Load interstitial and rewarded ads
      // Only load if ads can be shown
      if (this.canShowAds) {
        this.loadInterstitial();
        this.loadRewardedAd();
      }
    } catch (error) {
      console.error('Ads initialization error:', error);
      // Si falla la inicialización, permitir anuncios no personalizados como fallback
      this.canShowAds = true;
      this.notifyListeners();
      try { this.loadInterstitial(); } catch (e) { console.error('Error loading interstitial after init failure:', e); }
      try { this.loadRewardedAd(); } catch (e) { console.error('Error loading rewarded ad after init failure:', e); }
    }
  }

  async requestConsent(): Promise<void> {
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate();

      if (consentInfo.isConsentFormAvailable) {
        const result = await AdsConsent.loadAndShowConsentFormIfRequired();

        if (result.status === AdsConsentStatus.OBTAINED) {
          this.consentGiven = true;
          this.canShowAds = true;
          this.notifyListeners();
          await AsyncStorage.setItem(CONSENT_KEY, 'true');
          await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'obtained');
        } else if (result.status === AdsConsentStatus.NOT_REQUIRED) {
          this.consentGiven = true;
          this.canShowAds = true;
          this.notifyListeners();
          await AsyncStorage.setItem(CONSENT_KEY, 'true');
          await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'not_required');
      } else {
        // Estado inesperado (UNKNOWN, etc.) — mostrar anuncios no personalizados igualmente
        this.consentGiven = false;
        this.canShowAds = true;
        this.notifyListeners();
        await AsyncStorage.setItem(CONSENT_KEY, 'false');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'denied');
      }
      } else {
        // Consent not required in this region
        this.consentGiven = true;
        this.canShowAds = true;
        this.notifyListeners();
        await AsyncStorage.setItem(CONSENT_KEY, 'true');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'not_required');
      }

      // Pre-cargar interstitial y rewarded ahora que tenemos consentimiento
      if (this.canShowAds) {
        this.loadInterstitial();
        this.loadRewardedAd();
      }
    } catch (error) {
      console.error('Consent request error:', error);
      // Si falla el consentimiento, permitir anuncios no personalizados como fallback
      this.canShowAds = true;
      this.notifyListeners();
    }
  }

  async showPrivacyOptions(): Promise<void> {
    try {
      const result = await AdsConsent.showPrivacyOptionsForm();
      
      if (result.status === AdsConsentStatus.OBTAINED) {
        this.consentGiven = true;
        this.canShowAds = true;
        await AsyncStorage.setItem(CONSENT_KEY, 'true');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'obtained');
      } else if (result.status === AdsConsentStatus.NOT_REQUIRED) {
        this.consentGiven = true;
        this.canShowAds = true;
        await AsyncStorage.setItem(CONSENT_KEY, 'true');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'not_required');
      } else {
        // Si el usuario denegó o estado inesperado, mostrar anuncios no personalizados
        this.consentGiven = false;
        this.canShowAds = true;
        this.notifyListeners();
        await AsyncStorage.setItem(CONSENT_KEY, 'false');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'denied');
      }
    } catch (error) {
      console.error('Privacy options error:', error);
      this.canShowAds = true;
      this.notifyListeners();
      try { this.loadRewardedAd(); } catch (e) { console.error('Error loading rewarded ad after privacy change:', e); }
    }
  }

  async resetConsent(): Promise<void> {
    this.consentGiven = false;
    this.canShowAds = true;
    await AsyncStorage.removeItem(CONSENT_KEY);
    await AsyncStorage.removeItem(CONSENT_STATUS_KEY);
    await this.requestConsent();
  }

  getCanShowAds(): boolean {
    return this.canShowAds;
  }

  getConsentGiven(): boolean {
    return this.consentGiven;
  }

  private interstitialRetryCount = 0;
  private readonly maxInterstitialRetries = 3;
  private readonly interstitialRetryDelay = 10000; // 10 seconds between retries
  private interstitialRetryTimer: ReturnType<typeof setTimeout> | null = null;

  private rewardedRetryCount = 0;
  private readonly maxRewardedRetries = 10;
  private readonly rewardedRetryDelay = 5000; // 5 seconds between retries
  private rewardedRetryTimer: ReturnType<typeof setTimeout> | null = null;

  loadRewardedAd(): void {
    if (!this.canShowAds) return;
    if (!RewardedAd) return;

    // Limpiar retry programado previo
    if (this.rewardedRetryTimer) {
      clearTimeout(this.rewardedRetryTimer);
      this.rewardedRetryTimer = null;
    }

    const adUnitId = __DEV__
      ? TestIds.REWARDED
      : Platform.select({
          android: 'ca-app-pub-3758182602063783/8097499944',
          ios: 'ca-app-pub-3758182602063783/8097499944',
        });

    this.rewardedAd = RewardedAd.createForAdRequest(adUnitId!, {
      requestNonPersonalizedAdsOnly: !this.consentGiven,
      keywords: ['invoice', 'business', 'finance'],
    });

    this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      this.isRewardedLoaded = true;
      this.lastRewardedError = null; // Limpiar error al cargar con éxito
      this.rewardedRetryCount = 0; // Reset retry counter on success
      console.log('🎁 Rewarded ad loaded successfully');
    });

    this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
      this.isRewardedLoaded = false;
      // Detectar tipo de error
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('no-fill') || errorMsg.includes('No fill')) {
        this.lastRewardedError = 'no_fill';
        console.warn('⚠️ Rewarded ad — sin anuncios disponibles (no fill)');
      } else {
        this.lastRewardedError = 'load_error';
        console.warn('❌ Error loading rewarded ad:', errorMsg);
      }
      // Si hay una promesa pendiente de show, resolverla como false
      if (this.rewardedAdResolve) {
        const cb = this.rewardedAdResolve;
        this.rewardedAdResolve = null;
        cb(false);
      }
      // Reintentar carga automática (solo si no es no-fill, o si es no-fill con menos reintentos)
      if (this.rewardedRetryCount < this.maxRewardedRetries) {
        this.rewardedRetryCount++;
        console.log(`🔄 Reintentando cargar rewarded ad (${this.rewardedRetryCount}/${this.maxRewardedRetries})...`);
        this.rewardedRetryTimer = setTimeout(() => {
          this.loadRewardedAd();
        }, this.rewardedRetryDelay);
      } else {
        console.warn('❌ Rewarded ad no disponible tras', this.rewardedRetryCount, 'intentos');
      }
    });

    this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      this.isRewardedLoaded = false;
      this.rewardedRetryCount = 0;
      // Si hay una promesa pendiente de show, resolverla como false (no ganó recompensa)
      if (this.rewardedAdResolve) {
        const cb = this.rewardedAdResolve;
        this.rewardedAdResolve = null;
        cb(false);
      }
      // Recargar para la próxima vez
      setTimeout(() => this.loadRewardedAd(), 1000);
    });

    this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      console.log('🎁 Rewarded ad — usuario ganó la recompensa');
      if (this.rewardedAdResolve) {
        this.rewardedAdResolve(true);
        this.rewardedAdResolve = null;
      }
    });

    this.rewardedAd.load();
  }

  /**
   * Muestra el rewarded ad y resuelve con true si el usuario completó el anuncio.
   * Si retorna false, revisar `adsService.lastRewardedError` para conocer la causa:
   * - 'no_fill': AdMob no tiene anuncios disponibles (problema externo)
   * - 'load_error': Error cargando el anuncio
   * - 'show_error': Error al mostrar el anuncio
   * - null: timeout, ads desactivados, o no inicializado
   */
  async showRewardedAd(): Promise<boolean> {
    console.log('🎬 showRewardedAd() llamado - canShowAds:', this.canShowAds, 'rewardedAd:', !!this.rewardedAd, 'isRewardedLoaded:', this.isRewardedLoaded);

    // Resetear contador para que cada intento del usuario tenga reintentos frescos
    this.rewardedRetryCount = 0;

    if (!this.canShowAds) {
      console.log('❌ Rewarded ad — ads no disponibles (canShowAds=false)');
      this.lastRewardedError = null;
      return false;
    }

    if (!this.rewardedAd) {
      console.log('❌ Rewarded ad — objeto no inicializado, cargando...');
      this.lastRewardedError = null;
      this.loadRewardedAd();
      return false;
    }

    if (!this.isRewardedLoaded) {
      console.log('⏳ Rewarded ad — no cargado aún, esperando...');
      this.lastRewardedError = null; // Reset antes de intentar
      this.loadRewardedAd();
      
      // Esperar hasta 10 segundos (reducido de 15s para no hacer esperar tanto)
      const loaded = await new Promise<boolean>((resolve) => {
        const startTime = Date.now();
        const check = () => {
          if (this.isRewardedLoaded) {
            console.log('✅ Rewarded ad cargado tras espera');
            resolve(true);
          } else if (Date.now() - startTime > 10000) {
            console.log('❌ Rewarded ad — timeout esperando carga (lastError:', this.lastRewardedError, ')');
            resolve(false);
          } else {
            setTimeout(check, 300);
          }
        };
        check();
      });
      
      if (!loaded) return false;
    }

    try {
      // Crear una promesa que se resuelve cuando el usuario gana la recompensa
      // o cuando se cierra sin haber completado
      return new Promise<boolean>((resolve) => {
        this.rewardedAdResolve = resolve;

        // Timeout de seguridad: si no hay evento en 60s, resolver como fallo
        const timeout = setTimeout(() => {
          console.log('⏱️ Rewarded ad timeout');
          this.rewardedAdResolve = null;
          resolve(false);
        }, 60000);

        // Guardar referencia a resolve original para limpiar timeout
        const originalResolve = resolve;
        this.rewardedAdResolve = (rewarded: boolean) => {
          clearTimeout(timeout);
          originalResolve(rewarded);
        };

        this.rewardedAd.show().catch((error: any) => {
          console.error('Error showing rewarded ad:', error);
          this.lastRewardedError = 'show_error';
          clearTimeout(timeout);
          this.isRewardedLoaded = false;
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Error showing rewarded ad:', error);
      this.isRewardedLoaded = false;
      return false;
    }
  }

  loadInterstitial(): void {
    if (!this.canShowAds) return;

    // Limpiar retry programado previo
    if (this.interstitialRetryTimer) {
      clearTimeout(this.interstitialRetryTimer);
      this.interstitialRetryTimer = null;
    }

    const adUnitId = __DEV__ 
      ? TestIds.INTERSTITIAL 
      : Platform.select({
          android: 'ca-app-pub-3758182602063783/4421373572',
          ios: 'ca-app-pub-3758182602063783/4421373572',
        });

    this.interstitialAd = InterstitialAd.createForAdRequest(adUnitId!, {
      requestNonPersonalizedAdsOnly: !this.consentGiven,
      keywords: ['invoice', 'business', 'finance'],
    });

    this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      this.isInterstitialLoaded = true;
      this.interstitialRetryCount = 0; // Reset retry counter on success
    });

    this.interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
      this.isInterstitialLoaded = false;
      // Reintentar carga automática si no hemos agotado los intentos
      if (this.interstitialRetryCount < this.maxInterstitialRetries) {
        this.interstitialRetryCount++;
        console.log(`🔄 Reintentando cargar interstitial (${this.interstitialRetryCount}/${this.maxInterstitialRetries})...`);
        this.interstitialRetryTimer = setTimeout(() => {
          this.loadInterstitial();
        }, this.interstitialRetryDelay);
      } else {
        console.warn('❌ Interstitial no disponible tras', this.maxInterstitialRetries, 'intentos');
      }
    });

    this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      this.isInterstitialLoaded = false;
      this.interstitialRetryCount = 0;
      this.loadInterstitial(); // Preload next ad
    });

    this.interstitialAd.load();
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.canShowAds || !this.interstitialAd || !this.isInterstitialLoaded) {
      return false;
    }

    try {
      await this.interstitialAd.show();
      return true;
    } catch (error) {
      console.error('Error showing interstitial:', error);
      return false;
    }
  }

  /**
   * Muestra un anuncio intersticial en CADA acción del usuario.
   * Se muestra en cada creación de factura, cliente o producto.
   * @param isPremium Si el usuario es premium, no se muestra nada.
   * @returns true si se mostró un anuncio, false en caso contrario.
   */
  async incrementAction(isPremium: boolean): Promise<boolean> {
    if (isPremium || !this.canShowAds) {
      return false;
    }

    try {
      // Mostrar anuncio en CADA acción
      const shown = await this.showInterstitial();
      if (shown) {
        // Precargar el siguiente anuncio para la próxima acción
        setTimeout(() => {
          this.loadInterstitial();
        }, 1000);
      } else {
        // Si falló, reintentar cargar para la próxima
        this.loadInterstitial();
      }
      return shown;
    } catch (error) {
      console.error('Error al mostrar anuncio intersticial:', error);
      return false;
    }
  }

  getBannerAdSize(): any {
    return BannerAdSize ? BannerAdSize.BANNER : 'BANNER';
  }

  /**
   * Forzar recarga de rewarded ad (llamar al volver a foreground).
   */
  reloadRewardedAd(): void {
    this.rewardedRetryCount = 0;
    this.isRewardedLoaded = false;
    this.loadRewardedAd();
  }

  getBannerAdUnitId(): string {
    return __DEV__ 
      ? TestIds.BANNER 
      : Platform.select({
          android: 'ca-app-pub-3758182602063783/5253589032',
          ios: 'ca-app-pub-3758182602063783/5253589032',
        }) || '';
  }
}

export const adsService = AdsService.getInstance();
