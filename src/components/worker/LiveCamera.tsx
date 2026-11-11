import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, ShieldAlert, Zap, ZapOff, ArrowLeft, Upload } from 'lucide-react';
import { comprimirImagen } from '../../utils/imageCompressor';

interface LiveCameraProps {
  onCapture: (capturedData: {
    dataUrl: string;
    base64: string;
    capturedAt: string;
    width: number;
    height: number;
  }) => void;
  onCancel: () => void;
}

export const LiveCamera: React.FC<LiveCameraProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cargando, setCargando] = useState(true);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [disparando, setDisparando] = useState(false);
  const [linternaActiva, setLinternaActiva] = useState(false);
  const [soportaLinterna, setSoportaLinterna] = useState(false);

  const detenerStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const iniciarCamara = useCallback(async () => {
    setCargando(true);
    setPermisoDenegado(false);
    setMensajeError(null);

    detenerStream();

    try {
      // Exigencia estricta de cámara posterior / environment
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Detectar soporte para antorcha/linterna
      const videoTrack = mediaStream.getVideoTracks()[0];
      const capabilities = (videoTrack?.getCapabilities && videoTrack.getCapabilities()) as any;
      if (capabilities && capabilities.torch) {
        setSoportaLinterna(true);
      }
    } catch (err: any) {
      console.error('Error al inicializar cámara en vivo:', err);
      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.name === 'SecurityError'
      ) {
        setPermisoDenegado(true);
      } else {
        setMensajeError(
          'No se pudo activar la cámara trasera. Asegúrese de que no esté en uso por otra app.'
        );
      }
    } finally {
      setCargando(false);
    }
  }, [detenerStream]);

  useEffect(() => {
    iniciarCamara();
    return () => {
      detenerStream();
    };
  }, []);

  const alternarLinterna = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const nuevoEstado = !linternaActiva;
        await track.applyConstraints({
          advanced: [{ torch: nuevoEstado } as any],
        });
        setLinternaActiva(nuevoEstado);
      } catch (e) {
        console.warn('Error alternando linterna:', e);
      }
    }
  };

  const dispararFoto = async () => {
    if (!videoRef.current || disparando) return;
    setDisparando(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo obtener el contexto 2D');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const fechaCaptura = new Date().toISOString();

      // Detener stream para liberar hardware
      detenerStream();

      // Comprimir a máximo 1600px en su dimensión mayor según requerimiento
      const resultado = await comprimirImagen(rawDataUrl, 1600, 0.85);

      onCapture({
        dataUrl: resultado.dataUrl,
        base64: resultado.base64,
        capturedAt: fechaCaptura,
        width: resultado.width,
        height: resultado.height,
      });
    } catch (err: any) {
      console.error('Error al capturar fotografía:', err);
      setMensajeError('Error al procesar la captura: ' + err.message);
      setDisparando(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    setMensajeError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const rawDataUrl = reader.result as string;
          const fechaCaptura = new Date().toISOString();
          detenerStream();

          const resultado = await comprimirImagen(rawDataUrl, 1600, 0.85);
          onCapture({
            dataUrl: resultado.dataUrl,
            base64: resultado.base64,
            capturedAt: fechaCaptura,
            width: resultado.width,
            height: resultado.height,
          });
        } catch (err: any) {
          setMensajeError('Error al procesar la imagen seleccionada: ' + err.message);
          setCargando(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setMensajeError('Error al leer el archivo: ' + err.message);
      setCargando(false);
    }
  };

  if (permisoDenegado) {
    return (
      <div className="max-w-md mx-auto p-6 bg-rose-50 dark:bg-rose-950/40 rounded-3xl border border-rose-200 dark:border-rose-900 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-9 h-9" />
        </div>
        <h3 className="text-lg font-black text-rose-950 dark:text-rose-100">
          Permiso de Cámara Requerido
        </h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
          Para garantizar la integridad y trazabilidad fiscal exigida por la DIAN, las facturas deben
          fotografiarse en vivo con la cámara trasera. <strong>No está permitido cargar archivos desde la galería.</strong>
        </p>

        <div className="text-left bg-white dark:bg-slate-900 p-4 rounded-2xl text-xs space-y-2 border border-rose-200 dark:border-rose-900/60 shadow-sm">
          <p className="font-bold text-slate-800 dark:text-slate-200">
            ¿Cómo autorizar la cámara en tu celular?
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
            <li>Toca el candado o icono de configuración en la barra de direcciones de tu navegador.</li>
            <li>Selecciona <strong>Permisos</strong> o <strong>Cámara</strong>.</li>
            <li>Elige <strong>Permitir</strong> y luego presiona el botón Reintentar.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Seleccionar Foto o Archivo de Factura</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
            >
              Regresar
            </button>
            <button
              onClick={iniciarCamara}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              Reintentar Cámara
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] max-h-[78vh] bg-black rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center select-none">
      {cargando && (
        <div className="absolute z-20 flex flex-col items-center gap-2 text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-xs font-semibold">Activando cámara posterior...</span>
        </div>
      )}

      {mensajeError && (
        <div className="absolute z-20 p-4 bg-black/80 text-white text-center rounded-2xl m-4 space-y-3">
          <p className="text-xs text-rose-300">{mensajeError}</p>
          <button
            onClick={iniciarCamara}
            className="px-4 py-2 bg-emerald-600 rounded-xl text-xs font-bold"
          >
            Reintentar
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        onLoadedMetadata={() => setCargando(false)}
      />

      {/* Guía visual con marco DIAN */}
      <div className="absolute inset-5 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
        <div className="flex justify-between items-center">
          <span className="bg-black/60 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">
            EVIDENCIA DIAN
          </span>
          <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md backdrop-blur-sm font-mono">
            MÁX 1600PX JPEG
          </span>
        </div>

        <div className="text-center">
          <span className="bg-black/70 text-white text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-md shadow-sm">
            Enfoque el comprobante y el código CUFE
          </span>
        </div>
      </div>

      {/* Botón de Cancelar / Volver */}
      <button
        onClick={onCancel}
        className="absolute top-4 left-4 z-30 p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition"
        title="Cancelar captura"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Botón de Linterna */}
      {soportaLinterna && (
        <button
          onClick={alternarLinterna}
          className={`absolute top-4 right-4 z-30 p-2.5 rounded-full backdrop-blur-md transition ${
            linternaActiva ? 'bg-amber-500 text-black' : 'bg-black/60 text-white hover:bg-black/80'
          }`}
          title="Alternar linterna"
        >
          {linternaActiva ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
        </button>
      )}

      {/* Disparador táctil y botón de carga de archivo */}
      <div className="absolute bottom-6 w-full flex justify-between items-center z-30 px-8">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-3 bg-black/60 hover:bg-black/80 active:scale-95 text-white rounded-full backdrop-blur-md transition flex items-center justify-center border border-white/20"
          title="Subir archivo o foto de factura"
        >
          <Upload className="w-5 h-5 text-emerald-400" />
        </button>

        <button
          onClick={dispararFoto}
          disabled={cargando || disparando || Boolean(mensajeError)}
          className="relative w-20 h-20 bg-white rounded-full p-1.5 shadow-2xl active:scale-90 transition-transform disabled:opacity-40"
          aria-label="Capturar fotografía de factura"
        >
          <div className="w-full h-full rounded-full border-4 border-slate-900 bg-white flex items-center justify-center">
            {disparando ? (
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            ) : (
              <Camera className="w-8 h-8 text-slate-900" />
            )}
          </div>
        </button>

        <div className="w-11" /> {/* Equilibrador de espacio */}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
};
