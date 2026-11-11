import { getWorkspaceAccessToken } from './googleDriveAuth';
import { Gasto } from '../types';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

async function getAuthHeader() {
  const token = await getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Sesión de Google Workspace no autenticada. Conecte su cuenta para continuar.');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export interface GoogleSheetSummary {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetName: string;
  rowCount: number;
}

/**
 * Lista las hojas de cálculo de Google existentes en Google Drive
 */
export async function listarHojasCalculoDeUsuario(): Promise<
  Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }>
> {
  const token = await getWorkspaceAccessToken();
  if (!token) return [];

  const q = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
  const fields = 'files(id, name, modifiedTime, webViewLink)';
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    q
  )}&fields=${encodeURIComponent(fields)}&orderBy=modifiedTime desc&pageSize=25`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error consultando hojas de cálculo en Drive');
  }

  const data = await resp.json();
  return data.files || [];
}

/**
 * Crea una nueva hoja de cálculo en Google Sheets con formato corporativo DIAN
 */
export async function crearHojaDeCalculoGastos(
  titulo = `Legalización de Gastos DIAN - ${new Date().getFullYear()}`,
  carpetaDestinoId?: string
): Promise<GoogleSheetSummary> {
  const headers = await getAuthHeader();

  const body = {
    properties: {
      title: titulo,
      locale: 'es_CO',
      autoRecalc: 'ON_CHANGE',
    },
    sheets: [
      {
        properties: {
          title: 'Gastos Legalizados',
          gridProperties: {
            frozenRowCount: 1,
            rowCount: 200,
            columnCount: 16,
          },
        },
      },
    ],
  };

  const resp = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al crear hoja de cálculo en Google Sheets');
  }

  const data = await resp.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Si se especificó carpeta en Drive, mover la hoja creada a dicha carpeta
  if (carpetaDestinoId) {
    try {
      await fetch(
        `${DRIVE_API_BASE}/files/${spreadsheetId}?addParents=${carpetaDestinoId}&fields=id,parents`,
        {
          method: 'PATCH',
          headers,
        }
      );
    } catch (e) {
      console.warn('Aviso: No se pudo mover la hoja a la carpeta de Drive:', e);
    }
  }

  // Aplicar formato de cabecera con estilo corporativo
  await formatearCabeceraHoja(spreadsheetId, data.sheets?.[0]?.properties?.sheetId || 0);

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: titulo,
    sheetName: 'Gastos Legalizados',
    rowCount: 1,
  };
}

/**
 * Aplica estilos en Google Sheets (fondo azul corporativo, texto blanco, negrita, anchos)
 */
async function formatearCabeceraHoja(spreadsheetId: string, sheetId: number): Promise<void> {
  const headers = await getAuthHeader();

  const batchUpdateBody = {
    requests: [
      // 1. Formato de encabezado (Fila 1)
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 16,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.04, green: 0.14, blue: 0.25 }, // #0A2540
              horizontalAlignment: 'CENTER',
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 10,
                bold: true,
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      // 2. Anchos óptimos de columnas
      {
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 1,
          },
          properties: { pixelSize: 130 }, // Fecha
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 4,
            endIndex: 5,
          },
          properties: { pixelSize: 220 }, // Emisor
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 10,
            endIndex: 11,
          },
          properties: { pixelSize: 250 }, // Objeto
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 14,
            endIndex: 15,
          },
          properties: { pixelSize: 320 }, // CUFE
          fields: 'pixelSize',
        },
      },
    ],
  };

  try {
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batchUpdateBody),
    });
  } catch (err) {
    console.warn('Error aplicando formato a Google Sheets:', err);
  }
}

/**
 * Obtiene los detalles y metadatos de una hoja de cálculo existente
 */
export async function obtenerMetadatosHoja(spreadsheetId: string): Promise<{
  titulo: string;
  pestañas: Array<{ id: number; nombre: string }>;
  enlace: string;
}> {
  const headers = await getAuthHeader();
  const resp = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties`, {
    headers,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'No se pudo acceder a la hoja de Google Sheets');
  }

  const data = await resp.json();
  const pestañas = (data.sheets || []).map((s: any) => ({
    id: s.properties.sheetId,
    nombre: s.properties.title,
  }));

  return {
    titulo: data.properties.title || 'Hoja de Google Sheets',
    pestañas,
    enlace: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

/**
 * Sincroniza el listado completo de gastos en la hoja de cálculo de Google
 */
export async function sincronizarGastosConGoogleSheets(
  spreadsheetId: string,
  gastos: Gasto[],
  nombrePestaña?: string
): Promise<{ filasActualizadas: number; rango: string; enlace: string }> {
  const headers = await getAuthHeader();

  // 1. Obtener el nombre real de la primera pestaña para no hardcodear
  const meta = await obtenerMetadatosHoja(spreadsheetId);
  const targetSheetName = nombrePestaña || meta.pestañas[0]?.nombre || 'Gastos Legalizados';

  // 2. Construir cabecera y filas
  const encabezados = [
    'Fecha Registro',
    'Estado',
    'Responsable',
    'Cargo',
    'Emisor / Proveedor',
    'NIT Emisor',
    'N° Factura',
    'Fecha Emisión',
    'Fecha Vencimiento',
    'Tipo de Gasto',
    'Medio de Pago',
    'Objeto / Justificación',
    'Valor Neto (COP)',
    'IVA (COP)',
    'Total (COP)',
    'CUFE (DIAN 96 Hex)',
  ];

  const filas = gastos.map((g) => [
    new Date(g.creado_en).toLocaleDateString('es-CO') + ' ' + new Date(g.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    g.estado.toUpperCase(),
    g.nombre_responsable,
    g.cargo,
    g.emisor,
    g.nit_emisor || 'N/A',
    g.numero_factura,
    g.fecha_emision,
    g.fecha_vencimiento || 'N/A',
    g.tipo_gasto,
    g.tipo_pago,
    g.objeto,
    Number(g.valor_neto) || 0,
    Number(g.iva) || 0,
    Number(g.total) || 0,
    g.cufe,
  ]);

  // Fila de sumatoria
  const ultimaFila = gastos.length + 1;
  const filaTotales = [
    'TOTALES CONSOLIDADOS',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    gastos.length > 0 ? `=SUM(M2:M${ultimaFila})` : 0,
    gastos.length > 0 ? `=SUM(N2:N${ultimaFila})` : 0,
    gastos.length > 0 ? `=SUM(O2:O${ultimaFila})` : 0,
    `${gastos.length} facturas registradas`,
  ];

  const todosLosValores = [encabezados, ...filas, filaTotales];

  // 3. Escribir valores en Google Sheets
  const range = `'${targetSheetName}'!A1:P${todosLosValores.length}`;
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const resp = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: todosLosValores,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al actualizar valores en Google Sheets');
  }

  // 4. Formatear números en columnas L, M, N como moneda COP
  const targetSheetId = meta.pestañas.find((p) => p.nombre === targetSheetName)?.id || 0;
  await formatearMonedaColumnas(spreadsheetId, targetSheetId, 1, todosLosValores.length);

  return {
    filasActualizadas: todosLosValores.length,
    rango: range,
    enlace: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

/**
 * Añade una sola fila de gasto a la hoja de Google Sheets (append)
 */
export async function anexarGastoAHoja(
  spreadsheetId: string,
  gasto: Gasto,
  nombrePestaña?: string
): Promise<void> {
  const headers = await getAuthHeader();
  const meta = await obtenerMetadatosHoja(spreadsheetId);
  const targetSheetName = nombrePestaña || meta.pestañas[0]?.nombre || 'Gastos Legalizados';

  const fila = [
    new Date(gasto.creado_en).toLocaleDateString('es-CO') + ' ' + new Date(gasto.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    gasto.estado.toUpperCase(),
    gasto.nombre_responsable,
    gasto.cargo,
    gasto.emisor,
    gasto.numero_factura,
    gasto.fecha_emision,
    gasto.fecha_vencimiento || 'N/A',
    gasto.tipo_gasto,
    gasto.tipo_pago,
    gasto.objeto,
    Number(gasto.valor_neto) || 0,
    Number(gasto.iva) || 0,
    Number(gasto.total) || 0,
    gasto.cufe,
  ];

  const range = `'${targetSheetName}'!A1`;
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [fila],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error anexando fila a Google Sheets');
  }
}

/**
 * Aplica formato de moneda COP "$ #,##0" a las columnas L, M y N
 */
async function formatearMonedaColumnas(
  spreadsheetId: string,
  sheetId: number,
  startRow: number,
  endRow: number
): Promise<void> {
  const headers = await getAuthHeader();

  const body = {
    requests: [
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: startRow,
            endRowIndex: endRow,
            startColumnIndex: 11, // L (Neto)
            endColumnIndex: 14,   // N (Total)
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'CURRENCY',
                pattern: '"$"#,##0',
              },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      },
    ],
  };

  try {
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn('Aviso formateando celdas de moneda:', e);
  }
}
