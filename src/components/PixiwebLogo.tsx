import React from 'react';

interface Props {
  variant?: 'horizontal' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  tone?: 'dark' | 'light';
  showSubtitle?: boolean;
  className?: string;
}

export const PixiwebLogo: React.FC<Props> = ({
  variant = 'horizontal',
  size = 'md',
  tone = 'dark',
  showSubtitle = true,
  className = '',
}) => {
  // Dimension definitions preserving original 1200x378 ratio (~3.17)
  const logoDimensions = {
    sm: { width: 96, height: 30 },
    md: { width: 120, height: 38 },
    lg: { width: 154, height: 49 },
  }[size];

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }[size];

  const logoSrc =
    tone === 'light'
      ? '/brand/logos/logo-horizontal-claro.png'
      : '/brand/logos/logo-horizontal-principal.png';

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <img
          src="/brand/logos/favicon-512.png"
          alt="Pixiweb"
          className={`${iconSizes} rounded-xl object-contain shadow-sm transition-transform hover:scale-105`}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col select-none ${className}`}>
      <div className="flex items-center gap-1.5">
        <img
          src={logoSrc}
          alt="Pixiweb"
          width={logoDimensions.width}
          height={logoDimensions.height}
          className="h-auto object-contain transition-opacity hover:opacity-95"
          style={{ width: `${logoDimensions.width}px` }}
        />
        {/* Design System lime accent indicator */}
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#c6ff33] shrink-0"
          title="Pixiweb Design System"
        />
      </div>

      {showSubtitle && (
        <span
          className={`text-[10px] font-semibold tracking-wider uppercase mt-0.5 ${
            tone === 'light' ? 'text-slate-600' : 'text-slate-400'
          }`}
        >
          Radar de Clientes
        </span>
      )}
    </div>
  );
};
