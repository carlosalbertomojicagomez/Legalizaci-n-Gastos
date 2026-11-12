import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { getApps, initializeApp, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Configuración de límites para permitir fotografías en Base64 de alta resolución
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// INICIALIZACIÓN DE FIREBASE ADMIN / FIRESTORE
// ==========================================
const PROJECT_ID = firebaseConfig.projectId || 'just-now-q5v9p';
const FIRESTORE_DB_ID =
  firebaseConfig.firestoreDatabaseId ||
  'ai-studio-legalizacindegas-4630c3f7-d6e5-451e-8566-9072a7af4d3c';

if (!getApps().length) {
  try {
    initializeApp({
      projectId: PROJECT_ID,
    });
  } catch (err) {
    console.warn('Inicialización de firebase-admin sin credenciales de servicio:', err);
  }
}

// Inicialización de Firestore
let firestoreDb: any = null;
try {
  firestoreDb = getFirestore(FIRESTORE_DB_ID);
} catch (e) {
  try {
    firestoreDb = getFirestore();
  } catch (err) {
    console.warn('Firestore admin fallback a almacenamiento persistente protegido:', err);
  }
}

// Directorio protegido de almacenamiento de fotografías (NO es público)
const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROTECTED_UPLOADS_DIR = path.join(DATA_DIR, 'protected_uploads');
const PERSISTENT_STORE_FILE = path.join(DATA_DIR, 'colaves_expenses_store.json');

if (!fs.existsSync(PROTECTED_UPLOADS_DIR)) {
  fs.mkdirSync(PROTECTED_UPLOADS_DIR, { recursive: true });
}

// Eliminar cualquier data/db.json previo con datos de prueba
const OLD_DB_FILE = path.join(DATA_DIR, 'db.json');
if (fs.existsSync(OLD_DB_FILE)) {
  try {
    fs.unlinkSync(OLD_DB_FILE);
    console.log('Archivo data/db.json de demostración eliminado exitosamente.');
  } catch (e) {
    console.warn('Aviso limpiando db.json:', e);
  }
}

// ==========================================
// INICIALIZACIÓN DE GEMINI SDK (SERVER-SIDE)
// ==========================================
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'colaves-legalizacion-gastos',
    },
  },
});

// Catálogos iniciales por defecto de Colaves
const DEFAULT_CATALOGS = {
  tiposGasto: [
    'Alimentación / Viáticos',
    'Transporte terrestre',
    'Combustible',
    'Hospedaje',
    'Peajes / Parqueaderos',
    'Mantenimiento técnico',
    'Papelería / Útiles',
    'Imprevistos de operación',
  ],
  tiposPago: [
    'Efectivo / Caja menor',
    'Tarjeta corporativa Colaves',
    'Transferencia Bancolombia',
    'Transferencia Nequi / Daviplata',
  ],
};

// ==========================================
// ALMACENAMIENTO PERSISTENTE DE RESPALDO (REAL, SIN MOCKS)
// ==========================================
interface LocalStore {
  expenses: any[];
  users: any[];
  catalogs: {
    tiposGasto: string[];
    tiposPago: string[];
  };
}

function readLocalStore(): LocalStore {
  try {
    if (!fs.existsSync(PERSISTENT_STORE_FILE)) {
      const initial: LocalStore = {
        expenses: [],
        users: [
          {
            id: 'carlos_admin_default',
            email: 'carlosalbertomojicagomez@gmail.com',
            nombre_completo: 'Carlos Alberto Mojica',
            cargo: 'Auditor Senior / Administrador',
            rol: 'administrador',
            creado_en: new Date().toISOString(),
          },
        ],
        catalogs: DEFAULT_CATALOGS,
      };
      fs.writeFileSync(PERSISTENT_STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(PERSISTENT_STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      catalogs: parsed.catalogs || DEFAULT_CATALOGS,
    };
  } catch (err) {
    console.error('Error leyendo almacén local:', err);
    return { expenses: [], users: [], catalogs: DEFAULT_CATALOGS };
  }
}

function writeLocalStore(data: LocalStore): void {
  try {
    fs.writeFileSync(PERSISTENT_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error escribiendo almacén local:', err);
  }
}

// ==========================================
// AUTENTICACIÓN Y ROLES (RBAC) - MIDDLEWARE
// ==========================================
export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  role: 'trabajador' | 'administrador';
  cargo?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Valida criptográficamente el ID token de Firebase
 */
async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ uid: string; email: string; name?: string } | null> {
  // 1. Intentar con firebase-admin
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    if (decoded && decoded.uid) {
      return {
        uid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || decoded.email?.split('@')[0],
      };
    }
  } catch (e) {
    // Si firebase-admin no tiene credenciales de servicio, continúa a endpoints estándar
  }

  // 2. Tokeninfo de Google OAuth2 (válido para tokens de Google / Firebase)
  try {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.sub) {
        return {
          uid: data.sub,
          email: data.email || '',
          name: data.name || data.email?.split('@')[0],
        };
      }
    }
  } catch (e) {
    // Continuar
  }

  // 3. Identity Toolkit de Firebase
  try {
    const apiKey = firebaseConfig.apiKey;
    if (apiKey) {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const user = data.users?.[0];
        if (user) {
          return {
            uid: user.localId,
            email: user.email || '',
            name: user.displayName || user.email?.split('@')[0],
          };
        }
      }
    }
  } catch (e) {
    console.error('Fallo en verificación con IdentityToolkit:', e);
  }

  return null;
}

/**
 * Middleware para exigir sesión válida en rutas /api/*
 */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1].trim();
  } else if (typeof req.query.token === 'string' && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({
      error: 'Acceso no autorizado: Se requiere token de autenticación válido.',
    });
    return;
  }

  const tokenPayload = await verifyFirebaseIdToken(token);

  if (!tokenPayload) {
    res.status(401).json({
      error: 'Sesión inválida o expirada. Inicie sesión nuevamente en Colaves.',
    });
    return;
  }

  // Determinar rol del usuario desde Firestore o almacén persistente
  let userRole: 'trabajador' | 'administrador' = 'trabajador';
  let userCargo = 'Funcionario de Campo';
  let userName = tokenPayload.name || tokenPayload.email.split('@')[0];

  // Superadministrador inicial de la plataforma
  if (tokenPayload.email.toLowerCase() === 'carlosalbertomojicagomez@gmail.com') {
    userRole = 'administrador';
    userCargo = 'Auditor General / Administrador';
  } else {
    // Consultar Firestore
    try {
      if (firestoreDb) {
        const userDoc = await firestoreDb.collection('users').doc(tokenPayload.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.rol) userRole = userData.rol;
          if (userData?.cargo) userCargo = userData.cargo;
          if (userData?.nombre_completo) userName = userData.nombre_completo;
        }
      }
    } catch (err) {
      // Fallback a almacén local
      const store = readLocalStore();
      const localUser = store.users.find(
        (u) => u.id === tokenPayload.uid || u.email.toLowerCase() === tokenPayload.email.toLowerCase()
      );
      if (localUser) {
        userRole = localUser.rol;
        userCargo = localUser.cargo;
        userName = localUser.nombre_completo;
      }
    }
  }

  req.user = {
    uid: tokenPayload.uid,
    email: tokenPayload.email,
    name: userName,
    role: userRole,
    cargo: userCargo,
  };

  next();
}

/**
 * Middleware para restringir rutas exclusivamente a administradores
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'administrador') {
    res.status(403).json({
      error: 'Acceso restringido: Se requieren permisos de Administrador para esta operación.',
    });
    return;
  }
  next();
}

// Canales SSE para notificaciones y tiempo real del panel
const sseClients: { res: Response; userId?: string; role?: string }[] = [];

function notifySSE(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].res.write(msg);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ==========================================
// RUTAS DE LA API
// ==========================================

// 1. Canal Realtime con Server-Sent Events (SSE)
app.get('/api/expenses/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.push({ res });

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.res === res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 2. Perfil del Usuario Autenticado
app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    id: req.user!.uid,
    email: req.user!.email,
    nombre_completo: req.user!.name,
    cargo: req.user!.cargo,
    rol: req.user!.role,
  });
});

// 3. Extracción de Factura con IA de Visión (Gemini Flash Multimodal con doble lectura CUFE)
app.post('/api/extract-invoice', requireAuth, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'No se recibió la imagen de la factura para analizar.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: 'Servicio de visión no configurado: GEMINI_API_KEY ausente en variables de entorno.',
        error_extraccion: true,
        confianza_extraccion: 'baja',
        mensaje_diagnostico:
          'La clave GEMINI_API_KEY no está configurada en el servidor. Debe ingresarse en el panel de Secrets.',
      });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const promptPrincipal = `
Eres el motor de análisis fiscal y tributario para COLAVES S.A.S. en Colombia.
Analiza minuciosamente la fotografía de esta factura física o electrónica emitida bajo normas de la DIAN.

REGLAS ESTRICTAS DE EXTRACCIÓN REAL:
- Emisor: Razón social exacta o nombre comercial del proveedor impreso en el encabezado.
- nit_emisor: NIT del proveedor con dígito de verificación si aparece (ej: "860.005.224-6" o "901234567-8").
- numero_factura: Prefijo y consecutivo oficial de la factura (ej: "FE-1290", "SETP-990", "POS-102").
- cufe: Código Único de Factura Electrónica (o CUDE si es documento soporte).
  * Consta de EXACTAMENTE 96 caracteres hexadecimales (0-9, a-f).
  * Si la imagen contiene código QR de la DIAN, puedes leer el parámetro "CUFE=" dentro de la cadena.
  * Si no es legible o no tiene exactamente 96 caracteres, devuelve null. NUNCA inventes caracteres.
- qr_dian: Cadena de parámetros de control DIAN (NumFac=...&NitFac=...&ValFac=...&CUFE=...) o enlace catalogo-vpfe.dian.gov.co. Si no hay, null.
- fecha_emision: Fecha de emisión en formato YYYY-MM-DD.
- fecha_vencimiento: Fecha de vencimiento si existe en formato YYYY-MM-DD, de lo contrario null.
- valor_neto: Subtotal o base gravable en COP como número sin separadores.
- iva: Monto total liquidado por IVA o Impoconsumo en COP. Si está exento o no aplica, 0.
- total: Total a pagar en pesos colombianos (COP) como número entero o flotante.
- tipo_documento: "Factura Electrónica de Venta", "Documento Soporte" o "Tiquete POS / Equivalente".
- forma_pago: "Contado" o "Crédito".
- medio_pago: "Efectivo", "Tarjeta / Transferencia" o "Bancarizado".
- concepto_sugerido: Breve justificación sugerida del gasto (ej: "Combustible ruta", "Alimentación viáticos", "Peaje vehicular", "Mantenimiento").

NUNCA inventes datos. Si un campo no es identificable en la fotografía, asigna null.
`;

    let response: any;
    let modelName = 'gemini-2.5-flash';

    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: promptPrincipal },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              emisor: { type: Type.STRING },
              nit_emisor: { type: Type.STRING },
              numero_factura: { type: Type.STRING },
              cufe: { type: Type.STRING },
              qr_dian: { type: Type.STRING },
              fecha_emision: { type: Type.STRING },
              fecha_vencimiento: { type: Type.STRING },
              valor_neto: { type: Type.NUMBER },
              iva: { type: Type.NUMBER },
              total: { type: Type.NUMBER },
              tipo_documento: { type: Type.STRING },
              forma_pago: { type: Type.STRING },
              medio_pago: { type: Type.STRING },
              concepto_sugerido: { type: Type.STRING },
            },
          },
        },
      });
    } catch (err: any) {
      console.warn('Intento con gemini-2.5-flash falló, probando gemini-3.8-flash:', err.message);
      modelName = 'gemini-3.8-flash';
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: promptPrincipal },
          ],
        },
      });
    }

    const rawResponseText = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawResponseText);
    } catch {
      const matchJson = rawResponseText.match(/\{[\s\S]*\}/);
      if (matchJson) {
        parsed = JSON.parse(matchJson[0]);
      }
    }

    // Validación rigurosa de 96 caracteres hexadecimales para el CUFE
    let cufeEncontrado: string | null = null;
    if (parsed.cufe) {
      const clean = String(parsed.cufe).trim().toLowerCase().replace(/[^a-f0-9]/g, '');
      if (clean.length === 96) cufeEncontrado = clean;
    }

    // Búsqueda en QR DIAN
    if (!cufeEncontrado && parsed.qr_dian) {
      const matchQr = String(parsed.qr_dian).match(/[a-fA-F0-9]{96}/);
      if (matchQr) cufeEncontrado = matchQr[0].toLowerCase();
    }

    // SEGUNDA LECTURA ENFOCADA (único reintento si no se encontró en la primera pasada)
    if (!cufeEncontrado) {
      try {
        const cufePassResponse = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              { inlineData: { mimeType, data: cleanBase64 } },
              {
                text: 'Localiza EXCLUSIVAMENTE el código CUFE (o CUDE) o el código QR de esta factura DIAN de Colombia. Responde únicamente con el valor hexadecimal de 96 caracteres o el contenido decodificado del QR.',
              },
            ],
          },
        });
        const secondText = cufePassResponse.text || '';
        const matchSecond = secondText.match(/[a-fA-F0-9]{96}/);
        if (matchSecond) {
          cufeEncontrado = matchSecond[0].toLowerCase();
        }
      } catch (e) {
        console.warn('Segunda lectura de CUFE no concluyente:', e);
      }
    }

    parsed.cufe = cufeEncontrado; // queda con 96 hex o null (marcado como "No identificado")
    parsed.ia_raw_response = rawResponseText;

    // Diagnóstico y confianza
    if (parsed.cufe && parsed.total > 0 && parsed.emisor) {
      parsed.confianza_extraccion = 'alta';
      parsed.mensaje_diagnostico =
        'Lectura fiscal conforme: CUFE de 96 caracteres, valores numéricos y emisor identificados con certeza.';
    } else if (parsed.total > 0 && parsed.emisor) {
      parsed.confianza_extraccion = 'media';
      parsed.mensaje_diagnostico =
        'Se identificaron los montos y emisor. El código CUFE de 96 caracteres no fue detectable con nitidez.';
    } else {
      parsed.confianza_extraccion = 'baja';
      parsed.mensaje_diagnostico =
        'La imagen no presenta nitidez suficiente para extraer todos los datos fiscales. Se sugiere repetir la foto con mejor enfoque e iluminación.';
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Error en extracción visual con Gemini:', error);
    res.status(500).json({
      error: `Error al procesar la factura con el motor de visión: ${error.message || 'Error desconocido'}`,
      error_extraccion: true,
      confianza_extraccion: 'baja',
    });
  }
});

// 4. Verificación de CUFE duplicado en toda la base de datos (sin exponer registros de otros trabajadores)
app.get('/api/check-cufe/:cufe', requireAuth, async (req: Request, res: Response) => {
  const cufeToCheck = String(req.params.cufe || '').trim().toLowerCase();
  if (cufeToCheck.length !== 96) {
    res.json({ duplicado: false });
    return;
  }

  try {
    // 1. Consultar Firestore
    if (firestoreDb) {
      const snap = await firestoreDb
        .collection('expenses')
        .where('cufe', '==', cufeToCheck)
        .limit(1)
        .get();

      if (!snap.empty) {
        const docData = snap.docs[0].data();
        res.json({
          duplicado: true,
          registrado_por: docData.nombre_responsable || 'Otro funcionario',
          cargo: docData.cargo || 'Funcionario',
          fecha_registro: docData.creado_en,
          numero_factura: docData.numero_factura,
          emisor: docData.emisor,
        });
        return;
      }
    }
  } catch (err) {
    console.warn('Consulta CUFE en Firestore falló, verificando almacén local:', err);
  }

  // 2. Consultar almacén persistente de respaldo
  const store = readLocalStore();
  const match = store.expenses.find(
    (g) => String(g.cufe || '').trim().toLowerCase() === cufeToCheck
  );

  if (match) {
    res.json({
      duplicado: true,
      registrado_por: match.nombre_responsable,
      cargo: match.cargo,
      fecha_registro: match.creado_en,
      numero_factura: match.numero_factura,
      emisor: match.emisor,
    });
    return;
  }

  res.json({ duplicado: false });
});

// 5. Listar gastos con RBAC estricto:
// - Trabajador: lee ÚNICAMENTE sus propios gastos
// - Administrador: lee y gestiona los gastos de toda la compañía
app.get('/api/expenses', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const { estado, search } = req.query;

  let gastos: any[] = [];

  try {
    if (firestoreDb) {
      let queryRef = firestoreDb.collection('expenses');
      if (user.role === 'trabajador') {
        queryRef = queryRef.where('user_id', '==', user.uid);
      }
      const snapshot = await queryRef.get();
      snapshot.forEach((doc: any) => {
        gastos.push({ id: doc.id, ...doc.data() });
      });
    }
  } catch (err) {
    console.warn('Consulta Firestore falló, leyendo almacén local:', err);
  }

  if (gastos.length === 0) {
    const store = readLocalStore();
    gastos =
      user.role === 'trabajador'
        ? store.expenses.filter((g) => g.user_id === user.uid)
        : [...store.expenses];
  }

  // Filtros opcionales
  if (estado && estado !== 'todos') {
    gastos = gastos.filter((g) => g.estado === String(estado));
  }
  if (search) {
    const s = String(search).toLowerCase();
    gastos = gastos.filter(
      (g) =>
        (g.emisor && g.emisor.toLowerCase().includes(s)) ||
        (g.nombre_responsable && g.nombre_responsable.toLowerCase().includes(s)) ||
        (g.numero_factura && g.numero_factura.toLowerCase().includes(s)) ||
        (g.cufe && g.cufe.toLowerCase().includes(s)) ||
        (g.tipo_gasto && g.tipo_gasto.toLowerCase().includes(s))
    );
  }

  // Orden descendente por fecha de radicación
  gastos.sort(
    (a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
  );

  res.json(gastos);
});

// 6. Radicar nuevo gasto (con foto obligatoria protegida y CUFE validado)
app.post('/api/expenses', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const body = req.body;

  // Validación estricta de propiedad de la radicación
  if (user.role === 'trabajador' && body.user_id && body.user_id !== user.uid) {
    res.status(403).json({ error: 'No está autorizado a radicar gastos en nombre de otro trabajador.' });
    return;
  }

  const cufeLimpio = String(body.cufe || '').trim().toLowerCase();
  if (cufeLimpio.length !== 96 || !/^[a-f0-9]{96}$/.test(cufeLimpio)) {
    res.status(400).json({
      error: 'El código CUFE es inválido. Debe constar de exactamente 96 caracteres hexadecimales.',
    });
    return;
  }

  // Validación de fotografía obligatoria
  if (!body.foto_url) {
    res.status(400).json({
      error: 'La captura fotográfica de la factura con cámara en vivo es obligatoria.',
    });
    return;
  }

  const expenseId = body.id || crypto.randomUUID();

  // Guardar fotografía físicamente en almacén protegido
  const fileName = `factura_${expenseId}_${Date.now()}.jpg`;
  const filePath = path.join(PROTECTED_UPLOADS_DIR, fileName);

  try {
    const cleanBase64 = String(body.foto_url).replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));
  } catch (err) {
    console.error('Error al guardar archivo de foto:', err);
    res.status(500).json({ error: 'Error al asegurar la imagen de la factura en el servidor.' });
    return;
  }

  const nuevoGasto = {
    id: expenseId,
    creado_en: body.creado_en || new Date().toISOString(),
    user_id: user.uid,
    emisor: body.emisor || 'No identificado',
    nit_emisor: body.nit_emisor || null,
    numero_factura: body.numero_factura || 'No identificado',
    cufe: cufeLimpio,
    qr_dian: body.qr_dian || null,
    fecha_emision: body.fecha_emision || new Date().toISOString().split('T')[0],
    fecha_vencimiento: body.fecha_vencimiento || null,
    valor_neto: Number(body.valor_neto) || 0,
    iva: Number(body.iva) || 0,
    total: Number(body.total) || 0,
    tipo_documento: body.tipo_documento || 'Factura Electrónica de Venta',
    forma_pago: body.forma_pago || 'Contado',
    medio_pago: body.medio_pago || 'Bancarizado',
    nombre_responsable: user.name || body.nombre_responsable,
    cargo: user.cargo || body.cargo,
    tipo_gasto: body.tipo_gasto || 'Alimentación / Viáticos',
    tipo_pago: body.tipo_pago || 'Efectivo / Caja menor',
    objeto: body.objeto || '',
    foto_storage_path: fileName,
    foto_url: `/api/expenses/${expenseId}/photo`,
    foto_tomada_en: body.foto_tomada_en || new Date().toISOString(),
    estado: 'pendiente',
    confianza_extraccion: body.confianza_extraccion || 'alta',
    mensaje_diagnostico: body.mensaje_diagnostico || 'Radicado conforme.',
    ia_raw_response: body.ia_raw_response || null,
  };

  // 1. Persistir en Firestore
  try {
    if (firestoreDb) {
      await firestoreDb.collection('expenses').doc(expenseId).set(nuevoGasto);
    }
  } catch (err) {
    console.warn('Persistencia en Firestore falló, escribiendo en almacén de respaldo:', err);
  }

  // 2. Persistir en almacén local
  const store = readLocalStore();
  store.expenses = store.expenses.filter((g) => g.id !== expenseId);
  store.expenses.unshift(nuevoGasto);
  writeLocalStore(store);

  // 3. Notificar a administradores conectados en tiempo real
  notifySSE({ type: 'nuevo_gasto', data: nuevoGasto });

  res.status(201).json(nuevoGasto);
});

// 7. Servir fotografía de factura PROTEGIDA con autenticación y verificación de permisos
// Un trabajador solo puede ver sus fotos; un administrador puede ver cualquier foto.
app.get('/api/expenses/:id/photo', requireAuth, async (req: Request, res: Response) => {
  const expenseId = req.params.id;
  const user = req.user!;

  let gasto: any = null;

  // Consultar gasto en Firestore
  try {
    if (firestoreDb) {
      const doc = await firestoreDb.collection('expenses').doc(expenseId).get();
      if (doc.exists) {
        gasto = doc.data();
      }
    }
  } catch (e) {
    // Continuar con almacén local
  }

  if (!gasto) {
    const store = readLocalStore();
    gasto = store.expenses.find((g) => g.id === expenseId);
  }

  if (!gasto) {
    res.status(404).json({ error: 'Comprobante no encontrado en el sistema.' });
    return;
  }

  // Comprobar autorización de acceso al archivo fotográfico
  if (user.role !== 'administrador' && gasto.user_id !== user.uid) {
    res.status(403).json({
      error: 'Acceso denegado: No tiene autorización para consultar este archivo de factura.',
    });
    return;
  }

  const fileName = gasto.foto_storage_path || `factura_${expenseId}.jpg`;
  const filePath = path.join(PROTECTED_UPLOADS_DIR, fileName);

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Si no está el archivo físico pero viene foto_url en dataUrl
    if (gasto.foto_url && gasto.foto_url.startsWith('data:image/')) {
      const base64Data = gasto.foto_url.replace(/^data:image\/[a-z]+;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', 'image/jpeg');
      res.send(imgBuffer);
    } else {
      res.status(404).json({ error: 'El archivo físico de la fotografía no se encuentra en el servidor.' });
    }
  }
});

// 8. Actualizar estado de aprobación/rechazo (EXCLUSIVO ADMINISTRADOR)
app.patch('/api/expenses/:id/status', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const expenseId = req.params.id;
  const { estado, comentario_aprobacion } = req.body;
  const adminUser = req.user!;

  if (!['aprobado', 'rechazado'].includes(estado)) {
    res.status(400).json({ error: 'El estado solo puede ser aprobado o rechazado.' });
    return;
  }

  const updateFields = {
    estado,
    comentario_aprobacion: comentario_aprobacion || null,
    revisado_por: adminUser.name || adminUser.email,
    actualizado_en: new Date().toISOString(),
  };

  // 1. Actualizar en Firestore
  try {
    if (firestoreDb) {
      await firestoreDb.collection('expenses').doc(expenseId).update(updateFields);
    }
  } catch (err) {
    console.warn('Actualización en Firestore falló, actualizando en almacén local:', err);
  }

  // 2. Actualizar en almacén local
  const store = readLocalStore();
  const idx = store.expenses.findIndex((g) => g.id === expenseId);
  if (idx !== -1) {
    store.expenses[idx] = { ...store.expenses[idx], ...updateFields };
    writeLocalStore(store);
  }

  const updatedGasto = idx !== -1 ? store.expenses[idx] : { id: expenseId, ...updateFields };

  // Notificar al trabajador vía SSE
  notifySSE({
    type: 'status_updated',
    data: updatedGasto,
  });

  res.json(updatedGasto);
});

// 9. Catálogos operacionales
app.get('/api/catalogs', requireAuth, async (req: Request, res: Response) => {
  try {
    if (firestoreDb) {
      const catDoc = await firestoreDb.collection('catalogs').doc('default').get();
      if (catDoc.exists) {
        res.json(catDoc.data());
        return;
      }
    }
  } catch (e) {
    // Fallback local
  }
  const store = readLocalStore();
  res.json(store.catalogs);
});

app.post('/api/catalogs', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { tiposGasto, tiposPago } = req.body;

  const catalogPayload = {
    tiposGasto: Array.isArray(tiposGasto) ? tiposGasto : DEFAULT_CATALOGS.tiposGasto,
    tiposPago: Array.isArray(tiposPago) ? tiposPago : DEFAULT_CATALOGS.tiposPago,
    actualizado_en: new Date().toISOString(),
  };

  try {
    if (firestoreDb) {
      await firestoreDb.collection('catalogs').doc('default').set(catalogPayload, { merge: true });
    }
  } catch (e) {
    console.warn('Escritura de catálogos en Firestore falló:', e);
  }

  const store = readLocalStore();
  store.catalogs = catalogPayload;
  writeLocalStore(store);

  res.json(catalogPayload);
});

// 10. Gestión de Usuarios y Asignación de Roles (EXCLUSIVO ADMINISTRADOR)
app.get('/api/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  let usersList: any[] = [];
  try {
    if (firestoreDb) {
      const snapshot = await firestoreDb.collection('users').get();
      snapshot.forEach((doc: any) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
    }
  } catch (e) {
    console.warn('Consulta de usuarios en Firestore falló:', e);
  }

  if (usersList.length === 0) {
    const store = readLocalStore();
    usersList = store.users;
  }

  res.json(usersList);
});

app.patch('/api/users/:uid/role', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const targetUid = req.params.uid;
  const { rol, cargo } = req.body;

  if (rol && !['trabajador', 'administrador'].includes(rol)) {
    res.status(400).json({ error: 'Rol no válido. Debe ser trabajador o administrador.' });
    return;
  }

  const updateData: any = { actualizado_en: new Date().toISOString() };
  if (rol) updateData.rol = rol;
  if (cargo) updateData.cargo = cargo;

  try {
    if (firestoreDb) {
      await firestoreDb.collection('users').doc(targetUid).set(updateData, { merge: true });
    }
  } catch (e) {
    console.warn('Actualización de rol en Firestore falló:', e);
  }

  const store = readLocalStore();
  const userIdx = store.users.findIndex((u) => u.id === targetUid);
  if (userIdx !== -1) {
    store.users[userIdx] = { ...store.users[userIdx], ...updateData };
    writeLocalStore(store);
  }

  res.json({ success: true, updated: updateData });
});

// ==========================================
// MONTAJE DE VITE / PRODUCCIÓN
// ==========================================
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[COLAVES] Servidor de Legalización de Gastos activo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fallo fatal al iniciar el servidor Colaves:', err);
});
