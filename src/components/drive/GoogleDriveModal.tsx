import React, { useState, useEffect } from 'react';
import {
  initDriveAuth,
  signInWithGoogleDrive,
  logoutGoogleDrive,
  getDriveAccessToken,
} from '../../lib/googleDriveAuth';
import {
  listarArchivosDrive,
  obtenerOCrearCarpetaPrincipal,
  crearCarpetaDrive,
  respaldarReporteExcelEnDrive,
  eliminarArchivoDrive,
  DriveFileItem,
  respaldarFacturaEnDrive,
} from '../../lib/googleDriveService';
import { generarExcelBlob } from '../../utils/excelExporter';
import { Gasto } from '../../types';
import {
  X,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  Trash2,
  FileSpreadsheet,
  Image as ImageIcon,
  Folder,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  FolderOpen
} from 'lucide-react';
import { User } from 'firebase/auth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gastos: Gasto[];
}

export const GoogleDriveModal: React.FC<Props> = ({ isOpen, onClose, gastos }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [cargandoArchivos, setCargandoArchivos] = useState(false);
  const [archivos, setArchivos] = useState<DriveFileItem[]>([]);
  const [carpetaActual, setCarpetaActual] = useState<{ id: string; name: string } | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // Acciones en curso
  const [subiendoExcel, setSubiendoExcel] = useState(false);
  const [respaldandoTodo, setRespaldandoTodo] = useState(false);
  const [progresoRespaldo, setProgresoRespaldo] = useState<{ total: number; actual: number } | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Modales seguros en lugar de window.confirm/prompt/alert
  const [archivoAEliminar, setArchivoAEliminar] = useState<DriveFileItem | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [dialogoConfirmar, setDialogoConfirmar] = useState<{
    titulo: string;
    mensaje: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [mostrarCrearCarpeta, setMostrarCrearCarpeta] = useState(false);
  const [nuevoNombreCarpeta, setNuevoNombreCarpeta] = useState('');
  const [creandoCarpeta, setCreandoCarpeta] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initDriveAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        cargarCarpetaYArchivos();
      },
      () => {
        setUser(null);
        setToken(null);
        setArchivos([]);
      }
    );

    // Verificar si ya hay token en memoria
    getDriveAccessToken().then((cached) => {
      if (cached) {
        setToken(cached);
        cargarCarpetaYArchivos();
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  const cargarCarpetaYArchivos = async () => {
    setCargandoArchivos(true);
    setMensajeError(null);
    try {
      // Obtener o crear la carpeta corporativa en Google Drive
      const carpeta = await obtenerOCrearCarpetaPrincipal('Legalización de Gastos - DIAN');
      setCarpetaActual({ id: carpeta.id, name: carpeta.name });

      const files = await listarArchivosDrive(carpeta.id, busqueda);
      setArchivos(files);
    } catch (err: any) {
      console.warn('Error cargando archivos de Drive:', err);
      setMensajeError(err.message || 'Error al conectar con Google Drive');
    } finally {
      setCargandoArchivos(false);
    }
  };

  const handleConectarGoogle = async () => {
    setConectando(true);
    setMensajeError(null);
    try {
      const result = await signInWithGoogleDrive();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await cargarCarpetaYArchivos();
      }
    } catch (err: any) {
      console.error(err);
      setMensajeError(err.message || 'Fallo en la autenticación con Google Workspace');
    } finally {
      setConectando(false);
    }
  };

  const handleDesconectar = async () => {
    await logoutGoogleDrive();
    setUser(null);
    setToken(null);
    setArchivos([]);
    setCarpetaActual(null);
  };

  const handleCrearSubcarpeta = () => {
    setNuevoNombreCarpeta('');
    setMostrarCrearCarpeta(true);
  };

  const ejecutarCrearSubcarpeta = async () => {
    if (!nuevoNombreCarpeta.trim()) return;
    setCreandoCarpeta(true);
    setMensajeError(null);
    try {
      await crearCarpetaDrive(nuevoNombreCarpeta.trim(), carpetaActual?.id);
      setMensajeExito(`Carpeta "${nuevoNombreCarpeta.trim()}" creada en Google Drive.`);
      setTimeout(() => setMensajeExito(null), 3000);
      setMostrarCrearCarpeta(false);
      setNuevoNombreCarpeta('');
      await cargarCarpetaYArchivos();
    } catch (err: any) {
      setMensajeError('Error creando carpeta: ' + err.message);
    } finally {
      setCreandoCarpeta(false);
    }
  };

  const ejecutarSubidaExcel = async () => {
    setSubiendoExcel(true);
    setMensajeError(null);
    try {
      const blob = await generarExcelBlob(gastos);
      const nombreArchivo = `Reporte_Gastos_DIAN_${new Date().toISOString().split('T')[0]}.xlsx`;

      await respaldarReporteExcelEnDrive(
        blob,
        nombreArchivo,
        carpetaActual?.id
      );

      setMensajeExito(`¡Reporte Excel subido exitosamente a Google Drive!`);
      setTimeout(() => setMensajeExito(null), 4000);
      await cargarCarpetaYArchivos();
    } catch (err: any) {
      setMensajeError('Error subiendo reporte Excel: ' + err.message);
    } finally {
      setSubiendoExcel(false);
    }
  };

  const handleSubirExcelADrive = () => {
    if (gastos.length === 0) {
      setMensajeError('No hay gastos disponibles para exportar a Google Drive.');
      return;
    }

    setDialogoConfirmar({
      titulo: '¿Subir consolidado a Google Drive?',
      mensaje: `¿Desea generar y subir el reporte consolidado de ${gastos.length} comprobante(s) con imágenes incrustadas a la carpeta "${carpetaActual?.name || 'Drive'}"?`,
      onConfirm: ejecutarSubidaExcel,
    });
  };

  const ejecutarRespaldoFotos = async (facturasConFoto: typeof gastos) => {
    setRespaldandoTodo(true);
    setMensajeError(null);
    setProgresoRespaldo({ total: facturasConFoto.length, actual: 0 });

    try {
      let subidas = 0;
      for (const gasto of facturasConFoto) {
        try {
          await respaldarFacturaEnDrive(gasto, carpetaActual?.id);
          subidas++;
          setProgresoRespaldo({ total: facturasConFoto.length, actual: subidas });
        } catch (e) {
          console.warn('Error subiendo factura:', e);
        }
      }

      setMensajeExito(`Se respaldaron ${subidas} fotografías en Google Drive.`);
      setTimeout(() => setMensajeExito(null), 4000);
      await cargarCarpetaYArchivos();
    } catch (err: any) {
      setMensajeError('Error durante el respaldo masivo: ' + err.message);
    } finally {
      setRespaldandoTodo(false);
      setProgresoRespaldo(null);
    }
  };

  const handleRespaldarTodasLasFacturas = () => {
    const facturasConFoto = gastos.filter((g) => Boolean(g.foto_url));
    if (facturasConFoto.length === 0) {
      setMensajeError('No hay facturas con fotografía disponibles.');
      return;
    }

    setDialogoConfirmar({
      titulo: '¿Respaldar fotografías en Google Drive?',
      mensaje: `¿Desea respaldar las fotografías de las ${facturasConFoto.length} facturas registradas en la carpeta de Google Drive?`,
      onConfirm: () => ejecutarRespaldoFotos(facturasConFoto),
    });
  };

  // REGLA CRÍTICA: Confirmación explícita para operaciones destructivas
  const handleConfirmarEliminacion = async () => {
    if (!archivoAEliminar) return;
    setEliminando(true);
    try {
      await eliminarArchivoDrive(archivoAEliminar.id);
      setMensajeExito(`El archivo "${archivoAEliminar.name}" fue eliminado de Google Drive.`);
      setTimeout(() => setMensajeExito(null), 3000);
      setArchivoAEliminar(null);
      await cargarCarpetaYArchivos();
    } catch (err: any) {
      setMensajeError('Error al eliminar archivo: ' + err.message);
    } finally {
      setEliminando(false);
    }
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
        {/* Cabecera del Modal */}
        <div className="flex justify-between items-start border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                Google Workspace Cloud Storage
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Google Drive para Legalizaciones
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

        {/* Notificaciones */}
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
                Conecta tu cuenta de Google Workspace
              </p>
              <p>
                Permite respaldar automáticamente las fotografías de las facturas DIAN y subir reportes contables en Excel (.xlsx) a tu carpeta segura en Google Drive con permiso de tu usuario.
              </p>
            </div>

            {/* Botón Oficial "Sign in with Google" / Conectar */}
            <button
              onClick={handleConectarGoogle}
              disabled={conectando}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 font-bold text-sm rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow transition active:scale-95 disabled:opacity-50"
            >
              {conectando ? (
                <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
              )}
              <span>Conectar con Google Drive</span>
            </button>
          </div>
        ) : (
          /* ESTADO 2: AUTENTICADO CON GOOGLE DRIVE */
          <div className="space-y-4">
            {/* Banner de Usuario Conectado */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
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
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
                <button
                  onClick={handleDesconectar}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                  title="Desconectar cuenta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Barra de Acciones de Drive */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>Carpeta: {carpetaActual?.name || 'Cargando...'}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCrearSubcarpeta}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Nueva Carpeta</span>
                </button>

                <button
                  onClick={handleSubirExcelADrive}
                  disabled={subiendoExcel}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                  title="Sube el archivo Excel con todas las imágenes incrustadas a Google Drive"
                >
                  {subiendoExcel ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>Subir Reporte Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleRespaldarTodasLasFacturas}
                  disabled={respaldandoTodo}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                  title="Sube las fotos de comprobantes a Google Drive"
                >
                  {respaldandoTodo ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>Respaldar Facturas ({gastos.length})</span>
                </button>
              </div>
            </div>

            {/* Barra de progreso de respaldo masivo */}
            {progresoRespaldo && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
                <div className="flex justify-between font-bold text-[11px]">
                  <span>Subiendo facturas a Google Drive...</span>
                  <span>
                    {progresoRespaldo.actual} de {progresoRespaldo.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${(progresoRespaldo.actual / progresoRespaldo.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Explorador de Archivos en Google Drive */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500">
                  Archivos en Google Drive ({archivos.length})
                </span>
                <button
                  onClick={cargarCarpetaYArchivos}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                  title="Recargar archivos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cargandoArchivos ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {cargandoArchivos ? (
                  <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Consultando Google Drive...</span>
                  </div>
                ) : archivos.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    No hay archivos en esta carpeta de Google Drive aún.
                  </div>
                ) : (
                  archivos.map((file) => {
                    const esCarpeta = file.mimeType === 'application/vnd.google-apps.folder';
                    const esExcel =
                      file.name.endsWith('.xlsx') ||
                      file.mimeType.includes('spreadsheet') ||
                      file.mimeType.includes('sheet');
                    const esImagen =
                      file.mimeType.startsWith('image/') ||
                      file.name.endsWith('.jpg') ||
                      file.name.endsWith('.png');

                    return (
                      <div
                        key={file.id}
                        className="p-2.5 px-3 flex items-center justify-between hover:bg-white dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-2.5 max-w-[70%]">
                          <div className="text-slate-500 flex-shrink-0">
                            {esCarpeta ? (
                              <Folder className="w-4 h-4 text-amber-500" />
                            ) : esExcel ? (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            ) : esImagen ? (
                              <ImageIcon className="w-4 h-4 text-blue-500" />
                            ) : (
                              <FileText className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="truncate">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {file.name}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {file.modifiedTime
                                ? new Date(file.modifiedTime).toLocaleDateString('es-CO')
                                : 'Reciente'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              title="Abrir en Google Drive"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setArchivoAEliminar(file)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Eliminar archivo de Google Drive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL MANDATORIO DE CONFIRMACIÓN PARA OPERACIONES DESTRUCTIVAS */}
        {archivoAEliminar && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setArchivoAEliminar(null)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-rose-300 dark:border-rose-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  ¿Eliminar archivo de Google Drive?
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                ¿Está seguro de que desea eliminar permanentemente el archivo{' '}
                <strong>"{archivoAEliminar.name}"</strong> de su cuenta de Google Drive? Esta acción no se puede deshacer.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setArchivoAEliminar(null)}
                  disabled={eliminando}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarEliminacion}
                  disabled={eliminando}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-1.5"
                >
                  {eliminando ? (
                    <span>Eliminando...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirmar Eliminación</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SEGURO DE CONFIRMACIÓN DE OPERACIONES EN NUBE */}
        {dialogoConfirmar && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setDialogoConfirmar(null)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-amber-300 dark:border-amber-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-amber-600">
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
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md flex items-center gap-1.5"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PARA CREAR CARPETA EN DRIVE */}
        {mostrarCrearCarpeta && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setMostrarCrearCarpeta(false)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Crear Nueva Carpeta en Drive
              </h3>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Nombre de la carpeta
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="ej: Auditoría Octubre 2026"
                  value={nuevoNombreCarpeta}
                  onChange={(e) => setNuevoNombreCarpeta(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setMostrarCrearCarpeta(false)}
                  disabled={creandoCarpeta}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={ejecutarCrearSubcarpeta}
                  disabled={creandoCarpeta || !nuevoNombreCarpeta.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50"
                >
                  {creandoCarpeta ? 'Creando...' : 'Crear Carpeta'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
