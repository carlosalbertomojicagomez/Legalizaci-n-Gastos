# COLAVES S.A.S. — Sistema Corporativo de Legalización de Gastos DIAN

Plataforma empresarial mobile-first (PWA) de legalización de gastos operacionales y facturación electrónica para **COLAVES S.A.S.**, con captura en vivo por cámara trasera, lectura multimodal con IA (Gemini 2.5 Flash), validación de CUFE (96 caracteres hexadecimales), control de acceso basado en roles (RBAC) con Firebase Authentication y Firestore, cola fuera de línea con IndexedDB, notificaciones en tiempo real, exportación a Excel con evidencias y suite de integraciones con Google Workspace (Drive, Sheets y Chat).

---

## 🏛️ Identidad Corporativa Colaves

- **Azul Corporativo**: `#07426B`
- **Verde Institucional**: `#2CAE4A`
- **Verde Oscuro**: `#206A3C`
- **Verde Secundario**: `#00984C`

---

## 🔒 Arquitectura de Seguridad & RBAC

1. **Autenticación Real (Firebase Auth)**:
   - Acceso con **Google Workspace** y credenciales de correo/contraseña corporativas.
   - Se eliminó el selector manual de roles en el cliente; el rol está almacenado y gobernado en Firestore y verificado en el servidor.
   - Superadministrador bootstrap inicial: `carlosalbertomojicagomez@gmail.com`.

2. **Middleware Express (`requireAuth` y `requireAdmin`)**:
   - Todas las rutas `/api/*` requieren un token de autenticación válido (`Authorization: Bearer <token>` o token en queries para recursos multimedia).
   - Solicitudes no autorizadas responden `401 Unauthorized`.
   - Acciones administrativas (gestión de roles, modificación de catálogos, aprobación/rechazo) responden `403 Forbidden` si el usuario no tiene rol `administrador`.

3. **Protección Estricta de Evidencias Fotográficas**:
   - Las fotos capturadas se almacenan en el directorio privado `data/protected_uploads/` (fuera del directorio público de Vite).
   - Se sirven exclusivamente a través del endpoint protegido `GET /api/expenses/:id/photo`.
   - Solo el trabajador dueño del comprobante o un auditor con rol `administrador` pueden visualizar o descargar la evidencia.

4. **Reglas de Seguridad Firestore (`firestore.rules`)**:
   - Colección `/users/{userId}`: los usuarios pueden leer su perfil; solo administradores pueden modificar roles.
   - Colección `/expenses/{expenseId}`: los trabajadores crean registros y leen únicamente los suyos; los administradores auditan y actualizan estados.
   - Colección `/catalogs/{catalogId}`: lectura pública para la operación, escritura restringida a administradores.

---

## 📷 Flujo Guiado de Facturación (Trabajador)

El módulo para trabajadores (`WorkerExpenseForm`) opera en 4 pasos obligatorios:

1. **Captura Exclusiva con Cámara Trasera en Vivo**:
   - Utiliza la API web `getUserMedia` solicitando el lente posterior (`facingMode: { ideal: 'environment' }`).
   - Sin botones de subida de galería ni `<input type="file">`.
   - Instrucciones claras en pantalla ante falta de permisos de cámara.

2. **Lectura Multimodal con Gemini en Servidor**:
   - Procesa la fotografía con `gemini-2.5-flash` estructurado en esquema JSON estricto.
   - Dos pasadas automáticas: lectura general de campos y pasada de alta resolución en la zona de CUFE/código QR.
   - Extracción de CUFE (96 hex), emisor, NIT, número de factura, fechas, subtotal, IVA, total, forma y medio de pago.
   - Registro de la respuesta cruda de la IA (`ia_raw_response`) para trazabilidad de auditoría.

3. **Verificación Estricta (Campos de Lectura de Solo Lectura)**:
   - Los datos extraídos por la IA son estrictamente de solo lectura para evitar alteraciones manuales.
   - Verificación de cuadre aritmético: `Neto + IVA = Total`. El sistema bloquea el registro si hay descuadre y solicita repetir la fotografía.
   - Verificación de CUFE duplicado contra toda la base de datos desde el servidor.
   - Campos manuales de diligenciamiento: Clasificación del gasto (`tipo_gasto`), Tipo de pago (`tipo_pago`) y Justificación operativa (`objeto`).

4. **Confirmación y Radicación**:
   - Radicación instantánea si hay conexión a internet.
   - Si no hay señal en campo, se encola de forma segura en `IndexedDB` (`idb`) y se sincroniza automáticamente al recuperar la conexión.

---

## 📊 Panel de Auditoría & Control (Administrador)

- **KPIs en Tiempo Real**: Total acumulado (COP), pendientes, aprobadas y rechazadas.
- **Gráfico de Distribución**: Desglose porcentual y montos por tipo de gasto.
- **Tabla de Auditoría**: Filtros por estado, responsable, clasificación, rangos de fecha y búsqueda de texto.
- **Detalle y Zoom**: Visualizador de factura en alta resolución con `SecureImage`, botón para copiar CUFE y trazabilidad de auditoría.
- **Aprobación / Rechazo con Observaciones**: Registro de auditor, fecha y motivo obligatorio en caso de rechazo.
- **Exportación a Excel**: Reporte contable con cabecera corporativa de Colaves e imágenes de evidencias incrustadas en cada fila.
- **Gestión de Usuarios y Roles**: Modal interactivo para ascender o revocar permisos administrativos.

---

## ☁️ Integraciones Google Workspace

- **Google Drive**: Genera carpetas mensuales ordenadas por centro de costos y respalda los comprobantes originales.
- **Google Sheets**: Sincroniza en tiempo real las legalizaciones en una hoja de cálculo en la nube para el equipo contable.
- **Google Chat**: Emite tarjetas y fichas interactivas de legalización a los espacios de trabajo del equipo.

---

## 🚀 Puesta en Marcha

```bash
# Instalar dependencias
npm install

# Compilar proyecto y verificar tipos
npm run build
npm run lint

# Iniciar servidor de desarrollo en puerto 3000
npm run dev
```
