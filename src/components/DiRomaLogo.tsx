import React from 'react';

/** Logo oficial animada (CDN). */
const LOGO_SRC = 'https://pub-0bd190a98cd2450691fc945bd0eb0ecf.r2.dev/diroma.gif';

interface DiRomaLogoProps {
  className?: string;
  compact?: boolean;
  /** Mantido por compatibilidade (sidebar / login). */
  inverted?: boolean;
  /** Altura customizada (ex: h-20). Sobrescreve compact. */
  sizeClass?: string;
}

export const DiRomaLogo: React.FC<DiRomaLogoProps> = ({
  className = '',
  compact = false,
  inverted = false,
  sizeClass,
}) => {
  const height = sizeClass ?? (compact ? 'h-12' : 'h-16 sm:h-20');

  return (
    <img
      src={LOGO_SRC}
      alt="Access diRoma"
      className={`${height} w-auto max-w-full object-contain mx-auto block ${className}`}
      draggable={false}
      data-inverted={inverted ? '1' : '0'}
    />
  );
};
