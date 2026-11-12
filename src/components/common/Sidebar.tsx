import React from 'react';
import { RolUsuario, UsuarioPerfil } from '../../types';
import { ColavesLogo } from './ColavesLogo';
import {
  LayoutDashboard,
  Receipt,
  Layers,
  Users,
  Cloud,
  Camera,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  Building2,
  FileSpreadsheet,
  MessageSquare
} from 'lucide-react';

export type NavItemKey =
  | 'registro'
  | 'resumen'
  | 'facturas'
  | 'catalogos'
  | 'usuarios'
  | 'integraciones';

interface Props {
  rol: RolUsuario;
  usuario: UsuarioPerfil;
  seccionActiva: NavItemKey;
  onSelectSeccion: (seccion: NavItemKey) => void;
  colapsada: boolean;
  onToggleColapsar: () => void;
  onLogout: () => void;
  onAbrirDrive: () => void;
  onAbrirSheets: () => void;
  onAbrirChat: () => void;
  onAbrirUsuarios: () => void;
  onAbrirCatalogos: () => void;
}

export const Sidebar: React.FC<Props> = ({
  rol,
  usuario,
  seccionActiva,
  onSelectSeccion,
  colapsada,
  onToggleColapsar,
  onLogout,
  onAbrirDrive,
  onAbrirSheets,
  onAbrirChat,
  onAbrirUsuarios,
  onAbrirCatalogos,
}) => {
  // Trabajador ve exclusivamente "Registro factura"
  // Administrador ve: "Resumen", "Facturas", "Catálogos", "Usuarios", "Integraciones", "Registro factura"
  const navItems = [
    ...(rol === 'administrador'
      ? [
          {
            key: 'resumen' as NavItemKey,
            label: 'Resumen',
            icon: LayoutDashboard,
            badge: 'KPIs',
          },
          {
            key: 'facturas' as NavItemKey,
            label: 'Facturas',
            icon: Receipt,
            badge: 'DIAN',
          },
          {
            key: 'catalogos' as NavItemKey,
            label: 'Catálogos',
            icon: Layers,
            action: onAbrirCatalogos,
          },
          {
            key: 'usuarios' as NavItemKey,
            label: 'Usuarios',
            icon: Users,
            action: onAbrirUsuarios,
          },
          {
            key: 'integraciones' as NavItemKey,
            label: 'Integraciones',
            icon: Cloud,
          },
        ]
      : []),
    {
      key: 'registro' as NavItemKey,
      label: 'Registro factura',
      icon: Camera,
      badge: 'En vivo',
    },
  ];

  return (
    <aside
      className={`relative z-30 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 select-none ${
        colapsada ? 'w-20' : 'w-64 sm:w-72'
      }`}
    >
      {/* Encabezado con Logotipo de Colaves */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          {colapsada ? (
            <div className="mx-auto" title="Colaves S.A.S.">
              <ColavesLogo variant="emblem" size="md" />
            </div>
          ) : (
            <div className="transition-opacity duration-300">
              <ColavesLogo variant="full" size="md" />
            </div>
          )}
        </div>

        <button
          onClick={onToggleColapsar}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          title={colapsada ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
        >
          {colapsada ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navegación Principal Filtrada por Rol */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="px-3 py-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {colapsada ? 'Menú' : `Módulos ${rol === 'administrador' ? 'Auditoría' : 'Operación'}`}
          </span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = seccionActiva === item.key;

          return (
            <button
              key={item.key}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  onSelectSeccion(item.key);
                }
              }}
              title={item.label}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl font-bold text-xs transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#07426B] to-[#052F4D] text-white shadow-md shadow-blue-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isActive ? 'text-[#2CAE4A]' : 'text-slate-400 dark:text-slate-500'
                }`}
              />

              {!colapsada && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-50 text-[#206A3C] dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {/* Sección de Integraciones Workspace (Admin) */}
        {rol === 'administrador' && !colapsada && (
          <div className="pt-4 space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 mt-3">
            <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Google Workspace
            </span>

            <button
              onClick={onAbrirDrive}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-800 dark:hover:text-amber-300 transition"
            >
              <Cloud className="w-4 h-4 text-amber-500" />
              <span>Google Drive</span>
            </button>

            <button
              onClick={onAbrirSheets}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-800 dark:hover:text-emerald-300 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#2CAE4A]" />
              <span>Google Sheets</span>
            </button>

            <button
              onClick={onAbrirChat}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-800 dark:hover:text-blue-300 transition"
            >
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span>Google Chat</span>
            </button>
          </div>
        )}
      </div>

      {/* Perfil del Usuario Autenticado y Cierre de Sesión Seguro */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
        <div
          className={`flex items-center gap-2.5 ${colapsada ? 'justify-center' : 'justify-between'}`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs text-white shadow-sm flex-shrink-0 ${
                rol === 'administrador'
                  ? 'bg-gradient-to-tr from-[#07426B] to-[#206A3C]'
                  : 'bg-gradient-to-tr from-[#2CAE4A] to-[#00984C]'
              }`}
            >
              {usuario.nombre_completo.charAt(0).toUpperCase()}
            </div>

            {!colapsada && (
              <div className="overflow-hidden">
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {usuario.nombre_completo}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md ${
                      rol === 'administrador'
                        ? 'bg-blue-100 text-[#07426B] dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-emerald-100 text-[#206A3C] dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {rol === 'administrador' ? (
                      <Shield className="w-2.5 h-2.5" />
                    ) : (
                      <UserCheck className="w-2.5 h-2.5" />
                    )}
                    <span>{rol}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">{usuario.cargo}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            title="Cerrar sesión de forma segura"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
