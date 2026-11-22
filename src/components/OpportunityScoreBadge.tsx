import { useState } from 'react';
import { OpportunityBreakdownItem } from '../types';
import { Info, ChevronDown } from 'lucide-react';

interface Props {
  score: number;
  breakdown?: OpportunityBreakdownItem[];
  isDetailed?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const OpportunityScoreBadge = ({
  score,
  breakdown = [],
  isDetailed = false,
  size = 'md',
}: Props) => {
  const [showPopover, setShowPopover] = useState(false);

  // Rangos de color: 0-49 rojo/rosa, 50-79 ámbar, 80-100 Pixiweb lima
  const getColorClasses = (val: number) => {
    if (val >= 80) {
      return {
        text: 'text-[#c6ff33]',
        bg: 'bg-[#c6ff33]/15',
        border: 'border-[#c6ff33]/40',
        bar: 'bg-[#c6ff33]',
        pillText: 'Alta oportunidad',
      };
    }
    if (val >= 50) {
      return {
        text: 'text-amber-300',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
        bar: 'bg-amber-400',
        pillText: 'Media oportunidad',
      };
    }
    return {
      text: 'text-rose-300',
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/30',
      bar: 'bg-rose-500',
      pillText: 'Baja oportunidad',
    };
  };

  const style = getColorClasses(score);

  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5 font-bold',
  }[size];

  return (
    <div className="relative inline-block select-none">
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className={`inline-flex items-center gap-1.5 rounded-full border font-mono tabular-nums font-bold transition-all hover:scale-105 cursor-pointer shadow-sm ${sizeClasses} ${style.bg} ${style.border} ${style.text}`}
        title="Ver desglose de puntuación"
      >
        <span>{score}</span>
        <span className="text-[10px] text-slate-400 font-sans font-normal">/100</span>
        <ChevronDown className="w-3 h-3 text-slate-400 opacity-70" />
      </button>

      {showPopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-white/15 bg-[#0a0718] p-4 shadow-2xl z-50 text-left text-xs text-slate-200 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <Info className="w-4 h-4 text-[#b9a0ff]" />
                <span>Desglose de Oportunidad</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${style.bg} ${style.text}`}>
                {isDetailed ? 'Auditada' : 'Provisional'}
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {breakdown.length > 0 ? (
                breakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-300 leading-tight">{item.label}</span>
                    <span
                      className={`font-mono tabular-nums font-bold shrink-0 ${
                        item.points > 0 ? 'text-[#c6ff33]' : item.points < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {item.points > 0 ? `+${item.points}` : item.points}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-[11px]">Puntuación provisional estimada a partir de la presencia en Google Places.</p>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white">
              <span>Puntuación final</span>
              <span className={`font-mono text-base font-extrabold ${style.text}`}>{score} / 100</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
