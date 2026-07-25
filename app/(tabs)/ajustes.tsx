import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { AuthModal } from "../../components/AuthModal";
import { useAuth } from "../../contexts/AuthContext";
import { useModernAlert } from "../../components/ModernAlert";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { supabase } from "../../services/supabase";
import { adsService } from "../../services/adsService";
import SwipeNavigation from "../../components/SwipeNavigation";
import { generarPDFPreview } from "../../utils/pdf";
import Pdf from 'react-native-pdf';
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { getFacturaItems, getFacturas } from "../db/facturas";
import { getClientes } from "../db/clientes";
import { getProductos } from "../db/productos";

import {
  DatosEmpresa,
  DEFAULT_NUMERACION,
  FormatoFecha,
  getDatosEmpresa, getFormatoFecha, getMoneda, getNumeracionConfig, getPlantillaPDF,
  Moneda, MONEDAS,
  NumeracionConfig,
  PlantillaPDF,
  PLANTILLAS_PDF,
  setDatosEmpresa, setFormatoFecha, setMoneda, setNumeracionConfig, setPlantillaPDF
} from "../../utils/settings";
import { PrimaryColor, primaryColors } from "../../utils/themes";

export default function Ajustes() {
  const { t, i18n } = useTranslation();
  const { isPremium, offerings, comprar, restaurar } = useSubscription();
  const modernAlert = useModernAlert();
  const { currentTheme, primaryColor, mode, setPrimaryColor, setMode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user, requireAuth, showAuthModal, handleCloseModal, handleLogin, handleRegister, handleGoogleSignIn, executePendingAction } = useAuthGuard();
  const { signOut } = useAuth();
  const [mostrarPaywall, setMostrarPaywall] = useState(false);
  const [mostrarDatos, setMostrarDatos] = useState(false);
  const [mostrarMoneda, setMostrarMoneda] = useState(false);
  const [mostrarPlantilla, setMostrarPlantilla] = useState(false);
  const [mostrarTemas, setMostrarTemas] = useState(false);
  const [mostrarIdiomas, setMostrarIdiomas] = useState(false);
  const [mostrarNumeracion, setMostrarNumeracion] = useState(false);
  const [numeracionConfig, setNumeracionConfigState] = useState<NumeracionConfig>(DEFAULT_NUMERACION);
  const [comprando, setComprando] = useState(false);
  const [monedaActual, setMonedaActual] = useState<Moneda>(MONEDAS[0]);
  const [plantillaActual, setPlantillaActual] = useState<PlantillaPDF>('default');
  const [formatoFechaActual, setFormatoFechaActual] = useState<FormatoFecha>('DD/MM/YYYY');
  const [datos, setDatos] = useState<DatosEmpresa>({
    nombre: '', nif: '', direccion: '', telefono: '', email: ''
  });
  const [planSeleccionado, setPlanSeleccionado] = useState<any>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [mostrarPreviewPdf, setMostrarPreviewPdf] = useState(false);

  const tabOrder = ['/(tabs)/index', '/(tabs)/documentos', '/(tabs)/clientes', '/(tabs)/productos', '/(tabs)/informes', '/(tabs)/ajustes'];

  const navigateToNextTab = () => {
    const currentIndex = tabOrder.indexOf('/(tabs)/ajustes');
    if (currentIndex < tabOrder.length - 1) {
      router.push(tabOrder[currentIndex + 1] as any);
    }
  };

  const navigateToPreviousTab = () => {
    const currentIndex = tabOrder.indexOf('/(tabs)/ajustes');
    if (currentIndex > 0) {
      router.push(tabOrder[currentIndex - 1] as any);
    }
  };

  useFocusEffect(() => {
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  });

  useEffect(() => {
    getMoneda().then(setMonedaActual);
    getDatosEmpresa().then(setDatos);
    getPlantillaPDF().then(setPlantillaActual);
    getFormatoFecha().then(setFormatoFechaActual);
    getNumeracionConfig().then(setNumeracionConfigState);
    if (params.paywall === 'true') {
      setMostrarPaywall(true);
    }
  }, [params.paywall]); 

  useEffect(() => {
    executePendingAction();
  }, [executePendingAction, user]);

  async function handleComprar(pkg: any) {
    setComprando(true);
    const result = await comprar(pkg);
    setComprando(false);
    if (result.success) {
      setMostrarPaywall(false);
      modernAlert.showSuccess('✨ ' + t('bienvenida_premium'), t('acceso_premium'));
    } else if (!result.cancelled) {
      modernAlert.showError(t('error'), result.error || 'Error al procesar la compra')
    }
  }

  async function handleRestaurar() {
    // Primera vez: mostrar explicación de qué hace restaurar compras
    const haVistoInfo = await AsyncStorage.getItem('ha_visto_restore_info');
    if (haVistoInfo !== 'true') {
      await AsyncStorage.setItem('ha_visto_restore_info', 'true');
      modernAlert.showAlert({
        title: t('restaurar_compras'),
        message: t('restaurar_compras_info'),
        buttons: [
          { text: t('cancelar'), style: 'cancel' },
          { text: t('confirmar'), onPress: async () => {
            const result = await restaurar();
            if (result.isPremium) {
              modernAlert.showSuccess('✅', t('compra_restaurada'));
            } else {
              modernAlert.showError(t('info'), t('no_compras_previas'));
            }
          }}
        ]
      });
      return;
    }
    // Usuario ya sabe: restaurar directamente
    const result = await restaurar();
    if (result.isPremium) {
      modernAlert.showSuccess('✅', t('compra_restaurada'))
    } else {
      modernAlert.showError(t('info'), t('no_compras_previas'));
    }
  }

  async function handleGuardarDatos() {
    await setDatosEmpresa(datos);
    modernAlert.showSuccess('✅', t('datos_guardados'))
    setMostrarDatos(false);
  }

  async function handleSeleccionarMoneda(moneda: Moneda) {
    await setMoneda(moneda);
    setMonedaActual(moneda);
    setMostrarMoneda(false);
  }

  async function handleSeleccionarPlantilla(plantilla: PlantillaPDF) {
    await setPlantillaPDF(plantilla);
    setPlantillaActual(plantilla);
    setMostrarPlantilla(false);
  }

  async function handlePreviewPlantilla(plantilla: PlantillaPDF) {
    try {
      const facturaPreview = {
        id: 0,
        numero: 'PREVIEW-001',
        cliente_id: 0,
        cliente_nombre: 'Cliente Ejemplo',
        subtotal: 850,
        descuento: 0,
        iva_porcentaje: 21,
        iva_importe: 178.5,
        irpf_porcentaje: 0,
        irpf_importe: 0,
        total: 1028.5,
        notas: '',
        metodo_pago: 'efectivo',
        fecha_vencimiento: '',
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        cliente_email: 'cliente@email.com',
        cliente_direccion: 'Calle Ejemplo 123',
      };
      const itemsPreview = [
        { descripcion: 'Servicio de consultoría', cantidad: '10', unidad: 'h', precio_unitario: '50', descuento: '0', subtotal: 500 },
        { descripcion: 'Desarrollo web', cantidad: '1', unidad: 'ud', precio_unitario: '350', descuento: '0', subtotal: 350 },
      ];
      const uri = await generarPDFPreview(facturaPreview, itemsPreview, true, plantilla, '€', currentTheme.colors.primary);
      if (uri) {
        setPreviewUri(uri);
        setMostrarPreviewPdf(true);
      }
    } catch {
      modernAlert.showError(t('error'), t('no_se_pudo_generar_pdf'))
    }
  }

  async function handleExportData() {
    try {
      // 1. Datos locales
      let facturas = getFacturas();
      let clientes = getClientes();
      let productos = getProductos();
      let datosSupabase = false;

      // 2. Intentar obtener datos desde Supabase para exportación completa
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: facturasRemotas } = await supabase
              .from('facturas')
              .select('*')
              .eq('user_id', session.user.id);
            
            const { data: clientesRemotos } = await supabase
              .from('clientes')
              .select('*')
              .eq('user_id', session.user.id);

            const { data: productosRemotos } = await supabase
              .from('productos')
              .select('*')
              .eq('user_id', session.user.id);

            if (facturasRemotas || clientesRemotos || productosRemotos) {
              datosSupabase = true;
              // Combinar: los datos remotos tienen prioridad (source of truth)
              // pero mantenemos datos locales que no estén en remoto (pendientes de sync)
              const idsRemotos = new Set((facturasRemotas || []).map((f: any) => f.id));
              const localesNoSync = facturas.filter((f: any) => !idsRemotos.has(f.id));
              facturas = [...(facturasRemotas || []), ...localesNoSync];

              const clientesIdsRemotos = new Set((clientesRemotos || []).map((c: any) => c.id));
              const clientesLocalesNoSync = clientes.filter((c: any) => !clientesIdsRemotos.has(c.id));
              clientes = [...(clientesRemotos || []), ...clientesLocalesNoSync];

              const productosIdsRemotos = new Set((productosRemotos || []).map((p: any) => p.id));
              const productosLocalesNoSync = productos.filter((p: any) => !productosIdsRemotos.has(p.id));
              productos = [...(productosRemotos || []), ...productosLocalesNoSync];
            }
          }
        } catch {
          // Si falla la conexión, usar solo datos locales
        }
      }

      // 3. Generar HTML con items de cada factura
      const facturasConLineas = facturas.map(f => {
        // Intentar items locales, luego remotos
        let items = getFacturaItems(f.id) as any[];
        if (items.length === 0 && f.items) {
          items = f.items;
        }
        const itemsHtml = items.length > 0
          ? `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;margin:8px 0;"><tr><th>Descripción</th><th>Cant.</th><th>Ud.</th><th>P.Unit.</th><th>Desc.</th><th>Subtotal</th></tr>${items.map(it => `<tr><td>${it.descripcion}</td><td>${it.cantidad}</td><td>${it.unidad}</td><td>${Number(it.precio_unitario).toFixed(2)}${monedaActual.simbolo}</td><td>${Number(it.descuento).toFixed(2)}${monedaActual.simbolo}</td><td>${Number(it.subtotal).toFixed(2)}${monedaActual.simbolo}</td></tr>`).join('')}</table>`
          : '<p style="color:#888;">Sin líneas</p>';
        return `
          <li style="margin-bottom:16px;">
            <strong>${f.numero}</strong> - ${f.cliente_nombre || 'Sin cliente'} - Total: ${Number(f.total).toFixed(2)}${monedaActual.simbolo} - Estado: ${f.estado}
            <br><small>Fecha: ${new Date(f.fecha || f.created_at || '').toLocaleDateString('es-ES')} | Método: ${f.metodo_pago || '-'}</small>
            ${itemsHtml}
          </li>`;
      }).join('');
      
      const html = `
        <html><body style="font-family: sans-serif; padding: 20px;">
        <h1 style="color: ${currentTheme.colors.primary};">Exportación de datos (RGPD)</h1>
        <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
        <p><strong>Incluye datos del servidor:</strong> ${datosSupabase ? 'Sí' : 'No (solo locales)'}</p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />
        <h2>Configuración</h2>
        <p>Moneda: ${monedaActual.simbolo} (${monedaActual.codigo})</p>
        <p>Plantilla: ${plantillaActual}</p>
        <h2>Datos de empresa</h2>
        <p>Nombre: ${datos.nombre || '-'}<br>NIF: ${datos.nif || '-'}<br>Dirección: ${datos.direccion || '-'}<br>Tel: ${datos.telefono || '-'}<br>Email: ${datos.email || '-'}</p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />
        <h2>Facturas (${facturas.length})</h2>
        <ul>${facturas.length > 0 ? facturasConLineas : '<li>Sin facturas</li>'}</ul>
        <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />
        <h2>Clientes (${clientes.length})</h2>
        <ul>${clientes.map((c: any) => `<li>${c.nombre}${c.email ? ' - ' + c.email : ''}${c.telefono || c.telefono ? ' - Tel: ' + (c.telefono || '') : ''}${c.direccion ? ' - ' + c.direccion : ''}</li>`).join('') || '<li>Sin clientes</li>'}</ul>
        <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />
        <h2>Productos (${productos.length})</h2>
        <ul>${productos.map((p: any) => `<li>${p.descripcion} - ${p.precio}${monedaActual.simbolo} / ${p.unidad}</li>`).join('') || '<li>Sin productos</li>'}</ul>
        <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />
        <p style="font-size:11px;color:#888;">
          Datos exportados desde InvoiceRapid Pro. ${datosSupabase ? 'Incluye datos sincronizados con el servidor.' : 'Solo datos locales. Conéctate a internet para incluir datos del servidor.'}
        </p>
        </body></html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      let compartido = false;
      if (await Sharing.isAvailableAsync()) {
        try {
          await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf', dialogTitle: 'Exportar datos' });
          compartido = true;
        } catch (_) {
          // Usuario canceló el share — no mostrar éxito
        }
      }
      if (compartido) {
        modernAlert.showSuccess('✅', t('datos_exportados'))
      }
    } catch {
      modernAlert.showError(t('error'), t('error_exportar_datos'))
    }
  }

  async function handleDeleteAccount() {
    // Step 1: Explicación del proceso con período de gracia de 30 días
    modernAlert.showAlert({
      title: t('confirmar_eliminar_titulo'),
      message: t('confirmar_eliminar_desc') + '\n\n' + t('plazo_30_dias'),
      buttons: [
        { text: t('cancelar'), style: 'cancel' },
        {
          text: t('borrar'),
          style: 'destructive',
          onPress: () => {
            // Step 2: Doble confirmación
            modernAlert.showAlert({
              title: t('confirmar_eliminar_titulo'),
              message: t('confirmar_eliminar_final'),
              buttons: [
                { text: t('cancelar'), style: 'cancel' },
                {
                  text: t('borrar_definitivamente'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      if (!supabase) {
                        modernAlert.showError(t('error'), t('aviso_sin_conexion'));
                        return;
                      }

                      const { data: { session } } = await supabase.auth.getSession();
                      const accessToken = session?.access_token;

                      if (!accessToken) {
                        modernAlert.showError(t('error'), t('aviso_sesion_expirada'));
                        return;
                      }

                      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 10000);
                      const response = await fetch(
                        `${supabaseUrl}/functions/v1/delete-account`,
                        {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                          },
                          signal: controller.signal,
                        }
                      );
                      clearTimeout(timeoutId);

                      if (!response.ok) {
                        const body = await response.json().catch(() => ({}));
                        throw new Error((body as any).error || 'Error del servidor');
                      }

                      // Mostrar confirmación ANTES de cerrar sesión — título CORTO
                      modernAlert.showAlert({
                        title: t('cuenta_eliminada_titulo'),
                        message: t('cuenta_marcada_eliminacion'),
                        buttons: [
                          {
                            text: t('volver'),
                            onPress: async () => {
                              // Cerrar sesión sin borrar datos locales (período de gracia)
                              await signOut();
                            }
                          }
                        ]
                      });
                    } catch (error: any) {
                      modernAlert.showError(t('error'), t('error_eliminar_cuenta') + ': ' + (error.message || ''));
                    }
                  }
                }
              ]
            });
          }
        }
      ]
    });
  }

  async function handleChangeConsent() {
    // 1. Intentar con el formulario UMP de Google (disponible en EEE)
    const umpOk = await adsService.showPrivacyOptions();
    if (umpOk) {
      modernAlert.showSuccess('✅', t('consentimiento_actualizado'));
      return;
    }

    // 2. Si UMP no está disponible (fuera de EEE), ofrecer elección manual
    modernAlert.showAlert({
      title: t('consentimiento_anuncios'),
      message: t('consentimiento_pregunta') + '\n\n' + t('consentimiento_pregunta_sub'),
      buttons: [
        { text: t('consentimiento_no'), style: 'cancel', onPress: async () => {
          await adsService.setConsentManually(false);
          modernAlert.showSuccess('✅', t('consentimiento_actualizado'));
        }},
        { text: t('consentimiento_si'), onPress: async () => {
          await adsService.setConsentManually(true);
          modernAlert.showSuccess('✅', t('consentimiento_actualizado'));
        }},
      ]
    });
  }

  const idiomaActual = i18n.language;

  const idiomas = [
    { code: 'es', nombre: 'Español' },
    { code: 'en', nombre: 'English' },
    { code: 'fr', nombre: 'Français' },
    { code: 'de', nombre: 'Deutsch' },
    { code: 'it', nombre: 'Italiano' },
  ];

  const idiomaSeleccionado = idiomas.find(i => i.code === idiomaActual)?.nombre || idiomaActual;

  return (
    <SwipeNavigation onSwipeLeft={navigateToNextTab} onSwipeRight={navigateToPreviousTab}>
    <View style={[styles.wrapper, { backgroundColor: currentTheme.colors.background }]}>
        <ScrollView ref={scrollViewRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.titulo, { color: currentTheme.colors.text }]}>{t('ajustes_titulo')}</Text>

        {/* Banner premium */}
        {!isPremium ? (
          <TouchableOpacity style={[styles.premiumBanner, { backgroundColor: currentTheme.colors.primary }]} onPress={() => requireAuth(() => setMostrarPaywall(true))}>
            <View style={styles.premiumBannerLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="diamond-outline" size={20} color="#fff" />
                <Text style={styles.premiumBannerTitulo}>{t('unlock_premium')}</Text>
              </View>
              <Text style={styles.premiumBannerSub}>{t('facturas_ilimitadas')} · {t('pdf_sin_marca')} · {t('sin_anuncios')}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.premiumBanner, { backgroundColor: currentTheme.colors.card }]}>
            <View style={styles.premiumBannerLeft}>
              <Text style={[styles.premiumBannerTitulo, { color: currentTheme.colors.text }]}>{t('plan_premium')}</Text>
              <Text style={[styles.premiumBannerSub, { color: currentTheme.colors.textSecondary }]}>{t('funciones_desbloqueadas')}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={28} color="#26de81" />
          </View>
        )}

        {/* Idioma */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('idioma')}</Text>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarIdiomas(true)}>
            <Ionicons name="language-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('idioma')}</Text>
            <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{idiomaSeleccionado}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Configuración */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('configuracion')}</Text>

          {/* Moneda */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarMoneda(true)}>
            <Ionicons name="cash-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('moneda')}</Text>
            <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{monedaActual.simbolo} {monedaActual.codigo}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Mis datos */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarDatos(true)}>
            <Ionicons name="business-outline" size={20} color={currentTheme.colors.primary} />
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('mis_datos')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Numeración personalizable */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => {
            getNumeracionConfig().then(setNumeracionConfigState);
            setMostrarNumeracion(true);
          }}>
            <Ionicons name="pricetags-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('numeracion')}</Text>
            <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{numeracionConfig.prefijo}XX{numeracionConfig.sufijo}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Formato de fecha */}
          <TouchableOpacity style={styles.opcionBoton} onPress={() => {
            const nuevoFormato = formatoFechaActual === 'DD/MM/YYYY' ? 'YYYY-MM-DD' : 'DD/MM/YYYY';
            setFormatoFecha(nuevoFormato);
            setFormatoFechaActual(nuevoFormato);
            modernAlert.showSuccess('✅', t('formato_fecha_actualizado'))
          }}>
            <Ionicons name="calendar-outline" size={20} color={currentTheme.colors.primary} />
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('formato_fecha')}</Text>
              <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{formatoFechaActual}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Plantilla PDF (solo premium) */}
          {isPremium && (
            <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarPlantilla(true)}>
              <Ionicons name="document-text-outline" size={20} color={currentTheme.colors.primary} />
              <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('plantilla_pdf')}</Text>
              <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{PLANTILLAS_PDF.find(p => p.id === plantillaActual)?.nombre || t('estandar')}</Text>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Tema (solo premium) */}
          {isPremium && (
            <TouchableOpacity style={styles.opcionBoton} onPress={() => setMostrarTemas(true)}>
              <Ionicons name="color-palette-outline" size={20} color={currentTheme.colors.primary} />
              <View style={{ flexDirection: 'row', flex: 1 }}>
                <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('tema')}</Text>
                <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>{t(primaryColor)} - {t(mode)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
            </TouchableOpacity>
          )}

        </View>

        {/* Suscripción */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('suscripcion_label')}</Text>
          <View style={styles.opcion}>
            <Ionicons name="star-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('plan_actual_label')}</Text>
            <Text style={[styles.opcionValor, isPremium && { color: currentTheme.colors.primary }, { color: currentTheme.colors.textSecondary }]}>
              {isPremium ? 'Premium' : 'Gratis'}
            </Text>
          </View>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => requireAuth(handleRestaurar)}>
            <Ionicons name="refresh-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('restaurar_compras')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => { Linking.openURL('https://play.google.com/store/account/subscriptions'); }}>
            <Ionicons name="settings-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('gestionar_suscripcion')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Cuenta */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('cuenta')}</Text>
          <TouchableOpacity style={styles.opcionBoton} onPress={() => router.push('/auth/profile')}>
            <Ionicons name="person-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('mi_perfil')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.opcion}>
            <Ionicons name="information-circle-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('version')}</Text>
            <Text style={[styles.opcionValor, { color: currentTheme.colors.textSecondary }]}>1.0.0</Text>
          </View>
        </View>

        {/* Seguridad */}
        <View style={[styles.seccion, { backgroundColor: currentTheme.colors.card }]}>
          <Text style={[styles.seccionTitulo, { color: currentTheme.colors.textSecondary }]}>{t('privacidad_datos')}</Text>
          

          
          <TouchableOpacity style={styles.opcionBoton} onPress={() => router.push('/legal/privacy')}>
            <Ionicons name="document-text-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('politica_privacidad')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcionBoton} onPress={() => router.push('/legal/terms')}>
            <Ionicons name="reader-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('terminos_condiciones')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcionBoton} onPress={() => router.push('/legal/cookies')}>
            <Ionicons name="cafe-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('politica_cookies')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcionBoton} onPress={() => router.push('/legal')}>
            <Ionicons name="shield-checkmark-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('legal')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.opcionBoton} onPress={() => requireAuth(handleExportData)}>
            <Ionicons name="download-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('exportar_datos_label')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcionBoton} onPress={() => requireAuth(handleDeleteAccount)}>
            <Ionicons name="trash-outline" size={20} color="#FF4757" />
            <Text style={[styles.opcionTexto, { color: '#FF4757' }]}>{t('borrar_cuenta')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.opcionBoton} onPress={handleChangeConsent}>
            <Ionicons name="shield-outline" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.opcionTexto, { color: currentTheme.colors.text }]}>{t('consentimiento_anuncios')}</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
        </ScrollView>

      {/* Modal Numeración */}
      <Modal visible={mostrarNumeracion} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarNumeracion(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('numeracion')}</Text>
            <TouchableOpacity onPress={async () => {
              await setNumeracionConfig(numeracionConfig);
              modernAlert.showSuccess('✅', t('numeracion_guardada'))
              setMostrarNumeracion(false);
            }}>
              <Text style={styles.modalGuardar}>{t('guardar')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <View style={styles.campoWrapper}>
              <Text style={styles.campoLabel}>{t('numeracion_prefijo')}</Text>
              <TextInput
                style={styles.campoInput}
                placeholder="F-"
                placeholderTextColor="#bbb"
                value={numeracionConfig.prefijo}
                onChangeText={v => setNumeracionConfigState(prev => ({ ...prev, prefijo: v }))}
              />
            </View>
            <View style={styles.campoWrapper}>
              <Text style={styles.campoLabel}>{t('numeracion_sufijo')}</Text>
              <TextInput
                style={styles.campoInput}
                placeholder="/2024"
                placeholderTextColor="#bbb"
                value={numeracionConfig.sufijo}
                onChangeText={v => setNumeracionConfigState(prev => ({ ...prev, sufijo: v }))}
              />
            </View>
            <View style={styles.campoWrapper}>
              <Text style={styles.campoLabel}>{t('numeracion_digitos')}</Text>
              <View style={styles.ivaOpciones}>
                {[3, 4, 5, 6].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.ivaBtn, numeracionConfig.digitos === d && { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.primary }]}
                    onPress={() => setNumeracionConfigState(prev => ({ ...prev, digitos: d }))}
                  >
                    <Text style={[styles.ivaBtnTexto, numeracionConfig.digitos === d && styles.ivaBtnTextoActivo]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[styles.seccion, { marginTop: 16 }]}>
              <Text style={{ fontSize: 14, color: '#888', textAlign: 'center' }}>
                {t('numeracion_vista_previa')}: <Text style={{ fontWeight: '700', color: '#1a1a1a' }}>{numeracionConfig.prefijo}{String(1).padStart(numeracionConfig.digitos, '0')}{numeracionConfig.sufijo}</Text>
              </Text>
            </View>
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Mis Datos */}
      <Modal visible={mostrarDatos} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarDatos(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('mis_datos_titulo')}</Text>
            <TouchableOpacity onPress={handleGuardarDatos}>
              <Text style={styles.modalGuardar}>{t('guardar')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            {[
              { key: 'nombre', label: t('nombre_empresa'), placeholder: 'Autónomo / Mi Empresa S.L.' },
              { key: 'nif', label: t('nif'), placeholder: 'B12345678' },
              { key: 'direccion', label: t('dir_fiscal'), placeholder: 'Calle Mayor 1, Madrid' },
              { key: 'telefono', label: t('telefono_empresa'), placeholder: '+34 600 000 000' },
              { key: 'email', label: t('email_empresa'), placeholder: 'contacto@empresa.com' },
            ].map(campo => (
              <View key={campo.key} style={styles.campoWrapper}>
                <Text style={styles.campoLabel}>{campo.label}</Text>
                <TextInput
                  style={styles.campoInput}
                  placeholder={campo.placeholder}
                  placeholderTextColor="#bbb"
                  value={(datos as any)[campo.key]}
                  onChangeText={v => setDatos((prev: DatosEmpresa) => ({ ...prev, [campo.key]: v }))}
                />
              </View>
            ))}
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Moneda */}
      <Modal visible={mostrarMoneda} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarMoneda(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('moneda')}</Text>
            <View style={{ width: 40 }} />
          </View>
          {MONEDAS.map((m: Moneda) => (
            <TouchableOpacity
              key={m.codigo}
              style={styles.monedaItem}
              onPress={() => handleSeleccionarMoneda(m)}
            >
              <Text style={styles.monedaSimbolo}>{m.simbolo}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.monedaNombre}>{m.nombre}</Text>
                <Text style={styles.monedaCodigo}>{m.codigo}</Text>
              </View>
              {monedaActual.codigo === m.codigo && (
                <Ionicons name="checkmark-circle" size={22} color={currentTheme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Modal Plantilla PDF */}
      <Modal visible={mostrarPlantilla} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarPlantilla(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('modal_plantilla_pdf')}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            {PLANTILLAS_PDF.map((plantilla) => (
              <TouchableOpacity
                key={plantilla.id}
                style={[
                  styles.plantillaItem,
                  plantillaActual === plantilla.id && styles.plantillaItemActivo
                ]}
                onPress={() => handleSeleccionarPlantilla(plantilla.id)}
              >
                <View style={styles.plantillaIcono}>
                  <Ionicons name="document-text-outline" size={24} color={plantillaActual === plantilla.id ? currentTheme.colors.primary : "#999"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.plantillaNombre, plantillaActual === plantilla.id && styles.plantillaNombreActivo]}>
                    {plantilla.nombre}
                  </Text>
                  <Text style={styles.plantillaDescripcion}>{plantilla.descripcion}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.plantillaIcono, { backgroundColor: currentTheme.colors.primaryLight }]}
                  onPress={() => handlePreviewPlantilla(plantilla.id)}
                >
                  <Ionicons name="eye-outline" size={20} color={currentTheme.colors.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Temas */}
      <Modal visible={mostrarTemas} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarTemas(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('tema')}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            {/* Toggle Modo Oscuro/Claro */}
            <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12 }}>{t('modo')}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[
                    { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#e8e8e8', backgroundColor: '#fafafa', alignItems: 'center' },
                    mode === 'light' && { borderColor: currentTheme.colors.primary, backgroundColor: currentTheme.colors.primaryLight }
                  ]}
                  onPress={async () => {
                    await setMode('light');
                  }}
                >
                  <Ionicons name="sunny-outline" size={20} color={mode === 'light' ? currentTheme.colors.primary : '#999'} />
                  <Text style={[{ fontSize: 15, fontWeight: '600', marginTop: 4 }, mode === 'light' && { color: currentTheme.colors.primary }]}>
                    {t('light')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#e8e8e8', backgroundColor: '#fafafa', alignItems: 'center' },
                    mode === 'dark' && { borderColor: currentTheme.colors.primary, backgroundColor: currentTheme.colors.primaryLight }
                  ]}
                  onPress={async () => {
                    await setMode('dark');
                  }}
                >
                  <Ionicons name="moon-outline" size={20} color={mode === 'dark' ? currentTheme.colors.primary : '#999'} />
                  <Text style={[{ fontSize: 15, fontWeight: '600', marginTop: 4 }, mode === 'dark' && { color: currentTheme.colors.primary }]}>
                    {t('dark')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selección de Color */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12, paddingHorizontal: 4 }}>{t('color_principal')}</Text>
            {(Object.keys(primaryColors) as PrimaryColor[]).map((colorName) => (
              <TouchableOpacity
                key={colorName}
                style={[
                  styles.plantillaItem,
                  primaryColor === colorName && styles.plantillaItemActivo
                ]}
                onPress={async () => {
                  await setPrimaryColor(colorName);
                }}
              >
                <View style={[styles.plantillaIcono, { backgroundColor: primaryColors[colorName].color + '20' }]}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: primaryColors[colorName].color }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.plantillaNombre, primaryColor === colorName && { color: currentTheme.colors.primary }]}>
                    {t(colorName)}
                  </Text>
                </View>
                {primaryColor === colorName && (
                  <Ionicons name="checkmark-circle" size={22} color={currentTheme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Idiomas */}
      <Modal visible={mostrarIdiomas} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalWrapper}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMostrarIdiomas(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.modalTitulo}>{t('idioma')}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ padding: 20 }}>
            {idiomas.map((idioma) => (
              <TouchableOpacity
                key={idioma.code}
                style={[
                  styles.monedaItem,
                  idiomaActual === idioma.code && styles.monedaItemActivo
                ]}
                onPress={async () => {
                  await i18n.changeLanguage(idioma.code as any);
                  await AsyncStorage.setItem('idioma', idioma.code);
                  setMostrarIdiomas(false);
                }}
              >
                <Text style={styles.idiomaNombre}>{idioma.nombre}</Text>
                {idiomaActual === idioma.code && (
                  <Ionicons name="checkmark-circle" size={22} color="#6C47FF" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Paywall */}
      <Modal visible={mostrarPaywall} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.paywallWrapper}>
          <View style={styles.paywallHeader}>
            <TouchableOpacity onPress={() => setMostrarPaywall(false)}>
              <Ionicons name="close" size={26} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.paywallTop}>
              <View style={styles.paywallIcono}>
                <Ionicons name="rocket" size={36} color={currentTheme.colors.primary} />
              </View>
              <Text style={styles.paywallTitulo}>{t('premium_titulo')}</Text>
              <Text style={styles.paywallSub}>{t('premium_sub')}</Text>
            </View>

            {[
              { icon: 'infinite-outline', texto: t('facturas_ilimitadas') },
              { icon: 'document-text-outline', texto: t('pdf_sin_marca') },
              { icon: 'image-outline', texto: t('logo_personalizado') },
              { icon: 'color-palette-outline', texto: t('plantillas_premium') },
              { icon: 'ban-outline', texto: t('sin_anuncios') },
            ].map((f, i) => (
              <View key={i} style={styles.feature}>
                <View style={styles.featureIcono}>
                  <Ionicons name={f.icon as any} size={20} color={currentTheme.colors.primary} />
                </View>
                <Text style={styles.featureTexto}>{f.texto}</Text>
                <Ionicons name="checkmark" size={18} color="#26de81" />
              </View>
            ))}

            <View style={styles.planesContainer}>
              {offerings?.availablePackages?.map((pkg: any, i: number) => {
                const isAnual = pkg.packageType === 'ANNUAL';
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.planCard,
                      planSeleccionado?.identifier === pkg.identifier && {
                        borderColor: currentTheme.colors.primary,
                        backgroundColor: currentTheme.colors.primary + '10'
                      }
                    ]}
                    onPress={() => setPlanSeleccionado(pkg)}
                    disabled={comprando}
                  >
                    {isAnual && (
                      <View style={[styles.planBadge, { backgroundColor: currentTheme.colors.primary }]}>
                        <Text style={styles.planBadgeTexto}>{t('recomendado')}</Text>
                      </View>
                    )}
                    <Text style={styles.planNombre}>{pkg.product.title}</Text>
                    <Text style={[styles.planPrecio, { color: currentTheme.colors.primary }]}>{pkg.product.priceString}</Text>
                    <Text style={styles.planDesc}>{pkg.product.description}</Text>
                    {planSeleccionado?.identifier === pkg.identifier && (
                      <View style={styles.checkmarkContainer}>
                        <Ionicons name="checkmark-circle" size={24} color={currentTheme.colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {(!offerings || offerings.availablePackages?.length === 0) && (
                <View style={styles.paywallNoDisponible}>
                  <Ionicons name="construct-outline" size={32} color="#ccc" />
                  <Text style={styles.paywallNoDisponibleTexto}>
                    Compras no disponibles en modo desarrollo.{'\n'}Usa los botones de test en Ajustes.
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={[
                styles.botonDesbloquear, 
                { 
                  opacity: planSeleccionado ? 1 : 0.5,
                  backgroundColor: planSeleccionado ? currentTheme.colors.primary : '#ccc',
                  shadowColor: currentTheme.colors.primary
                }
              ]} 
              onPress={() => {
                if (!planSeleccionado) return;
                requireAuth(() => handleComprar(planSeleccionado));
              }}
              disabled={!planSeleccionado || comprando}
            >
              <Text style={styles.botonDesbloquearTexto}>{t('desbloquear')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.restaurarBtn} onPress={() => requireAuth(handleRestaurar)}>
              <Text style={[styles.restaurarTexto, { color: currentTheme.colors.primary }]}>{t('restaurar')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalTexto}>{t('cancelar_anytime')}</Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Vista previa PDF */}
        <Modal visible={mostrarPreviewPdf} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMostrarPreviewPdf(false)}>
          <View style={[styles.previewWrapper, { backgroundColor: currentTheme.colors.background }]}>
            <View style={[styles.previewHeader, { backgroundColor: currentTheme.colors.card, borderBottomColor: currentTheme.colors.border || '#f0f0f0' }]}>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => { setMostrarPreviewPdf(false); setPreviewUri(null); }}>
                <Ionicons name="close" size={22} color={currentTheme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.previewTitle, { color: currentTheme.colors.text }]}>{t('vista_previa')}</Text>
              <View style={{ width: 36 }} />
            </View>
            {previewUri ? (
              <Pdf source={{ uri: previewUri }} style={{ flex: 1 }} />
            ) : (
              <View style={styles.previewLoading}><Text style={{ color: currentTheme.colors.textSecondary }}>{t('cargando')}...</Text></View>
            )}
          </View>
        </Modal>

      <AuthModal
        visible={showAuthModal}
        onClose={handleCloseModal}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onGoogle={handleGoogleSignIn}
      />
    </View>
    </SwipeNavigation>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8F7FF' },
  scroll: { flex: 1, paddingTop: 55, paddingHorizontal: 16 },
  titulo: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 20, paddingHorizontal: 4 },
  premiumBanner: { backgroundColor: '#007AFF', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  premiumBannerLeft: { flex: 1 },
  premiumBannerTitulo: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  premiumBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  premiumBannerBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  seccion: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16 },
  seccionTitulo: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  opcionBoton: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  opcionTexto: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  opcionValor: { fontSize: 14, color: '#888', fontWeight: '600', marginLeft: 16 },
  idiomaOpciones: { gap: 10 },
  idiomaBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  idiomaBtnActivo: { borderColor: '#007AFF', backgroundColor: '#EEE9FF' },
  idiomaFlag: { fontSize: 22 },
  idiomaBtnTexto: { flex: 1, fontSize: 15, color: '#888', fontWeight: '600' },
  idiomaBtnTextoActivo: { color: '#007AFF' },
  modalWrapper: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  modalGuardar: { fontSize: 16, fontWeight: '700', color: '#007AFF' },
  campoWrapper: { marginBottom: 16 },
  campoLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  campoInput: { borderWidth: 1.5, borderColor: '#e8e8e8', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa' },
  monedaItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  monedaItemActivo: { backgroundColor: '#F8F7FF' },
  monedaSimbolo: { fontSize: 20, fontWeight: '700', color: '#007AFF', width: 40 },
  monedaNombre: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  monedaCodigo: { fontSize: 12, color: '#888' },
  idiomaNombre: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  paywallWrapper: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
  paywallHeader: { paddingHorizontal: 20, marginBottom: 10 },
  paywallTop: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 24 },
  paywallIcono: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#EEE9FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  paywallTitulo: { fontSize: 24, fontWeight: '900', color: '#1a1a1a', textAlign: 'center', marginBottom: 8 },
  paywallSub: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 10 },
  featureIcono: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEE9FF', justifyContent: 'center', alignItems: 'center' },
  featureTexto: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  checkmarkContainer: { position: 'absolute', top: 10, right: 10 },
  planCard: { borderWidth: 1.5, borderColor: '#e8e8e8', borderRadius: 16, padding: 18, backgroundColor: '#fafafa' },
  planBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  planBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planNombre: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  planPrecio: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  planDesc: { fontSize: 13, color: '#888' },
  botonDesbloquear: { marginHorizontal: 16, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  botonDesbloquearTexto: { color: '#fff', fontWeight: '800', fontSize: 17 },
  planesContainer: { padding: 16, gap: 12 },
  paywallNoDisponible: { alignItems: 'center', padding: 30, gap: 12 },
  paywallNoDisponibleTexto: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 22 },
  restaurarBtn: { alignItems: 'center', paddingVertical: 16 },
  restaurarTexto: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  legalTexto: { textAlign: 'center', fontSize: 13, color: '#666', paddingBottom: 10, paddingHorizontal: 20, lineHeight: 18 },
  ivaOpciones: { flexDirection: 'row', gap: 12 },
  ivaBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#e8e8e8', backgroundColor: '#fafafa', alignItems: 'center' },
  ivaBtnTexto: { fontSize: 16, fontWeight: '700', color: '#888' },
  ivaBtnTextoActivo: { color: '#fff' },
  plantillaItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  plantillaItemActivo: { backgroundColor: '#F8F7FF' },
  plantillaIcono: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fafafa', justifyContent: 'center', alignItems: 'center' },
  plantillaNombre: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  plantillaNombreActivo: { color: '#007AFF' },
  plantillaDescripcion: { fontSize: 12, color: '#888', marginTop: 2 },
  previewWrapper: { flex: 1, paddingTop: 20 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  previewCloseBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  previewTitle: { fontSize: 18, fontWeight: '800' },
  previewLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
