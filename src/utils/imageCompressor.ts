/**
 * Comprime y redimensiona una fotografía capturada a formato JPEG (máximo 1600px en su lado mayor)
 */
export async function comprimirImagen(
  dataUrl: string,
  maxDimension = 1600,
  calidad = 0.85
): Promise<{ blob: Blob; base64: string; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;

    img.onload = () => {
      let { width, height } = img;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo inicializar el contexto de imagen 2D'));
        return;
      }

      // Filtro de suavizado de alta calidad
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', calidad);
      const base64 = compressedDataUrl.replace(/^data:image\/jpeg;base64,/, '');

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Fallo al generar el archivo binario de la imagen'));
            return;
          }
          resolve({
            blob,
            base64,
            dataUrl: compressedDataUrl,
            width,
            height,
          });
        },
        'image/jpeg',
        calidad
      );
    };

    img.onerror = (err) => {
      reject(new Error('No se pudo procesar la fotografía: ' + String(err)));
    };
  });
}
