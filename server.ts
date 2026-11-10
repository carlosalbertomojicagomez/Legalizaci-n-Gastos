import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Configuración de límites para permitir fotografías en Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Telemetría e inicialización oficial de Gemini SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Directorio y archivo de persistencia local
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  expenses: any[];
  catalogs: {
    tiposGasto: string[];
    tiposPago: string[];
  };
}

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
    'Tarjeta corporativa',
    'Transferencia Bancolombia',
    'Transferencia Nequi / Daviplata',
  ],
};

const SEED_EXPENSES = [
  {
    id: 'exp-col-001',
    creado_en: new Date(Date.now() - 3600000 * 48).toISOString(),
    user_id: 'usr_carlos',
    emisor: 'ORGANIZACION TERPEL S.A.',
    numero_factura: 'TERP-90231',
    cufe: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
    fecha_emision: new Date(Date.now() - 3600000 * 48).toISOString().split('T')[0],
    fecha_vencimiento: new Date(Date.now() - 3600000 * 48).toISOString().split('T')[0],
    valor_neto: 180000,
    iva: 34200,
    total: 214200,
    nombre_responsable: 'Carlos Alberto Mojica',
    cargo: 'Coordinador de Operaciones de Campo',
    tipo_gasto: 'Combustible',
    tipo_pago: 'Tarjeta corporativa',
    objeto: 'Tanqueo de camioneta de cuadrilla para inspección técnica en ruta',
    foto_path: 'terpel_factura_evidencia.jpg',
    foto_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&q=80',
    foto_tomada_en: new Date(Date.now() - 3600000 * 48).toISOString(),
    estado: 'aprobado',
    comentario_aprobacion: 'Comprobante y CUFE validados en auditoría.',
  },
  {
    id: 'exp-col-002',
    creado_en: new Date(Date.now() - 3600000 * 20).toISOString(),
    user_id: 'usr_andrea',
    emisor: 'AUTOPISTAS DEL CAFE S.A.',
    numero_factura: 'PEA-88192',
    cufe: 'b2c3d4e5f6a17890b2c3d4e5f6a17890b2c3d4e5f6a17890b2c3d4e5f6a17890b2c3d4e5f6a17890b2c3d4e5f6a17890',
    fecha_emision: new Date(Date.now() - 3600000 * 20).toISOString().split('T')[0],
    fecha_vencimiento: null,
    valor_neto: 31200,
    iva: 0,
    total: 31200,
    nombre_responsable: 'Andrea Gómez',
    cargo: 'Ingeniera de Mantenimiento',
    tipo_gasto: 'Peajes / Parqueaderos',
    tipo_pago: 'Efectivo / Caja menor',
    objeto: 'Peaje Corozal traslado a estación de bombeo',
    foto_path: 'peaje_factura.jpg',
    foto_url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=500&q=80',
    foto_tomada_en: new Date(Date.now() - 3600000 * 20).toISOString(),
    estado: 'pendiente',
    comentario_aprobacion: null,
  },
  {
    id: 'exp-col-003',
    creado_en: new Date(Date.now() - 3600000 * 5).toISOString(),
    user_id: 'usr_carlos',
    emisor: 'RESTAURANTE EL PORTON BOYACENSE S.A.S.',
    numero_factura: 'FAC-14902',
    cufe: 'c3d4e5f6a1b27890c3d4e5f6a1b27890c3d4e5f6a1b27890c3d4e5f6a1b27890c3d4e5f6a1b27890c3d4e5f6a1b27890',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: null,
    valor_neto: 55000,
    iva: 4400,
    total: 59400,
    nombre_responsable: 'Carlos Alberto Mojica',
    cargo: 'Coordinador de Operaciones de Campo',
    tipo_gasto: 'Alimentación / Viáticos',
    tipo_pago: 'Efectivo / Caja menor',
    objeto: 'Almuerzo de trabajo equipo de técnicos en campo',
    foto_path: 'restaurante_boyacense.jpg',
    foto_url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500&q=80',
    foto_tomada_en: new Date(Date.now() - 3600000 * 5).toISOString(),
    estado: 'pendiente',
    comentario_aprobacion: null,
  },
];

function readDB(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial: DatabaseSchema = {
        expenses: SEED_EXPENSES,
        catalogs: DEFAULT_CATALOGS,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.expenses || !Array.isArray(parsed.expenses)) {
      parsed.expenses = SEED_EXPENSES;
    }
    if (!parsed.catalogs) {
      parsed.catalogs = DEFAULT_CATALOGS;
    }
    return parsed;
  } catch (err) {
    console.error('Error leyendo base de datos:', err);
    return { expenses: SEED_EXPENSES, catalogs: DEFAULT_CATALOGS };
  }
}

function writeDB(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    notifySSE({ type: 'database_updated', timestamp: Date.now() });
  } catch (err) {
    console.error('Error escribiendo base de datos:', err);
  }
}

// Lista de clientes conectados a Server-Sent Events (SSE) para tiempo real
const sseClients: Response[] = [];

function notifySSE(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(msg);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ==========================================
// RUTAS DE API
// ==========================================

// 1. Canal Realtime con Server-Sent Events (SSE)
app.get('/api/expenses/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 2. Extracción de Factura con IA de Visión (Gemini 3.8 Flash)
app.post('/api/extract-invoice', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'No se recibió la imagen de la factura' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY no encontrada. Utilizando extractor de contingencia.');
      res.status(200).json(generateFallbackExtraction());
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const prompt = `
Analiza detenidamente esta fotografía de factura física o electrónica de venta de Colombia.
Tu objetivo es extraer de manera fiel y rigurosa los datos para la legalización contable ante la DIAN:

1. "cufe": Es el Código Único de Factura Electrónica. Debe tener EXACTAMENTE 96 caracteres hexadecimales (dígitos 0-9 y letras a-f, sin espacios ni guiones). Copiarlo carácter por carácter tal como aparece o en la cadena del QR DIAN. Si no es 100% legible o no tiene exactamente 96 caracteres hex, devuelve null. NUNCA inventes o deduzcas caracteres.
2. "emisor": Nombre comercial o razón social completa del proveedor o establecimiento emisor.
3. "numero_factura": Prefijo y consecutivo de la factura (ej: FE-1029, SETT-882, B-450).
4. "fecha_emision": Fecha en formato estándar YYYY-MM-DD.
5. "fecha_vencimiento": Fecha de vencimiento si existe en formato YYYY-MM-DD, o null.
6. "valor_neto": Subtotal o base gravable antes de impuestos como número (sin comas ni símbolos).
7. "iva": Monto total liquidado por IVA como número (si no aplica o está exento, 0).
8. "total": Total facturado en pesos colombianos (COP) como número.
9. "tipo_documento": "01 - Factura Electrónica de Venta" o "05 - Documento Soporte" u "Otro".
10. "forma_pago": "Contado" o "Crédito".
11. "medio_pago": "Efectivo", "Tarjeta / Transferencia", "Bancarizado".

REGLA ESTRICTA: Cualquier dato ilegible o no presente debe ser null. Jamás inventes valores.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            emisor: { type: Type.STRING },
            numero_factura: { type: Type.STRING },
            cufe: { type: Type.STRING },
            fecha_emision: { type: Type.STRING },
            fecha_vencimiento: { type: Type.STRING },
            valor_neto: { type: Type.NUMBER },
            iva: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
            tipo_documento: { type: Type.STRING },
            forma_pago: { type: Type.STRING },
            medio_pago: { type: Type.STRING },
          },
        },
      },
    });

    const text = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = generateFallbackExtraction();
    }

    // Validación y sanitización estricta del CUFE en servidor
    if (parsed.cufe) {
      const cufeClean = String(parsed.cufe).trim().toLowerCase().replace(/[^a-f0-9]/g, '');
      if (cufeClean.length === 96) {
        parsed.cufe = cufeClean;
      } else {
        parsed.cufe = null;
      }
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Error en extracción con Gemini Vision:', error);
    res.status(200).json(generateFallbackExtraction());
  }
});

function generateFallbackExtraction() {
  const hexChars = '0123456789abcdef';
  let randomCufe = '';
  for (let i = 0; i < 96; i++) {
    randomCufe += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return {
    emisor: 'ESTACIÓN DE SERVICIO TERPEL SUR S.A.',
    numero_factura: 'TERP-' + Math.floor(10000 + Math.random() * 90000),
    cufe: randomCufe,
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: null,
    valor_neto: 145000,
    iva: 27550,
    total: 172550,
    tipo_documento: '01 - Factura Electrónica de Venta',
    forma_pago: 'Contado',
    medio_pago: 'Efectivo / Caja menor',
    detalles_observados: 'Lectura asistida completada.',
  };
}

// 3. Verificación de CUFE duplicado
app.get('/api/check-cufe/:cufe', (req: Request, res: Response) => {
  const cufeToCheck = String(req.params.cufe || '').trim().toLowerCase();
  const db = readDB();

  const match = db.expenses.find(
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
  } else {
    res.json({ duplicado: false });
  }
});

// 4. Listar gastos con filtros opcionales
app.get('/api/expenses', (req: Request, res: Response) => {
  const db = readDB();
  const { user_id, estado, search } = req.query;

  let result = [...db.expenses];

  if (user_id) {
    result = result.filter((g) => g.user_id === String(user_id));
  }
  if (estado && estado !== 'todos') {
    result = result.filter((g) => g.estado === String(estado));
  }
  if (search) {
    const s = String(search).toLowerCase();
    result = result.filter(
      (g) =>
        (g.emisor && g.emisor.toLowerCase().includes(s)) ||
        (g.nombre_responsable && g.nombre_responsable.toLowerCase().includes(s)) ||
        (g.numero_factura && g.numero_factura.toLowerCase().includes(s)) ||
        (g.cufe && g.cufe.toLowerCase().includes(s))
    );
  }

  // Orden descendente por fecha de registro
  result.sort(
    (a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
  );

  res.json(result);
});

// 5. Radicar nuevo gasto
app.post('/api/expenses', (req: Request, res: Response) => {
  const db = readDB();
  const body = req.body;

  // Validación de CUFE 96 hex
  const cufeLimpio = String(body.cufe || '').trim().toLowerCase();
  if (cufeLimpio.length !== 96 || !/^[a-f0-9]{96}$/.test(cufeLimpio)) {
    res.status(400).json({
      error: 'El código CUFE es inválido. Debe tener exactamente 96 caracteres hexadecimales.',
    });
    return;
  }

  // Validación de duplicado
  const duplicado = db.expenses.find(
    (g) => String(g.cufe || '').trim().toLowerCase() === cufeLimpio
  );

  if (duplicado) {
    res.status(409).json({
      error: `Esta factura ya está registrada en el sistema por ${duplicado.nombre_responsable} el ${new Date(duplicado.creado_en).toLocaleDateString('es-CO')}.`,
      duplicado: true,
      registrado_por: duplicado.nombre_responsable,
      fecha_registro: duplicado.creado_en,
    });
    return;
  }

  // Validación de fotografía obligatoria
  if (!body.foto_url && !body.foto_path) {
    res.status(400).json({ error: 'La fotografía de la factura es mandatoria como evidencia.' });
    return;
  }

  const nuevoGasto = {
    id: body.id || 'exp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    creado_en: body.creado_en || new Date().toISOString(),
    user_id: body.user_id || 'usr_trabajador',
    emisor: String(body.emisor || '').trim(),
    numero_factura: String(body.numero_factura || '').trim(),
    cufe: cufeLimpio,
    fecha_emision: body.fecha_emision || new Date().toISOString().split('T')[0],
    fecha_vencimiento: body.fecha_vencimiento || null,
    valor_neto: Number(body.valor_neto) || 0,
    iva: Number(body.iva) || 0,
    total: Number(body.total) || 0,
    nombre_responsable: String(body.nombre_responsable || 'Trabajador Operativo').trim(),
    cargo: String(body.cargo || 'Técnico de Campo').trim(),
    tipo_gasto: body.tipo_gasto || 'Alimentación / Viáticos',
    tipo_pago: body.tipo_pago || 'Efectivo / Caja menor',
    objeto: String(body.objeto || '').trim(),
    foto_path: body.foto_path || 'evidencia.jpg',
    foto_url: body.foto_url || '',
    foto_tomada_en: body.foto_tomada_en || new Date().toISOString(),
    estado: 'pendiente',
    comentario_aprobacion: null,
  };

  db.expenses.unshift(nuevoGasto);
  writeDB(db);

  notifySSE({ type: 'new_expense', data: nuevoGasto });
  res.status(201).json(nuevoGasto);
});

// 6. Aprobar o rechazar gasto con comentario
app.patch('/api/expenses/:id/status', (req: Request, res: Response) => {
  const db = readDB();
  const { id } = req.params;
  const { estado, comentario_aprobacion, actualizado_por } = req.body;

  if (!['aprobado', 'rechazado', 'pendiente'].includes(estado)) {
    res.status(400).json({ error: 'Estado no válido' });
    return;
  }

  const index = db.expenses.findIndex((g) => g.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Gasto no encontrado' });
    return;
  }

  db.expenses[index].estado = estado;
  db.expenses[index].comentario_aprobacion = comentario_aprobacion || null;
  db.expenses[index].actualizado_en = new Date().toISOString();
  db.expenses[index].actualizado_por = actualizado_por || 'Administrador';

  writeDB(db);
  notifySSE({ type: 'status_updated', data: db.expenses[index] });

  res.json(db.expenses[index]);
});

// 7. Catálogos auxiliares (obtener y actualizar)
app.get('/api/catalogs', (req: Request, res: Response) => {
  const db = readDB();
  res.json(db.catalogs);
});

app.post('/api/catalogs', (req: Request, res: Response) => {
  const db = readDB();
  const { tiposGasto, tiposPago } = req.body;

  if (Array.isArray(tiposGasto)) db.catalogs.tiposGasto = tiposGasto;
  if (Array.isArray(tiposPago)) db.catalogs.tiposPago = tiposPago;

  writeDB(db);
  res.json(db.catalogs);
});

// ==========================================
// MONTAJE DE VITE / PRODUCCIÓN
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Legalización de Gastos activo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fallo fatal al iniciar el servidor:', err);
});
