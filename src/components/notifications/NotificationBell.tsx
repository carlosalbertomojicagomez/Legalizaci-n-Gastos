import React, { useState, useEffect, useRef } from 'react';
import { NotificacionItem } from '../../types';
import {
  Bell,
  BellRing,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Volume2,
  Trash2,
  Check
} from 'lucide-react';
import {
  obtenerEstadoPermisoNotificacion,
  solicitarPermisoNotificacion,
  reproducirSonidoNotificacion,
  enviarNotificacionWeb,
  estaSoportadoWebNotification
} from '../../utils/notifications';

interface Props {
  notificaciones: NotificacionItem[];
  onLimpiarNotificaciones: () => void;
  onMarcarLeida: (id: string) => void;
  onMarcarTodasLeidas: () => void;
}

export const NotificationBell: React.FC<Props> = ({
  notificaciones,
  onLimpiarNotificaciones,
  onMarcarLeida,
  onMarcarTodasLeidas,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [permiso, setPermiso] = useState<NotificationPermission | 'unsupported'>('default');
  const [solicitandoPermiso, setSolicitandoPermiso] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPermiso(obtenerEstadoPermisoNotificacion());
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    if (abierto) {
      document.addEventListener('mousedown', handleClickFuera);
    }
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, [abierto]);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const handleActivarNotificaciones = async () => {
    setSolicitandoPermiso(true);
    try {
      const nuevoPermiso = await solicitarPermisoNotificacion();
      setPermiso(nuevoPermiso);

      if (nuevoPermiso === 'granted') {
        reproducirSonidoNotificacion('aprobado');
        await enviarNotificacionWeb('🔔 ¡Notificaciones Activadas!', {
          body: 'Recibirás avisos inmediatos cuando el administrador apruebe o rechace tus legalizaciones.',
        });
      }
    } finally {
      setSolicitandoPermiso(false);
    }
  };

  const handleProbarNotificacion = async () => {
    reproducirSonidoNotificacion('aprobado');
    await enviarNotificacionWeb('Prueba de Notificación DIAN', {
      body: 'Tu gasto de prueba fue aprobado por Administración. ¡El sistema de notificaciones opera correctamente!',
    });
  };

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => {
          setAbierto(!abierto);
          if (!abierto && noLeidas > 0) {
            onMarcarTodasLeidas();
          }
        }}
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
        title="Centro de notificaciones de legalizaciones"
      >
        {noLeidas > 0 ? (
          <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-emerald-600 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {/* Popover desplegable */}
      {abierto && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Encabezado */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white">
                Notificaciones de Gastos
              </h3>
            </div>

            <div className="flex items-center gap-1">
              {notificaciones.length > 0 && (
                <button
                  onClick={onLimpiarNotificaciones}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                  title="Limpiar todas"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Banner de Estado de Notificaciones Web del Navegador */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
            {permiso === 'granted' ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Notificaciones Web del sistema activas</span>
                </div>
                <button
                  onClick={handleProbarNotificacion}
                  className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-300 flex items-center gap-1 underline"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Probar</span>
                </button>
              </div>
            ) : permiso === 'denied' ? (
              <div className="flex items-center gap-2 text-[11px] text-rose-700 dark:text-rose-300">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Las notificaciones están bloqueadas en los permisos de tu navegador.</span>
              </div>
            ) : estaSoportadoWebNotification() ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Activa los avisos para enterarte cuando aprueben tus facturas.
                </p>
                <button
                  onClick={handleActivarNotificaciones}
                  disabled={solicitandoPermiso}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-sm transition active:scale-95 flex-shrink-0"
                >
                  {solicitandoPermiso ? 'Activando...' : 'Activar'}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Notificaciones visuales activas en pantalla.
              </p>
            )}
          </div>

          {/* Lista de Notificaciones */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notificaciones.length === 0 ? (
              <div className="py-8 px-4 text-center space-y-1">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  No hay notificaciones recientes
                </p>
                <p className="text-[10px] text-slate-400">
                  Cuando el administrador revise tus comprobantes radicados, te avisaremos aquí y mediante alertas web.
                </p>
              </div>
            ) : (
              notificaciones.map((n) => {
                const esAprobado = n.tipo === 'aprobado';
                return (
                  <div
                    key={n.id}
                    onClick={() => onMarcarLeida(n.id)}
                    className={`p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer ${
                      !n.leida ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          esAprobado
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                        }`}
                      >
                        {esAprobado ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {n.titulo}
                          </h4>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {n.fecha}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                          {n.mensaje}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
