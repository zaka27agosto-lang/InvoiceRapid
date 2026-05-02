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
}

const CONSENT_KEY = 'ads_consent_given';
const CONSENT_STATUS_KEY = 'ads_consent_status';

export class AdsService {
  private static instance: AdsService;
  private consentGiven = false;
  private canShowAds = false;
  private interstitialAd: any = null;
  private isInterstitialLoaded = false;

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
      }

      // Load interstitial ad
      this.loadInterstitial();
    } catch (error) {
      console.error('Ads initialization error:', error);
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
          await AsyncStorage.setItem(CONSENT_KEY, 'true');
          await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'obtained');
        } else if (result.status === AdsConsentStatus.NOT_REQUIRED) {
          this.consentGiven = true;
          this.canShowAds = true;
          await AsyncStorage.setItem(CONSENT_KEY, 'true');
          await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'not_required');
        } else {
          this.consentGiven = false;
          this.canShowAds = false;
          await AsyncStorage.setItem(CONSENT_KEY, 'false');
          await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'denied');
        }
      } else {
        // Consent not required in this region
        this.consentGiven = true;
        this.canShowAds = true;
        await AsyncStorage.setItem(CONSENT_KEY, 'true');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'not_required');
      }
    } catch (error) {
      console.error('Consent request error:', error);
      this.canShowAds = false;
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
        this.consentGiven = false;
        this.canShowAds = false;
        await AsyncStorage.setItem(CONSENT_KEY, 'false');
        await AsyncStorage.setItem(CONSENT_STATUS_KEY, 'denied');
      }
    } catch (error) {
      console.error('Privacy options error:', error);
    }
  }

  async resetConsent(): Promise<void> {
    this.consentGiven = false;
    this.canShowAds = false;
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

  loadInterstitial(): void {
    if (!this.canShowAds) return;

    // Create and load interstitial ad
    const adUnitId = __DEV__ 
      ? TestIds.INTERSTITIAL 
      : Platform.select({
          ios: 'ca-app-pub-xxx/xxx',
          android: 'ca-app-pub-xxx/xxx',
        });

    this.interstitialAd = InterstitialAd.createForAdRequest(adUnitId!, {
      requestNonPersonalizedAdsOnly: !this.consentGiven,
      keywords: ['invoice', 'business', 'finance'],
    });

    this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      this.isInterstitialLoaded = true;
    });

    this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      this.isInterstitialLoaded = false;
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

  getBannerAdSize(): any {
    return BannerAdSize ? BannerAdSize.BANNER : 'BANNER';
  }

  getBannerAdUnitId(): string {
    return __DEV__ 
      ? TestIds.BANNER 
      : Platform.select({
          ios: 'ca-app-pub-xxx/xxx',
          android: 'ca-app-pub-xxx/xxx',
        }) || '';
  }
}

export const adsService = AdsService.getInstance();
