import React from 'react';
import {
  Search,
  FileText,
  Radar,
  Users,
  Settings,
  AlertTriangle,
  Flame,
  BookOpen,
} from 'lucide-react';
import { QuotaSettings, SellerProfile } from '../types';
import { PixiwebLogo } from './PixiwebLogo';

export type ActiveScreen = 'buscar' | 'ficha' | 'radar' | 'leads' | 'ajustes';

interface Props {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  hasActiveBusiness: boolean;
  savedLeadsCount: number;
  quota: QuotaSettings;
  sellerProfile?: SellerProfile;
}

export const Sidebar: React.FC<Props> = ({
  currentScreen,
  onNavigate,
  hasActiveBusiness,
  savedLeadsCount,
  quota,
  sellerProfile,
}) => {
  const quotaUsed = quota?.usedThisMonth || 0;
  const quotaLimit = quota?.monthlyLimit || 1000;
  const quotaPercent = Math.min(100, Math.round((quotaUsed / quotaLimit) * 100));
  const isNearLimit = quotaUsed >= 800;
  const isOverLimit = quotaUsed >= quotaLimit;

  const navItems = [
    {
      id: 'buscar' as ActiveScreen,
      label: 'Buscar',
      sublabel: 'Prospección en zona',
      icon: Search,
      badge: null,
      disabled: false,
    },
    {
      id: 'ficha' as ActiveScreen,
      label: 'Ficha de Negocio',
      sublabel: 'Auditoría y contacto',
      icon: FileText,
      badge: hasActiveBusiness ? 'Activo' : null,
      disabled: !hasActiveBusiness,
    },
    {
      id: 'radar' as ActiveScreen,
      label: 'Radar de Nichos',
      sublabel: 'Ranking de oportunidades',
      icon: Radar,
      badge: null,
      disabled: false,
    },
    {
      id: 'leads' as ActiveScreen,
      label: 'Mis Leads',
      sublabel: 'Pipeline comercial',
      icon: Users,
      badge: savedLeadsCount > 0 ? savedLeadsCount.toString() : null,
      disabled: false,
    },
    {
      id: 'ajustes' as ActiveScreen,
      label: 'Ajustes',
      sublabel: 'Clave API y perfil',
      icon: Settings,
      badge: null,
      disabled: false,
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#000000] border-r border-white/10 flex flex-col h-screen select-none no-print relative z-20">
      {/* Brand Header with Pixiweb Design System Logo */}
      <div className="p-4 border-b border-white/10">
        <PixiwebLogo size="md" />
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && onNavigate(item.id)}
              disabled={item.disabled}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                item.disabled
                  ? 'opacity-30 cursor-not-allowed text-slate-500'
                  : isActive
                  ? 'bg-[#7d39eb]/20 text-white border border-[#7d39eb]/50 shadow-[0_0_20px_-4px_rgba(125,57,235,0.4)]'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#c6ff33]' : 'text-slate-400'
                  }`}
                />
                <div className="truncate">
                  <div className={`leading-tight ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {item.badge && (
                <span
                  className={`ml-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-[#7d39eb] text-white shadow-sm'
                      : 'bg-white/10 text-[#b9a0ff]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quota Usage Counter Widget */}
      <div className="p-3 mx-3 mb-2 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-300 mb-1.5">
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#c6ff33]" />
            <span>Llamadas Places</span>
          </span>
          <span className="font-mono tabular-nums text-white text-xs font-bold">
            {quotaUsed} / {quotaLimit}
          </span>
        </div>

        {/* Progress Bar with Pixiweb Lime / Violet Accent */}
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isOverLimit
                ? 'bg-rose-500'
                : isNearLimit
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-[#7d39eb] to-[#c6ff33]'
            }`}
            style={{ width: `${quotaPercent}%` }}
          />
        </div>

        {/* Alert at 800 threshold */}
        {isNearLimit && (
          <div className="flex items-start gap-1.5 text-[10px] text-amber-300/90 leading-tight mb-1">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <span>
              {isOverLimit
                ? 'Límite mensual alcanzado.'
                : 'Has superado el 80% de llamadas gratuitas estimadas.'}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Hoy: <strong className="text-white font-mono">{quota?.usedToday || 0} / 30</strong></span>
          <div className="flex items-center gap-2">
            <a
              href="/manual-onboarding.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#c6ff33] hover:underline font-medium transition-colors"
              title="Abrir Manual de Onboarding y Configuración"
            >
              <BookOpen className="w-3 h-3" />
              <span>Manual</span>
            </a>
            <button
              type="button"
              onClick={() => onNavigate('ajustes')}
              className="text-[#b9a0ff] hover:text-[#c6ff33] font-medium transition-colors cursor-pointer"
            >
              Límites
            </button>
          </div>
        </div>
      </div>

      {/* Active Profile Badge */}
      <div className="p-3 mx-3 mb-3 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => onNavigate('ajustes')}
          className="w-full text-left flex items-center justify-between gap-2 bg-white/[0.03] hover:bg-white/[0.06] p-2.5 rounded-2xl border border-white/10 transition-colors cursor-pointer"
          title="Personalizar tu perfil y credenciales en Ajustes"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#7d39eb] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              {(sellerProfile?.name || 'R').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate leading-tight">
                  {sellerProfile?.name && sellerProfile.name !== 'Tu Nombre'
                    ? sellerProfile.name
                    : 'Radar Lite'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff33] shrink-0" />
              </div>
              <div className="text-[10px] text-slate-400 truncate font-mono">
                {sellerProfile?.agencyName || 'Edición Personal'}
              </div>
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
};
