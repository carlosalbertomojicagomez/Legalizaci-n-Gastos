import React from 'react';
import { NotificacionItem } from '../../types';
import { CheckCircle2, XCircle, X, Bell } from 'lucide-react';

interface Props {
  notificaciones: NotificacionItem[];
  onDescartar: (id: string) => void;
}

export const NotificationToasts: React.FC<Props> = ({ notificaciones, onDescartar }) => {
  if (notificaciones.length === 0) return null;

  return (
    <div className="fixed top-16 right-3 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {notificaciones.slice(0, 3).map((notif) => {
        const esAprobado = notif.tipo === 'aprobado';

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 ${
              esAprobado
                ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-300 dark:border-emerald-700/70 text-slate-900 dark:text-white'
                : 'bg-white/95 dark:bg-slate-900/95 border-rose-300 dark:border-rose-700/70 text-slate-900 dark:text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    esAprobado
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400'
                      : 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400'
                  }`}
                >
                  {esAprobado ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-black text-xs leading-tight">
                    {notif.titulo}
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {notif.fecha}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDescartar(notif.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition"
                title="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {notif.mensaje}
            </p>
          </div>
        );
      })}
    </div>
  );
};
