# 📦 Instrucciones de compilación — InvoiceRapid Pro

## Requisitos previos

- **JDK 21** (incluido en el proyecto en `tools/jdk21/jdk-21.0.6+7`)
- **Android SDK** (ubicación típica: `C:/Users/<usuario>/AppData/Local/Android/Sdk`)
- **Node.js** y `npm` instalados
- **Git Bash** (MSYS2) como terminal

> ⚠️ **IMPORTANTE**: React Native NO funciona con Java 25+. Usa siempre **JDK 21**.
> El proyecto ya tiene configurado `org.gradle.java.home` en `android/gradle.properties`
> apuntando al JDK 21 de `tools/jdk21/`.

---

## Paso 1: TypeScript check

Antes de compilar, verifica que no haya errores de TypeScript:

```bash
cd /c/ProyectosZKRStudio/InvoiceRapidPro
npx tsc --noEmit
```

Si hay errores, corrígelos antes de continuar.

---

## Paso 2: Compilar APK (release)

Ejecuta desde **Git Bash**:

```bash
export JAVA_HOME="/c/ProyectosZKRStudio/InvoiceRapidPro/tools/jdk21/jdk-21.0.6+7"
export PATH="$JAVA_HOME/bin:$PATH"

cd /c/ProyectosZKRStudio/InvoiceRapidPro/android
MSYS2_ARG_CONV_EXCL="*" ./gradlew assembleRelease
```

**Explicación de cada parte:**
- `export JAVA_HOME="..."` → fuerza el uso de JDK 21
- `MSYS2_ARG_CONV_EXCL="*"` → evita que Git Bash convierta rutas de Windows (ej: `C:\...` → `C;...`)
- `./gradlew assembleRelease` → compila el APK en modo release

El APK se genera en:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Si la build falla

| Error | Solución |
|-------|----------|
| `Unsupported class file major version 69` | Estás usando Java 25. Verifica que `JAVA_HOME` apunte al JDK 21 |
| `Could not resolve com.facebook.react:react-native-gradle-plugin` | El plugin de RN no se encuentra. Revisa que la versión de RN en `package.json` coincida con la del `gradle.properties` |
| `sdk.dir not found` | Asegúrate de tener `android/local.properties` con `sdk.dir=C:/Users/<usuario>/AppData/Local/Android/Sdk` |
| Error de permisos en `gradlew` | Ejecuta `chmod +x gradlew` |
| Caché corrupta de Gradle | `./gradlew clean` y vuelve a intentar |

---

## Paso 3: Transferir APK al móvil (USB)

```bash
MSYS2_ARG_CONV_EXCL="*" \
  "C:/Users/zakar/AppData/Local/Android/Sdk/platform-tools/adb.exe" \
  push \
  "C:/ProyectosZKRStudio/InvoiceRapidPro/android/app/build/outputs/apk/release/app-release.apk" \
  /sdcard/Download/InvoiceRapid.apk
```

El APK aparecerá en el móvil en: **Almacenamiento interno → Descargas → InvoiceRapid.apk**

---

## Paso 4 (opcional): Debuggear crashes con logcat

Si la app se cierra al abrir, conecta el móvil por USB y ejecuta:

```bash
"C:/Users/zakar/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -d -s ReactNative:V ReactNativeJS:V AndroidRuntime:E *:F | tail -100
```

Busca líneas con `FATAL EXCEPTION` — ahí verás la causa del crash.

---

## Notas adicionales

### Configuración clave en `android/gradle.properties`

```properties
org.gradle.java.home=C\:\\ProyectosZKRStudio\\InvoiceRapidPro\\tools\\jdk21\\jdk-21.0.6+7
```

Esto asegura que Gradle use el JDK correcto sin depender del PATH del sistema.

### Versiones del proyecto

| Componente | Versión |
|------------|---------|
| React Native | 0.81.5 |
| react-native-google-mobile-ads | Última (compatible con RN 0.81) |
| JDK | 21.0.6+7 |
| Gradle | Wrapper incluido en el proyecto |

### AdMob IDs (producción)

| Formato | ID |
|---------|----|
| Banner | `ca-app-pub-3758182602063783/5253589032` |
| Interstitial | `ca-app-pub-3758182602063783/4421373572` |
| Rewarded | `ca-app-pub-3758182602063783/8097499944` |

---

## Resumen rápido (copia y pega todo)

```bash
# 1. Typecheck
cd /c/ProyectosZKRStudio/InvoiceRapidPro && npx tsc --noEmit

# 2. Build
export JAVA_HOME="/c/ProyectosZKRStudio/InvoiceRapidPro/tools/jdk21/jdk-21.0.6+7"
export PATH="$JAVA_HOME/bin:$PATH"
cd /c/ProyectosZKRStudio/InvoiceRapidPro/android
MSYS2_ARG_CONV_EXCL="*" ./gradlew assembleRelease

# 3. Push al móvil
MSYS2_ARG_CONV_EXCL="*" "C:/Users/zakar/AppData/Local/Android/Sdk/platform-tools/adb.exe" push "C:/ProyectosZKRStudio/InvoiceRapidPro/android/app/build/outputs/apk/release/app-release.apk" /sdcard/Download/InvoiceRapid.apk
```
