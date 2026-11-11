import React, { useState, useEffect } from 'react';
import {
  initDriveAuth,
  signInWithGoogleWorkspace,
  logoutGoogleWorkspace,
  getWorkspaceAccessToken,
} from '../../lib/googleDriveAuth';
import {
  crearHojaDeCalculoGastos,
  sincronizarGastosConGoogleSheets,
  listarHojasCalculoDeUsuario,
  obtenerMetadatosHoja,
  GoogleSheetSummary,
} from '../../lib/googleSheetsService';
import { Gasto } from '../../types';
import { formatCOP } from '../../utils/validations';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Link,
  Table,
  Check,
  LogOut,
  Sparkles
} from 'lucide-react';
import { User } from 'firebase/auth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gastos: Gasto[];
  carpetaDriveId?: string;
}

export const GoogleSheetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  gastos,
  carpetaDriveId,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  // Hoja vinculada actualmente
  const [hojaVinculada, setHojaVinculada] = useState<{
    spreadsheetId: string;
    title: string;
    url: string;
    ultimaSincronizacion?: string;
  } | null>(() => {
    const guardada = localStorage.getItem('google_sheet_vinculada');
    return guardada ? JSON.parse(guardada) : null;
  });

  // Hojas existentes en el Drive del usuario
  const [hojasExistentes, setHojasExistentes] = useState<
    Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }>
  >([]);
  const [cargandoHojas, setCargandoHojas] = useState(false);
  const [mostrarSelectorExistente, setMostrarSelectorExistente] = useState(false);

  // Estados de ejecución
  const [sincronizando, setSincronizando] = useState(false);
  const [creandoHoja, setCreandoHoja] = useState(false);
  const [mostrarCrearHoja, setMostrarCrearHoja] = useState(false);
  const [nuevoNombreHoja, setNuevoNombreHoja] = useState('');
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [dialogoConfirmar, setDialogoConfirmar] = useState<{
    titulo: string;
    mensaje: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initDriveAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        cargarHojasExistentes();
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );

    getWorkspaceAccessToken().then((cached) => {
      if (cached) {
        setToken(cached);
        cargarHojasExistentes();
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  const cargarHojasExistentes = async () => {
    setCargandoHojas(true);
    try {
      const lista = await listarHojasCalculoDeUsuario();
      setHojasExistentes(lista);
    } catch (err: any) {
      console.warn('Aviso listando hojas:', err.message);
    } finally {
      setCargandoHojas(false);
    }
  };

  const handleConectar = async () => {
    setConectando(true);
    setMensajeError(null);
    try {
      const result = await signInWithGoogleWorkspace();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await cargarHojasExistentes();
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error al conectar con Google Sheets');
    } finally {
      setConectando(false);
    }
  };

  const handleDesconectar = async () => {
    await logoutGoogleWorkspace();
    setUser(null);
    setToken(null);
  };

  // Crear una nueva hoja en Google Sheets
  const handleAbrirCrearHoja = () => {
    setNuevoNombreHoja(`Legalización de Gastos DIAN - ${new Date().getFullYear()}`);
    setMostrarCrearHoja(true);
  };

  const ejecutarCrearNuevaHoja = async () => {
    if (!nuevoNombreHoja.trim()) return;

    setCreandoHoja(true);
    setMensajeError(null);
    try {
      const nueva = await crearHojaDeCalculoGastos(nuevoNombreHoja.trim(), carpetaDriveId);

      const nuevaHoja = {
        spreadsheetId: nueva.spreadsheetId,
        title: nueva.title,
        url: nueva.spreadsheetUrl,
        ultimaSincronizacion: new Date().toISOString(),
      };

      setHojaVinculada(nuevaHoja);
      localStorage.setItem('google_sheet_vinculada', JSON.stringify(nuevaHoja));

      // Sincronizar los gastos actuales en la hoja recién creada
      await sincronizarGastosConGoogleSheets(nueva.spreadsheetId, gastos);

      setMensajeExito(`¡Hoja "${nueva.title}" creada y sincronizada con éxito en Google Sheets!`);
      setTimeout(() => setMensajeExito(null), 4000);
      setMostrarCrearHoja(false);
      setNuevoNombreHoja('');
      await cargarHojasExistentes();
    } catch (err: any) {
      setMensajeError('Error creando hoja: ' + err.message);
    } finally {
      setCreandoHoja(false);
    }
  };

  // Vincular hoja existente seleccionada
  const handleVincularHojaExistente = async (item: { id: string; name: string }) => {
    try {
      const meta = await obtenerMetadatosHoja(item.id);
      const vinculada = {
        spreadsheetId: item.id,
        title: meta.titulo,
        url: meta.enlace,
        ultimaSincronizacion: undefined,
      };
      setHojaVinculada(vinculada);
      localStorage.setItem('google_sheet_vinculada', JSON.stringify(vinculada));
      setMostrarSelectorExistente(false);
      setMensajeExito(`Hoja "${meta.titulo}" vinculada correctamente.`);
      setTimeout(() => setMensajeExito(null), 3000);
    } catch (err: any) {
      setMensajeError('Error al acceder a la hoja: ' + err.message);
    }
  };

  // Sincronizar datos actuales con la hoja vinculada (con confirmación previa segura)
  const ejecutarSincronizacion = async () => {
    if (!hojaVinculada) return;
    setSincronizando(true);
    setMensajeError(null);
    try {
      const res = await sincronizarGastosConGoogleSheets(hojaVinculada.spreadsheetId, gastos);

      const actualizada = {
        ...hojaVinculada,
        ultimaSincronizacion: new Date().toISOString(),
      };
      setHojaVinculada(actualizada);
      localStorage.setItem('google_sheet_vinculada', JSON.stringify(actualizada));

      setMensajeExito(
        `¡Sincronización exitosa! Se actualizaron ${res.filasActualizadas} filas en Google Sheets.`
      );
      setTimeout(() => setMensajeExito(null), 4000);
    } catch (err: any) {
      setMensajeError('Error sincronizando con Google Sheets: ' + err.message);
    } finally {
      setSincronizando(false);
    }
  };

  const handleSincronizarAhora = () => {
    if (!hojaVinculada) {
      setMensajeError('Primero cree o vincule una hoja de cálculo de Google Sheets.');
      return;
    }

    setDialogoConfirmar({
      titulo: '¿Sincronizar con Google Sheets?',
      mensaje: `¿Desea actualizar y sincronizar los ${gastos.length} gastos actuales en la hoja de cálculo "${hojaVinculada.title}" de Google Sheets?`,
      onConfirm: async () => {
        setDialogoConfirmar(null);
        await ejecutarSincronizacion();
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex justify-between items-start border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                Google Workspace
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Google Sheets - Sincronización Contable
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensajes */}
        {mensajeExito && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {mensajeError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{mensajeError}</span>
          </div>
        )}

        {/* ESTADO 1: NO AUTENTICADO */}
        {!token ? (
          <div className="py-8 text-center space-y-4 max-w-sm mx-auto">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">
                Conectar con Google Sheets
              </p>
              <p>
                Permite mantener una hoja de cálculo en la nube actualizada automáticamente con los gastos legalizados, comprobantes DIAN y fórmulas contables en pesos colombianos.
              </p>
            </div>

            <button
              onClick={handleConectar}
              disabled={conectando}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 font-bold text-sm rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow transition active:scale-95 disabled:opacity-50"
            >
              {conectando ? (
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              )}
              <span>Iniciar Sesión con Google</span>
            </button>
          </div>
        ) : (
          /* ESTADO 2: AUTENTICADO */
          <div className="space-y-4">
            {/* Banner de Usuario */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    {user?.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {user?.displayName || 'Usuario de Google'}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">{user?.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Habilitado
                </span>
                <button
                  onClick={handleDesconectar}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                  title="Cerrar sesión de Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* HOJA VINCULADA ACTUAL */}
            {hojaVinculada ? (
              <div className="bg-gradient-to-br from-emerald-950 to-slate-900 text-white rounded-3xl p-5 border border-emerald-800/60 shadow-xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700">
                      Hoja de Google Sheets Activa
                    </span>
                    <h3 className="text-lg font-black text-white mt-1">
                      {hojaVinculada.title}
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      {hojaVinculada.ultimaSincronizacion ? (
                        <>Última sincronización: {new Date(hojaVinculada.ultimaSincronizacion).toLocaleTimeString('es-CO')}</>
                      ) : (
                        'Pendiente de sincronizar'
                      )}
                    </p>
                  </div>

                  <a
                    href={hojaVinculada.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition backdrop-blur-sm"
                  >
                    <span>Abrir en Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleSincronizarAhora}
                    disabled={sincronizando}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
                  >
                    <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
                    <span>{sincronizando ? 'Actualizando...' : `Sincronizar ${gastos.length} Facturas`}</span>
                  </button>

                  <button
                    onClick={() => setMostrarSelectorExistente(true)}
                    className="px-3.5 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs transition"
                  >
                    Cambiar Hoja
                  </button>
                </div>
              </div>
            ) : (
              /* SIN HOJA VINCULADA */
              <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
                <FileSpreadsheet className="w-10 h-10 mx-auto text-emerald-600" />
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Ninguna hoja vinculada todavía
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Crea una nueva hoja de cálculo corporativa o vincula una existente de tu cuenta.
                  </p>
                </div>

                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={handleAbrirCrearHoja}
                    disabled={creandoHoja}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{creandoHoja ? 'Creando...' : 'Crear Nueva Hoja en Sheets'}</span>
                  </button>

                  <button
                    onClick={() => setMostrarSelectorExistente(true)}
                    className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs"
                  >
                    Vincular Existente
                  </button>
                </div>
              </div>
            )}

            {/* SELECTOR DE HOJAS EXISTENTES */}
            {mostrarSelectorExistente && (
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Seleccionar hoja de Google Drive:
                  </span>
                  <button
                    onClick={() => setMostrarSelectorExistente(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>

                {cargandoHojas ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Consultando Google Drive...</p>
                ) : hojasExistentes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No se encontraron hojas de cálculo en Drive. Puedes crear una nueva.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                    {hojasExistentes.map((h) => (
                      <div
                        key={h.id}
                        className="py-2 px-2 flex items-center justify-between hover:bg-white dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <div className="flex items-center gap-2 truncate max-w-[70%]">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-semibold truncate">{h.name}</span>
                        </div>
                        <button
                          onClick={() => handleVincularHojaExistente(h)}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700"
                        >
                          Vincular
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resumen de Columnas que se Sincronizan */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Table className="w-4 h-4 text-emerald-600" />
                Estructura de Columnas Sincronizadas (DIAN):
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Fecha Registro, Estado, Responsable, Cargo, Emisor, Factura N°, Fecha Emisión, Vencimiento, Tipo de Gasto, Medio de Pago, Objeto, Valor Neto (COP), IVA (COP), Total (COP), CUFE (96 Hex) y fila automática con fórmula <code>=SUM(...)</code>.
              </p>
            </div>
          </div>
        )}

        {/* MODAL SEGURO DE CONFIRMACIÓN */}
        {dialogoConfirmar && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setDialogoConfirmar(null)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-emerald-300 dark:border-emerald-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-emerald-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {dialogoConfirmar.titulo}
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {dialogoConfirmar.mensaje}
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDialogoConfirmar(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={dialogoConfirmar.onConfirm}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-1.5"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PARA CREAR NUEVA HOJA EN SHEETS */}
        {mostrarCrearHoja && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setMostrarCrearHoja(false)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-emerald-300 dark:border-emerald-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Nueva Hoja de Cálculo en Sheets
              </h3>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Título de la hoja
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="ej: Legalización de Gastos DIAN - 2026"
                  value={nuevoNombreHoja}
                  onChange={(e) => setNuevoNombreHoja(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setMostrarCrearHoja(false)}
                  disabled={creandoHoja}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={ejecutarCrearNuevaHoja}
                  disabled={creandoHoja || !nuevoNombreHoja.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50"
                >
                  {creandoHoja ? 'Creando...' : 'Crear y Sincronizar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
