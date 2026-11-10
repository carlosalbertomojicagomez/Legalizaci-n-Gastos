import React, { useState } from 'react';
import { UsuarioPerfil, RolUsuario } from '../../types';
import { X, User, Shield, Phone, Mail, CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuarioActual: UsuarioPerfil;
  onCambiarUsuario: (usuario: UsuarioPerfil) => void;
}

export const PRESET_USUARIOS: UsuarioPerfil[] = [
  {
    id: 'usr_carlos',
    nombre_completo: 'Carlos Alberto Mojica',
    identificacion: 'CC 1098765432',
    cargo: 'Coordinador de Operaciones de Campo',
    email: 'carlos.mojica@empresa.com.co',
    telefono: '+57 312 456 7890',
    rol: 'trabajador',
  },
  {
    id: 'usr_andrea',
    nombre_completo: 'Andrea Gómez',
    identificacion: 'CC 1014238910',
    cargo: 'Ingeniera de Mantenimiento',
    email: 'andrea.gomez@empresa.com.co',
    telefono: '+57 310 987 6543',
    rol: 'trabajador',
  },
  {
    id: 'usr_admin',
    nombre_completo: 'Dra. Marleny Suárez',
    identificacion: 'CC 52490123',
    cargo: 'Contadora General / Auditora Fiscal',
    email: 'marleny.suarez@empresa.com.co',
    telefono: '+57 320 123 4567',
    rol: 'administrador',
  },
];

export const UserModal: React.FC<Props> = ({
  isOpen,
  onClose,
  usuarioActual,
  onCambiarUsuario,
}) => {
  const [modo, setModo] = useState<'rapido' | 'manual'>('rapido');
  const [emailOTelefono, setEmailOTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [rol, setRol] = useState<RolUsuario>('trabajador');

  if (!isOpen) return null;

  const handleLoginManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOTelefono.trim() || !nombre.trim()) return;

    const esTelefono = /^\+?[\d\s-]{7,15}$/.test(emailOTelefono.trim());
    const nuevoPerfil: UsuarioPerfil = {
      id: 'usr_' + Date.now(),
      nombre_completo: nombre.trim(),
      identificacion: 'CC ' + Math.floor(10000000 + Math.random() * 90000000),
      cargo: cargo.trim() || (rol === 'administrador' ? 'Auditor Contable' : 'Técnico de Campo'),
      email: esTelefono ? `${nombre.toLowerCase().replace(/\s+/g, '.')}@empresa.com.co` : emailOTelefono.trim(),
      telefono: esTelefono ? emailOTelefono.trim() : '+57 300 000 0000',
      rol,
    };

    onCambiarUsuario(nuevoPerfil);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b pb-3 dark:border-slate-700">
          <div>
            <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
              Autenticación y Perfil
            </span>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">
              Inicio de Sesión / Perfil
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de modo */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setModo('rapido')}
            className={`flex-1 py-2 rounded-xl transition ${
              modo === 'rapido'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Perfiles de Empresa
          </button>
          <button
            onClick={() => setModo('manual')}
            className={`flex-1 py-2 rounded-xl transition ${
              modo === 'manual'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Ingreso por Teléfono / Correo
          </button>
        </div>

        {modo === 'rapido' ? (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-500">
              Selecciona un perfil operativo o administrativo de la empresa:
            </p>
            {PRESET_USUARIOS.map((u) => {
              const esActivo = usuarioActual.id === u.id;
              return (
                <div
                  key={u.id}
                  onClick={() => {
                    onCambiarUsuario(u);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                    esActivo
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                        u.rol === 'administrador'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {u.rol === 'administrador' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{u.nombre_completo}</span>
                        {esActivo && (
                          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.2 rounded-full font-bold">
                            Activo
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{u.cargo}</p>
                      <span className="text-[10px] font-mono text-slate-400">{u.email}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              );
            })}
          </div>
        ) : (
          <form onSubmit={handleLoginManual} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Correo Electrónico o Celular *
              </label>
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder="ejemplo@empresa.com o 3124567890"
                  value={emailOTelefono}
                  onChange={(e) => setEmailOTelefono(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nombre Completo *
              </label>
              <input
                required
                type="text"
                placeholder="Nombre del trabajador o auditor"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo
                </label>
                <input
                  type="text"
                  placeholder="Técnico / Conductor"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rol de Acceso *
                </label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as RolUsuario)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="trabajador">Trabajador</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition text-xs mt-2"
            >
              Iniciar Sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
