import { useWindowDimensions } from 'react-native';

/** Ancho lógico de referencia: Xiaomi Redmi Note 8 (~392px lógicos) */
const REF_WIDTH = 390;

/**
 * Hook que devuelve funciones para escalar tamaños proporcionalmente
 * según el ancho del dispositivo vs la referencia (Xiaomi Redmi Note 8).
 */
export function useScale() {
  const { width } = useWindowDimensions();
  const scale = width / REF_WIDTH;

  /** Escalar un valor de espacio/tamaño (paddings, márgenes, iconos...) */
  function s(value: number): number {
    return Math.round(value * scale);
  }

  /** Escalar un valor de fuente (más suave para no deformar texto) */
  function fs(value: number): number {
    return Math.round(value * (0.5 + scale * 0.5));
  }

  return { scale, s, fs };
}
