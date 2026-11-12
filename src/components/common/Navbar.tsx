import React from 'react';
import { RolUsuario, UsuarioPerfil, NotificacionItem } from '../../types';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationBell } from '../notifications/NotificationBell';
import { ColavesLogo } from './ColavesLogo';
import {
  Sun,
  Moon,
  Shield,
  UserCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  FlaskConical,
  Cloud,
  FileSpreadsheet,
  MessageSquare,
  Menu,
  LogOut
} from 'lucide-react';

interface Props {
  rol: RolUsuario;
  usuario: UsuarioPerfil;
  seccionActivaTitulo: string;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onAbrirTestsModal: () => void;
  onAbrirDriveModal: () => void;
  onAbrirSheetsModal: () => void;
  onAbrirChatModal: () => void;
  temaOscuro: boolean;
  onToggleTema: () => void;
  isOnline: boolean;
  colaOfflineCount: number;
  onSincronizarOffline: () => void;
  sincronizando: boolean;
  notificaciones: NotificacionItem[];
  onLimpiarNotificaciones: () => void;
  onMarcarNotificacionLeida: (id: string) => void;
  onMarcarTodasNotificacionesLeidas: () => void;
}

export const Navbar: React.FC<Props> = ({
  rol,
  usuario,
  seccionActivaTitulo,
  onToggleSidebar,
  onLogout,
  onAbrirTestsModal,
  onAbrirDriveModal,
  onAbrirSheetsModal,
  onAbrirChatModal,
  temaOscuro,
  onToggleTema,
  isOnline,
  colaOfflineCount,
  onSincronizarOffline,
  sincronizando,
  notificaciones,
  onLimpiarNotificaciones,
  onMarcarNotificacionLeida,
  onMarcarTodasNotificacionesLeidas,
}) => {
  return (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-3">
        {/* Botón de barra lateral y título de sección */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-95"
            title="Alternar barra lateral de navegación"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <ColavesLogo variant="emblem" size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-[#07426B] dark:text-blue-400 uppercase tracking-wider">
                  Colaves
                </span>
                <span className="text-slate-300 dark:text-slate-700">/</span>
                <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {seccionActivaTitulo}
                </h1>
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 font-medium">
                Trabajamos con el corazón • Control Fiscal DIAN
              </p>
            </div>
          </div>
        </div>

        {/* Acciones del encabezado */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Indicador de Conexión en Tiempo Real */}
          <div className="flex items-center gap-1">
            {isOnline ? (
              <span
                className="flex items-center gap-1 text-[11px] font-bold text-[#206A3C] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800"
                title="Conectado al servidor en tiempo real"
              >
                <Wifi className="w-3.5 h-3.5 text-[#2CAE4A]" />
                <span className="hidden md:inline">En línea</span>
              </span>
            ) : (
              <span
                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-800"
                title="Modo fuera de línea activo: los gastos se encolan localmente"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sin conexión</span>
              </span>
            )}

            {colaOfflineCount > 0 && (
              <button
                onClick={onSincronizarOffline}
                disabled={sincronizando || !isOnline}
                className="flex items-center gap-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                title="Sincronizar facturas guardadas sin conexión"
              >
                <RefreshCw className={`w-3 h-3 ${sincronizando ? 'animate-spin' : ''}`} />
                <span>{colaOfflineCount} en cola</span>
              </button>
            )}
          </div>

          {/* Accesos Workspace para Administradores */}
          {rol === 'administrador' && (
            <div className="hidden lg:flex items-center gap-1 border-l border-r border-slate-200 dark:border-slate-800 px-1.5 mx-1">
              <button
                onClick={onAbrirDriveModal}
                className="p-2 rounded-xl text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                title="Google Drive: respaldar comprobantes contables"
              >
                <Cloud className="w-4 h-4" />
              </button>
              <button
                onClick={onAbrirSheetsModal}
                className="p-2 rounded-xl text-[#206A3C] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                title="Google Sheets: exportar hoja contable sincronizada"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={onAbrirChatModal}
                className="p-2 rounded-xl text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                title="Google Chat: emitir notificaciones a espacios corporativos"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Botón PWA Install */}
          <PWAInstallButton />

          {/* Campana de Notificaciones Web */}
          <NotificationBell
            notificaciones={notificaciones}
            onLimpiarNotificaciones={onLimpiarNotificaciones}
            onMarcarLeida={onMarcarNotificacionLeida}
            onMarcarTodasLeidas={onMarcarTodasNotificacionesLeidas}
          />

          {/* Botón de Pruebas Unitarias de Validación */}
          <button
            onClick={onAbrirTestsModal}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Ejecutar suite de pruebas unitarias de validación (CUFE, NIT, Aritmética)"
          >
            <FlaskConical className="w-4 h-4 text-[#2CAE4A]" />
          </button>

          {/* Modo Oscuro / Claro */}
          <button
            onClick={onToggleTema}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Alternar tema claro/oscuro"
          >
            {temaOscuro ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Identificación del Usuario y Cierre de Sesión */}
          <div className="flex items-center gap-1.5 pl-1">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[130px]">
                {usuario.nombre_completo}
              </span>
              <span className="text-[10px] text-slate-400 capitalize">
                {usuario.rol}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="p-2 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
