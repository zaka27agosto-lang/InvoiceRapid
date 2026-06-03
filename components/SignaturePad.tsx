import React, { useRef, useCallback, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface SignaturePadProps {
  onSignatureChange: (signatureData: string | null) => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
  primaryColor?: string;
  width?: number;
  height?: number;
}

const SIGNATURE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; touch-action: none; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="sigCanvas"></canvas>
  <script>
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let hasSignature = false;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }

    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      isDrawing = true;
      hasSignature = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'drawStart' }));
    });

    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!isDrawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    });

    canvas.addEventListener('touchend', function(e) {
      e.preventDefault();
      if (!isDrawing) return;
      isDrawing = false;
      const dataUrl = canvas.toDataURL('image/png');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'drawEnd' }));
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: dataUrl }));
    });

    canvas.addEventListener('touchcancel', function(e) {
      e.preventDefault();
      if (!isDrawing) return;
      isDrawing = false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'drawEnd' }));
    });

    function clearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasSignature = false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cleared' }));
    }

    // Listen for clear command from React Native
    document.addEventListener('message', function(e) {
      if (e.data === 'clear') clearCanvas();
    });
  </script>
</body>
</html>
`;

export function SignaturePad({ onSignatureChange, onDrawStart, onDrawEnd, primaryColor = '#6C47FF', width = 300, height = 150 }: SignaturePadProps) {
  const { t } = useTranslation();
  const webViewRef = useRef<WebView>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'signature' && msg.data) {
        setSignatureData(msg.data);
        onSignatureChange(msg.data);
      } else if (msg.type === 'cleared') {
        setSignatureData(null);
        onSignatureChange(null);
      } else if (msg.type === 'drawStart') {
        onDrawStart?.();
      } else if (msg.type === 'drawEnd') {
        onDrawEnd?.();
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [onSignatureChange, onDrawStart, onDrawEnd]);

  const handleClear = useCallback(() => {
    webViewRef.current?.postMessage('clear');
    setSignatureData(null);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <View style={styles.container}>
      <View style={[styles.canvasContainer, { width, height, borderColor: primaryColor }]}>
        {loading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={primaryColor} />
          </View>
        )}
        {error ? (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle-outline" size={24} color="#FF4757" />
            <Text style={styles.errorText}>{t('error_cargar_firma')}</Text>
            <TouchableOpacity onPress={() => { setError(false); setLoading(true); }} style={[styles.retryBtn, { borderColor: primaryColor }]}>
              <Text style={[styles.retryBtnText, { color: primaryColor }]}>{t('reintentar')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <WebView
          ref={webViewRef}
          source={{ html: SIGNATURE_HTML }}
          style={[styles.webview, { width, height }]}
          onMessage={handleMessage}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />
        )}
      </View>
      {signatureData ? (
        <TouchableOpacity style={[styles.clearBtn, { borderColor: primaryColor }]} onPress={handleClear}>
          <Ionicons name="close-circle-outline" size={16} color={primaryColor} />
          <Text style={[styles.clearBtnText, { color: primaryColor }]}>{t('borrar_firma')}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.hintText}>{t('firma_aqui')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  canvasContainer: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  webview: {
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: '#fafafa',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: '#fafafa',
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#FF4757',
    fontWeight: '600',
  },
  retryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: '#aaa',
    fontStyle: 'italic',
  },
});
