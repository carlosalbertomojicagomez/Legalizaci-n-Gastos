import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gasto, RolUsuario, UsuarioPerfil, NotificacionItem } from './types';
import {
  auth,
  getIdToken,
  fetchUserProfile,
  logout,
} from './lib/firebaseClient';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Navbar } from './components/common/Navbar';
import { Sidebar, NavItemKey } from './components/common/Sidebar';
import { WorkerExpenseForm } from './components/worker/WorkerExpenseForm';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthScreen } from './components/auth/AuthScreen';
import { UserManagementModal } from './components/admin/UserManagementModal';
import { CatalogModal } from './components/admin/CatalogModal';
import { ValidationTestsModal } from './components/common/ValidationTestsModal';
import { GoogleDriveModal } from './components/drive/GoogleDriveModal';
import { GoogleSheetsModal } from './components/sheets/GoogleSheetsModal';
import { GoogleChatModal } from './components/chat/GoogleChatModal';
import { NotificationToasts } from './components/notifications/NotificationToasts';
import { procesarNotificacionDeGasto } from './utils/notifications';
import { ColavesLogo } from './components/common/ColavesLogo';
import {
  obtenerColaOffline,
  sincronizarColaConServidor,
} from './lib/offlineQueue';
import { RefreshCw, Cloud, FileSpreadsheet, MessageSquare, ExternalLink, ShieldCheck } from 'lucide-react';

export default function App() {
  // Estado de Autenticación Real de Firebase
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authCargando, setAuthCargando] = useState(true);
  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(null);
  const [rol, setRol] = useState<RolUsuario>('trabajador');

  const usuarioRef = useRef<UsuarioPerfil | null>(null);
  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);

  // Navegación con Barra Lateral
  const [seccionActiva, setSeccionActiva] = useState<NavItemKey>('registro');
  const [sidebarColapsada, setSidebarColapsada] = useState(false);
  const [sidebarAbiertaMobile, setSidebarAbiertaMobile] = useState(false);

  // Datos
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargandoGastos, setCargandoGastos] = useState(true);

  const [catalogos, setCatalogos] = useState<{
    tiposGasto: string[];
    tiposPago: string[];
  }>({
    tiposGasto: [
      'Alimentación / Viáticos',
      'Transporte terrestre',
      'Combustible',
      'Hospedaje',
      'Peajes / Parqueaderos',
      'Mantenimiento técnico',
      'Papelería / Útiles',
      'Imprevistos de operación',
    ],
    tiposPago: [
      'Efectivo / Caja menor',
      'Tarjeta corporativa',
      'Transferencia Bancolombia',
      'Transferencia Nequi / Daviplata',
    ],
  });

  // Conexión y Cola Offline
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [colaOfflineCount, setColaOfflineCount] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  // Modales
  const [modalUsuarios, setModalUsuarios] = useState(false);
  const [modalCatalogos, setModalCatalogos] = useState(false);
  const [modalTests, setModalTests] = useState(false);
  const [modalDrive, setModalDrive] = useState(false);
  const [modalSheets, setModalSheets] = useState(false);
  const [modalChat, setModalChat] = useState(false);
  const [gastoParaChat, setGastoParaChat] = useState<Gasto | null>(null);

  // Notificaciones de Aprobación/Rechazo
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>(() => {
    const saved = localStorage.getItem('colaves_notificaciones_gastos');
    return saved ? JSON.parse(saved) : [];
  });
  const [toastsActivos, setToastsActivos] = useState<NotificacionItem[]>([]);

  useEffect(() => {
    localStorage.setItem('colaves_notificaciones_gastos', JSON.stringify(notificaciones));
  }, [notificaciones]);

  // Modo Oscuro / Claro
  const [temaOscuro, setTemaOscuro] = useState(() => {
    const saved = localStorage.getItem('colaves_tema_oscuro');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (temaOscuro) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('colaves_tema_oscuro', String(temaOscuro));
  }, [temaOscuro]);

  // Escuchar cambios en la sesión de Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const perfil = await fetchUserProfile(user.uid, user.email);
          const rolAsignado: RolUsuario = perfil?.rol || (user.email?.toLowerCase() === 'carlosalbertomojicagomez@gmail.com' ? 'administrador' : 'trabajador');
          const perfilFinal: UsuarioPerfil = {
            id: user.uid,
            email: user.email || '',
            nombre_completo: perfil?.nombre_completo || user.displayName || user.email?.split('@')[0] || 'Funcionario Colaves',
            cargo: perfil?.cargo || (rolAsignado === 'administrador' ? 'Auditor Contable' : 'Funcionario Operativo'),
            rol: rolAsignado,
          };
          setUsuario(perfilFinal);
          setRol(rolAsignado);

          // Si es trabajador, seccion por defecto 'registro'. Si es admin, 'resumen'
          setSeccionActiva(rolAsignado === 'administrador' ? 'resumen' : 'registro');
        } catch (err) {
          console.error('Error cargando perfil tras auth:', err);
        }
      } else {
        setUsuario(null);
      }
      setAuthCargando(false);
    });

    return () => unsubscribe();
  }, []);

  // Cargar Gastos y Catálogos desde Servidor con Token
  const cargarGastos = useCallback(async () => {
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch('/api/expenses', { headers });
      if (resp.ok) {
        const data = await resp.json();
        setGastos(data);
      }
    } catch (err) {
      console.warn('Modo sin conexión o servidor temporalmente inaccesible:', err);
    } finally {
      setCargandoGastos(false);
    }
  }, []);

  const cargarCatalogos = useCallback(async () => {
    try {
      const resp = await fetch('/api/catalogs');
      if (resp.ok) {
        const data = await resp.json();
        setCatalogos(data);
      }
    } catch (err) {
      console.warn('Error cargando catálogos:', err);
    }
  }, []);

  // Actualizar contador de cola offline
  const actualizarContadorOffline = useCallback(async () => {
    const cola = await obtenerColaOffline();
    setColaOfflineCount(cola.length);
  }, []);

  // Sincronizar cola offline con el servidor
  const ejecutarSincronizacionOffline = useCallback(async () => {
    if (sincronizando || !navigator.onLine) return;
    setSincronizando(true);

    try {
      await sincronizarColaConServidor((guardado, exito) => {
        if (exito) {
          setGastos((prev) => {
            const existe = prev.some((g) => g.id === guardado.id);
            return existe ? prev : [guardado, ...prev];
          });
        }
      });
      await actualizarContadorOffline();
    } catch (err) {
      console.error('Error en sincronización offline:', err);
    } finally {
      setSincronizando(false);
    }
  }, [sincronizando, actualizarContadorOffline]);

  // Manejo de eventos online/offline y conexión SSE Realtime
  useEffect(() => {
    if (!firebaseUser) return;

    cargarGastos();
    cargarCatalogos();
    actualizarContadorOffline();

    const handleOnline = () => {
      setIsOnline(true);
      ejecutarSincronizacionOffline();
      cargarGastos();
    };

    const handleOffline = () => {
      setIsOnline(false);
      actualizarContadorOffline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Conexión Server-Sent Events (SSE) autenticada con token
    let eventSource: EventSource | null = null;
    getIdToken().then((token) => {
      try {
        const streamUrl = token ? `/api/expenses/stream?token=${encodeURIComponent(token)}` : '/api/expenses/stream';
        eventSource = new EventSource(streamUrl);
        eventSource.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'new_expense') {
              setGastos((prev) => {
                const existe = prev.some((g) => g.id === msg.data.id);
                if (existe) return prev;
                return [msg.data, ...prev];
              });
            } else if (msg.type === 'status_updated') {
              const gastoActualizado = msg.data as Gasto;
              setGastos((prev) =>
                prev.map((g) => (g.id === gastoActualizado.id ? gastoActualizado : g))
              );

              // Disparar notificación web e in-app para el trabajador si el gasto le pertenece
              if (usuarioRef.current) {
                const notif = procesarNotificacionDeGasto(gastoActualizado, usuarioRef.current);
                if (notif) {
                  setNotificaciones((prev) => [notif, ...prev.slice(0, 49)]);
                  setToastsActivos((prev) => [notif, ...prev]);

                  setTimeout(() => {
                    setToastsActivos((prev) => prev.filter((t) => t.id !== notif.id));
                  }, 8000);
                }
              }
            } else if (msg.type === 'database_updated') {
              cargarGastos();
            }
          } catch (e) {
            console.warn('Error parseando evento SSE:', e);
          }
        };
      } catch (e) {
        console.warn('SSE no disponible:', e);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (eventSource) eventSource.close();
    };
  }, [
    firebaseUser,
    cargarGastos,
    cargarCatalogos,
    actualizarContadorOffline,
    ejecutarSincronizacionOffline,
  ]);

  // Guardar nuevo gasto desde el flujo del trabajador
  const handleGastoGuardado = (nuevo: Gasto) => {
    setGastos((prev) => {
      const existe = prev.some((g) => g.id === nuevo.id);
      return existe ? prev : [nuevo, ...prev];
    });
    actualizarContadorOffline();
  };

  // Actualizar estado (aprobado / rechazado)
  const handleActualizarEstado = async (
    id: string,
    nuevoEstado: 'aprobado' | 'rechazado',
    comentario?: string
  ) => {
    const token = await getIdToken();
    const resp = await fetch(`/api/expenses/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        estado: nuevoEstado,
        comentario_aprobacion: comentario,
        actualizado_por: usuario?.nombre_completo || 'Auditor Colaves',
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar el estado de la factura');
    }

    const actualizado = await resp.json();
    setGastos((prev) => prev.map((g) => (g.id === id ? actualizado : g)));
  };

  // Guardar cambios de catálogos
  const handleSaveCatalogs = async (
    tiposGasto: string[],
    tiposPago: string[]
  ) => {
    const token = await getIdToken();
    const resp = await fetch('/api/catalogs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tiposGasto, tiposPago }),
    });

    if (!resp.ok) {
      throw new Error('Error al guardar catálogos en el servidor');
    }

    const data = await resp.json();
    setCatalogos(data);
  };

  const handleLogout = async () => {
    await logout();
    setFirebaseUser(null);
    setUsuario(null);
  };

  const handleAbrirChatConGasto = (g?: Gasto) => {
    setGastoParaChat(g || null);
    setModalChat(true);
  };

  // Pantalla de carga mientras se verifica la sesión inicial de Firebase
  if (authCargando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#07426B] via-[#052F4D] to-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="flex flex-col items-center space-y-4">
          <ColavesLogo variant="vertical" size="lg" inverted={true} />
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <RefreshCw className="w-4 h-4 animate-spin text-[#2CAE4A]" />
            <span>Verificando credenciales corporativas Colaves...</span>
          </div>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, renderizar la pantalla de login/registro
  if (!firebaseUser || !usuario) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  const tituloSeccion = {
    registro: 'Registro y Radicación de Facturas',
    resumen: 'Panel de Auditoría Fiscal',
    facturas: 'Comprobantes y Facturación Electrónica DIAN',
    catalogos: 'Catálogos Operacionales',
    usuarios: 'Gestión de Usuarios y Roles',
    integraciones: 'Integraciones Google Workspace',
  }[seccionActiva] || 'Colaves S.A.S.';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex font-sans transition-colors">
      {/* Barra Lateral de Navegación con Roles Estrictos */}
      <Sidebar
        rol={rol}
        usuario={usuario}
        seccionActiva={seccionActiva}
        onSelectSeccion={(s) => {
          setSeccionActiva(s);
          setSidebarAbiertaMobile(false);
        }}
        colapsada={sidebarColapsada}
        onToggleColapsar={() => setSidebarColapsada(!sidebarColapsada)}
        onLogout={handleLogout}
        onAbrirDrive={() => setModalDrive(true)}
        onAbrirSheets={() => setModalSheets(true)}
        onAbrirChat={() => {
          setGastoParaChat(null);
          setModalChat(true);
        }}
        onAbrirUsuarios={() => setModalUsuarios(true)}
        onAbrirCatalogos={() => setModalCatalogos(true)}
      />

      {/* Contenido Principal con Top Navbar */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          rol={rol}
          usuario={usuario}
          seccionActivaTitulo={tituloSeccion}
          onToggleSidebar={() => setSidebarColapsada(!sidebarColapsada)}
          onLogout={handleLogout}
          onAbrirTestsModal={() => setModalTests(true)}
          onAbrirDriveModal={() => setModalDrive(true)}
          onAbrirSheetsModal={() => setModalSheets(true)}
          onAbrirChatModal={() => {
            setGastoParaChat(null);
            setModalChat(true);
          }}
          temaOscuro={temaOscuro}
          onToggleTema={() => setTemaOscuro(!temaOscuro)}
          isOnline={isOnline}
          colaOfflineCount={colaOfflineCount}
          onSincronizarOffline={ejecutarSincronizacionOffline}
          sincronizando={sincronizando}
          notificaciones={notificaciones}
          onLimpiarNotificaciones={() => setNotificaciones([])}
          onMarcarNotificacionLeida={(id) =>
            setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
          }
          onMarcarTodasNotificacionesLeidas={() =>
            setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
          }
        />

        {/* Notificaciones flotantes en pantalla (Toasts) */}
        <NotificationToasts
          notificaciones={toastsActivos}
          onDescartar={(id) => setToastsActivos((prev) => prev.filter((t) => t.id !== id))}
        />

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
          {/* El trabajador siempre tiene acceso a la radicación de facturas */}
          {rol === 'trabajador' || seccionActiva === 'registro' ? (
            <WorkerExpenseForm
              usuario={usuario}
              catalogos={catalogos}
              onGastoGuardado={handleGastoGuardado}
              isOnline={isOnline}
              onAbrirDrive={() => setModalDrive(true)}
            />
          ) : seccionActiva === 'integraciones' ? (
            /* Vista de Integraciones Google Workspace */
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#07426B] dark:text-blue-400">
                  Google Workspace
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Integraciones Empresariales Colaves S.A.S.
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Conecte los comprobantes fiscales y hojas de legalización directamente con las herramientas de colaboración en la nube.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tarjeta Google Drive */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                      <Cloud className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Google Drive
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cree carpetas mensuales por centro de costos y respalde las fotos originales de cada factura en la nube.
                    </p>
                  </div>
                  <button
                    onClick={() => setModalDrive(true)}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                  >
                    Abrir Google Drive
                  </button>
                </div>

                {/* Tarjeta Google Sheets */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#2CAE4A] flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Google Sheets
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sincronice todas las legalizaciones en una hoja de cálculo en vivo para auditoría y conciliación contable.
                    </p>
                  </div>
                  <button
                    onClick={() => setModalSheets(true)}
                    className="w-full py-2.5 bg-[#2CAE4A] hover:bg-[#00984C] text-white font-bold rounded-xl text-xs transition"
                  >
                    Abrir Google Sheets
                  </button>
                </div>

                {/* Tarjeta Google Chat */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#07426B] dark:text-blue-400 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Google Chat
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Envíe fichas fiscales interactivas a espacios corporativos para notificar radicaciones y aprobaciones.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setGastoParaChat(null);
                      setModalChat(true);
                    }}
                    className="w-full py-2.5 bg-[#07426B] hover:bg-[#052F4D] text-white font-bold rounded-xl text-xs transition"
                  >
                    Abrir Google Chat
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Vista del Administrador: Resumen General y Facturas */
            <AdminDashboard
              gastos={gastos}
              onActualizarEstado={handleActualizarEstado}
              catalogs={catalogos}
              onSaveCatalogs={handleSaveCatalogs}
              onAbrirDrive={() => setModalDrive(true)}
              onAbrirSheets={() => setModalSheets(true)}
              onAbrirChat={handleAbrirChatConGasto}
              onAbrirUsuarios={() => setModalUsuarios(true)}
            />
          )}
        </main>
      </div>

      {/* MODALES DEL SISTEMA */}

      {/* Modal de Gestión de Usuarios y Roles (RBAC Admin) */}
      <UserManagementModal
        isOpen={modalUsuarios}
        onClose={() => setModalUsuarios(false)}
        currentUser={usuario}
      />

      {/* Modal de Catálogos */}
      <CatalogModal
        isOpen={modalCatalogos}
        onClose={() => setModalCatalogos(false)}
        catalogs={catalogos}
        onSave={handleSaveCatalogs}
      />

      {/* Modal de Pruebas Unitarias de Validación */}
      <ValidationTestsModal
        isOpen={modalTests}
        onClose={() => setModalTests(false)}
        cufeMuestraExistente={gastos[0]?.cufe}
      />

      {/* Modal de Google Drive */}
      <GoogleDriveModal
        isOpen={modalDrive}
        onClose={() => setModalDrive(false)}
        gastos={gastos}
      />

      {/* Modal de Google Sheets */}
      <GoogleSheetsModal
        isOpen={modalSheets}
        onClose={() => setModalSheets(false)}
        gastos={gastos}
      />

      {/* Modal de Google Chat */}
      <GoogleChatModal
        isOpen={modalChat}
        onClose={() => setModalChat(false)}
        gastos={gastos}
        gastoSeleccionado={gastoParaChat}
      />
    </div>
  );
}
