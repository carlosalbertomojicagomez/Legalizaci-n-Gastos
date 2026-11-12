import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, ShieldAlert, Zap, ZapOff, ArrowLeft, Eye, HelpCircle } from 'lucide-react';
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cargando, setCargando] = useState(true);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [disparando, setDisparando] = useState(false);
  const [linternaActiva, setLinternaActiva] = useState(false);
  const [soportaLinterna, setSoportaLinterna] = useState(false);
  const [mostrarAyudaPermisos, setMostrarAyudaPermisos] = useState(false);

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

      // Detectar antorcha/linterna
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
          'No se pudo activar la cámara trasera del dispositivo. Verifique que otra aplicación no la esté bloqueando.'
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

      // Compresión fotográfica a máximo 1600px en su dimensión mayor
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

  if (permisoDenegado) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-5 shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Cámara en Vivo Requerida
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
            Por estricta política de control fiscal y trazabilidad DIAN en <strong>Colaves</strong>, la factura debe capturarse en tiempo real mediante la cámara trasera del dispositivo. <strong>No se permite la selección de archivos de galería.</strong>
          </p>
        </div>

        <div className="text-left bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl text-xs space-y-2 border border-slate-200 dark:border-slate-700">
          <p className="font-bold text-[#07426B] dark:text-blue-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4" />
            ¿Cómo autorizar la cámara en el navegador?
          </p>
          <ul className="list-decimal pl-4 space-y-1.5 text-slate-600 dark:text-slate-300 text-[11px]">
            <li>Presione el icono de <strong>candado o configuración</strong> en la barra de direcciones del navegador.</li>
            <li>Seleccione <strong>Permisos del sitio</strong> &gt; <strong>Cámara</strong>.</li>
            <li>Cambie la opción a <strong>Permitir</strong>.</li>
            <li>Presione el botón <strong>Reintentar Cámara</strong> a continuación.</li>
          </ul>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-xs transition"
          >
            Regresar
          </button>
          <button
            type="button"
            onClick={iniciarCamara}
            className="flex-1 py-3 bg-[#07426B] hover:bg-[#052F4D] text-white font-bold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar Cámara</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] max-h-[78vh] bg-black rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center select-none border-2 border-[#07426B]">
      {/* Elemento de video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Guía visual de encuadre tributario */}
      <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
        <div className="flex justify-between items-center text-[10px] text-white/90 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full w-fit">
          <Eye className="w-3 h-3 mr-1 text-[#2CAE4A]" />
          <span>Encuadre la factura y el código QR / CUFE</span>
        </div>
        <div className="text-center text-[10px] text-white/70 bg-black/40 backdrop-blur-sm py-0.5 rounded-full">
          Cámara trasera en vivo — Colaves
        </div>
      </div>

      {/* Spinner de carga inicial */}
      {cargando && (
        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-[#2CAE4A]" />
          <p className="text-xs font-semibold">Iniciando cámara trasera...</p>
        </div>
      )}

      {/* Barra de control superior */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
        <button
          type="button"
          onClick={onCancel}
          className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition"
          aria-label="Cerrar cámara"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {soportaLinterna && (
          <button
            type="button"
            onClick={alternarLinterna}
            className={`p-2.5 rounded-full backdrop-blur-sm transition ${
              linternaActiva
                ? 'bg-[#2CAE4A] text-white shadow-lg shadow-[#2CAE4A]/30'
                : 'bg-black/60 text-white hover:bg-black/80'
            }`}
            aria-label="Alternar linterna"
          >
            {linternaActiva ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Botón disparador inferior */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center z-10">
        <button
          type="button"
          onClick={dispararFoto}
          disabled={cargando || disparando}
          className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:scale-95 transition flex items-center justify-center p-1.5 shadow-2xl disabled:opacity-40"
          aria-label="Capturar fotografía"
        >
          <div className="w-full h-full rounded-full bg-[#2CAE4A] hover:bg-[#00984C] flex items-center justify-center text-white transition">
            {disparando ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : (
              <Camera className="w-8 h-8" />
            )}
          </div>
        </button>
      </div>

      {/* Alerta de error */}
      {mensajeError && (
        <div className="absolute bottom-28 left-4 right-4 p-3 bg-rose-600/90 text-white rounded-xl text-xs text-center backdrop-blur-sm z-20">
          {mensajeError}
        </div>
      )}
    </div>
  );
};
