import { getWorkspaceAccessToken } from './googleDriveAuth';
import { Gasto } from '../types';
import { formatCOP } from '../utils/validations';
import firebaseConfig from '../../firebase-applet-config.json';

const CHAT_API_BASE = 'https://chat.googleapis.com/v1';
const PROJECT_ID = firebaseConfig.projectId || 'just-now-q5v9p';

export const CHAT_APP_CONSOLE_URL = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${PROJECT_ID}`;

export interface GoogleChatSpace {
  name: string; // e.g. "spaces/AAAAAAAAAAA"
  displayName?: string;
  type?: string;
  spaceType?: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE';
  spaceDetails?: {
    description?: string;
    guidelines?: string;
  };
}

export interface ChatApiError {
  isChatAppNotConfigured: boolean;
  message: string;
  consoleUrl: string;
}

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

/**
 * Consulta la lista de espacios o salas de Google Chat accesibles por el usuario
 */
export async function listarEspaciosChat(): Promise<GoogleChatSpace[]> {
  const headers = await getAuthHeader();

  const resp = await fetch(`${CHAT_API_BASE}/spaces?pageSize=50`, {
    headers,
  });

  if (!resp.ok) {
    const errorJson = await resp.json().catch(() => ({}));
    const errorMsg = errorJson.error?.message || '';

    // Manejo específico del requisito de configuración de Google Chat en Cloud Console
    if (resp.status === 404 || errorMsg.includes('Google Chat app not found')) {
      const chatError = new Error(
        'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.'
      ) as any;
      chatError.isChatAppNotConfigured = true;
      chatError.consoleUrl = CHAT_APP_CONSOLE_URL;
      throw chatError;
    }

    throw new Error(errorMsg || `Error al consultar espacios de Google Chat (HTTP ${resp.status})`);
  }

  const data = await resp.json();
  return data.spaces || [];
}

/**
 * Crea un nuevo espacio en Google Chat (ej: "Legalizaciones Colaves")
 */
export async function crearEspacioChat(
  displayName: string,
  description?: string
): Promise<GoogleChatSpace> {
  const headers = await getAuthHeader();

  const body: any = {
    displayName,
    spaceType: 'SPACE',
  };

  if (description) {
    body.spaceDetails = { description };
  }

  const resp = await fetch(`${CHAT_API_BASE}/spaces`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errorJson = await resp.json().catch(() => ({}));
    const errorMsg = errorJson.error?.message || '';

    if (resp.status === 404 || errorMsg.includes('Google Chat app not found')) {
      const chatError = new Error(
        'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.'
      ) as any;
      chatError.isChatAppNotConfigured = true;
      chatError.consoleUrl = CHAT_APP_CONSOLE_URL;
      throw chatError;
    }

    throw new Error(errorMsg || `Error al crear el espacio en Google Chat (HTTP ${resp.status})`);
  }

  return await resp.json();
}

/**
 * Envía un mensaje con formato y tarjetas a un espacio de Google Chat
 */
export async function enviarMensajeChat(
  spaceName: string,
  text: string,
  cardsV2?: any[]
): Promise<any> {
  const headers = await getAuthHeader();

  const body: any = { text };
  if (cardsV2 && cardsV2.length > 0) {
    body.cardsV2 = cardsV2;
  }

  const cleanSpaceName = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
  const resp = await fetch(`${CHAT_API_BASE}/${cleanSpaceName}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errorJson = await resp.json().catch(() => ({}));
    const errorMsg = errorJson.error?.message || '';

    if (resp.status === 404 || errorMsg.includes('Google Chat app not found')) {
      const chatError = new Error(
        'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.'
      ) as any;
      chatError.isChatAppNotConfigured = true;
      chatError.consoleUrl = CHAT_APP_CONSOLE_URL;
      throw chatError;
    }

    throw new Error(errorMsg || `Error al enviar mensaje a Google Chat (HTTP ${resp.status})`);
  }

  return await resp.json();
}

/**
 * Estructura y envía una notificación contable y fiscal DIAN a un espacio de Google Chat
 */
export async function enviarNotificacionGastoChat(
  spaceName: string,
  gasto: Gasto,
  tipoEvento: 'radicado' | 'aprobado' | 'rechazado',
  observacionAuditor?: string
): Promise<any> {
  let badgeColor = '#059669'; // verde
  let tituloEvento = 'NUEVO GASTO RADICADO';
  let iconoStatus = '✅';

  if (tipoEvento === 'aprobado') {
    badgeColor = '#047857';
    tituloEvento = 'GASTO APROBADO POR AUDITORÍA';
    iconoStatus = '🎉';
  } else if (tipoEvento === 'rechazado') {
    badgeColor = '#DC2626';
    tituloEvento = 'GASTO RECHAZADO EN REVISIÓN';
    iconoStatus = '⚠️';
  }

  const textoResumen = `${iconoStatus} *${tituloEvento}*\n*Proveedor:* ${gasto.emisor} (NIT: ${gasto.nit_emisor || 'N/A'})\n*Factura:* ${gasto.numero_factura}\n*Total:* $ ${formatCOP(gasto.total)} COP\n*Responsable:* ${gasto.nombre_responsable} (${gasto.cargo})\n*CUFE:* \`${gasto.cufe}\``;

  // Construcción de CardV2 oficial para Google Chat
  const cardV2 = [
    {
      cardId: `gasto_${gasto.id}_${Date.now()}`,
      card: {
        header: {
          title: `Legalización de Gastos: ${tituloEvento}`,
          subtitle: `DIAN Colombia - ${gasto.emisor}`,
          imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/receipt_long/default/48px.svg',
          imageType: 'CIRCLE',
        },
        sections: [
          {
            header: 'Detalle Fiscal y Contable',
            widgets: [
              {
                decoratedText: {
                  topLabel: 'Monto Total Legalizado',
                  text: `<b>$ ${formatCOP(gasto.total)} COP</b>`,
                  bottomLabel: `Neto: $ ${formatCOP(gasto.valor_neto)} | IVA: $ ${formatCOP(gasto.iva)}`,
                  startIcon: {
                    knownIcon: 'DOLLAR',
                  },
                },
              },
              {
                decoratedText: {
                  topLabel: 'Emisor / Proveedor y NIT',
                  text: `${gasto.emisor}`,
                  bottomLabel: `NIT: ${gasto.nit_emisor || 'No especificado'} | Factura: ${gasto.numero_factura}`,
                },
              },
              {
                decoratedText: {
                  topLabel: 'Funcionario Responsable',
                  text: `${gasto.nombre_responsable}`,
                  bottomLabel: `Cargo: ${gasto.cargo} | Medio: ${gasto.tipo_pago}`,
                },
              },
              {
                decoratedText: {
                  topLabel: 'Código CUFE Verificado (96 hex)',
                  text: `<font color="#2563eb">${gasto.cufe.substring(0, 32)}...</font>`,
                  wrapText: true,
                },
              },
              ...(observacionAuditor || gasto.comentario_aprobacion
                ? [
                    {
                      decoratedText: {
                        topLabel: 'Observación de Auditoría Contable',
                        text: `<i>"${observacionAuditor || gasto.comentario_aprobacion}"</i>`,
                        wrapText: true,
                      },
                    },
                  ]
                : []),
              ...(gasto.objeto
                ? [
                    {
                      decoratedText: {
                        topLabel: 'Justificación Operacional',
                        text: `${gasto.objeto}`,
                        wrapText: true,
                      },
                    },
                  ]
                : []),
            ],
          },
        ],
      },
    },
  ];

  return await enviarMensajeChat(spaceName, textoResumen, cardV2);
}
