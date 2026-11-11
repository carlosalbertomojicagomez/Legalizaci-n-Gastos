import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gasto, RolUsuario, UsuarioPerfil, NotificacionItem } from './types';
import { Navbar } from './components/common/Navbar';
import { WorkerExpenseForm } from './components/worker/WorkerExpenseForm';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UserModal, PRESET_USUARIOS } from './components/auth/UserModal';
import { ValidationTestsModal } from './components/common/ValidationTestsModal';
import { GoogleDriveModal } from './components/drive/GoogleDriveModal';
import { GoogleSheetsModal } from './components/sheets/GoogleSheetsModal';
import { NotificationToasts } from './components/notifications/NotificationToasts';
import { procesarNotificacionDeGasto } from './utils/notifications';
import {
  obtenerColaOffline,
  sincronizarColaConServidor,
} from './lib/offlineQueue';

export default function App() {
  const [rol, setRol] = useState<RolUsuario>('trabajador');
  const [usuario, setUsuario] = useState<UsuarioPerfil>(() => {
    const saved = localStorage.getItem('usuario_legalizacion');
    return saved ? JSON.parse(saved) : PRESET_USUARIOS[0];
  });
  const usuarioRef = useRef(usuario);
  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);

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

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [colaOfflineCount, setColaOfflineCount] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  // Modales
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalTests, setModalTests] = useState(false);
  const [modalDrive, setModalDrive] = useState(false);
  const [modalSheets, setModalSheets] = useState(false);

  // Notificaciones de Aprobación/Rechazo
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>(() => {
    const saved = localStorage.getItem('notificaciones_gastos');
    return saved ? JSON.parse(saved) : [];
  });
  const [toastsActivos, setToastsActivos] = useState<NotificacionItem[]>([]);

  useEffect(() => {
    localStorage.setItem('notificaciones_gastos', JSON.stringify(notificaciones));
  }, [notificaciones]);

  // Modo Oscuro
  const [temaOscuro, setTemaOscuro] = useState(() => {
    const saved = localStorage.getItem('tema_oscuro');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (temaOscuro) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('tema_oscuro', String(temaOscuro));
  }, [temaOscuro]);

  // Cargar Gastos y Catálogos desde Servidor
  const cargarGastos = useCallback(async () => {
    try {
      const resp = await fetch('/api/expenses');
      if (resp.ok) {
        const data = await resp.json();
        setGastos(data);
      }
    } catch (err) {
      console.warn('No se pudo conectar al backend (modo offline probable):', err);
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

  // Sincronizar cola offline
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

    // Conexión Server-Sent Events (SSE) para tiempo real
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/expenses/stream');
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

            // Disparar notificación web e in-app para el trabajador
            const notif = procesarNotificacionDeGasto(gastoActualizado, usuarioRef.current);
            if (notif) {
              setNotificaciones((prev) => [notif, ...prev.slice(0, 49)]);
              setToastsActivos((prev) => [notif, ...prev]);

              // Auto descartar el toast después de 7 segundos
              setTimeout(() => {
                setToastsActivos((prev) => prev.filter((t) => t.id !== notif.id));
              }, 7000);
            }
          } else if (msg.type === 'database_updated') {
            cargarGastos();
          }
        } catch (e) {
          console.warn('Error parseando SSE:', e);
        }
      };
    } catch (e) {
      console.warn('SSE no disponible:', e);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (eventSource) eventSource.close();
    };
  }, [
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
    const resp = await fetch(`/api/expenses/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: nuevoEstado,
        comentario_aprobacion: comentario,
        actualizado_por: usuario.nombre_completo,
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
    const resp = await fetch('/api/catalogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiposGasto, tiposPago }),
    });

    if (!resp.ok) {
      throw new Error('Error al guardar catálogos en el servidor');
    }

    const data = await resp.json();
    setCatalogos(data);
  };

  const handleCambiarUsuario = (u: UsuarioPerfil) => {
    setUsuario(u);
    setRol(u.rol);
    localStorage.setItem('usuario_legalizacion', JSON.stringify(u));
  };

  const handleLimpiarNotificaciones = () => {
    setNotificaciones([]);
  };

  const handleMarcarNotificacionLeida = (id: string) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
  };

  const handleMarcarTodasLeidas = () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  const handleDescartarToast = (id: string) => {
    setToastsActivos((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <Navbar
        rol={rol}
        onCambiarRol={setRol}
        usuario={usuario}
        onAbrirUsuarioModal={() => setModalUsuario(true)}
        onAbrirTestsModal={() => setModalTests(true)}
        onAbrirDriveModal={() => setModalDrive(true)}
        onAbrirSheetsModal={() => setModalSheets(true)}
        temaOscuro={temaOscuro}
        onToggleTema={() => setTemaOscuro(!temaOscuro)}
        isOnline={isOnline}
        colaOfflineCount={colaOfflineCount}
        onSincronizarOffline={ejecutarSincronizacionOffline}
        sincronizando={sincronizando}
        notificaciones={notificaciones}
        onLimpiarNotificaciones={handleLimpiarNotificaciones}
        onMarcarNotificacionLeida={handleMarcarNotificacionLeida}
        onMarcarTodasNotificacionesLeidas={handleMarcarTodasLeidas}
      />

      {/* Notificaciones flotantes en pantalla (Toasts) */}
      <NotificationToasts
        notificaciones={toastsActivos}
        onDescartar={handleDescartarToast}
      />

      <main className="flex-1 p-3 sm:p-6">
        {rol === 'trabajador' ? (
          <WorkerExpenseForm
            usuario={usuario}
            catalogos={catalogos}
            onGastoGuardado={handleGastoGuardado}
            isOnline={isOnline}
            onAbrirDrive={() => setModalDrive(true)}
          />
        ) : (
          <AdminDashboard
            gastos={gastos}
            onActualizarEstado={handleActualizarEstado}
            catalogs={catalogos}
            onSaveCatalogs={handleSaveCatalogs}
            onAbrirDrive={() => setModalDrive(true)}
            onAbrirSheets={() => setModalSheets(true)}
          />
        )}
      </main>

      {/* Modal de Usuario y Autenticación */}
      <UserModal
        isOpen={modalUsuario}
        onClose={() => setModalUsuario(false)}
        usuarioActual={usuario}
        onCambiarUsuario={handleCambiarUsuario}
      />

      {/* Modal de Pruebas Unitarias de Validación */}
      <ValidationTestsModal
        isOpen={modalTests}
        onClose={() => setModalTests(false)}
        cufeMuestraExistente={gastos[0]?.cufe}
      />

      {/* Modal de Google Drive (Workspace) */}
      <GoogleDriveModal
        isOpen={modalDrive}
        onClose={() => setModalDrive(false)}
        gastos={gastos}
      />

      {/* Modal de Google Sheets (Workspace) */}
      <GoogleSheetsModal
        isOpen={modalSheets}
        onClose={() => setModalSheets(false)}
        gastos={gastos}
      />
    </div>
  );
}
