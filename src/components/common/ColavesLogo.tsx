import React from 'react';

interface Props {
  variant?: 'full' | 'horizontal' | 'vertical' | 'emblem' | 'white-box';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  inverted?: boolean;
  className?: string;
}

export const ColavesLogo: React.FC<Props> = ({
  variant = 'full',
  size = 'md',
  inverted = false,
  className = '',
}) => {
  // Dimensiones proporcionales basadas en la versión oficial
  const heightClasses = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-12',
    xl: 'h-16',
  };

  const emblemSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  // Solo el isotipo / emblema (Corazón verde con núcleo estriado)
  if (variant === 'emblem') {
    return (
      <div
        className={`inline-flex items-center justify-center flex-shrink-0 ${emblemSizes[size]} ${className}`}
      >
        <img
          src="/colaves_logo_emblem.png"
          alt="Isotipo Colaves"
          className="w-full h-full object-contain drop-shadow-sm select-none"
          draggable={false}
        />
      </div>
    );
  }

  // Versión vertical (Emblema arriba, marca y eslogan "Trabajamos con el corazón" abajo)
  if (variant === 'vertical') {
    return (
      <div className={`inline-flex flex-col items-center justify-center ${className}`}>
        <img
          src={
            inverted
              ? '/colaves_logo_vertical_white_transparent.png'
              : '/colaves_logo_vertical.png'
          }
          alt="Colaves — Trabajamos con el corazón"
          className={`${
            size === 'sm' ? 'h-14' : size === 'md' ? 'h-20' : size === 'lg' ? 'h-28' : 'h-36'
          } w-auto object-contain select-none ${
            !inverted ? 'dark:hidden' : ''
          }`}
          draggable={false}
        />
        {!inverted && (
          <img
            src="/colaves_logo_vertical_white_transparent.png"
            alt="Colaves — Trabajamos con el corazón"
            className={`hidden dark:block ${
              size === 'sm' ? 'h-14' : size === 'md' ? 'h-20' : size === 'lg' ? 'h-28' : 'h-36'
            } w-auto object-contain select-none`}
            draggable={false}
          />
        )}
      </div>
    );
  }

  // Caja blanca para fondos oscuros (login, splash, modales)
  if (variant === 'white-box') {
    return (
      <div
        className={`bg-white px-4 py-2 rounded-2xl shadow-md border border-slate-100/90 inline-flex items-center justify-center ${className}`}
      >
        <img
          src="/colaves_logo_horizontal.png"
          alt="Colaves — Trabajamos con el corazón"
          className={`${heightClasses[size]} w-auto object-contain select-none`}
          draggable={false}
        />
      </div>
    );
  }

  // Versión horizontal completa oficial (por defecto: Isotipo a la izquierda + Colaves + Slogan)
  return (
    <div className={`inline-flex items-center ${heightClasses[size]} ${className}`}>
      {inverted ? (
        <img
          src="/colaves_logo_horizontal_white_transparent.png"
          alt="Colaves — Trabajamos con el corazón"
          className={`${heightClasses[size]} w-auto object-contain select-none`}
          draggable={false}
        />
      ) : (
        <>
          {/* Versión para fondo claro */}
          <img
            src="/colaves_logo_horizontal.png"
            alt="Colaves — Trabajamos con el corazón"
            className={`${heightClasses[size]} w-auto object-contain dark:hidden select-none`}
            draggable={false}
          />
          {/* Versión adaptativa para modo oscuro */}
          <img
            src="/colaves_logo_horizontal_white_transparent.png"
            alt="Colaves — Trabajamos con el corazón"
            className={`hidden dark:block ${heightClasses[size]} w-auto object-contain select-none`}
            draggable={false}
          />
        </>
      )}
    </div>
  );
};
