import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

// Solo importar Google Mobile Ads en plataformas nativas
let mobileAds: any = null;
let AdEventType: any = null;
let BannerAdSize: any = null;
let InterstitialAd: any = null;
let MaxAdContentRating: any = null;
let TestIds: any = null;
let RewardedAd: any = null;
let RewardedAdEventType: any = null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ads = require('react-native-google-mobile-ads');
  mobileAds = ads.mobileAds;
  AdEventType = ads.AdEventType;
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
    } catch {
      // Si falla la inicialización, permitir anuncios no personalizados como fallback
      this.canShowAds = true;
      this.notifyListeners();
      try { this.loadInterstitial(); } catch {}
      try { this.loadRewardedAd(); } catch {}
    }
  }

  private showConsentDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Consentimiento de anuncios',
        'Esta app usa anuncios para mantenerse gratuita.\n\n¿Aceptas que se muestren anuncios personalizados?\n\nSi eliges "No, anuncios genéricos", seguirás viendo anuncios pero no basados en tu perfil.',
        [
          {
            text: 'No, anuncios genéricos',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Sí, aceptar',
            onPress: () => resolve(true),
          },
        ],
      );
    });
  }

  async requestConsent(): Promise<void> {
    try {  if (__DEV__) console.log('[CONSENT] 📡 requestConsent() — mostrando Alert personalizado...');
      const accepted = await this.showConsentDialog();

      if (accepted) {  if (__DEV__) console.log('[CONSENT] ✅ Usuario ACEPTÓ anuncios personalizados');
        this.consentGiven = true;
        this.canShowAds = true;
        await AsyncStorage.setItem(CONSENT_KEY, 'true');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'obtained');
      } else {  if (__DEV__) console.log('[CONSENT] ❌ Usuario RECHAZÓ — se muestran anuncios no personalizados');
        this.consentGiven = false;
        this.canShowAds = true;
        await AsyncStorage.setItem(CONSENT_KEY, 'false');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'denied');
      }

      this.notifyListeners();

      if (this.canShowAds) {  if (__DEV__) console.log('[CONSENT] 🚀 Precargando interstitial y rewarded');
        this.loadInterstitial();
        this.loadRewardedAd();
      }
    } catch (error) {  if (__DEV__) console.log('[CONSENT] 💥 ERROR en requestConsent():', String(error));
      this.canShowAds = true;
      this.notifyListeners();
    }
  }

  async showPrivacyOptions(): Promise<void> {
    try {  if (__DEV__) console.log('[CONSENT] 🔄 showPrivacyOptions() — mostrando Alert personalizado...');
      const accepted = await this.showConsentDialog();

      if (accepted) {  if (__DEV__) console.log('[CONSENT] ✅ Usuario ACEPTÓ anuncios personalizados');
        this.consentGiven = true;
        await AsyncStorage.setItem(CONSENT_KEY, 'true');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'obtained');
      } else {  if (__DEV__) console.log('[CONSENT] ❌ Usuario RECHAZÓ — anuncios no personalizados');
        this.consentGiven = false;
        await AsyncStorage.setItem(CONSENT_KEY, 'false');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'denied');
      }

      this.canShowAds = true;
      this.notifyListeners();
      try { this.loadRewardedAd(); } catch {}
    } catch {
      this.canShowAds = true;
      this.notifyListeners();
      try { this.loadRewardedAd(); } catch {}
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
    if (!this.canShowAds) {  if (__DEV__) console.log('[REWARDED] ❌ loadRewardedAd() — canShowAds=false, no se carga nada');
      return;
    }
    if (!RewardedAd) {  if (__DEV__) console.log('[REWARDED] ❌ loadRewardedAd() — RewardedAd no disponible (¿web? ¿SDK no cargado?)');
      return;
    }

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
        });  if (__DEV__) console.log('[REWARDED] 📥 Creando RewardedAd con adUnitId:', adUnitId);  if (__DEV__) console.log('[REWARDED]    consentGiven:', this.consentGiven, '| noPersonalizados:', !this.consentGiven);

    this.rewardedAd = RewardedAd.createForAdRequest(adUnitId!, {
      requestNonPersonalizedAdsOnly: !this.consentGiven,
      keywords: ['invoice', 'business', 'finance'],
    });

    this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {  if (__DEV__) console.log('[REWARDED] ✅ LOADED — anuncio cargado correctamente');
      this.isRewardedLoaded = true;
      this.lastRewardedError = null; // Limpiar error al cargar con éxito
      this.rewardedRetryCount = 0; // Reset retry counter on success
    });

    this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {  if (__DEV__) console.log('[REWARDED] ❌ ERROR — error completo:', JSON.stringify(error));  if (__DEV__) console.log('[REWARDED]    error.message:', error?.message);  if (__DEV__) console.log('[REWARDED]    error.code:', error?.code);  if (__DEV__) console.log('[REWARDED]    String(error):', String(error));
      this.isRewardedLoaded = false;
      // Detectar tipo de error
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('no-fill') || errorMsg.includes('No fill')) {  if (__DEV__) console.log('[REWARDED]    tipo: no_fill (AdMob sin anuncios disponibles)');
        this.lastRewardedError = 'no_fill';
      } else {  if (__DEV__) console.log('[REWARDED]    tipo: load_error');
        this.lastRewardedError = 'load_error';
      }
      // Si hay una promesa pendiente de show, resolverla como false
      if (this.rewardedAdResolve) {
        const cb = this.rewardedAdResolve;
        this.rewardedAdResolve = null;
        cb(false);
      }
      // Reintentar carga automática (solo si no es no-fill, o si es no-fill con menos reintentos)
      if (this.rewardedRetryCount < this.maxRewardedRetries) {
        this.rewardedRetryCount++;  if (__DEV__) console.log(`[REWARDED] 🔄 Reintento ${this.rewardedRetryCount}/${this.maxRewardedRetries} en ${this.rewardedRetryDelay}ms`);
        this.rewardedRetryTimer = setTimeout(() => {
          this.loadRewardedAd();
        }, this.rewardedRetryDelay);
      }
    });

    this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {  if (__DEV__) console.log('[REWARDED] 🚪 CLOSED — anuncio cerrado (sin recompensa)');
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

    this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {  if (__DEV__) console.log('[REWARDED] 🎁 EARNED_REWARD — ¡el usuario ganó la recompensa!');
      if (this.rewardedAdResolve) {
        this.rewardedAdResolve(true);
        this.rewardedAdResolve = null;
      }
    });

    this.rewardedAd.load();  if (__DEV__) console.log('[REWARDED] 📤 load() llamado — esperando evento LOADED o ERROR...');
  }

  /**
   * Muestra el rewarded ad y resuelve con true si el usuario completó el anuncio.
   * Si retorna false, revisar `adsService.lastRewardedError` para conocer la causa:
   * - 'no_fill': AdMob no tiene anuncios disponibles (problema externo)
   * - 'load_error': Error cargando el anuncio
   * - 'show_error': Error al mostrar el anuncio
   * - null: timeout, ads desactivados, o no inicializado
   */
  async showRewardedAd(): Promise<boolean> {  if (__DEV__) console.log('[REWARDED] 🎬 showRewardedAd() llamado');  if (__DEV__) console.log('[REWARDED]    canShowAds:', this.canShowAds);  if (__DEV__) console.log('[REWARDED]    rewardedAd existe:', !!this.rewardedAd);  if (__DEV__) console.log('[REWARDED]    isRewardedLoaded:', this.isRewardedLoaded);  if (__DEV__) console.log('[REWARDED]    lastRewardedError:', this.lastRewardedError);

    // Resetear contador para que cada intento del usuario tenga reintentos frescos
    this.rewardedRetryCount = 0;

    if (!this.canShowAds) {  if (__DEV__) console.log('[REWARDED] ❌ showRewardedAd — canShowAds=false, retornando false');
      this.lastRewardedError = null;
      return false;
    }

    if (!this.rewardedAd) {  if (__DEV__) console.log('[REWARDED] ❌ showRewardedAd — rewardedAd es null, llamando loadRewardedAd()');
      this.lastRewardedError = null;
      this.loadRewardedAd();
      return false;
    }

    if (!this.isRewardedLoaded) {  if (__DEV__) console.log('[REWARDED] ⏳ showRewardedAd — no cargado, esperando hasta 10s...');
      this.lastRewardedError = null; // Reset antes de intentar
      this.loadRewardedAd();
      
      // Esperar hasta 15 segundos para dar tiempo a los reintentos automáticos (cada 5s)
      const loaded = await new Promise<boolean>((resolve) => {
        const startTime = Date.now();
        const check = () => {
          if (this.isRewardedLoaded) {
            resolve(true);
          } else if (Date.now() - startTime > 15000) {
            resolve(false);
          } else {
            setTimeout(check, 300);
          }
        };
        check();
      });
      
      if (!loaded) {  if (__DEV__) console.log('[REWARDED] ⏳ timeout — anuncio no cargó en 15s, lastRewardedError:', this.lastRewardedError);
        return false;
      }  if (__DEV__) console.log('[REWARDED] ✅ anuncio cargado tras espera');
    }

    try {
      // Crear una promesa que se resuelve cuando el usuario gana la recompensa
      // o cuando se cierra sin haber completado
      return new Promise<boolean>((resolve) => {
        this.rewardedAdResolve = resolve;

        // Timeout de seguridad: si no hay evento en 60s, resolver como fallo
        const timeout = setTimeout(() => {
          this.rewardedAdResolve = null;
          resolve(false);
        }, 60000);

        // Guardar referencia a resolve original para limpiar timeout
        const originalResolve = resolve;
        this.rewardedAdResolve = (rewarded: boolean) => {
          clearTimeout(timeout);
          originalResolve(rewarded);
        };

        this.rewardedAd.show().catch((error: any) => {  if (__DEV__) console.log('[REWARDED] ❌ show_error al mostrar el anuncio — error:', String(error));
          this.lastRewardedError = 'show_error';
          clearTimeout(timeout);
          this.isRewardedLoaded = false;
          resolve(false);
        });
      });
    } catch {
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
      // Pequeña pausa para asegurar que los assets creativos (imágenes/vídeo)
      // se han descargado completamente antes de permitir mostrar el anuncio.
      // Esto evita la pantalla negra en el primer anuncio.
      this.interstitialRetryCount = 0;
      setTimeout(() => {
        this.isInterstitialLoaded = true;
      }, 1200);
    });

    this.interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
      this.isInterstitialLoaded = false;
      // Reintentar carga automática si no hemos agotado los intentos
      if (this.interstitialRetryCount < this.maxInterstitialRetries) {
        this.interstitialRetryCount++;
        this.interstitialRetryTimer = setTimeout(() => {
          this.loadInterstitial();
        }, this.interstitialRetryDelay);
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
    } catch {
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
    } catch {
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
