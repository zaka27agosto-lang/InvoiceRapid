import { useRef } from 'react';
import { Dimensions } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';

const { width: screenWidth } = Dimensions.get('window');
const EDGE_THRESHOLD = 30; // 30px desde el borde

interface SwipeNavigationProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  activeOffsetX?: [number, number];
}

export default function SwipeNavigation({ children, onSwipeLeft, onSwipeRight, activeOffsetX }: SwipeNavigationProps) {
  const gestureRef = useRef(null);
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
        // Umbral para considerar swipe válido (mínimo 50px de desplazamiento)
        const SWIPE_THRESHOLD = 50;
        
        if (translationX > SWIPE_THRESHOLD && startedFromLeftEdge && onSwipeRight) {
          // Swipe hacia la derecha desde el borde izquierdo
          onSwipeRight();
        } else if (translationX < -SWIPE_THRESHOLD && startedFromRightEdge && onSwipeLeft) {
          // Swipe hacia la izquierda desde el borde derecho
          onSwipeLeft();
        }
      }
    }
  };

  return (
    <PanGestureHandler
      ref={gestureRef}
      onGestureEvent={handleGesture}
      activeOffsetX={activeOffsetX ?? [-40, 40]}
      failOffsetY={[-10, 10]}
      minDist={10}
    >
      {children}
    </PanGestureHandler>
  );
}
