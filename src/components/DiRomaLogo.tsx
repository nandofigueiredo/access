import React from 'react';

/** Logo oficial animada (CDN) — texto claro; precisa de fundo escuro em telas claras. */
const LOGO_SRC = 'https://pub-0bd190a98cd2450691fc945bd0eb0ecf.r2.dev/diroma.gif';

interface DiRomaLogoProps {
  className?: string;
  compact?: boolean;
  /**
   * true = já está em fundo escuro (sidebar) — só a imagem.
   * false = fundo claro (login) — placa escura para o GIF ficar visível.
   */
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

  const img = (
    <img
      src={LOGO_SRC}
      alt="Access diRoma"
      className={`${height} w-auto max-w-full object-contain mx-auto block ${className}`}
      draggable={false}
    />
  );

  if (inverted) {
    return img;
  }

  // Login / fundo claro: placa navy para o GIF branco aparecer com contraste
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-[#001529] shadow-sm ${
        compact ? 'px-4 py-2.5' : 'px-6 py-4 sm:px-8 sm:py-5'
      }`}
    >
      {img}
    </div>
  );
};
