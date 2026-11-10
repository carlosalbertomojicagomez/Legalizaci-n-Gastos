export type RolUsuario = 'trabajador' | 'administrador';
export type EstadoGasto = 'pendiente' | 'aprobado' | 'rechazado';

export interface Gasto {
  id: string;
  creado_en: string; // ISO string
  user_id: string;
  emisor: string;
  numero_factura: string;
  cufe: string; // 96 hexadecimal characters
  fecha_emision: string; // YYYY-MM-DD
  fecha_vencimiento?: string | null;
  valor_neto: number; // COP
  iva: number; // COP
  total: number; // COP
  nombre_responsable: string;
  cargo: string;
  tipo_gasto: string;
  tipo_pago: string;
  objeto: string;
  foto_path: string;
  foto_url: string; // Base64 dataUrl or storage URL
  foto_tomada_en: string; // ISO string
  estado: EstadoGasto;
  comentario_aprobacion?: string | null;
  actualizado_en?: string;
  actualizado_por?: string;
}

export interface CatalogoData {
  tiposGasto: string[];
  tiposPago: string[];
}

export interface UsuarioPerfil {
  id: string;
  nombre_completo: string;
  identificacion: string;
  cargo: string;
  email: string;
  telefono: string;
  rol: RolUsuario;
}

export interface ExtractionResponse {
  emisor: string | null;
  numero_factura: string | null;
  cufe: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  valor_neto: number | null;
  iva: number | null;
  total: number | null;
  tipo_documento?: string | null;
  forma_pago?: string | null;
  medio_pago?: string | null;
  confianza_cufe?: boolean;
}

export interface CufeCheckResult {
  duplicado: boolean;
  registrado_por?: string;
  cargo?: string;
  fecha_registro?: string;
  numero_factura?: string;
  emisor?: string;
}
