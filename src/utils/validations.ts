/**
 * Validaciones fiscales y de negocio para Facturación Electrónica DIAN (Colombia)
 */

export const validarCUFE = (cufe: string): boolean => {
  if (!cufe) return false;
  const limpio = cufe.trim();
  // El CUFE DIAN colombiano consta de exactamente 96 caracteres hexadecimales
  return /^[a-fA-F0-9]{96}$/.test(limpio);
};

export const verificarAritmeticaCOP = (
  neto: number,
  iva: number,
  total: number
): { cuadra: boolean; diferencia: number; sumaEsperada: number } => {
  const sumaEsperada = Math.round((Number(neto) || 0) + (Number(iva) || 0));
  const totalNum = Math.round(Number(total) || 0);
  const diferencia = Math.abs(sumaEsperada - totalNum);

  // Margen de tolerancia de 1 COP por posibles redondeos en centavos DIAN
  return {
    cuadra: diferencia <= 1,
    diferencia,
    sumaEsperada,
  };
};

export const formatCOP = (valor: number): string => {
  const num = Number(valor) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatFecha = (fechaIso: string): string => {
  if (!fechaIso) return '-';
  try {
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return fechaIso;
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return fechaIso;
  }
};

export const sanitizeText = (texto: string): string => {
  if (!texto) return '';
  return texto
    .replace(/[<>]/g, '')
    .trim();
};
