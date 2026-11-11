import { Gasto, UsuarioPerfil, NotificacionItem } from '../types';
import { formatCOP } from './validations';

/**
 * Gestor de notificaciones Web (Web Notifications API) y sonido en la aplicación.
 */

export const estaSoportadoWebNotification = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const obtenerEstadoPermisoNotificacion = (): NotificationPermission | 'unsupported' => {
  if (!estaSoportadoWebNotification()) return 'unsupported';
  return Notification.permission;
};

export const solicitarPermisoNotificacion = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!estaSoportadoWebNotification()) return 'unsupported';
  try {
    const permiso = await Notification.requestPermission();
    return permiso;
  } catch (err) {
    console.warn('Error al solicitar permiso de notificaciones:', err);
    return Notification.permission;
  }
};

/**
 * Genera un tono de audio suave mediante la Web Audio API nativa
 * sin requerir dependencias de archivos de audio externos.
 */
export const reproducirSonidoNotificacion = (tipo: 'aprobado' | 'rechazado'): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tipo === 'aprobado') {
      // Tono ascendente agradable de éxito (523 Hz Do -> 659 Hz Mi -> 784 Hz Sol)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // Tono doble de alerta sobrio
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.15);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    // Los navegadores pueden bloquear audio si no hubo interacción previa
    console.debug('No se pudo reproducir audio de notificación:', e);
  }
};

/**
 * Envía una notificación Web a nivel de sistema operativo / navegador
 */
export const enviarNotificacionWeb = async (
  titulo: string,
  opciones: {
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
  }
): Promise<boolean> => {
  if (!estaSoportadoWebNotification()) return false;
  if (Notification.permission !== 'granted') return false;

  const defaultIcon = '/pwa-192x192.png';
  const defaultBadge = '/favicon.ico';

  try {
    // Si hay un Service Worker activo (PWA), preferir reg.showNotification para soporte en segundo plano
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        const swOptions: any = {
          body: opciones.body,
          icon: opciones.icon || defaultIcon,
          badge: opciones.badge || defaultBadge,
          tag: opciones.tag || 'legalizacion-gasto',
          data: opciones.data,
          vibrate: [150, 80, 150],
        };
        await reg.showNotification(titulo, swOptions);
        return true;
      }
    }

    // Fallback estándar en ventana
    const notif = new Notification(titulo, {
      body: opciones.body,
      icon: opciones.icon || defaultIcon,
      badge: opciones.badge || defaultBadge,
      tag: opciones.tag || 'legalizacion-gasto',
      data: opciones.data,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn('Error enviando notificación web nativa:', err);
    return false;
  }
};

/**
 * Evalúa si un cambio de estado en un gasto corresponde al trabajador actual
 * y genera tanto la notificación web como el registro in-app.
 */
export const procesarNotificacionDeGasto = (
  gasto: Gasto,
  usuarioActual: UsuarioPerfil
): NotificacionItem | null => {
  // Verificar si el gasto le pertenece al usuario actual
  const esDelUsuario =
    gasto.user_id === usuarioActual.id ||
    gasto.nombre_responsable?.trim().toLowerCase() === usuarioActual.nombre_completo?.trim().toLowerCase() ||
    usuarioActual.rol === 'trabajador';

  if (!esDelUsuario) {
    return null;
  }

  // Solo notificar cambios definitivos (aprobado o rechazado)
  if (gasto.estado !== 'aprobado' && gasto.estado !== 'rechazado') {
    return null;
  }

  const esAprobado = gasto.estado === 'aprobado';
  const adminNombre = gasto.actualizado_por || 'Administración';
  const fechaStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  let titulo = '';
  let cuerpo = '';

  if (esAprobado) {
    titulo = `✅ Gasto Aprobado: ${gasto.emisor}`;
    cuerpo = `Tu factura N° ${gasto.numero_factura} por ${formatCOP(gasto.total)} fue aprobada por ${adminNombre}.${
      gasto.comentario_aprobacion ? ` Nota: "${gasto.comentario_aprobacion}"` : ''
    }`;
  } else {
    titulo = `❌ Gasto Rechazado: ${gasto.emisor}`;
    cuerpo = `Tu factura N° ${gasto.numero_factura} por ${formatCOP(gasto.total)} fue rechazada por ${adminNombre}.${
      gasto.comentario_aprobacion ? ` Motivo: "${gasto.comentario_aprobacion}"` : ''
    }`;
  }

  // Reproducir sonido
  reproducirSonidoNotificacion(esAprobado ? 'aprobado' : 'rechazado');

  // Enviar notificación web a nivel de sistema operativo
  enviarNotificacionWeb(titulo, {
    body: cuerpo,
    tag: `gasto-estado-${gasto.id}`,
    data: { gastoId: gasto.id, url: '/' },
  });

  return {
    id: crypto.randomUUID(),
    gastoId: gasto.id,
    titulo,
    mensaje: cuerpo,
    tipo: esAprobado ? 'aprobado' : 'rechazado',
    fecha: fechaStr,
    leida: false,
    emisor: gasto.emisor,
    total: gasto.total,
  };
};
