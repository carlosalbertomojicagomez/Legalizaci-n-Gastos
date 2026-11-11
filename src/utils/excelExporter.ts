import ExcelJS from 'exceljs';
import { Gasto } from '../types';

/**
 * Genera el Blob binario del libro Excel (.xlsx) con fotografías incrustadas
 */
export async function generarExcelBlob(gastos: Gasto[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Legalización de Gastos PWA - DIAN Colombia';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Gastos', {
    views: [{ showGridLines: true }],
  });

  // Definición formal de columnas
  worksheet.columns = [
    { header: 'Fecha Registro', key: 'creado_en', width: 18 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Responsable', key: 'nombre_responsable', width: 24 },
    { header: 'Cargo', key: 'cargo', width: 20 },
    { header: 'Emisor / Proveedor', key: 'emisor', width: 28 },
    { header: 'N° Factura', key: 'numero_factura', width: 16 },
    { header: 'Fecha Emisión', key: 'fecha_emision', width: 15 },
    { header: 'Fecha Vencimiento', key: 'fecha_vencimiento', width: 16 },
    { header: 'Tipo de Gasto', key: 'tipo_gasto', width: 22 },
    { header: 'Tipo de Pago', key: 'tipo_pago', width: 22 },
    { header: 'Objeto / Justificación', key: 'objeto', width: 36 },
    { header: 'Valor Neto (COP)', key: 'valor_neto', width: 18 },
    { header: 'IVA (COP)', key: 'iva', width: 16 },
    { header: 'Total (COP)', key: 'total', width: 18 },
    { header: 'CUFE (DIAN 96 Hex)', key: 'cufe', width: 38 },
    { header: 'Evidencia (Factura)', key: 'foto', width: 22 },
  ];

  // Estilo corporativo de cabecera (Azul DIAN / Corporativo)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0A2540' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (let i = 0; i < gastos.length; i++) {
    const g = gastos[i];
    const rowIndex = i + 2;

    const row = worksheet.addRow({
      creado_en:
        new Date(g.creado_en).toLocaleDateString('es-CO') +
        ' ' +
        new Date(g.creado_en).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      estado: g.estado.toUpperCase(),
      nombre_responsable: g.nombre_responsable,
      cargo: g.cargo,
      emisor: g.emisor,
      numero_factura: g.numero_factura,
      fecha_emision: g.fecha_emision,
      fecha_vencimiento: g.fecha_vencimiento || 'N/A',
      tipo_gasto: g.tipo_gasto,
      tipo_pago: g.tipo_pago,
      objeto: g.objeto,
      valor_neto: Number(g.valor_neto) || 0,
      iva: Number(g.iva) || 0,
      total: Number(g.total) || 0,
      cufe: g.cufe,
      foto: '',
    });

    row.getCell(12).numFmt = '"$"#,##0';
    row.getCell(13).numFmt = '"$"#,##0';
    row.getCell(14).numFmt = '"$"#,##0';

    row.height = 98;
    row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    const estadoCell = row.getCell(2);
    estadoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (g.estado === 'aprobado') {
      estadoCell.font = { bold: true, color: { argb: 'FF047857' } };
    } else if (g.estado === 'rechazado') {
      estadoCell.font = { bold: true, color: { argb: 'FFB91C1C' } };
    } else {
      estadoCell.font = { bold: true, color: { argb: 'FFB45309' } };
    }

    if (g.foto_url) {
      try {
        let base64Clean = '';
        if (g.foto_url.startsWith('data:image/')) {
          base64Clean = g.foto_url.split(',')[1];
        } else if (g.foto_url.startsWith('http')) {
          const resp = await fetch(g.foto_url);
          const arrayBuffer = await resp.arrayBuffer();
          const imgId = workbook.addImage({
            buffer: arrayBuffer,
            extension: 'jpeg',
          });
          worksheet.addImage(imgId, {
            tl: { col: 15.05, row: rowIndex - 0.95 },
            ext: { width: 125, height: 92 },
            editAs: 'oneCell',
          });
          continue;
        }

        if (base64Clean) {
          const imgId = workbook.addImage({
            base64: base64Clean,
            extension: 'jpeg',
          });
          worksheet.addImage(imgId, {
            tl: { col: 15.05, row: rowIndex - 0.95 },
            ext: { width: 125, height: 92 },
            editAs: 'oneCell',
          });
        }
      } catch (err) {
        console.warn(`No fue posible incrustar la fotografía del gasto ${g.id}:`, err);
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Exporta y descarga directamente en el navegador
 */
export async function exportarGastosAExcel(
  gastos: Gasto[],
  nombreArchivo = 'Legalizaciones_Gastos_DIAN.xlsx'
): Promise<void> {
  const blob = await generarExcelBlob(gastos);
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = nombreArchivo;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);
}
