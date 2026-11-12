import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UsuarioPerfil, RolUsuario } from '../types';

// Inicialización segura de Firebase Client
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Conexión obligatoria con el ID de base de datos Firestore provisionado
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || 'ai-studio-legalizacindegas-4630c3f7-d6e5-451e-8566-9072a7af4d3c'
);

// Proveedor de Google Workspace
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Obtiene el token JWT actual de Firebase para enviarlo en los encabezados HTTP a /api/*
 */
export async function getIdToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return await currentUser.getIdToken(false);
}

/**
 * Iniciar sesión con Google Workspace
 */
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Iniciar sesión con correo y contraseña
 */
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

/**
 * Registro de cuenta corporativa con correo y contraseña
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  nombreCompleto: string,
  cargo: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  const user = result.user;

  // Registrar perfil inicial en Firestore (rol determinado por el backend/reglas)
  const isSuperadmin = email.toLowerCase() === 'carlosalbertomojicagomez@gmail.com';
  const perfil: UsuarioPerfil = {
    id: user.uid,
    email: user.email || email,
    nombre_completo: nombreCompleto,
    cargo: cargo || 'Funcionario de Campo',
    rol: isSuperadmin ? 'administrador' : 'trabajador',
    creado_en: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'users', user.uid), perfil, { merge: true });
  } catch (err) {
    console.warn('Registro de perfil en Firestore gestionado por backend:', err);
  }

  return user;
}

/**
 * Cierre de sesión seguro
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Consulta el perfil y rol del usuario autenticado desde Firestore
 */
export async function fetchUserProfile(uid: string, userEmail?: string | null): Promise<UsuarioPerfil | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UsuarioPerfil;
    }
  } catch (err) {
    console.warn('Aviso leyendo perfil Firestore directo, intentando API backend:', err);
  }

  // Fallback seguro: consultar al backend autenticado
  try {
    const token = await getIdToken();
    if (token) {
      const resp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        return await resp.json();
      }
    }
  } catch (err) {
    console.error('Error al consultar perfil desde backend:', err);
  }

  // Si es el superadmin inicial garantizado
  if (userEmail && userEmail.toLowerCase() === 'carlosalbertomojicagomez@gmail.com') {
    return {
      id: uid,
      email: userEmail,
      nombre_completo: 'Carlos Alberto Mojica',
      cargo: 'Auditor Senior / Administrador',
      rol: 'administrador',
    };
  }

  return null;
}
