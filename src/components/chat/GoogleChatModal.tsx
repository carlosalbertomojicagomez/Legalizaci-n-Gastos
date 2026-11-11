import React, { useState, useEffect } from 'react';
import {
  listarEspaciosChat,
  crearEspacioChat,
  enviarNotificacionGastoChat,
  enviarMensajeChat,
  GoogleChatSpace,
  CHAT_APP_CONSOLE_URL,
} from '../../lib/googleChatService';
import {
  signInWithGoogleWorkspace,
  getWorkspaceAccessToken,
  initDriveAuth,
} from '../../lib/googleDriveAuth';
import { Gasto } from '../../types';
import { formatCOP } from '../../utils/validations';
import {
  MessageSquare,
  Send,
  Plus,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  X,
  ShieldCheck,
  Building2,
  HelpCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gastos: Gasto[];
  gastoSeleccionado?: Gasto | null;
  onEspacioSeleccionado?: (spaceName: string) => void;
}

export const GoogleChatModal: React.FC<Props> = ({
  isOpen,
  onClose,
  gastos,
  gastoSeleccionado,
  onEspacioSeleccionado,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loadingEspacios, setLoadingEspacios] = useState(false);
  const [espacios, setEspacios] = useState<GoogleChatSpace[]>([]);
  const [espacioActivo, setEspacioActivo] = useState<string>('');
  const [nuevoEspacioNombre, setNuevoEspacioNombre] = useState('');
  const [mostrandoCrearEspacio, setMostrandoCrearEspacio] = useState(false);
  const [creandoEspacio, setCreandoEspacio] = useState(false);

  // Gasto a enviar
  const [gastoParaEnviarId, setGastoParaEnviarId] = useState<string>(
    gastoSeleccionado?.id || (gastos.length > 0 ? gastos[0].id : '')
  );

  // Estados de envío y confirmación mandatoria
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [errorChatAppNotConfigured, setErrorChatAppNotConfigured] = useState(false);
  const [modalConfirmacionEnvio, setModalConfirmacionEnvio] = useState(false);

  // Mensaje libre opcional
  const [modoEnvio, setModoEnvio] = useState<'gasto' | 'mensaje_directo'>('gasto');
  const [mensajeLibre, setMensajeLibre] = useState('');

  // Verificar sesión OAuth inicial
  useEffect(() => {
    initDriveAuth(
      () => {
        setIsAuthenticated(true);
        cargarEspacios();
      },
      () => {
        setIsAuthenticated(false);
      }
    );
  }, []);

  // Sincronizar si cambia gastoSeleccionado
  useEffect(() => {
    if (gastoSeleccionado) {
      setGastoParaEnviarId(gastoSeleccionado.id);
    }
  }, [gastoSeleccionado]);

  const handleLogin = async () => {
    setIsAuthenticating(true);
    setErrorGlobal(null);
    try {
      const res = await signInWithGoogleWorkspace();
      if (res?.accessToken) {
        setIsAuthenticated(true);
        await cargarEspacios();
      }
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      setErrorGlobal(err.message || 'No fue posible completar la autenticación con Google');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const cargarEspacios = async () => {
    setLoadingEspacios(true);
    setErrorGlobal(null);
    setErrorChatAppNotConfigured(false);
    try {
      const list = await listarEspaciosChat();
      setEspacios(list);
      if (list.length > 0 && !espacioActivo) {
        setEspacioActivo(list[0].name);
        if (onEspacioSeleccionado) onEspacioSeleccionado(list[0].name);
      }
    } catch (err: any) {
      console.warn('Error al cargar espacios de Google Chat:', err);
      if (err.isChatAppNotConfigured || err.message?.includes('Google Chat app not found')) {
        setErrorChatAppNotConfigured(true);
      } else {
        setErrorGlobal(err.message || 'Error al consultar espacios de Google Chat');
      }
    } finally {
      setLoadingEspacios(false);
    }
  };

  const handleCrearEspacio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoEspacioNombre.trim()) return;

    setCreandoEspacio(true);
    setErrorGlobal(null);
    setErrorChatAppNotConfigured(false);

    try {
      const nuevo = await crearEspacioChat(
        nuevoEspacioNombre.trim(),
        'Canal para notificaciones de legalización de gastos DIAN y auditorías contables'
      );
      setEspacios((prev) => [nuevo, ...prev]);
      setEspacioActivo(nuevo.name);
      if (onEspacioSeleccionado) onEspacioSeleccionado(nuevo.name);
      setNuevoEspacioNombre('');
      setMostrandoCrearEspacio(false);
      setMensajeExito(`Espacio "${nuevo.displayName || 'Nuevo'}" creado con éxito en Google Chat`);
    } catch (err: any) {
      console.error('Error al crear espacio:', err);
      if (err.isChatAppNotConfigured || err.message?.includes('Google Chat app not found')) {
        setErrorChatAppNotConfigured(true);
      } else {
        setErrorGlobal(err.message || 'No se pudo crear el espacio en Google Chat');
      }
    } finally {
      setCreandoEspacio(false);
    }
  };

  // Solicitar confirmación obligatoria del usuario antes de enviar el mensaje en su nombre
  const handleSolicitarEnvio = () => {
    if (!espacioActivo) {
      setErrorGlobal('Seleccione o cree un espacio de Google Chat antes de enviar la notificación.');
      return;
    }
    setErrorGlobal(null);
    setMensajeExito(null);
    setModalConfirmacionEnvio(true);
  };

  // Ejecución del envío tras confirmación explícita
  const handleConfirmarYEnviar = async () => {
    setModalConfirmacionEnvio(false);
    setEnviando(true);
    setErrorGlobal(null);
    setMensajeExito(null);

    try {
      const espacioObj = espacios.find((s) => s.name === espacioActivo);
      const nombreEspacio = espacioObj?.displayName || espacioActivo;

      if (modoEnvio === 'gasto') {
        const gasto = gastos.find((g) => g.id === gastoParaEnviarId) || gastoSeleccionado;
        if (!gasto) {
          throw new Error('Seleccione un comprobante de gasto para notificar');
        }

        await enviarNotificacionGastoChat(
          espacioActivo,
          gasto,
          gasto.estado === 'aprobado' ? 'aprobado' : gasto.estado === 'rechazado' ? 'rechazado' : 'radicado'
        );

        setMensajeExito(
          `Notificación fiscal del gasto "${gasto.emisor} (${gasto.numero_factura})" enviada exitosamente al espacio "${nombreEspacio}" de Google Chat.`
        );
      } else {
        if (!mensajeLibre.trim()) {
          throw new Error('Ingrese el contenido del mensaje a enviar');
        }
        await enviarMensajeChat(espacioActivo, mensajeLibre.trim());
        setMensajeLibre('');
        setMensajeExito(`Mensaje publicado exitosamente en "${nombreEspacio}".`);
      }
    } catch (err: any) {
      console.error('Error al enviar a Google Chat:', err);
      if (err.isChatAppNotConfigured || err.message?.includes('Google Chat app not found')) {
        setErrorChatAppNotConfigured(true);
      } else {
        setErrorGlobal(err.message || 'Error al enviar el mensaje a Google Chat');
      }
    } finally {
      setEnviando(false);
    }
  };

  if (!isOpen) return null;

  const gastoSeleccionadoActual = gastos.find((g) => g.id === gastoParaEnviarId) || gastoSeleccionado;
  const espacioSeleccionadoActual = espacios.find((s) => s.name === espacioActivo);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex justify-between items-start border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                Google Chat para Empresas
              </h3>
              <p className="text-xs text-slate-400">
                Notificaciones operacionales y alertas contables en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Requisito de Autenticación Workspace */}
        {!isAuthenticated ? (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Conectar con Google Workspace
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Conecte su cuenta corporativa para listar espacios de Google Chat y notificar automáticamente al equipo sobre radicaciones y aprobaciones contables.
              </p>
            </div>

            <button
              onClick={handleLogin}
              disabled={isAuthenticating}
              className="px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl border border-slate-300 dark:border-slate-600 shadow-md transition flex items-center justify-center gap-3 text-xs mx-auto disabled:opacity-50"
            >
              {isAuthenticating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>Iniciar sesión con Google Workspace</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Aviso especial: Requisito de Google Cloud Console para Google Chat */}
            {errorChatAppNotConfigured && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-2 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2 font-black text-amber-900 dark:text-amber-100">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span>Configuración de Google Chat en Cloud Console</span>
                </div>
                <p className="leading-relaxed">
                  Para emitir mensajes y crear espacios mediante la API de Google Chat con cuentas corporativas, Google Cloud requiere un nombre de aplicación en el proyecto.
                </p>
                <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200 dark:border-amber-800/80 space-y-1.5 font-mono text-[11px]">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Pasos rápidos:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                    <li>Haga clic en el botón de abajo para abrir la consola.</li>
                    <li>Ingrese un nombre de aplicación (ej: <strong>Legalización Colaves</strong>).</li>
                    <li>Guarde la configuración.</li>
                  </ol>
                </div>
                <a
                  href={CHAT_APP_CONSOLE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Configurar Chat App en Google Cloud Console</span>
                </a>
              </div>
            )}

            {/* Selector de Espacio / Sala */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  Espacio / Sala de Google Chat destino:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cargarEspacios}
                    disabled={loadingEspacios}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingEspacios ? 'animate-spin' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                  <button
                    onClick={() => setMostrandoCrearEspacio(!mostrandoCrearEspacio)}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Crear Espacio</span>
                  </button>
                </div>
              </div>

              {/* Crear nuevo espacio inline */}
              {mostrandoCrearEspacio && (
                <form
                  onSubmit={handleCrearEspacio}
                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                    Nombre del nuevo espacio:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Legalización de Gastos Colaves"
                      value={nuevoEspacioNombre}
                      onChange={(e) => setNuevoEspacioNombre(e.target.value)}
                      className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={creandoEspacio || !nuevoEspacioNombre.trim()}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {creandoEspacio ? 'Creando...' : 'Crear'}
                    </button>
                  </div>
                </form>
              )}

              {loadingEspacios ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span>Cargando espacios de Google Chat...</span>
                </div>
              ) : espacios.length > 0 ? (
                <select
                  value={espacioActivo}
                  onChange={(e) => {
                    setEspacioActivo(e.target.value);
                    if (onEspacioSeleccionado) onEspacioSeleccionado(e.target.value);
                  }}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200"
                >
                  {espacios.map((esp) => (
                    <option key={esp.name} value={esp.name}>
                      {esp.displayName || esp.name} ({esp.spaceType || 'SALA'})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-500 space-y-1">
                  <p>No se encontraron espacios existentes en su cuenta de Google Chat.</p>
                  <p className="text-[11px] text-slate-400">
                    Use el botón <strong>"Crear Espacio"</strong> arriba para generar la sala de legalización de gastos.
                  </p>
                </div>
              )}
            </div>

            {/* Pestañas de modo: Notificación de Gasto vs Mensaje */}
            <div className="flex border-b dark:border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setModoEnvio('gasto')}
                className={`pb-2 px-3 transition border-b-2 ${
                  modoEnvio === 'gasto'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Ficha Fiscal de Gasto (DIAN)
              </button>
              <button
                type="button"
                onClick={() => setModoEnvio('mensaje_directo')}
                className={`pb-2 px-3 transition border-b-2 ${
                  modoEnvio === 'mensaje_directo'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Mensaje de Texto Directo
              </button>
            </div>

            {/* Modo 1: Tarjeta de Gasto */}
            {modoEnvio === 'gasto' && (
              <div className="space-y-3">
                {gastos.length > 0 ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Comprobante a Notificar en Google Chat:
                    </label>
                    <select
                      value={gastoParaEnviarId}
                      onChange={(e) => setGastoParaEnviarId(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {gastos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.emisor} — Factura {g.numero_factura} ({formatCOP(g.total)}) [{g.estado.toUpperCase()}]
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No hay gastos radicados aún en el sistema.</p>
                )}

                {/* Previsualización del gasto */}
                {gastoSeleccionadoActual && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                    <div className="flex justify-between items-center border-b pb-1 dark:border-slate-700">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {gastoSeleccionadoActual.emisor}
                      </span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        {formatCOP(gastoSeleccionadoActual.total)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <span>NIT: <strong>{gastoSeleccionadoActual.nit_emisor || 'N/A'}</strong></span>
                      <span>Factura: <strong>{gastoSeleccionadoActual.numero_factura}</strong></span>
                      <span>Responsable: <strong>{gastoSeleccionadoActual.nombre_responsable}</strong></span>
                      <span>Estado: <strong className="uppercase">{gastoSeleccionadoActual.estado}</strong></span>
                    </div>
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-400 block">CUFE Verificado:</span>
                      <span className="font-mono text-[9px] text-slate-600 dark:text-slate-400 break-all bg-white dark:bg-slate-900 p-1 rounded border border-slate-200 dark:border-slate-700 block">
                        {gastoSeleccionadoActual.cufe}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modo 2: Mensaje Directo */}
            {modoEnvio === 'mensaje_directo' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mensaje para el equipo en Google Chat:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Se ha radicado el cierre de legalizaciones quincenales para la auditoría contable."
                  value={mensajeLibre}
                  onChange={(e) => setMensajeLibre(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            )}

            {/* Banners de éxito o error */}
            {mensajeExito && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{mensajeExito}</span>
              </div>
            )}

            {errorGlobal && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 text-rose-800 dark:text-rose-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{errorGlobal}</span>
              </div>
            )}

            {/* Botón de Envío */}
            <button
              onClick={handleSolicitarEnvio}
              disabled={enviando || !espacioActivo}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-2xl shadow-lg active:scale-95 transition text-xs flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {enviando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enviando notificación a Google Chat...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar Notificación a Google Chat</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* DIÁLOGO MANDATORIO DE CONFIRMACIÓN DE MUTACIÓN DE DATOS WORKSPACE */}
      {modalConfirmacionEnvio && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setModalConfirmacionEnvio(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-slate-900 dark:text-white border-b pb-2 dark:border-slate-800">
              <HelpCircle className="w-5 h-5 text-emerald-600" />
              <h4 className="font-black text-sm">Confirmar Envío a Google Chat</h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              ¿Está seguro de publicar esta notificación en el espacio{' '}
              <strong>"{espacioSeleccionadoActual?.displayName || espacioActivo}"</strong> en nombre de su cuenta de Google Workspace?
            </p>

            {modoEnvio === 'gasto' && gastoSeleccionadoActual && (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 space-y-1 border border-slate-200 dark:border-slate-700">
                <p><strong>Comprobante:</strong> {gastoSeleccionadoActual.emisor}</p>
                <p><strong>Factura:</strong> {gastoSeleccionadoActual.numero_factura} ({formatCOP(gastoSeleccionadoActual.total)})</p>
                <p><strong>Responsable:</strong> {gastoSeleccionadoActual.nombre_responsable}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmacionEnvio(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarYEnviar}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirmar y Publicar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
