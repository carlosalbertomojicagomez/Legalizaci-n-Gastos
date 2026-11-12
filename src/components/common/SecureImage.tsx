import React, { useState, useEffect } from 'react';
import { getIdToken } from '../../lib/firebaseClient';
import { Image as ImageIcon, Loader2 } from 'lucide-react';

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackIconSize?: number;
}

export const SecureImage: React.FC<Props> = ({
  src,
  alt = 'Fotografía',
  className = '',
  fallbackIconSize = 16,
  ...props
}) => {
  const [authenticatedSrc, setAuthenticatedSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function resolveSource() {
      if (!src) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
        return;
      }

      // Si ya es un dataUrl en base64 o URL externa
      if (src.startsWith('data:image/') || src.startsWith('blob:')) {
        if (isMounted) {
          setAuthenticatedSrc(src);
          setLoading(false);
        }
        return;
      }

      // Si es una ruta protegida /api/...
      if (src.startsWith('/api/')) {
        try {
          const token = await getIdToken();
          if (isMounted) {
            const separator = src.includes('?') ? '&' : '?';
            const secureUrl = token ? `${src}${separator}token=${encodeURIComponent(token)}` : src;
            setAuthenticatedSrc(secureUrl);
            setLoading(false);
          }
        } catch {
          if (isMounted) {
            setAuthenticatedSrc(src);
            setLoading(false);
          }
        }
        return;
      }

      if (isMounted) {
        setAuthenticatedSrc(src);
        setLoading(false);
      }
    }

    resolveSource();
    return () => {
      isMounted = false;
    };
  }, [src]);

  if (error || !authenticatedSrc) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 ${className}`}>
        <ImageIcon style={{ width: fallbackIconSize, height: fallbackIconSize }} />
      </div>
    );
  }

  return (
    <img
      src={authenticatedSrc}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      onLoad={() => setLoading(false)}
      {...props}
    />
  );
};
