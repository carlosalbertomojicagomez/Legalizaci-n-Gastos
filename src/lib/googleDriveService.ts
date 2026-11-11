import { getDriveAccessToken } from './googleDriveAuth';
import { Gasto } from '../types';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  description?: string;
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

async function getHeaders(contentType = 'application/json') {
  const token = await getDriveAccessToken();
  if (!token) {
    throw new Error('Sesión de Google Drive no autenticada. Inicie sesión para continuar.');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': contentType,
  };
}

/**
 * Lista archivos y carpetas en Google Drive
 */
export async function listarArchivosDrive(
  folderId?: string,
  busqueda?: string
): Promise<DriveFileItem[]> {
  const token = await getDriveAccessToken();
  if (!token) return [];

  let q = "trashed = false";
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }
  if (busqueda && busqueda.trim()) {
    q += ` and name contains '${busqueda.replace(/'/g, "\\'")}'`;
  }

  const fields =
    'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, thumbnailLink, iconLink, description)';
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    q
  )}&fields=${encodeURIComponent(fields)}&orderBy=folder,modifiedTime desc&pageSize=50`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al listar archivos de Google Drive');
  }

  const data = await resp.json();
  return data.files || [];
}

/**
 * Crea una carpeta en Google Drive
 */
export async function crearCarpetaDrive(
  nombre: string,
  parentId?: string
): Promise<DriveFileItem> {
  const headers = await getHeaders();
  const body: any = {
    name: nombre,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    body.parents = [parentId];
  }

  const resp = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al crear carpeta en Google Drive');
  }

  return await resp.json();
}

/**
 * Busca o crea la carpeta principal "Legalización de Gastos - DIAN"
 */
export async function obtenerOCrearCarpetaPrincipal(
  nombre = 'Legalización de Gastos - DIAN'
): Promise<DriveFileItem> {
  const archivos = await listarArchivosDrive(
    undefined,
    nombre
  );
  const carpetaExistente = archivos.find(
    (f) => f.name === nombre && f.mimeType === 'application/vnd.google-apps.folder'
  );

  if (carpetaExistente) {
    return carpetaExistente;
  }

  return await crearCarpetaDrive(nombre);
}

/**
 * Sube un archivo con metadata a Google Drive usando multipart/related
 */
export async function subirArchivoADrive(
  nombre: string,
  blob: Blob,
  parentId?: string,
  descripcion?: string
): Promise<DriveFileItem> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('No hay sesión activa de Google Drive');

  const metadata: any = {
    name: nombre,
    description: descripcion || 'Soporte fiscal DIAN - Legalización de Gastos',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`;

  const metadataBuffer = new TextEncoder().encode(metadataPart);
  const closeBuffer = new TextEncoder().encode(closeDelimiter);
  const fileArrayBuffer = await blob.arrayBuffer();

  const multipartBody = new Uint8Array(
    metadataBuffer.byteLength + fileArrayBuffer.byteLength + closeBuffer.byteLength
  );
  multipartBody.set(metadataBuffer, 0);
  multipartBody.set(new Uint8Array(fileArrayBuffer), metadataBuffer.byteLength);
  multipartBody.set(
    closeBuffer,
    metadataBuffer.byteLength + fileArrayBuffer.byteLength
  );

  const resp = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al subir archivo a Google Drive');
  }

  return await resp.json();
}

/**
 * Respalda la fotografía de una factura en Google Drive
 */
export async function respaldarFacturaEnDrive(
  gasto: Gasto,
  carpetaDestinoId?: string
): Promise<DriveFileItem> {
  let blob: Blob;

  if (gasto.foto_url.startsWith('data:image/')) {
    const resp = await fetch(gasto.foto_url);
    blob = await resp.blob();
  } else if (gasto.foto_url.startsWith('http')) {
    const resp = await fetch(gasto.foto_url);
    blob = await resp.blob();
  } else {
    throw new Error('La factura no tiene una fotografía válida para respaldar');
  }

  const fechaFormat = gasto.fecha_emision || new Date().toISOString().split('T')[0];
  const nombreLimpio = gasto.emisor.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const nombreArchivo = `Factura_${fechaFormat}_${nombreLimpio}_${gasto.numero_factura || 'S-N'}.jpg`;

  const descripcion = `COMPROBANTE FISCAL DIAN
Proveedor / Emisor: ${gasto.emisor}
N° Factura: ${gasto.numero_factura}
CUFE: ${gasto.cufe}
Fecha de Emisión: ${gasto.fecha_emision}
Valor Neto: $ ${gasto.valor_neto} COP
IVA: $ ${gasto.iva} COP
Total: $ ${gasto.total} COP
Responsable: ${gasto.nombre_responsable} (${gasto.cargo})
Tipo de Gasto: ${gasto.tipo_gasto}
Objeto: ${gasto.objeto}`;

  return await subirArchivoADrive(
    nombreArchivo,
    blob,
    carpetaDestinoId,
    descripcion
  );
}

/**
 * Respalda un reporte de Excel generado en Google Drive
 */
export async function respaldarReporteExcelEnDrive(
  excelBlob: Blob,
  nombreArchivo: string,
  carpetaDestinoId?: string
): Promise<DriveFileItem> {
  const descripcion = `Reporte consolidado de gastos con fotografías de comprobantes incrustadas, generado automáticamente desde la PWA Legalización de Gastos.`;
  return await subirArchivoADrive(
    nombreArchivo,
    excelBlob,
    carpetaDestinoId,
    descripcion
  );
}

/**
 * Elimina un archivo de Google Drive (OPERACIÓN DESTRUCTIVA - REQUIERE CONFIRMACIÓN PREVIA)
 */
export async function eliminarArchivoDrive(fileId: string): Promise<void> {
  const headers = await getHeaders();
  const resp = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers,
  });

  if (!resp.ok && resp.status !== 204) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al eliminar archivo de Google Drive');
  }
}
