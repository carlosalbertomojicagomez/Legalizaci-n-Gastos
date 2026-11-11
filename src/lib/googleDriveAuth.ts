import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicializar Firebase App de manera segura (reutilizando si ya existe)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Scopes de Google Workspace (Google Drive + Google Sheets)
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

export const DRIVE_SCOPES = WORKSPACE_SCOPES;

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));

// Manejo de token en memoria (REGLA: NUNCA almacenar en localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Si hay usuario pero expiró el token en memoria, se notifica
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleWorkspace = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se obtuvo el token de acceso OAuth para Google Workspace');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error al conectar con Google Workspace:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Alias para compatibilidad previa
export const signInWithGoogleDrive = signInWithGoogleWorkspace;

export const getDriveAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getWorkspaceAccessToken = getDriveAccessToken;

export const logoutGoogleWorkspace = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const logoutGoogleDrive = logoutGoogleWorkspace;
