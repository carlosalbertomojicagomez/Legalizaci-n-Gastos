import React, { useState, useEffect } from 'react';
import { LiveCamera } from './LiveCamera';
import { Gasto, UsuarioPerfil, CufeCheckResult, ExtractionResponse } from '../../types';
import { validarCUFE, verificarAritmeticaCOP, formatCOP, sanitizeText } from '../../utils/validations';
import { encolarGastoOffline } from '../../lib/offlineQueue';
import { getIdToken } from '../../lib/firebaseClient';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  RefreshCw,
  Building2,
  Hash,
  KeyRound,
  Calendar,
  DollarSign,
  Briefcase,
  FileText,
  CreditCard,
  Tag,
  WifiOff,
  Cloud,
  Maximize2,
  QrCode,
  X,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface Props {
  usuario: UsuarioPerfil;
  catalogos: { tiposGasto: string[]; tiposPago: string[] };
  onGastoGuardado: (gasto: Gasto) => void;
  isOnline: boolean;
  onAbrirDrive: () => void;
}

type EtapaFlujo = 'captura' | 'lectura' | 'verificacion' | 'confirmacion';

export const WorkerExpenseForm: React.FC<Props> = ({
  usuario,
  catalogos,
  onGastoGuardado,
  isOnline,
  onAbrirDrive,
}) => {
  // Flujo guiado por etapas: 1. Captura, 2. Lectura, 3. Verificación, 4. Confirmación
  const [etapa, setEtapa] = useState<EtapaFlujo>('captura');
  const [mostrandoCamara, setMostrandoCamara] = useState(false);

  // Evidencia Fotográfica Real
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoTomadaEn, setFotoTomadaEn] = useState('');
  const [modalFotoZoom, setModalFotoZoom] = useState(false);

  // Datos Fiscales Leídos por IA (ESTRICTAMENTE SOLO LECTURA)
  const [emisor, setEmisor] = useState<string | null>(null);
  const [nitEmisor, setNitEmisor] = useState<string | null>(null);
  const [numeroFactura, setNumeroFactura] = useState<string | null>(null);
  const [cufe, setCufe] = useState<string | null>(null);
  const [qrDian, setQrDian] = useState<string | null>(null);
  const [fechaEmision, setFechaEmision] = useState<string | null>(null);
  const [fechaVencimiento, setFechaVencimiento] = useState<string | null>(null);
  const [valorNeto, setValorNeto] = useState<number | null>(null);
  const [iva, setIva] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [tipoDocumento, setTipoDocumento] = useState<string | null>(null);
  const [formaPago, setFormaPago] = useState<string | null>(null);
  const [medioPagoExtraid, setMedioPagoExtraid] = useState<string | null>(null);

  // Diagnóstico y Confianza de IA
  const [confianzaExtraccion, setConfianzaExtraccion] = useState<'alta' | 'media' | 'baja'>('alta');
  const [mensajeDiagnostico, setMensajeDiagnostico] = useState<string | null>(null);
  const [iaRawResponse, setIaRawResponse] = useState<string | null>(null);

  // Campos Manuales Únicos Permitidos
  const [tipoGasto, setTipoGasto] = useState('');
  const [tipoPago, setTipoPago] = useState('');
  const [objeto, setObjeto] = useState('');

  // Validaciones y Servidor
  const [infoDuplicado, setInfoDuplicado] = useState<CufeCheckResult | null>(null);
  const [validandoCufe, setValidandoCufe] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [gastoCreado, setGastoCreado] = useState<Gasto | null>(null);
  const [guardadoOffline, setGuardadoOffline] = useState(false);

  // Inicializar catálogos
  useEffect(() => {
    if (!tipoGasto && catalogos.tiposGasto.length > 0) {
      setTipoGasto(catalogos.tiposGasto[0]);
    }
    if (!tipoPago && catalogos.tiposPago.length > 0) {
      setTipoPago(catalogos.tiposPago[0]);
    }
  }, [catalogos, tipoGasto, tipoPago]);

  // Al recibir la foto capturada en vivo por LiveCamera
  const handleCapture = async ({
    dataUrl,
    base64,
    capturedAt,
  }: {
    dataUrl: string;
    base64: string;
    capturedAt: string;
  }) => {
    setMostrandoCamara(false);
    setFotoUrl(dataUrl);
    setFotoBase64(base64);
    setFotoTomadaEn(capturedAt);
    setEtapa('lectura');
    setErrorGlobal(null);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Llamada al endpoint con modelo Gemini de visión en el servidor
      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!response.ok) {
        throw new Error('El servicio de análisis tributario no respondió correctamente.');
      }

      const data: ExtractionResponse = await response.json();

      // Guardar datos leídos (dato no visible = null / No identificado)
      setEmisor(data.emisor || null);
      setNitEmisor(data.nit_emisor || null);
      setNumeroFactura(data.numero_factura || null);
      setCufe(data.cufe || null);
      setQrDian(data.qr_dian || null);
      setFechaEmision(data.fecha_emision || null);
      setFechaVencimiento(data.fecha_vencimiento || null);
      setValorNeto(data.valor_neto !== undefined && data.valor_neto !== null ? Number(data.valor_neto) : null);
      setIva(data.iva !== undefined && data.iva !== null ? Number(data.iva) : null);
      setTotal(data.total !== undefined && data.total !== null ? Number(data.total) : null);
      setTipoDocumento(data.tipo_documento || null);
      setFormaPago(data.forma_pago || null);
      setMedioPagoExtraid(data.medio_pago || null);
      setConfianzaExtraccion(data.confianza_extraccion || 'alta');
      setMensajeDiagnostico(data.mensaje_diagnostico || null);
      setIaRawResponse(data.ia_raw_response || null);

      if (data.concepto_sugerido && !objeto) {
        setObjeto(data.concepto_sugerido);
      }

      // Si se leyó un CUFE de 96 hex, verificar duplicado inmediatamente en el servidor
      if (data.cufe && data.cufe.length === 96) {
        verificarCufeEnServidor(data.cufe, token);
      }
    } catch (err: any) {
      console.warn('Aviso en extracción con IA:', err.message);
      setMensajeDiagnostico('No fue posible extraer automáticamente los datos. Por favor repita la fotografía con mejor luz.');
    } finally {
      setEtapa('verificacion');
    }
  };

  // Verificación de CUFE duplicado en el servidor
  const verificarCufeEnServidor = async (cufeToCheck: string, tokenParam?: string | null) => {
    const limpio = cufeToCheck.trim().toLowerCase();
    if (limpio.length !== 96) {
      setInfoDuplicado(null);
      return;
    }

    setValidandoCufe(true);
    try {
      const token = tokenParam || (await getIdToken());
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch(`/api/check-cufe/${limpio}`, { headers });
      if (resp.ok) {
        const data = await resp.json();
        if (data.duplicado) {
          setInfoDuplicado(data);
        } else {
          setInfoDuplicado(null);
        }
      }
    } catch (err) {
      console.warn('Aviso consultando duplicado de CUFE:', err);
    } finally {
      setValidandoCufe(false);
    }
  };

  // Comprobación aritmética estricta
  const checkAritmetica = verificarAritmeticaCOP(valorNeto || 0, iva || 0, total || 0);

  // Radicar gasto formalmente
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorGlobal(null);

    // 1. Fotografía obligatoria
    if (!fotoUrl) {
      setErrorGlobal('La captura fotográfica de la factura con cámara trasera es obligatoria.');
      return;
    }

    // 2. Validación de CUFE de 96 caracteres hexadecimales
    if (!cufe || !validarCUFE(cufe)) {
      setErrorGlobal(
        'El Código CUFE no pudo ser validado con los 96 caracteres hexadecimales requeridos por la DIAN. Presione "Repetir Fotografía" para capturarlo nuevamente.'
      );
      return;
    }

    // 3. Validación de duplicado
    if (infoDuplicado?.duplicado) {
      setErrorGlobal('Esta factura (CUFE) ya se encuentra radicada en el sistema contable de Colaves.');
      return;
    }

    // 4. Verificación aritmética de Neto + IVA = Total
    // En Colaves, si la aritmética no cuadra, no se permite autorizar: debe repetirse la foto
    if (!checkAritmetica.cuadra) {
      setErrorGlobal(
        `Descuadre contable detectado: Neto ($ ${formatCOP(valorNeto || 0)}) + IVA ($ ${formatCOP(iva || 0)}) = $ ${formatCOP(checkAritmetica.sumaEsperada)}, existiendo una diferencia de $ ${formatCOP(checkAritmetica.diferencia)} frente al Total ($ ${formatCOP(total || 0)}). Debe repetir la foto para corregir la lectura.`
      );
      return;
    }

    // 5. Justificación obligatoria
    if (!objeto.trim()) {
      setErrorGlobal('Debe ingresar el objeto o justificación operativa del gasto.');
      return;
    }

    setGuardando(true);

    const expenseId = crypto.randomUUID();
    const payloadGasto: Gasto = {
      id: expenseId,
      creado_en: new Date().toISOString(),
      user_id: usuario.id,
      emisor: sanitizeText(emisor || 'No identificado'),
      nit_emisor: nitEmisor ? sanitizeText(nitEmisor) : null,
      numero_factura: sanitizeText(numeroFactura || 'No identificado'),
      cufe: cufe.trim().toLowerCase(),
      qr_dian: qrDian || null,
      fecha_emision: fechaEmision || new Date().toISOString().split('T')[0],
      fecha_vencimiento: fechaVencimiento || null,
      valor_neto: Number(valorNeto) || 0,
      iva: Number(iva) || 0,
      total: Number(total) || 0,
      tipo_documento: tipoDocumento || 'Factura Electrónica de Venta',
      forma_pago: formaPago || 'Contado',
      medio_pago: medioPagoExtraid || 'Bancarizado',
      nombre_responsable: usuario.nombre_completo,
      cargo: usuario.cargo,
      tipo_gasto: tipoGasto || 'Alimentación / Viáticos',
      tipo_pago: tipoPago || 'Efectivo / Caja menor',
      objeto: sanitizeText(objeto),
      foto_path: `factura_${expenseId}.jpg`,
      foto_url: fotoUrl, // Se envía para almacenamiento protegido en el backend
      foto_tomada_en: fotoTomadaEn || new Date().toISOString(),
      estado: 'pendiente',
      confianza_extraccion: confianzaExtraccion,
      mensaje_diagnostico: mensajeDiagnostico || 'Radicado por trabajador',
      ia_raw_response: iaRawResponse,
    };

    try {
      if (!navigator.onLine) {
        // Encolado offline en IndexedDB
        await encolarGastoOffline(payloadGasto);
        setGuardadoOffline(true);
        setGastoCreado(payloadGasto);
        onGastoGuardado(payloadGasto);
        setEtapa('confirmacion');
        return;
      }

      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch('/api/expenses', {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadGasto),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 409 && errorData.duplicado) {
          setInfoDuplicado(errorData);
          throw new Error(errorData.error || 'Factura ya radicada anteriormente.');
        }
        throw new Error(errorData.error || 'Error al radicar el comprobante en el servidor.');
      }

      const guardado = await resp.json();
      setGuardadoOffline(false);
      setGastoCreado(guardado);
      onGastoGuardado(guardado);
      setEtapa('confirmacion');
    } catch (err: any) {
      console.error('Error al radicar gasto:', err);
      if (!navigator.onLine || err.message?.includes('Failed to fetch')) {
        await encolarGastoOffline(payloadGasto);
        setGuardadoOffline(true);
        setGastoCreado(payloadGasto);
        onGastoGuardado(payloadGasto);
        setEtapa('confirmacion');
      } else {
        setErrorGlobal(err.message || 'Error inesperado al guardar');
      }
    } finally {
      setGuardando(false);
    }
  };

  const reiniciarFlujo = () => {
    setEtapa('captura');
    setMostrandoCamara(false);
    setFotoUrl('');
    setFotoBase64('');
    setFotoTomadaEn('');
    setEmisor(null);
    setNitEmisor(null);
    setNumeroFactura(null);
    setCufe(null);
    setQrDian(null);
    setFechaEmision(null);
    setFechaVencimiento(null);
    setValorNeto(null);
    setIva(null);
    setTotal(null);
    setTipoDocumento(null);
    setFormaPago(null);
    setMedioPagoExtraid(null);
    setObjeto('');
    setInfoDuplicado(null);
    setErrorGlobal(null);
    setGastoCreado(null);
  };

  // VISTA 1: CÁMARA TRASERA EN VIVO
  if (mostrandoCamara) {
    return (
      <div className="py-2">
        <LiveCamera
          onCapture={handleCapture}
          onCancel={() => setMostrandoCamara(false)}
        />
      </div>
    );
  }

  // Barra indicadora de progreso (4 etapas guiadas)
  const renderIndicadorProgreso = () => {
    const etapas: { id: EtapaFlujo; label: string; num: number }[] = [
      { id: 'captura', label: 'Captura', num: 1 },
      { id: 'lectura', label: 'Lectura', num: 2 },
      { id: 'verificacion', label: 'Verificación', num: 3 },
      { id: 'confirmacion', label: 'Confirmación', num: 4 },
    ];

    const currentIdx = etapas.findIndex((e) => e.id === etapa);

    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm mb-5">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-100 dark:bg-slate-800 z-0" />
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-[#2CAE4A] transition-all duration-500 z-0"
            style={{ width: `${(currentIdx / (etapas.length - 1)) * 100}%` }}
          />

          {etapas.map((step, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? 'bg-[#2CAE4A] text-white shadow-md'
                      : isCurrent
                      ? 'bg-[#07426B] text-white ring-4 ring-blue-100 dark:ring-blue-950/60 shadow-lg'
                      : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                </div>
                <span
                  className={`text-[10px] mt-1.5 font-bold ${
                    isCurrent
                      ? 'text-[#07426B] dark:text-blue-400'
                      : isCompleted
                      ? 'text-[#2CAE4A]'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ETAPA 2: LECTURA CON IA DE VISIÓN
  if (etapa === 'lectura') {
    return (
      <div className="max-w-md mx-auto space-y-5">
        {renderIndicadorProgreso()}

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6">
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-[#2CAE4A]/20 animate-ping" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#07426B] to-[#2CAE4A] flex items-center justify-center text-white shadow-xl">
              <Sparkles className="w-10 h-10 animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Analizando Factura DIAN...
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              El motor de visión artificial está localizando el CUFE de 96 caracteres, identificando al emisor y verificando los impuestos tributarios.
            </p>
          </div>

          {fotoUrl && (
            <div className="w-48 h-32 mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
              <img src={fotoUrl} alt="Vista previa" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ETAPA 4: CONFIRMACIÓN EXITOSA
  if (etapa === 'confirmacion') {
    return (
      <div className="max-w-md mx-auto space-y-5">
        {renderIndicadorProgreso()}

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 text-[#2CAE4A] mx-auto flex items-center justify-center border-2 border-emerald-200 dark:border-emerald-800 shadow-lg">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              ¡Factura Radicada con Éxito!
            </h2>
            {guardadoOffline ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full text-xs font-semibold border border-amber-200">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Guardado fuera de línea (se sincronizará automáticamente)</span>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                El comprobante y su código CUFE han quedado registrados en Colaves para auditoría contable.
              </p>
            )}
          </div>

          {gastoCreado && (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2.5">
              <div className="flex justify-between border-b pb-2 dark:border-slate-700">
                <span className="text-slate-400">Total Legalizado:</span>
                <span className="font-black text-[#2CAE4A] text-sm">
                  {formatCOP(gastoCreado.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Emisor:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {gastoCreado.emisor}
                </span>
              </div>
              {gastoCreado.nit_emisor && (
                <div className="flex justify-between">
                  <span className="text-slate-400">NIT:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {gastoCreado.nit_emisor}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">N° Factura:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {gastoCreado.numero_factura}
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-slate-400 text-[10px]">CUFE Verificado:</span>
                <span className="font-mono text-[9px] text-slate-600 dark:text-slate-300 break-all bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  {gastoCreado.cufe}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={onAbrirDrive}
              className="w-full py-3 bg-[#07426B] hover:bg-[#052F4D] text-white font-bold rounded-2xl shadow-md active:scale-95 transition text-xs flex items-center justify-center gap-2"
            >
              <Cloud className="w-4 h-4" />
              <span>Respaldar en Google Drive</span>
            </button>

            <button
              onClick={reiniciarFlujo}
              className="w-full py-3.5 bg-[#2CAE4A] hover:bg-[#00984C] text-white font-black rounded-2xl shadow-lg active:scale-95 transition text-xs flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Registrar Otra Factura</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ETAPA 1: INICIO / ACTIVACIÓN DE CÁMARA
  if (etapa === 'captura') {
    return (
      <div className="max-w-md mx-auto space-y-5">
        {renderIndicadorProgreso()}

        <div className="bg-gradient-to-br from-[#07426B] to-[#052F4D] text-white rounded-3xl p-6 shadow-xl space-y-5 relative overflow-hidden">
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2CAE4A] bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/80">
              Módulo de Campo Colaves
            </span>
            <h2 className="text-xl font-black text-white">
              Legalización de Facturas DIAN
            </h2>
            <p className="text-xs text-slate-200 leading-relaxed">
              Hola, <strong>{usuario.nombre_completo}</strong> ({usuario.cargo}). Fotografía la factura física en vivo con la cámara trasera para extraer automáticamente los códigos de facturación.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-2.5 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2CAE4A] flex-shrink-0" />
              <span>Captura en vivo obligatoria con cámara trasera (sin galería)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2CAE4A] flex-shrink-0" />
              <span>Validación estricta de CUFE (96 caracteres hexadecimales)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2CAE4A] flex-shrink-0" />
              <span>Campos leídos protegidos en modo solo lectura</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2CAE4A] flex-shrink-0" />
              <span>Trazabilidad y almacenamiento persistente en la nube</span>
            </div>
          </div>

          <button
            onClick={() => setMostrandoCamara(true)}
            className="w-full py-4 bg-[#2CAE4A] hover:bg-[#00984C] text-white font-black rounded-2xl shadow-xl shadow-[#2CAE4A]/30 active:scale-95 transition flex items-center justify-center gap-3 text-sm"
          >
            <Camera className="w-5 h-5" />
            <span>Activar Cámara Trasera</span>
          </button>
        </div>
      </div>
    );
  }

  // ETAPA 3: VERIFICACIÓN DE DATOS (CAMPOS LEÍDOS ESTRICTAMENTE SOLO LECTURA)
  return (
    <div className="max-w-md mx-auto space-y-5 pb-16">
      {renderIndicadorProgreso()}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tarjeta de Evidencia Fotográfica */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2CAE4A]" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Evidencia Fotográfica Capturada
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {fotoUrl && (
                <button
                  type="button"
                  onClick={() => setModalFotoZoom(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ampliar</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setMostrandoCamara(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#07426B] dark:text-blue-400 text-xs font-bold hover:bg-slate-200 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Repetir Fotografía</span>
              </button>
            </div>
          </div>

          {fotoUrl && (
            <div
              onClick={() => setModalFotoZoom(true)}
              className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 cursor-pointer group"
            >
              <img src={fotoUrl} alt="Factura capturada" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
              <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                Foto vinculada al registro contable
              </span>
            </div>
          )}
        </div>

        {/* Diagnóstico de Lectura IA */}
        {mensajeDiagnostico && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
              confianzaExtraccion === 'alta'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#2CAE4A]" />
            <div className="space-y-0.5">
              <span className="font-bold">
                Lectura DIAN ({confianzaExtraccion === 'alta' ? 'Confianza Alta' : 'Revisión Requerida'}):
              </span>
              <p className="text-[11px] opacity-90">{mensajeDiagnostico}</p>
            </div>
          </div>
        )}

        {/* Alerta de CUFE Duplicado */}
        {infoDuplicado?.duplicado && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-400 text-rose-800 dark:text-rose-200 rounded-2xl space-y-1.5 text-xs animate-shake">
            <div className="flex items-center gap-2 font-black text-rose-900 dark:text-rose-100 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>¡FACTURA DUPLICADA DETECTADA!</span>
            </div>
            <p>
              Este CUFE ya fue legalizado anteriormente en Colaves por{' '}
              <strong>{infoDuplicado.registrado_por}</strong> ({infoDuplicado.cargo || 'Funcionario'}) el{' '}
              <strong>
                {infoDuplicado.fecha_registro
                  ? new Date(infoDuplicado.fecha_registro).toLocaleDateString('es-CO')
                  : 'fecha previa'}
              </strong>.
            </p>
            <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              Por auditoría interna, no es posible radicar la misma factura dos veces.
            </p>
          </div>
        )}

        {/* Alerta de Descuadre Aritmético (Bloqueante, sin checkbox) */}
        {!checkAritmetica.cuadra && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 text-rose-800 dark:text-rose-200 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 font-black text-rose-900 dark:text-rose-100">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>Descuadre Aritmético: Neto + IVA ≠ Total</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Neto ($ {formatCOP(valorNeto || 0)}) + IVA ($ {formatCOP(iva || 0)}) = $ {formatCOP(checkAritmetica.sumaEsperada)}, existiendo una diferencia de $ {formatCOP(checkAritmetica.diferencia)} frente al Total ($ {formatCOP(total || 0)}).
            </p>
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl">
              Para asegurar la exactitud contable, debe presionar "Repetir Fotografía" para recapturar la factura con mayor nitidez.
            </p>
          </div>
        )}

        {/* Alerta de Error Global */}
        {errorGlobal && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-700 dark:text-rose-200 text-xs rounded-xl">
            {errorGlobal}
          </div>
        )}

        {/* SECCIÓN 1: DATOS LEÍDOS DE LA FACTURA (MODO SOLO LECTURA ESTRICTO) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#07426B] dark:text-blue-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Datos Fiscales Identificados (Solo Lectura)
              </h4>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" /> Protegido
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Emisor / Razón Social:
              </label>
              <div className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200">
                {emisor || <span className="text-amber-600 dark:text-amber-400 font-normal">No identificado</span>}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                NIT del Emisor:
              </label>
              <div className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200">
                {nitEmisor || <span className="text-slate-400">No especificado</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                N° Factura:
              </label>
              <div className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-800 dark:text-slate-200">
                {numeroFactura || <span className="text-amber-600 dark:text-amber-400 font-normal">No identificado</span>}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Fecha de Emisión:
              </label>
              <div className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                {fechaEmision || <span className="text-amber-600 dark:text-amber-400 font-normal">No identificado</span>}
              </div>
            </div>
          </div>

          {/* CUFE de 96 caracteres */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#07426B]" />
                Código CUFE / CUDE (96 hex):
              </label>
              <div className="flex items-center gap-1 text-[11px] font-mono">
                {validandoCufe && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                <span
                  className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                    cufe && cufe.length === 96
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}
                >
                  {cufe ? `${cufe.length}/96 hex` : 'No identificado'}
                </span>
              </div>
            </div>

            <div className="w-full font-mono text-[11px] p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 break-all leading-tight text-slate-800 dark:text-slate-200 select-all">
              {cufe || (
                <span className="text-rose-600 dark:text-rose-400 italic">
                  No se identificó el CUFE de 96 caracteres. Repita la foto para capturarlo con nitidez.
                </span>
              )}
            </div>
          </div>

          {/* Parámetros QR DIAN si existen */}
          {qrDian && (
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-400">
                <QrCode className="w-3.5 h-3.5 text-blue-500" />
                <span>Parámetros QR DIAN Detectados:</span>
              </div>
              <p className="font-mono text-slate-600 dark:text-slate-300 break-all select-all leading-tight bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                {qrDian}
              </p>
            </div>
          )}

          {/* Desglose de Valores */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-semibold">Neto (COP)</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {valorNeto !== null ? `$ ${formatCOP(valorNeto)}` : 'No ident.'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-semibold">IVA (COP)</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {iva !== null ? `$ ${formatCOP(iva)}` : '$ 0'}
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] text-[#206A3C] dark:text-emerald-400 block font-bold">Total (COP)</span>
              <span className="text-xs font-black text-[#2CAE4A] dark:text-emerald-300">
                {total !== null ? `$ ${formatCOP(total)}` : 'No ident.'}
              </span>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: CAMPOS MANUALES DE CLASIFICACIÓN Y JUSTIFICACIÓN */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-2 dark:border-slate-800">
            <Briefcase className="w-4 h-4 text-[#07426B] dark:text-blue-400" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              2. Clasificación y Justificación Operativa
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Responsable del Gasto:
              </label>
              <input
                disabled
                type="text"
                value={usuario.nombre_completo}
                className="w-full text-xs p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cargo en Colaves:
              </label>
              <input
                disabled
                type="text"
                value={usuario.cargo}
                className="w-full text-xs p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Gasto *
              </label>
              <select
                required
                value={tipoGasto}
                onChange={(e) => setTipoGasto(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200"
              >
                {catalogos.tiposGasto.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Medio de Desembolso *
              </label>
              <select
                required
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200"
              >
                {catalogos.tiposPago.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Objeto del Gasto / Justificación Operacional *
            </label>
            <textarea
              required
              rows={2}
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              placeholder="Describa el motivo laboral del gasto (ej: Tanqueo de cuadrilla para inspección en granja San Antonio)"
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>

        {/* Botón de Radicación Final */}
        <button
          type="submit"
          disabled={guardando || Boolean(infoDuplicado?.duplicado) || !checkAritmetica.cuadra || !cufe}
          className="w-full py-4 bg-[#2CAE4A] hover:bg-[#00984C] disabled:opacity-40 text-white font-black rounded-2xl shadow-xl shadow-[#2CAE4A]/25 active:scale-95 transition text-sm flex items-center justify-center gap-2"
        >
          {guardando ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Radicando en Colaves...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Radicar Legalización ({total ? formatCOP(total) : '$ 0'})</span>
            </>
          )}
        </button>
      </form>

      {/* Modal de Zoom de Fotografía */}
      {modalFotoZoom && fotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-zoom-out"
          onClick={() => setModalFotoZoom(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-4 space-y-3 shadow-2xl border border-slate-200 dark:border-slate-800 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#2CAE4A]" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Soporte Fotográfico Original
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalFotoZoom(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[70vh]">
              <img
                src={fotoUrl}
                alt="Comprobante en alta resolución"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span>{emisor ? `${emisor} — ` : ''}{numeroFactura || 'Factura'}</span>
              <span>Foto capturada en vivo</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
