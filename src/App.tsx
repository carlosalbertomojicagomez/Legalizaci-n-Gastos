import React, { useState, useEffect, useCallback } from 'react';
import { Gasto, RolUsuario, UsuarioPerfil } from './types';
import { Navbar } from './components/common/Navbar';
import { WorkerExpenseForm } from './components/worker/WorkerExpenseForm';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { UserModal, PRESET_USUARIOS } from './components/auth/UserModal';
import { ValidationTestsModal } from './components/common/ValidationTestsModal';
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
            setGastos((prev) =>
              prev.map((g) => (g.id === msg.data.id ? msg.data : g))
            );
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <Navbar
        rol={rol}
        onCambiarRol={setRol}
        usuario={usuario}
        onAbrirUsuarioModal={() => setModalUsuario(true)}
        onAbrirTestsModal={() => setModalTests(true)}
        temaOscuro={temaOscuro}
        onToggleTema={() => setTemaOscuro(!temaOscuro)}
        isOnline={isOnline}
        colaOfflineCount={colaOfflineCount}
        onSincronizarOffline={ejecutarSincronizacionOffline}
        sincronizando={sincronizando}
      />

      <main className="flex-1 p-3 sm:p-6">
        {rol === 'trabajador' ? (
          <WorkerExpenseForm
            usuario={usuario}
            catalogos={catalogos}
            onGastoGuardado={handleGastoGuardado}
            isOnline={isOnline}
          />
        ) : (
          <AdminDashboard
            gastos={gastos}
            onActualizarEstado={handleActualizarEstado}
            catalogs={catalogos}
            onSaveCatalogs={handleSaveCatalogs}
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
    </div>
  );
}
