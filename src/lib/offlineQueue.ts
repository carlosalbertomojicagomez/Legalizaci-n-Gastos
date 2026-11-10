import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Gasto } from '../types';

interface LegalizacionDB extends DBSchema {
  cola_offline: {
    key: string;
    value: Gasto;
    indexes: { 'por-fecha': string };
  };
  gastos_locales: {
    key: string;
    value: Gasto;
    indexes: { 'por-cufe': string };
  };
}

const DB_NAME = 'legalizacion_dian_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LegalizacionDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<LegalizacionDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LegalizacionDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cola_offline')) {
          const store = db.createObjectStore('cola_offline', { keyPath: 'id' });
          store.createIndex('por-fecha', 'creado_en');
        }
        if (!db.objectStoreNames.contains('gastos_locales')) {
          const cacheStore = db.createObjectStore('gastos_locales', { keyPath: 'id' });
          cacheStore.createIndex('por-cufe', 'cufe');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Guarda un gasto en la cola local cuando el dispositivo está sin conexión
 */
export async function encolarGastoOffline(gasto: Gasto): Promise<void> {
  const db = await getDB();
  await db.put('cola_offline', gasto);
  await db.put('gastos_locales', gasto);
}

/**
 * Obtiene todos los gastos pendientes de sincronización
 */
export async function obtenerColaOffline(): Promise<Gasto[]> {
  try {
    const db = await getDB();
    return await db.getAll('cola_offline');
  } catch (err) {
    console.error('Error al leer cola offline:', err);
    return [];
  }
}

/**
 * Elimina un gasto sincronizado de la cola local
 */
export async function eliminarDeColaOffline(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('cola_offline', id);
}

/**
 * Sincroniza la cola local contra el backend cuando se restablece la conexión
 */
export async function sincronizarColaConServidor(
  onSyncItem?: (gasto: Gasto, exito: boolean, mensaje?: string) => void
): Promise<{ total: number; sincronizados: number; errores: number }> {
  const cola = await obtenerColaOffline();
  if (cola.length === 0) return { total: 0, sincronizados: 0, errores: 0 };

  let sincronizados = 0;
  let errores = 0;

  for (const gasto of cola) {
    try {
      const resp = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gasto),
      });

      if (resp.ok) {
        const guardado = await resp.json();
        await eliminarDeColaOffline(gasto.id);
        sincronizados++;
        if (onSyncItem) onSyncItem(guardado, true);
      } else {
        const errorData = await resp.json().catch(() => ({}));
        errores++;
        if (onSyncItem) {
          onSyncItem(
            gasto,
            false,
            errorData.error || 'Fallo de servidor al sincronizar'
          );
        }
      }
    } catch (err: any) {
      errores++;
      if (onSyncItem) onSyncItem(gasto, false, err.message);
    }
  }

  return { total: cola.length, sincronizados, errores };
}
