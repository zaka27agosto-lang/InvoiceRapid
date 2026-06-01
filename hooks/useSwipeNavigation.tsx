import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Dimensions } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';

const { width: screenWidth } = Dimensions.get('window');
const EDGE_THRESHOLD = 30; // 30px desde el borde
const SWIPE_THRESHOLD = 50; // Mínimo 50px de desplazamiento

// Definir el orden de las tabs para navegación
const tabOrder = ['/(tabs)/index', '/(tabs)/documentos', '/(tabs)/clientes', '/(tabs)/productos', '/(tabs)/informes', '/(tabs)/ajustes'];

export function useSwipeNavigation(currentPath: string) {
  const router = useRouter();
  const startX = useRef(0);

  const handleGesture = (event: PanGestureHandlerGestureEvent) => {
    const { translationX, absoluteX, state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      // Guardar la posición inicial cuando comienza el gesto
      if (startX.current === 0) {
        startX.current = absoluteX - translationX;
      }
    }
    
    if (state === State.END) {
      // Detectar si el gesto comenzó desde el borde izquierdo o derecho
      const startedFromLeftEdge = startX.current <= EDGE_THRESHOLD;
      const startedFromRightEdge = startX.current >= screenWidth - EDGE_THRESHOLD;
      
      // Resetear la posición inicial
      startX.current = 0;
      
      // Solo procesar si el gesto comenzó desde un borde
      if (startedFromLeftEdge || startedFromRightEdge) {
        if (translationX > SWIPE_THRESHOLD && startedFromLeftEdge) {
          // Swipe hacia la derecha desde el borde izquierdo - navegar a la tab anterior
          navigateToPreviousTab(currentPath);
        } else if (translationX < -SWIPE_THRESHOLD && startedFromRightEdge) {
          // Swipe hacia la izquierda desde el borde derecho - navegar a la siguiente tab
          navigateToNextTab(currentPath);
        }
      }
    }
  };

  const navigateToNextTab = (path: string) => {
    const currentIndex = tabOrder.indexOf(path);
    
    if (currentIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentIndex + 1];
      router.push(nextTab as any);
    }
  };

  const navigateToPreviousTab = (path: string) => {
    const currentIndex = tabOrder.indexOf(path);
    
    if (currentIndex > 0) {
      const prevTab = tabOrder[currentIndex - 1];
      router.push(prevTab as any);
    }
  };

  return {
    handleGesture,
    PanGestureHandler
  };
}
