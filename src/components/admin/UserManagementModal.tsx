import React, { useState, useEffect } from 'react';
import { UsuarioPerfil, RolUsuario } from '../../types';
import { getIdToken } from '../../lib/firebaseClient';
import { Users, Shield, User, RefreshCw, X, Search, Check, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UsuarioPerfil;
}

export const UserManagementModal: React.FC<Props> = ({ isOpen, onClose, currentUser }) => {
  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [actualizandoUid, setActualizandoUid] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarUsuarios = async () => {
    setCargando(true);
    setError(null);
    try {
      const token = await getIdToken();
      const resp = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setUsuarios(data);
      } else {
        throw new Error('No se pudo cargar la lista de usuarios.');
      }
    } catch (err: any) {
      setError(err.message || 'Error consultando usuarios');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarUsuarios();
    }
  }, [isOpen]);

  const handleCambiarRol = async (uid: string, nuevoRol: RolUsuario) => {
    setActualizandoUid(uid);
    setMensaje(null);
    setError(null);

    try {
      const token = await getIdToken();
      const resp = await fetch(`/api/users/${uid}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rol: nuevoRol }),
      });

      if (!resp.ok) {
        throw new Error('Error al actualizar rol del usuario');
      }

      setUsuarios((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, rol: nuevoRol } : u))
      );
      setMensaje('Rol de usuario actualizado con éxito.');
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar el rol');
    } finally {
      setActualizandoUid(null);
    }
  };

  if (!isOpen) return null;

  const usuariosFiltrados = usuarios.filter(
    (u) =>
      u.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.email.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.cargo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex justify-between items-center border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#07426B] dark:text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Gestión de Usuarios y Roles Colaves
              </h3>
              <p className="text-xs text-slate-400">
                Control de acceso basado en roles (RBAC) administrado en el servidor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar funcionario por nombre, correo o cargo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full text-xs p-2.5 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        {mensaje && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{mensaje}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 dark:text-rose-200 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Lista de Usuarios */}
        {cargando ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#07426B]" />
            <span>Cargando usuarios desde Firestore...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {usuariosFiltrados.map((u) => {
              const esPropio = u.id === currentUser.id;

              return (
                <div
                  key={u.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {u.nombre_completo}
                      </span>
                      {esPropio && (
                        <span className="text-[10px] bg-blue-100 text-[#07426B] font-extrabold px-1.5 py-0.2 rounded">
                          (Tú)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Cargo: <strong>{u.cargo || 'Funcionario'}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Rol:</span>
                    <select
                      disabled={actualizandoUid === u.id || esPropio}
                      value={u.rol}
                      onChange={(e) =>
                        handleCambiarRol(u.id, e.target.value as RolUsuario)
                      }
                      className={`text-xs p-2 rounded-xl border font-bold ${
                        u.rol === 'administrador'
                          ? 'bg-blue-50 text-[#07426B] border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                          : 'bg-emerald-50 text-[#206A3C] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      } disabled:opacity-50`}
                    >
                      <option value="trabajador">Trabajador</option>
                      <option value="administrador">Administrador</option>
                    </select>

                    {actualizandoUid === u.id && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#07426B]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
