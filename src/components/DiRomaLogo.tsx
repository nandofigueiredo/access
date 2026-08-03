import React from 'react';

const LOGO_SRC = '/img/logo_diroma_branca-CphClutu.svg';

interface DiRomaLogoProps {
  className?: string;
  compact?: boolean;
  /** Logo branca (sidebar/fundo escuro). false = versão navy para fundo claro. */
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
  const height = sizeClass ?? (compact ? 'h-9' : 'h-14 sm:h-16');

  return (
    <img
      src={LOGO_SRC}
      alt="diRoma hotéis & parques"
      className={`${height} w-auto object-contain ${inverted ? '' : 'diroma-logo-navy'} ${className}`}
      draggable={false}
    />
  );
};
