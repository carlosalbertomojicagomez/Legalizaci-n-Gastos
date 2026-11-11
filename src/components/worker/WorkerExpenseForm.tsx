import React, { useState, useEffect } from 'react';
import { LiveCamera } from './LiveCamera';
import { Gasto, UsuarioPerfil, CufeCheckResult } from '../../types';
import { validarCUFE, verificarAritmeticaCOP, formatCOP, sanitizeText } from '../../utils/validations';
import { encolarGastoOffline } from '../../lib/offlineQueue';
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
  Cloud
} from 'lucide-react';

interface Props {
  usuario: UsuarioPerfil;
  catalogos: { tiposGasto: string[]; tiposPago: string[] };
  onGastoGuardado: (gasto: Gasto) => void;
  isOnline: boolean;
  onAbrirDrive: () => void;
}

export const WorkerExpenseForm: React.FC<Props> = ({
  usuario,
  catalogos,
  onGastoGuardado,
  isOnline,
  onAbrirDrive,
}) => {
  const [paso, setPaso] = useState<'inicio' | 'camara' | 'procesando_ia' | 'formulario' | 'exito'>('inicio');

  // Fotografía
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoTomadaEn, setFotoTomadaEn] = useState('');

  // Campos de la Factura (Autodiligenciados + Editables)
  const [emisor, setEmisor] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [cufe, setCufe] = useState('');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [valorNeto, setValorNeto] = useState<number>(0);
  const [iva, setIva] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  // Campos del Trabajador y Justificación
  const [nombreResponsable, setNombreResponsable] = useState(usuario.nombre_completo);
  const [cargo, setCargo] = useState(usuario.cargo);
  const [tipoGasto, setTipoGasto] = useState('');
  const [tipoPago, setTipoPago] = useState('');
  const [objeto, setObjeto] = useState('');

  // Estados de Validación y Servidor
  const [infoDuplicado, setInfoDuplicado] = useState<CufeCheckResult | null>(null);
  const [validandoCufeServidor, setValidandoCufeServidor] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [gastoCreado, setGastoCreado] = useState<Gasto | null>(null);
  const [guardadoOffline, setGuardadoOffline] = useState(false);

  // Actualizar nombre y cargo al cambiar usuario
  useEffect(() => {
    setNombreResponsable(usuario.nombre_completo);
    setCargo(usuario.cargo);
  }, [usuario]);

  // Selección predeterminada de catálogos
  useEffect(() => {
    if (!tipoGasto && catalogos.tiposGasto.length > 0) {
      setTipoGasto(catalogos.tiposGasto[0]);
    }
    if (!tipoPago && catalogos.tiposPago.length > 0) {
      setTipoPago(catalogos.tiposPago[0]);
    }
  }, [catalogos, tipoGasto, tipoPago]);

  // Al recibir la foto de LiveCamera
  const handleCapture = async ({
    dataUrl,
    base64,
    capturedAt,
  }: {
    dataUrl: string;
    base64: string;
    capturedAt: string;
  }) => {
    setFotoUrl(dataUrl);
    setFotoBase64(base64);
    setFotoTomadaEn(capturedAt);
    setPaso('procesando_ia');
    setErrorGlobal(null);

    try {
      // Llamada al endpoint con modelo Gemini de visión en el servidor
      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!response.ok) {
        throw new Error('El servicio de análisis fiscal no respondió correctamente');
      }

      const data = await response.json();

      // Precarga de valores leídos (dato no visible = null / vacío)
      if (data.emisor) setEmisor(data.emisor);
      if (data.numero_factura) setNumeroFactura(data.numero_factura);
      if (data.cufe) {
        setCufe(data.cufe);
        verificarCufeEnServidor(data.cufe);
      }
      if (data.fecha_emision) setFechaEmision(data.fecha_emision);
      if (data.fecha_vencimiento) setFechaVencimiento(data.fecha_vencimiento);
      if (data.valor_neto !== undefined && data.valor_neto !== null) {
        setValorNeto(Number(data.valor_neto));
      }
      if (data.iva !== undefined && data.iva !== null) {
        setIva(Number(data.iva));
      }
      if (data.total !== undefined && data.total !== null) {
        setTotal(Number(data.total));
      }
    } catch (err: any) {
      console.warn('Aviso en extracción con IA:', err.message);
    } finally {
      setPaso('formulario');
    }
  };

  // Verificación en tiempo real si el CUFE ya existe
  const verificarCufeEnServidor = async (cufeToCheck: string) => {
    const limpio = cufeToCheck.trim().toLowerCase();
    if (limpio.length !== 96 || !/^[a-f0-9]{96}$/.test(limpio)) {
      setInfoDuplicado(null);
      return;
    }

    setValidandoCufeServidor(true);
    try {
      const resp = await fetch(`/api/check-cufe/${limpio}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.duplicado) {
          setInfoDuplicado(data);
        } else {
          setInfoDuplicado(null);
        }
      }
    } catch (err) {
      console.warn('No se pudo verificar CUFE en servidor (posiblemente offline):', err);
    } finally {
      setValidandoCufeServidor(false);
    }
  };

  const handleCufeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Sanitizar permitiendo únicamente caracteres hexadecimales
    const sanitized = e.target.value.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
    setCufe(sanitized);
    if (sanitized.length === 96) {
      verificarCufeEnServidor(sanitized);
    } else {
      setInfoDuplicado(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorGlobal(null);

    // 1. Validación de fotografía mandatoria
    if (!fotoUrl) {
      setErrorGlobal('La fotografía en vivo de la factura es un requisito fiscal obligatorio.');
      return;
    }

    // 2. Validación de CUFE de 96 caracteres hexadecimales
    if (!validarCUFE(cufe)) {
      setErrorGlobal('El Código CUFE debe contener exactamente 96 caracteres hexadecimales válidos.');
      return;
    }

    // 3. Validación de duplicado
    if (infoDuplicado?.duplicado) {
      setErrorGlobal('Esta factura (CUFE) ya se encuentra radicada en el sistema contable.');
      return;
    }

    // 4. Verificación aritmética de Neto + IVA = Total
    const checkAritmetica = verificarAritmeticaCOP(valorNeto, iva, total);
    if (!checkAritmetica.cuadra) {
      const confirmacion = window.confirm(
        `Alerta Aritmética Contable:\n\nNeto ($ ${formatCOP(valorNeto)}) + IVA ($ ${formatCOP(iva)}) = $ ${formatCOP(checkAritmetica.sumaEsperada)}.\nEl Total ingresado es $ ${formatCOP(total)}, existiendo una diferencia de $ ${formatCOP(checkAritmetica.diferencia)}.\n\n¿Desea radicar el gasto de todos modos?`
      );
      if (!confirmacion) return;
    }

    setGuardando(true);

    const payloadGasto: Gasto = {
      id: crypto.randomUUID(),
      creado_en: new Date().toISOString(),
      user_id: usuario.id,
      emisor: sanitizeText(emisor),
      numero_factura: sanitizeText(numeroFactura),
      cufe: cufe.trim().toLowerCase(),
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento || null,
      valor_neto: Number(valorNeto) || 0,
      iva: Number(iva) || 0,
      total: Number(total) || 0,
      nombre_responsable: sanitizeText(nombreResponsable),
      cargo: sanitizeText(cargo),
      tipo_gasto: tipoGasto || 'Alimentación / Viáticos',
      tipo_pago: tipoPago || 'Efectivo / Caja menor',
      objeto: sanitizeText(objeto),
      foto_path: `factura_${Date.now()}_${cufe.substring(0, 8)}.jpg`,
      foto_url: fotoUrl,
      foto_tomada_en: fotoTomadaEn || new Date().toISOString(),
      estado: 'pendiente',
    };

    try {
      if (!navigator.onLine) {
        // Encolado offline en IndexedDB
        await encolarGastoOffline(payloadGasto);
        setGuardadoOffline(true);
        setGastoCreado(payloadGasto);
        onGastoGuardado(payloadGasto);
        setPaso('exito');
        return;
      }

      const resp = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadGasto),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 409 && errorData.duplicado) {
          setInfoDuplicado(errorData);
          throw new Error(errorData.error || 'Factura duplicada en el sistema');
        }
        throw new Error(errorData.error || 'Error al guardar el gasto en el servidor');
      }

      const guardado = await resp.json();
      setGuardadoOffline(false);
      setGastoCreado(guardado);
      onGastoGuardado(guardado);
      setPaso('exito');
    } catch (err: any) {
      console.error('Error al radicar gasto:', err);
      if (!navigator.onLine || err.message?.includes('Failed to fetch')) {
        await encolarGastoOffline(payloadGasto);
        setGuardadoOffline(true);
        setGastoCreado(payloadGasto);
        onGastoGuardado(payloadGasto);
        setPaso('exito');
      } else {
        setErrorGlobal(err.message || 'Error inesperado al radicar');
      }
    } finally {
      setGuardando(false);
    }
  };

  const reiniciarFormulario = () => {
    setPaso('inicio');
    setFotoUrl('');
    setFotoBase64('');
    setFotoTomadaEn('');
    setEmisor('');
    setNumeroFactura('');
    setCufe('');
    setValorNeto(0);
    setIva(0);
    setTotal(0);
    setObjeto('');
    setInfoDuplicado(null);
    setErrorGlobal(null);
    setGastoCreado(null);
  };

  const estadoAritmetica = verificarAritmeticaCOP(valorNeto, iva, total);

  // VISTA 1: CÁMARA EN VIVO
  if (paso === 'camara') {
    return (
      <LiveCamera
        onCapture={handleCapture}
        onCancel={() => setPaso('inicio')}
      />
    );
  }

  // VISTA 2: PROCESAMIENTO CON IA DE VISIÓN
  if (paso === 'procesando_ia') {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-5">
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
            <Sparkles className="w-10 h-10 animate-spin" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Analizando Factura Electrónica...
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            El modelo de visión artificial está localizando el CUFE de 96 caracteres, el emisor y desglosando los impuestos de la DIAN.
          </p>
        </div>

        {fotoUrl && (
          <div className="w-48 h-32 mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
            <img src={fotoUrl} alt="Vista previa" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    );
  }

  // VISTA 3: CONFIRMACIÓN EXITOSA
  if (paso === 'exito') {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border-4 border-emerald-200 dark:border-emerald-800 shadow-xl">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            ¡Gasto Radicado con Éxito!
          </h2>
          {guardadoOffline ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5" />
              Guardado en cola fuera de línea (se sincronizará al reconectar)
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              El comprobante y su código CUFE han quedado registrados para revisión contable.
            </p>
          )}
        </div>

        {gastoCreado && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2 shadow-sm">
            <div className="flex justify-between border-b pb-2 dark:border-slate-700">
              <span className="text-slate-400">Total Legalizado:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                {formatCOP(gastoCreado.total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Emisor:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {gastoCreado.emisor}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">N° Factura:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {gastoCreado.numero_factura}
              </span>
            </div>
            <div className="flex flex-col gap-1 pt-1">
              <span className="text-slate-400 text-[10px]">CUFE Verificado:</span>
              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 break-all bg-slate-50 dark:bg-slate-900 p-1.5 rounded">
                {gastoCreado.cufe}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <button
            onClick={onAbrirDrive}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-md active:scale-95 transition text-xs flex items-center justify-center gap-2"
          >
            <Cloud className="w-4 h-4" />
            <span>Respaldar Comprobante en Google Drive</span>
          </button>

          <button
            onClick={reiniciarFormulario}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg active:scale-95 transition text-sm flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            <span>Legalizar Otro Gasto</span>
          </button>
        </div>
      </div>
    );
  }

  // VISTA 4: FORMULARIO PRINCIPAL O BIENVENIDA
  return (
    <div className="max-w-md mx-auto space-y-5 pb-16">
      {/* Tarjeta de Inicio / Tomar Foto */}
      {paso === 'inicio' ? (
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-3xl p-6 shadow-xl space-y-5 relative overflow-hidden">
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
              Módulo de Campo
            </span>
            <h2 className="text-xl font-black text-white">
              Legalización de Gastos DIAN
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Hola, <strong>{usuario.nombre_completo}</strong> ({usuario.cargo}). Fotografía tu factura física o electrónica para extraer automáticamente el CUFE y los valores contables.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-3 relative z-10">
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Validación estricta de CUFE (96 caracteres hexadecimales)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Detección automática de duplicados</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Soporte sin conexión con sincronización automática</span>
            </div>
          </div>

          <button
            onClick={() => setPaso('camara')}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/25 active:scale-95 transition flex items-center justify-center gap-3 text-base"
          >
            <Camera className="w-6 h-6" />
            Tomar Foto de la Factura
          </button>
        </div>
      ) : (
        /* Formulario con Datos */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header con foto capturada */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-sm">Evidencia Fotográfica</h3>
              </div>
              <button
                type="button"
                onClick={() => setPaso('camara')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-slate-200 transition"
              >
                <Camera className="w-3.5 h-3.5" />
                Repetir Foto
              </button>
            </div>

            {fotoUrl && (
              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={fotoUrl} alt="Factura" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                  Cámara trasera en vivo
                </span>
              </div>
            )}
          </div>

          {/* Banner de alerta de duplicado */}
          {infoDuplicado?.duplicado && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-400 text-rose-800 dark:text-rose-200 rounded-2xl space-y-1.5 text-xs animate-shake">
              <div className="flex items-center gap-2 font-black text-rose-900 dark:text-rose-100 text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>¡FACTURA DUPLICADA DETECTADA!</span>
              </div>
              <p>
                Este CUFE ya fue legalizado anteriormente en el sistema contable por:{' '}
                <strong>{infoDuplicado.registrado_por}</strong> ({infoDuplicado.cargo || 'Funcionario'}) el{' '}
                <strong>
                  {infoDuplicado.fecha_registro
                    ? new Date(infoDuplicado.fecha_registro).toLocaleDateString('es-CO')
                    : 'fecha previa'}
                </strong>.
              </p>
              <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                Por política de control interno DIAN, esta radicación está bloqueada.
              </p>
            </div>
          )}

          {/* Banner de Error Global */}
          {errorGlobal && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/40 border border-rose-300 text-rose-700 dark:text-rose-200 text-xs rounded-xl">
              {errorGlobal}
            </div>
          )}

          {/* SECCIÓN 1: DATOS FISCALES EXTRAÍDOS */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-2 dark:border-slate-700">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                1. Datos Fiscales de la Factura
              </h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Emisor / Razón Social del Proveedor *
              </label>
              <input
                required
                type="text"
                placeholder="Ej: Organización Terpel S.A."
                value={emisor}
                onChange={(e) => setEmisor(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  N° Factura / Consecutivo *
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                  <input
                    required
                    type="text"
                    placeholder="FE-1234"
                    value={numeroFactura}
                    onChange={(e) => setNumeroFactura(e.target.value)}
                    className="w-full text-sm p-3 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha de Emisión *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                  <input
                    required
                    type="date"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    className="w-full text-sm p-3 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Campo CUFE 96 hex con contador interactivo */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  Código CUFE (96 hex) *
                </label>
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  {validandoCufeServidor && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      cufe.length === 96
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {cufe.length}/96 hex
                  </span>
                </div>
              </div>

              <textarea
                required
                rows={2}
                value={cufe}
                onChange={handleCufeChange}
                placeholder="Pegue o verifique los 96 caracteres hexadecimales del CUFE"
                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 break-all leading-tight"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Solo dígitos (0-9) y letras de la A a la F. El sistema bloquea duplicados.
              </p>
            </div>

            {/* Desglose de Valores y Alerta Aritmética */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Neto (COP) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={valorNeto || ''}
                    onChange={(e) => setValorNeto(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    IVA (COP) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={iva}
                    onChange={(e) => setIva(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Total (COP) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={total || ''}
                    onChange={(e) => setTotal(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </div>
              </div>

              {/* Indicador de comprobación aritmética */}
              {!estadoAritmetica.cuadra ? (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-200">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>Diferencia: Neto + IVA no suma Total</span>
                  </div>
                  <span className="font-bold">
                    Descuadre: {formatCOP(estadoAritmetica.diferencia)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold px-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aritmética fiscal conforme: Neto + IVA = Total</span>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: DATOS DEL RESPONSABLE Y CLASIFICACIÓN */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-2 dark:border-slate-700">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                2. Datos Operacionales y Justificación
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Responsable del Gasto *
                </label>
                <input
                  required
                  type="text"
                  value={nombreResponsable}
                  onChange={(e) => setNombreResponsable(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo *
                </label>
                <input
                  required
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
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
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
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
                  Medio de Pago *
                </label>
                <select
                  required
                  value={tipoPago}
                  onChange={(e) => setTipoPago(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
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
                Objeto del Gasto / Justificación Operativa *
              </label>
              <textarea
                required
                rows={2}
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                placeholder="Describa el motivo del gasto (ej: Tanqueo vehículo cuadrilla ruta Medellín-Bogotá)"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          {/* BOTÓN DE RADICACIÓN */}
          <button
            type="submit"
            disabled={guardando || Boolean(infoDuplicado?.duplicado)}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-40 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/30 active:scale-95 transition text-base flex items-center justify-center gap-2"
          >
            {guardando ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Radicando Comprobante...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Radicar Legalización ({formatCOP(total)})</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
