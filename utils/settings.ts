import AsyncStorage from '@react-native-async-storage/async-storage';

export type DatosEmpresa = {
  nombre: string;
  nif: string;
  direccion: string;
  telefono: string;
  email: string;
  incluirEnFactura: boolean;
};

export type Moneda = {
  simbolo: string;
  codigo: string;
  nombre: string;
};

export type PlantillaPDF = 'default' | 'elegante' | 'antigua' | 'colorida' | 'minimal';

export type FormatoFecha = 'DD/MM/YYYY' | 'YYYY-MM-DD';

export const PLANTILLAS_PDF: { id: PlantillaPDF; nombre: string; descripcion: string }[] = [
  { id: 'default', nombre: 'Estándar', descripcion: 'Diseño moderno con gradientes púrpura' },
  { id: 'elegante', nombre: 'Elegante', descripcion: 'Estilo clásico con fuente serif' },
  { id: 'antigua', nombre: 'Antigua', descripcion: 'Diseño vintage con bordes marrones' },
  { id: 'colorida', nombre: 'Colorida', descripcion: 'Colores vibrantes y gradientes' },
  { id: 'minimal', nombre: 'Minimalista', descripcion: 'Diseño limpio y simple' },
];

export const MONEDAS: Moneda[] = [
  { simbolo: '€', codigo: 'EUR', nombre: 'Euro' },
  { simbolo: '$', codigo: 'USD', nombre: 'Dólar' },
  { simbolo: '£', codigo: 'GBP', nombre: 'Libra' },
];

export const LIMITE_FACTURAS_GRATIS = 15;

export async function getMoneda(): Promise<Moneda> {
  try {
    const guardada = await AsyncStorage.getItem('moneda');
    if (guardada) return JSON.parse(guardada);
  } catch {}
  return MONEDAS[0];
}

export async function setMoneda(moneda: Moneda): Promise<void> {
  try {
    await AsyncStorage.setItem('moneda', JSON.stringify(moneda));
  } catch {}
}

export async function getDatosEmpresa(): Promise<DatosEmpresa> {
  try {
    const guardados = await AsyncStorage.getItem('datos_empresa');
    if (guardados) return JSON.parse(guardados);
  } catch {}
  return { nombre: '', nif: '', direccion: '', telefono: '', email: '', incluirEnFactura: true };
}

export async function setDatosEmpresa(datos: DatosEmpresa): Promise<void> {
  try {
    await AsyncStorage.setItem('datos_empresa', JSON.stringify(datos));
  } catch {}
}

export async function getPlantillaPDF(): Promise<PlantillaPDF> {
  try {
    const guardada = await AsyncStorage.getItem('plantilla_pdf');
    if (guardada) return guardada as PlantillaPDF;
  } catch {}
  return 'default';
}

export async function setPlantillaPDF(plantilla: PlantillaPDF): Promise<void> {
  try {
    await AsyncStorage.setItem('plantilla_pdf', plantilla);
  } catch {}
}

export async function getFormatoFecha(): Promise<FormatoFecha> {
  try {
    const guardado = await AsyncStorage.getItem('formato_fecha');
    if (guardado) return guardado as FormatoFecha;
  } catch {}
  return 'DD/MM/YYYY';
}

export async function setFormatoFecha(formato: FormatoFecha): Promise<void> {
  try {
    await AsyncStorage.setItem('formato_fecha', formato);
  } catch {}
}

export async function formatearFecha(fecha: string | Date): Promise<string> {
  try {
    const formato = await getFormatoFecha();
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
    
    if (formato === 'DD/MM/YYYY') {
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const año = date.getFullYear();
      return `${dia}/${mes}/${año}`;
    } else {
      const año = date.getFullYear();
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const dia = String(date.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    }
  } catch {
    return typeof fecha === 'string' ? fecha : fecha.toISOString().split('T')[0];
  }
}