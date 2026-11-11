import express, { Request, Response } from 'express';
import http from 'http';
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
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

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

// 2. Extracción de Factura con IA de Visión Real (Gemini 3.8 Flash)
app.post('/api/extract-invoice', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'No se recibió la imagen de la factura' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: 'Servicio de reconocimiento visual no disponible: GEMINI_API_KEY no configurada.',
        error_extraccion: true,
        confianza_extraccion: 'baja',
        mensaje_diagnostico: 'Configure la clave GEMINI_API_KEY en el servidor para habilitar el análisis visual automático.',
      });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const prompt = `
Eres un auditor tributario y perito en Facturación Electrónica de la DIAN en Colombia.
Analiza con el mayor rigor técnico la fotografía de esta factura física, electrónica o tiquete equivalente.

INSTRUCCIONES DE EXTRACCIÓN REAL:
1. "emisor": Nombre comercial o razón social completa del emisor/proveedor tal como aparece impreso en el encabezado.
2. "nit_emisor": Número de Identificación Tributaria (NIT) del proveedor con o sin dígito de verificación (ej: "900.123.456-7" o "860000000-1").
3. "numero_factura": Prefijo y consecutivo oficial de la factura (ej: "FE-1029", "SETP-9921", "B-4920", "POS-00129").
4. "cufe": Código Único de Factura Electrónica (o CUDE si es documento soporte).
   - Consta de exactamente 96 caracteres hexadecimales (dígitos 0-9 y letras a-f o A-F).
   - Búscalo en el bloque de texto con la etiqueta "CUFE", "CUDE", "Código de Seguridad", o decodifica el parámetro "CUFE=" dentro de la cadena del código QR DIAN si está visible.
   - Si identificas los 96 caracteres, devuélvelo en minúsculas sin espacios ni saltos de línea.
   - Si no es 100% legible o no tiene exactamente 96 caracteres, devuelve null. NUNCA inventes caracteres.
5. "qr_dian": Si la imagen contiene un código QR o la cadena de texto DIAN (ej: NumFac=...&NitFac=...&ValTolFac=...&CUFE=... o enlace de consulta catalogo-vpfe.dian.gov.co), extrae el texto completo o la URL. Si no existe, null.
6. "fecha_emision": Fecha de emisión en formato estándar YYYY-MM-DD.
7. "fecha_vencimiento": Fecha de vencimiento si aparece en formato YYYY-MM-DD, o null.
8. "valor_neto": Subtotal o base gravable antes de impuestos como número en pesos colombianos COP (sin comas ni símbolos).
9. "iva": Monto total liquidado por IVA o Impoconsumo como número en COP. Si está exento o no aplica, 0.
10. "total": Total a pagar en pesos colombianos (COP) como número entero o flotante.
11. "concepto_sugerido": Breve descripción del objeto o producto principal facturado (ej: "Combustible Diesel", "Alimentación viáticos", "Hospedaje", "Peaje vehicular", "Mantenimiento preventivo").
12. "tipo_documento": "01 - Factura Electrónica de Venta", "05 - Documento Soporte" o "Tiquete POS / Equivalente".
13. "forma_pago": "Contado" o "Crédito".
14. "medio_pago": "Efectivo", "Tarjeta / Transferencia" o "Bancarizado".
15. "confianza_extraccion": "alta" si el CUFE y total fueron claramente identificados, "media" si se leyó el total y emisor pero CUFE requiere verificación manual, "baja" si la foto está borrosa o ilegible.
16. "mensaje_diagnostico": Explicación concisa en español de los campos identificados con certeza y advertencias sobre datos que requieran corroboración visual.

REGLA ESTRICTA: Lee ÚNICAMENTE lo que esté efectivamente plasmado en la fotografía. NUNCA inventes o deduzcas datos inexistentes.
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
            nit_emisor: { type: Type.STRING },
            numero_factura: { type: Type.STRING },
            cufe: { type: Type.STRING },
            qr_dian: { type: Type.STRING },
            fecha_emision: { type: Type.STRING },
            fecha_vencimiento: { type: Type.STRING },
            valor_neto: { type: Type.NUMBER },
            iva: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
            concepto_sugerido: { type: Type.STRING },
            tipo_documento: { type: Type.STRING },
            forma_pago: { type: Type.STRING },
            medio_pago: { type: Type.STRING },
            confianza_extraccion: { type: Type.STRING },
            mensaje_diagnostico: { type: Type.STRING },
          },
        },
      },
    });

    const text = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        emisor: null,
        nit_emisor: null,
        numero_factura: null,
        cufe: null,
        qr_dian: null,
        fecha_emision: new Date().toISOString().split('T')[0],
        fecha_vencimiento: null,
        valor_neto: 0,
        iva: 0,
        total: 0,
        confianza_extraccion: 'baja',
        mensaje_diagnostico: 'No se pudo interpretar el formato JSON de la respuesta de IA.',
      };
    }

    // Post-procesamiento y validación rigurosa del CUFE (96 caracteres hexadecimales)
    let cufeEncontrado: string | null = null;

    if (parsed.cufe) {
      const cufeClean = String(parsed.cufe).trim().toLowerCase().replace(/[^a-f0-9]/g, '');
      if (cufeClean.length === 96) {
        cufeEncontrado = cufeClean;
      }
    }

    // Si no vino en el campo cufe directo, buscar en qr_dian o en el texto crudo
    if (!cufeEncontrado && parsed.qr_dian) {
      const matchQr = String(parsed.qr_dian).match(/[a-fA-F0-9]{96}/);
      if (matchQr) {
        cufeEncontrado = matchQr[0].toLowerCase();
      }
    }

    // Asignar el CUFE validado o null si no cumplió los 96 caracteres
    parsed.cufe = cufeEncontrado;

    // Ajustar diagnóstico de confianza
    if (parsed.cufe && parsed.total > 0 && parsed.emisor) {
      parsed.confianza_extraccion = 'alta';
      if (!parsed.mensaje_diagnostico) {
        parsed.mensaje_diagnostico = 'Factura leída con éxito: CUFE de 96 caracteres, valores y emisor confirmados.';
      }
    } else if (parsed.total > 0 && parsed.emisor) {
      parsed.confianza_extraccion = 'media';
      if (!parsed.mensaje_diagnostico) {
        parsed.mensaje_diagnostico = 'Se identificó el proveedor y valores. El CUFE de 96 caracteres requiere verificación manual.';
      }
    } else {
      parsed.confianza_extraccion = 'baja';
      if (!parsed.mensaje_diagnostico) {
        parsed.mensaje_diagnostico = 'La foto requiere mejor iluminación o enfoque para leer todos los datos fiscales.';
      }
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Error en extracción real con Gemini Vision:', error);
    res.status(200).json({
      emisor: null,
      nit_emisor: null,
      numero_factura: null,
      cufe: null,
      qr_dian: null,
      fecha_emision: new Date().toISOString().split('T')[0],
      fecha_vencimiento: null,
      valor_neto: 0,
      iva: 0,
      total: 0,
      confianza_extraccion: 'baja',
      mensaje_diagnostico: `Aviso del motor de visión: ${error.message || 'Error al procesar la imagen'}. Por favor revise la fotografía adjunta y complete los campos.`,
      error_extraccion: true,
    });
  }
});

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

  let fotoPath = body.foto_path || `factura_${Date.now()}.jpg`;
  if (body.foto_url && typeof body.foto_url === 'string' && body.foto_url.startsWith('data:image/')) {
    try {
      const match = body.foto_url.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'png' ? 'png' : 'jpg';
        const fileName = `factura_${Date.now()}_${cufeLimpio.substring(0, 8)}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
        fotoPath = `/uploads/${fileName}`;
      }
    } catch (e) {
      console.warn('Error al guardar archivo en disco:', e);
    }
  }

  const nuevoGasto = {
    id: body.id || 'exp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    creado_en: body.creado_en || new Date().toISOString(),
    user_id: body.user_id || 'usr_trabajador',
    emisor: String(body.emisor || '').trim(),
    nit_emisor: String(body.nit_emisor || '').trim() || null,
    numero_factura: String(body.numero_factura || '').trim(),
    cufe: cufeLimpio,
    qr_dian: body.qr_dian || null,
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
    foto_path: fotoPath,
    foto_url: body.foto_url || fotoPath,
    foto_tomada_en: body.foto_tomada_en || new Date().toISOString(),
    confianza_extraccion: body.confianza_extraccion || 'alta',
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
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
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
    console.log(`Servidor de Legalización de Gastos activo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fallo fatal al iniciar el servidor:', err);
});
