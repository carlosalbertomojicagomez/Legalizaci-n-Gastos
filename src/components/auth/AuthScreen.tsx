import React, { useState } from 'react';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
} from '../../lib/firebaseClient';
import { ColavesLogo } from '../common/ColavesLogo';
import { Mail, Lock, User, Briefcase, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';

interface Props {
  onAuthSuccess: () => void;
}

export const AuthScreen: React.FC<Props> = ({ onAuthSuccess }) => {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [cargo, setCargo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      if (modo === 'login') {
        await loginWithEmail(email.trim(), password);
      } else {
        if (!nombreCompleto.trim()) throw new Error('Por favor ingrese su nombre y apellidos.');
        if (!cargo.trim()) throw new Error('Por favor indique su cargo en Colaves.');
        await registerWithEmail(email.trim(), password, nombreCompleto.trim(), cargo.trim());
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      let msg = err.message || 'Error al iniciar sesión';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Credenciales no válidas. Verifique su correo y contraseña.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Este correo electrónico ya tiene una cuenta registrada.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'La contraseña debe tener al menos 6 caracteres.';
      }
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setCargando(true);
    try {
      await loginWithGoogle();
      onAuthSuccess();
    } catch (err: any) {
      console.error('Error Google Login:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Error al iniciar sesión con Google Workspace.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#07426B] via-[#052F4D] to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
        {/* Encabezado con Logo Oficial de Colaves */}
        <div className="flex flex-col items-center text-center space-y-3">
          <ColavesLogo variant="vertical" size="lg" />
          <div className="space-y-0.5">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {modo === 'login' ? 'Acceso al Sistema Contable' : 'Registro de Funcionario'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Plataforma Corporativa de Legalización de Facturas DIAN
            </p>
          </div>
        </div>

        {/* Botón de Inicio con Google Workspace */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={cargando}
          className="w-full py-3.5 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition flex items-center justify-center gap-3 text-xs active:scale-95 disabled:opacity-50"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          <span>Continuar con Google Workspace</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-[10px] font-bold uppercase text-slate-400">O con credenciales</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Formulario de Correo y Contraseña */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {modo === 'registro' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    required
                    type="text"
                    placeholder="Carlos Alberto Mojica"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    className="w-full text-xs p-2.5 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo en Colaves
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    required
                    type="text"
                    placeholder="Coordinador de Operaciones"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    className="w-full text-xs p-2.5 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Correo Electrónico Corporativo
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                required
                type="email"
                placeholder="usuario@colaves.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs p-2.5 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs p-2.5 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 text-rose-800 dark:text-rose-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3.5 bg-[#07426B] hover:bg-[#052F4D] text-white font-black rounded-2xl shadow-lg shadow-blue-900/20 active:scale-95 transition text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {cargando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#2CAE4A]" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <span>{modo === 'login' ? 'Ingresar a Colaves' : 'Crear Cuenta'}</span>
            )}
          </button>
        </form>

        {/* Alternar modo login / registro */}
        <div className="text-center pt-1 border-t dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setModo(modo === 'login' ? 'registro' : 'login');
              setError(null);
            }}
            className="text-xs text-[#07426B] dark:text-blue-400 font-bold hover:underline"
          >
            {modo === 'login'
              ? '¿Funcionario nuevo? Crear cuenta'
              : '¿Ya tiene cuenta? Iniciar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};
