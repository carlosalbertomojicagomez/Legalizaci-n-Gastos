import React from 'react';
import { RolUsuario, UsuarioPerfil } from '../../types';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Sun,
  Moon,
  Shield,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
  FlaskConical,
  CheckCircle2
} from 'lucide-react';

interface Props {
  rol: RolUsuario;
  onCambiarRol: (r: RolUsuario) => void;
  usuario: UsuarioPerfil;
  onAbrirUsuarioModal: () => void;
  onAbrirTestsModal: () => void;
  temaOscuro: boolean;
  onToggleTema: () => void;
  isOnline: boolean;
  colaOfflineCount: number;
  onSincronizarOffline: () => void;
  sincronizando: boolean;
}

export const Navbar: React.FC<Props> = ({
  rol,
  onCambiarRol,
  usuario,
  onAbrirUsuarioModal,
  onAbrirTestsModal,
  temaOscuro,
  onToggleTema,
  isOnline,
  colaOfflineCount,
  onSincronizarOffline,
  sincronizando,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Marca y Título */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <span className="font-black text-xs tracking-wider">LG</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                Legalización de gastos
              </h1>
              <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                DIAN
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Control Fiscal & Facturación Electrónica
            </p>
          </div>
        </div>

        {/* Acciones y Estados */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Indicador de Conexión y Cola Offline */}
          <div className="flex items-center gap-1">
            {isOnline ? (
              <span
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800"
                title="Conectado al servidor"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden md:inline">En línea</span>
              </span>
            ) : (
              <span
                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded-xl border border-rose-200 dark:border-rose-800"
                title="Modo fuera de línea activo"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sin conexión</span>
              </span>
            )}

            {colaOfflineCount > 0 && (
              <button
                onClick={onSincronizarOffline}
                disabled={sincronizando || !isOnline}
                className="flex items-center gap-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                title="Sincronizar gastos guardados sin conexión"
              >
                <RefreshCw className={`w-3 h-3 ${sincronizando ? 'animate-spin' : ''}`} />
                <span>{colaOfflineCount} en cola</span>
              </button>
            )}
          </div>

          {/* Botón PWA Install */}
          <PWAInstallButton />

          {/* Selector de Rol */}
          <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-2xl flex text-xs">
            <button
              onClick={() => onCambiarRol('trabajador')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition text-[11px] ${
                rol === 'trabajador'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trabajador</span>
            </button>
            <button
              onClick={() => onCambiarRol('administrador')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold transition text-[11px] ${
                rol === 'administrador'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          </div>

          {/* Badge del Usuario / Perfil */}
          <button
            onClick={onAbrirUsuarioModal}
            className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
            title="Cambiar usuario o perfil"
          >
            <div className="w-6 h-6 rounded-lg bg-slate-300 dark:bg-slate-600 flex items-center justify-center font-black text-[10px]">
              {usuario.nombre_completo.charAt(0)}
            </div>
            <span className="hidden lg:inline text-[11px] max-w-[120px] truncate">
              {usuario.nombre_completo}
            </span>
          </button>

          {/* Botón de Pruebas Unitarias */}
          <button
            onClick={onAbrirTestsModal}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Ejecutar pruebas unitarias de validación"
          >
            <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>

          {/* Modo Oscuro / Claro */}
          <button
            onClick={onToggleTema}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Alternar tema claro/oscuro"
          >
            {temaOscuro ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
