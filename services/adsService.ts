import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  loadRemoteConfigFromCache,
  refreshRemoteConfig,
  getRemoteConfigSync,
} from '../utils/remoteConfig';

// Solo importar Google Mobile Ads en plataformas nativas
let mobileAds: any = null;
let AdEventType: any = null;
let BannerAdSize: any = null;
let InterstitialAd: any = null;
let MaxAdContentRating: any = null;
let TestIds: any = null;
let RewardedAd: any = null;
let RewardedAdEventType: any = null;
let AdsConsent: any = null;
let AdsConsentStatus: any = null;

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
  AdsConsent = ads.AdsConsent;
  AdsConsentStatus = ads.AdsConsentStatus;
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
  /** Contador de acciones. El umbral viene de app_config.interstitial_every_n_actions (default 3). */
  private actionCount = 0;

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
      // 0. Cargar config remota en cache (offline-first). Si falla red,
      //    usa defaults. Asegura que `getRemoteConfigSync()` funciona desde
      //    el primer `incrementAction()`. Se hace ANTES de UMP para que
      //    cualquier UI que dependa del umbral esté sincronizada.
      try {
        await loadRemoteConfigFromCache();
      } catch { /* default */ }
      try {
        // Fire-and-forget: si falla red, mantenemos lo del cache local.
        refreshRemoteConfig().catch(() => {});
      } catch { /* default */ }

      // 1. Gather consent VÍA UMP DE GOOGLE (Google-rendered form) — ANTES de inicializar MobileAds.
      //    Google exige que el popup UMP aparezca en el primer arranque ANTES de mostrar anuncios.
      await this.gatherConsentUMP();

      // 2. Si podemos mostrar anuncios, inicializar MobileAds SDK y precargar
      if (this.canShowAds) {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.G,
          testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
        });
        await mobileAds().initialize();

        // 3. Pre-calentamiento del engine nativo (evita pantalla negra en primer interstitial)
        await this.prewarmNativeEngine();

        // 4. Cargar anuncios
        this.loadInterstitial();
        this.loadRewardedAd();
      }

      this.notifyListeners();
    } catch {
      // Fallback: si falla UMP o la inicialización, permitir anuncios no personalizados
      this.canShowAds = true;
      this.notifyListeners();
      try { this.loadInterstitial(); } catch {}
      try { this.loadRewardedAd(); } catch {}
    }
  }

  /**
   * Recolecta consentimiento usando UMP (User Messaging Platform) de Google.
   * Muestra el formulario nativo de Google si es necesario.
   * Google exige que esto ocurra en el primer arranque, ANTES de inicializar MobileAds.
   */
  private async gatherConsentUMP(): Promise<void> {
    if (!AdsConsent || !AdsConsentStatus) {
      // Si UMP no está disponible (web), permitir anuncios
      this.consentGiven = true;
      this.canShowAds = true;
      return;
    }

    try {
      // gatherConsent() internamente llama a requestInfoUpdate() y,
      // si se requiere consentimiento, muestra automáticamente el formulario UMP de Google.
      const consentInfo = await AdsConsent.gatherConsent({
        debugGeography: __DEV__ ? 1 : undefined, // 1 = EEA (para probar el flujo de consentimiento en desarrollo)
        testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
      });

      // NOT_REQUIRED = fuera de EEA (mayoría del mundo): Google permite anuncios personalizados
      // OBTAINED = usuario dio consentimiento explícito en el formulario UMP
      // Ambos casos = podemos usar anuncios personalizados (mayor revenue)
      this.consentGiven = consentInfo.status === AdsConsentStatus.OBTAINED ||
                          consentInfo.status === AdsConsentStatus.NOT_REQUIRED;
      this.canShowAds = consentInfo.canRequestAds;

      // Persistir estado para referencia offline
      await AsyncStorage.setItem(CONSENT_KEY, this.consentGiven ? 'true' : 'false');
      await AsyncStorage.setItem(CONSENT_STATUS_KEY, this.consentGiven ? 'obtained' : 'denied');
      // NOTA: No notificar aquí para evitar doble notificación —
      // initialize() o requestConsent() llaman a notifyListeners() después de cargar los anuncios.
    } catch {
      // Fallback: si UMP falla, mostrar anuncios no personalizados
      // (mejor mostrar anuncios no-personalizados que no mostrar nada,
      //  así al menos generamos ingresos aunque sean reducidos)
      this.consentGiven = false;
      this.canShowAds = true;
      await AsyncStorage.setItem(CONSENT_KEY, 'false');
      await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'denied');
      // No notificar aquí — initialize() es el único notificador después de cargar ads
    }
  }

  /**
   * Permite al usuario establecer el consentimiento manualmente (cuando UMP no está disponible).
   */
  async setConsentManually(given: boolean): Promise<void> {
    this.consentGiven = given;
    this.canShowAds = true;
    await AsyncStorage.setItem(CONSENT_KEY, given ? 'true' : 'false');
    await AsyncStorage.setItem(CONSENT_STATUS_KEY, given ? 'obtained' : 'denied');
    // Recargar anuncios con la nueva configuración
    try { this.loadInterstitial(); } catch {}
    try { this.loadRewardedAd(); } catch {}
    this.notifyListeners();
  }
  async requestConsent(): Promise<void> {
    await this.gatherConsentUMP();
    if (this.canShowAds) {
      this.loadInterstitial();
      this.loadRewardedAd();
    }
  }

  /**
   * Muestra el formulario de opciones de privacidad de Google UMP.
   * Si no está disponible (fuera de EEA), permite elegir manualmente.
   * @returns true si se pudo cambiar el consentimiento, false si se canceló
   */
  async showPrivacyOptions(): Promise<boolean> {
    if (!AdsConsent) {
      // Fallback: no se puede cambiar, devolver false
      return false;
    }

    try {
      // showPrivacyOptionsForm() muestra el formulario nativo de Google
      // donde el usuario puede modificar sus opciones de consentimiento.
      await AdsConsent.showPrivacyOptionsForm();

      // Re-verificar el estado después de que el usuario cierre el formulario
      const consentInfo = await AdsConsent.getConsentInfo();
      this.consentGiven = consentInfo.status === AdsConsentStatus.OBTAINED ||
                          consentInfo.status === AdsConsentStatus.NOT_REQUIRED;
      this.canShowAds = consentInfo.canRequestAds;

      await AsyncStorage.setItem(CONSENT_KEY, this.consentGiven ? 'true' : 'false');
      await AsyncStorage.setItem(CONSENT_STATUS_KEY, this.consentGiven ? 'obtained' : 'denied');

      this.notifyListeners();
      if (this.canShowAds) {
        try { this.loadRewardedAd(); } catch {}
      }
      return true;
    } catch {
      // Formulario no disponible (fuera de EEA o error)
      return false;
    }
  }

  /**
   * Resetea completamente el consentimiento usando UMP.reset().
   * Borra todo el estado de UMP y vuelve a recolectar consentimiento desde cero.
   */
  async resetConsent(): Promise<void> {
    // Resetear UMP (borra cookies, TC String, todo el estado de consentimiento)
    if (AdsConsent) {
      AdsConsent.reset();
    }

    this.consentGiven = false;
    this.canShowAds = false;
    await AsyncStorage.removeItem(CONSENT_KEY);
    await AsyncStorage.removeItem(CONSENT_STATUS_KEY);

    // Re-ejecutar el flujo completo de consentimiento
    await this.gatherConsentUMP();

    // Si ahora podemos mostrar anuncios, cargarlos
    if (this.canShowAds) {
      try { this.loadInterstitial(); } catch {}
      try { this.loadRewardedAd(); } catch {}
    }

    this.notifyListeners();
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
  /** Indica si ya se ha mostrado al menos un interstitial en esta sesión (para delays progresivos) */
  private firstInterstitialShown = false;

  /**
   * Pre-calentamiento del engine nativo de anuncios.
   * Carga un interstitial de TEST para forzar la inicialización de la WebView
   * y otros recursos nativos ANTES del primer anuncio real.
   * Esto evita la pantalla negra en el primer interstitial.
   */
  private async prewarmNativeEngine(): Promise<void> {
    if (!InterstitialAd || !TestIds) return;

    try {
      await new Promise<void>((resolve) => {
        const prewarmAd = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
          requestNonPersonalizedAdsOnly: true,
        });

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        prewarmAd.addAdEventListener(AdEventType.LOADED, () => {
          finish();
        });

        prewarmAd.addAdEventListener(AdEventType.ERROR, () => {
          finish(); // Incluso si falla, la inicialización pudo haber ocurrido
        });

        prewarmAd.load();

        // Timeout de seguridad: no esperar más de 8s
        setTimeout(finish, 8000);
      });
    } catch {
      // Silencioso — si falla la precarga, no bloqueamos la inicialización
    }
  }

  private rewardedRetryCount = 0;
  private readonly maxRewardedRetries = 10;
  private readonly rewardedRetryDelay = 5000; // 5 seconds between retries
  private rewardedRetryTimer: ReturnType<typeof setTimeout> | null = null;

  loadRewardedAd(): void {
    if (!this.canShowAds) {
      return;
    }
    if (!RewardedAd) {
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
        });

    this.rewardedAd = RewardedAd.createForAdRequest(adUnitId!, {
      requestNonPersonalizedAdsOnly: !this.consentGiven,
      keywords: ['invoice', 'business', 'finance'],
    });

    this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      this.isRewardedLoaded = true;
      this.lastRewardedError = null;
      this.rewardedRetryCount = 0;
    });

    this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
      this.isRewardedLoaded = false;
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('no-fill') || errorMsg.includes('No fill')) {
        this.lastRewardedError = 'no_fill';
      } else {
        this.lastRewardedError = 'load_error';
      }
      if (this.rewardedAdResolve) {
        const cb = this.rewardedAdResolve;
        this.rewardedAdResolve = null;
        cb(false);
      }
      if (this.rewardedRetryCount < this.maxRewardedRetries) {
        this.rewardedRetryCount++;
        this.rewardedRetryTimer = setTimeout(() => {
          this.loadRewardedAd();
        }, this.rewardedRetryDelay);
      }
    });

    this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      this.isRewardedLoaded = false;
      this.rewardedRetryCount = 0;
      if (this.rewardedAdResolve) {
        const cb = this.rewardedAdResolve;
        this.rewardedAdResolve = null;
        cb(false);
      }
      setTimeout(() => this.loadRewardedAd(), 1000);
    });

    this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
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
    this.rewardedRetryCount = 0;

    if (!this.canShowAds) {
      this.lastRewardedError = null;
      return false;
    }

    if (!this.rewardedAd) {
      this.lastRewardedError = null;
      this.loadRewardedAd();
      return false;
    }

    if (!this.isRewardedLoaded) {
      this.lastRewardedError = null;
      this.loadRewardedAd();

      // Esperar hasta 15 segundos
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

      if (!loaded) {
        return false;
      }
    }

    try {
      return new Promise<boolean>((resolve) => {
        this.rewardedAdResolve = resolve;

        const timeout = setTimeout(() => {
          this.rewardedAdResolve = null;
          resolve(false);
        }, 60000);

        const originalResolve = resolve;
        this.rewardedAdResolve = (rewarded: boolean) => {
          clearTimeout(timeout);
          originalResolve(rewarded);
        };

        this.rewardedAd.show().catch(() => {
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
      this.interstitialRetryCount = 0;
      const delay = this.firstInterstitialShown ? 1000 : 5000;
      setTimeout(() => {
        this.isInterstitialLoaded = true;
      }, delay);
    });

    this.interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
      this.isInterstitialLoaded = false;
      if (this.interstitialRetryCount < this.maxInterstitialRetries) {
        this.interstitialRetryCount++;
        this.interstitialRetryTimer = setTimeout(() => {
          this.loadInterstitial();
        }, this.interstitialRetryDelay);
      }
    });

    this.interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
      this.firstInterstitialShown = true;
    });

    this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      this.isInterstitialLoaded = false;
      this.interstitialRetryCount = 0;
      this.firstInterstitialShown = true;
      this.loadInterstitial();
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
   * Muestra un anuncio intersticial cada N acciones del usuario (N desde
   * app_config.interstitial_every_n_actions, default 3). Una acción es:
   * crear una factura, albarán, cliente o producto. Solo aplica a usuarios
   * sin suscripción Premium y con consentimiento para anuncios.
   * @param isPremium Si el usuario es premium, no se muestra nada.
   * @returns true si se mostró un anuncio, false en caso contrario.
   */
  async incrementAction(isPremium: boolean): Promise<boolean> {
    if (isPremium || !this.canShowAds) {
      return false;
    }

    this.actionCount++;

    // Lectura síncrona del cache módulo — si no está inicializado, devuelve defaults.
    const everyNActions = getRemoteConfigSync().interstitial_every_n_actions;

    if (this.actionCount < everyNActions) {
      return false;
    }

    this.actionCount = 0;

    try {
      const shown = await this.showInterstitial();
      if (shown) {
        setTimeout(() => {
          this.loadInterstitial();
        }, 1000);
      } else {
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
