import AsyncStorage from '@react-native-async-storage/async-storage';

// Tipos de cambio almacenados
interface ExchangeRates {
  EUR: number; // Euro (base)
  USD: number; // Dólar
  GBP: number; // Libra esterlina
  lastUpdated: number; // Timestamp
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hora en milisegundos
const CACHE_KEY = 'exchange_rates';

// Tipos de cambio por defecto (fallback)
const DEFAULT_RATES: ExchangeRates = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  lastUpdated: 0,
};

/**
 * Obtiene los tipos de cambio desde el caché o la API
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  try {
    // Intentar obtener desde caché
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const rates: ExchangeRates = JSON.parse(cached);
      const now = Date.now();
      
      // Si el caché es válido (menos de 12 horas), usarlo
      if (now - rates.lastUpdated < CACHE_DURATION) {
        return rates;
      }
    }
    
    // Si no hay caché o expiró, obtener de la API
    return await fetchExchangeRatesFromAPI();
  } catch (error) {
    console.error('Error al obtener tipos de cambio:', error);
    // En caso de error, usar tipos por defecto
    return DEFAULT_RATES;
  }
}

/**
 * Obtiene los tipos de cambio desde una API externa
 */
async function fetchExchangeRatesFromAPI(): Promise<ExchangeRates> {
  try {
    // Usar ExchangeRate-API (más fiable)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de cambio de la API');
    }
    
    const data = await response.json();
    
    // Verificar que data.rates existe
    if (!data || !data.rates) {
      console.error('API response invalid:', data);
      throw new Error('Respuesta de API inválida');
    }
    
    const rates: ExchangeRates = {
      EUR: 1, // Euro es la base
      USD: data.rates.USD || 1.08,
      GBP: data.rates.GBP || 0.86,
      lastUpdated: Date.now(),
    };
    
    // Guardar en caché
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(rates));
    
    return rates;
  } catch (error) {
    console.error('Error fetching exchange rates from API:', error);
    // En caso de error, intentar usar caché antiguo
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const rates: ExchangeRates = JSON.parse(cached);
      return rates;
    }
    // Si no hay caché, usar defaults
    return DEFAULT_RATES;
  }
}

/**
 * Fuerza la actualización de los tipos de cambio desde la API
 */
export async function refreshExchangeRates(): Promise<ExchangeRates> {
  try {
    const rates = await fetchExchangeRatesFromAPI();
    return rates;
  } catch (error) {
    console.error('Error al actualizar tipos de cambio:', error);
    throw error;
  }
}

/**
 * Convierte un valor de euros a la moneda seleccionada
 */
export function convertFromEuros(euros: number, targetCurrency: string, rates: ExchangeRates): number {
  if (targetCurrency === 'EUR') return euros;
  
  const rate = rates[targetCurrency as keyof ExchangeRates] as number;
  if (!rate) return euros;
  
  return euros * rate;
}

/**
 * Convierte un valor de una moneda a euros
 */
export function convertToEuros(amount: number, sourceCurrency: string, rates: ExchangeRates): number {
  if (sourceCurrency === 'EUR') return amount;
  
  const rate = rates[sourceCurrency as keyof ExchangeRates] as number;
  if (!rate || rate === 0) return amount;
  
  return amount / rate;
}

/**
 * Convierte un valor entre dos monedas
 */
export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, rates: ExchangeRates): number {
  // Primero convertir a euros
  const inEuros = convertToEuros(amount, fromCurrency, rates);
  // Luego convertir a la moneda destino
  return convertFromEuros(inEuros, toCurrency, rates);
}

/**
 * Convierte un importe a euros para guardar en la base de datos
 */
export async function convertirAEurosParaGuardar(importe: number, targetCurrency: string): Promise<number> {
  try {
    if (targetCurrency === 'EUR') return importe;
    
    const rates = await getExchangeRates();
    return convertToEuros(importe, targetCurrency, rates);
  } catch {
    // En caso de error, asumir que ya está en euros
    return importe;
  }
}

/**
 * Convierte un importe de euros a la moneda seleccionada para mostrar
 */
export async function convertirDeEurosParaMostrar(importeEnEuros: number, targetCurrency: string): Promise<number> {
  try {
    if (targetCurrency === 'EUR') return importeEnEuros;
    
    const rates = await getExchangeRates();
    return convertFromEuros(importeEnEuros, targetCurrency, rates);
  } catch {
    // En caso de error, devolver el valor original
    return importeEnEuros;
  }
}

/**
 * Formatea un valor monetario según la moneda
 */
export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return formatter.format(amount);
}

/**
 * Obtiene el símbolo de moneda
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
  };
  
  return symbols[currency] || currency;
}
