import React, { useState } from 'react';
import {
  Radar,
  MapPin,
  AlertTriangle,
  Play,
  Loader2,
  Sparkles,
  ArrowRight,
  Search,
  Trophy,
  Check,
  Plus,
  X,
} from 'lucide-react';
import { NicheCategoryStat, NicheAnalysisResult, UserSettings, BusinessItem } from '../types';
import { searchPlaces, analyzeNichesWithGemini } from '../services/api';
import { LocationAutocomplete } from './LocationAutocomplete';
import {
  getCachedNicheRadarScan,
  setCachedNicheRadarScan,
  clearCachedNicheRadarScan,
  getCachedSearch,
  setCachedSearch,
  getCustomCategories,
  saveCustomCategory,
  removeCustomCategory,
} from '../services/storage';

const DEFAULT_CATEGORIES = [
  'talleres mecánicos',
  'clínicas dentales',
  'fisioterapeutas',
  'peluquerías',
  'centros de estética',
  'restaurantes',
  'gimnasios',
  'academias',
  'inmobiliarias',
  'reformas',
  'veterinarios',
  'autoescuelas',
  'ópticas',
  'gestorías',
];

interface Props {
  settings: UserSettings;
  onLaunchSearch: (category: string, zone: string) => void;
  onNavigateToSettings: () => void;
}

export const NicheRadarScreen: React.FC<Props> = ({
  settings,
  onLaunchSearch,
  onNavigateToSettings,
}) => {
  const initialCache = getCachedNicheRadarScan();
  const [zone, setZone] = useState(() => initialCache?.zone || '');
  const [availableCategories, setAvailableCategories] = useState<string[]>(() => {
    const custom = getCustomCategories();
    const combined = [...DEFAULT_CATEGORIES];
    custom.forEach((c) => {
      if (!combined.includes(c)) combined.push(c);
    });
    return combined;
  });
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => initialCache?.selectedCategories || DEFAULT_CATEGORIES.slice(0, 8)
  );

  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryInput.trim().toLowerCase();
    if (!clean) return;

    saveCustomCategory(clean);

    setAvailableCategories((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setSelectedCategories((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setNewCategoryInput('');
  };

  const handleRemoveCustomCategory = (catToRemove: string) => {
    removeCustomCategory(catToRemove);
    setAvailableCategories((prev) => prev.filter((c) => c !== catToRemove));
    setSelectedCategories((prev) => prev.filter((c) => c !== catToRemove));
  };

  // Modal confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentCategory: string }>({
    current: 0,
    total: 0,
    currentCategory: '',
  });
  const [categoryStats, setCategoryStats] = useState<NicheCategoryStat[]>(
    () => initialCache?.categoryStats || []
  );
  const [geminiResult, setGeminiResult] = useState<NicheAnalysisResult | null>(
    () => initialCache?.geminiResult || null
  );
  const [isFromCache, setIsFromCache] = useState<boolean>(
    () => !!(initialCache?.categoryStats && initialCache.categoryStats.length > 0)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleZoneChange = (newZone: string) => {
    setZone(newZone);
    if (!newZone.trim()) {
      setIsFromCache(false);
      return;
    }

    const cached = getCachedNicheRadarScan(newZone);
    if (cached && cached.categoryStats?.length > 0) {
      setCategoryStats(cached.categoryStats);
      setGeminiResult(cached.geminiResult);
      if (cached.selectedCategories?.length > 0) {
        setSelectedCategories(cached.selectedCategories);
      }
      setIsFromCache(true);
    }
  };

  const handleClearScan = () => {
    clearCachedNicheRadarScan(zone);
    setCategoryStats([]);
    setGeminiResult(null);
    setIsFromCache(false);
  };

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) return; // Keep at least one
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleStartAnalysis = async () => {
    setShowConfirmModal(false);
    setIsExecuting(true);
    setErrorMessage(null);
    setCategoryStats([]);
    setGeminiResult(null);
    setIsFromCache(false);

    const stats: NicheCategoryStat[] = [];
    const total = selectedCategories.length;

    try {
      // 1. Query Places for each selected category
      for (let i = 0; i < total; i++) {
        const cat = selectedCategories[i];
        setProgress({
          current: i + 1,
          total,
          currentCategory: cat,
        });

        const query = `${cat} en ${zone.trim()}`;
        try {
          let places: BusinessItem[] = [];

          // Check if this exact query was already cached to avoid redundant calls
          const cachedSearchResult = getCachedSearch(query);
          if (cachedSearchResult && cachedSearchResult.results?.length > 0) {
            places = cachedSearchResult.results;
          } else {
            const res = await searchPlaces(query, undefined, settings.googleCloudApiKey);
            places = res.places;
            setCachedSearch(query, {
              results: places,
              nextPageToken: res.nextPageToken,
            });
          }

          const totalCount = places.length;
          const withoutWebCount = places.filter((p) => !p.hasWebsite).length;
          const percentWithoutWeb =
            totalCount > 0 ? Math.round((withoutWebCount / totalCount) * 100) : 0;

          // Average rating
          const ratings = places.filter((p) => p.rating != null).map((p) => p.rating as number);
          const avgRating =
            ratings.length > 0
              ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
              : 0;

          // Average review count
          const reviewCounts = places
            .filter((p) => p.userRatingCount != null)
            .map((p) => p.userRatingCount as number);
          const avgReviews =
            reviewCounts.length > 0
              ? Math.round(reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length)
              : 0;

          stats.push({
            category: cat,
            totalCount,
            withoutWebsiteCount: withoutWebCount,
            percentWithoutWebsite: percentWithoutWeb,
            avgRating,
            avgReviewCount: avgReviews,
            sampleBusinesses: places,
          });

          setCategoryStats([...stats]);
        } catch (catErr: unknown) {
          console.warn(`Error querying category ${cat}:`, catErr);
          stats.push({
            category: cat,
            totalCount: 0,
            withoutWebsiteCount: 0,
            percentWithoutWebsite: 0,
            avgRating: 0,
            avgReviewCount: 0,
          });
          setCategoryStats([...stats]);
        }
      }

      // 2. Call Gemini to rank categories and generate recommendation
      let gRes: NicheAnalysisResult | null = null;
      if (stats.some((s) => s.totalCount > 0)) {
        setProgress({
          current: total,
          total,
          currentCategory: 'Procesando análisis inteligente con Gemini Flash...',
        });

        gRes = await analyzeNichesWithGemini(zone, stats, settings.sellerProfile);
        setGeminiResult(gRes);
      }

      // Persist complete radar scan in storage
      setCachedNicheRadarScan({
        zone: zone.trim(),
        selectedCategories,
        categoryStats: stats,
        geminiResult: gRes,
      });
      setIsFromCache(false);
    } catch (err: unknown) {
      console.error('Error during niche radar analysis:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Error durante el análisis del radar de nichos.'
      );
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#000000] text-white">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/[0.02] backdrop-blur-md shrink-0 relative z-30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#c6ff33]" />
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Radar de Nichos</span>
                <span className="font-serif italic text-[#b9a0ff] font-normal text-sm">Oportunidades Digitales</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Descubre en qué sectores de tu zona hay mayor vacío digital (% sin web propia) y mayor demanda de clientes.
            </p>
          </div>

          {/* Zone Input & Launch Button */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="flex-1 md:w-72">
              <LocationAutocomplete
                value={zone}
                onChange={handleZoneChange}
                apiKey={settings.googleCloudApiKey}
                placeholder="Ciudad o zona (ej: Santa Rosa, Córdoba)..."
              />
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isExecuting || selectedCategories.length === 0}
              className="px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xl transition-all disabled:opacity-40 shrink-0"
              style={{
                background: '#7d39eb',
                color: '#ffffff',
                boxShadow: '0 4px 18px -2px rgba(125, 57, 235, 0.5)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#5a4be0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#7d39eb')}
            >
              <Play className="w-3.5 h-3.5 fill-current text-[#c6ff33]" />
              <span>Escanear zona</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Error notice */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="flex-1">
              <span>{errorMessage}</span>
              {errorMessage.includes('clave') && (
                <button
                  type="button"
                  onClick={onNavigateToSettings}
                  className="ml-2 underline font-semibold text-rose-200"
                >
                  Ir a Ajustes →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Categories selector chips */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-bold text-white flex items-center gap-2">
              <span>Categorías a escanear en {zone}</span>
              <span className="text-[10px] font-mono bg-[#7d39eb]/30 text-[#b9a0ff] px-2 py-0.5 rounded-full border border-[#7d39eb]/40">
                {selectedCategories.length} activas
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategories([...availableCategories])}
                className="text-[11px] text-[#b9a0ff] hover:text-[#c6ff33] font-semibold transition-colors cursor-pointer"
              >
                Todas ({availableCategories.length})
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setSelectedCategories(availableCategories.slice(0, 5))}
                className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Top 5
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setSelectedCategories([])}
                className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Ninguna
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {availableCategories.map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              const isCustom = !DEFAULT_CATEGORIES.includes(cat);

              return (
                <div
                  key={cat}
                  className={`inline-flex items-center rounded-full text-xs transition-all border ${
                    isSelected
                      ? 'bg-[#7d39eb]/25 text-white border-[#7d39eb]/60 font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSelected && <Check className="w-3 h-3 text-[#c6ff33]" />}
                    <span>{cat}</span>
                  </button>

                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomCategory(cat)}
                      className="pr-2 pl-0.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title={`Eliminar "${cat}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Input to add custom category */}
            <form
              onSubmit={handleAddCustomCategory}
              className="inline-flex items-center gap-1 bg-black/60 border border-dashed border-white/25 hover:border-[#7d39eb] focus-within:border-[#7d39eb] focus-within:ring-1 focus-within:ring-[#7d39eb] rounded-full pl-3 pr-1 py-0.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#c6ff33] shrink-0" />
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="Nueva categoría (ej: abogados)..."
                className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-36 sm:w-48 py-1"
              />
              <button
                type="submit"
                disabled={!newCategoryInput.trim()}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#7d39eb] hover:bg-[#5a4be0] disabled:opacity-30 disabled:pointer-events-none text-white cursor-pointer transition-colors"
              >
                + Añadir
              </button>
            </form>
          </div>
        </div>

        {/* Progress Bar during scan */}
        {isExecuting && (
          <div className="rounded-2xl border border-[#7d39eb]/40 bg-[#140e2b]/80 p-5 space-y-2 text-xs backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between text-[#b9a0ff]">
              <span className="flex items-center gap-2 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-[#c6ff33]" />
                <span>
                  Consultando negocios ({progress.current} de {progress.total}):{' '}
                  <strong className="text-white font-semibold">{progress.currentCategory}</strong>
                </span>
              </span>
              <span className="font-mono tabular-nums font-bold text-[#c6ff33]">
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#7d39eb] to-[#c6ff33] h-full transition-all duration-300 rounded-full"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Gemini AI Top 3 Recommendations */}
        {geminiResult && geminiResult.top3Categories?.length > 0 && (
          <div className="rounded-2xl border border-[#7d39eb]/40 bg-white/[0.03] backdrop-blur-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#c6ff33]">
              <Trophy className="w-5 h-5" />
              <h3 className="text-sm font-extrabold text-white tracking-tight">
                Los 3 Mejores Nichos para Vender en {geminiResult.zone} (Auditoría Inteligente Gemini)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {geminiResult.top3Categories.map((top, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col justify-between space-y-3 hover:border-[#7d39eb]/50 transition-all shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#7d39eb]/30 text-[#b9a0ff] border border-[#7d39eb]/40">
                        TOP #{top.rank}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#c6ff33]">
                        {top.opportunityScore}/100 Oportunidad
                      </span>
                    </div>
                    <div className="text-base font-extrabold text-white capitalize">{top.category}</div>
                    <div className="text-xs font-semibold text-[#b9a0ff]">
                      Servicio: {top.recommendedService}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{top.reason}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLaunchSearch(top.category, zone)}
                    className="w-full py-2.5 px-3 rounded-full text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md mt-2"
                    style={{ background: '#7d39eb' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#5a4be0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#7d39eb')}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Ver negocios en {top.category}</span>
                  </button>
                </div>
              ))}
            </div>

            {geminiResult.executiveSummary && (
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-300 leading-relaxed">
                <span className="font-bold text-white block mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#c6ff33]" />
                  <span>Resumen ejecutivo del mercado local:</span>
                </span>
                <p className="whitespace-pre-wrap">{geminiResult.executiveSummary}</p>
              </div>
            )}
          </div>
        )}

        {/* Niche Comparison Table */}
        {categoryStats.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-bold text-white">
                  Métricas comparativas por categoría ({zone})
                </h3>
                {isFromCache && (
                  <span className="text-[10px] font-mono text-[#c6ff33] bg-[#c6ff33]/10 border border-[#c6ff33]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    En memoria
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">
                  {categoryStats.length} categorías calculadas
                </span>
                <button
                  type="button"
                  onClick={handleClearScan}
                  className="text-[11px] text-slate-400 hover:text-rose-300 transition-colors underline cursor-pointer"
                >
                  Limpiar / Nuevo escaneo
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-semibold text-slate-400">
                    <th className="p-3.5">Categoría</th>
                    <th className="p-3.5 text-center">Negocios Detectados</th>
                    <th className="p-3.5 text-center">Sin Web Propia</th>
                    <th className="p-3.5 text-center">Valoración Media</th>
                    <th className="p-3.5 text-center">Media de Reseñas</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {categoryStats.map((stat, idx) => {
                    const isHighOpp = stat.percentWithoutWebsite >= 50;

                    return (
                      <tr key={idx} className="hover:bg-[#7d39eb]/10 transition-colors">
                        <td className="p-3.5 font-bold text-white capitalize">
                          {stat.category}
                        </td>
                        <td className="p-3.5 text-center font-mono tabular-nums text-slate-300">
                          {stat.totalCount}
                        </td>
                        <td className="p-3.5 text-center font-mono tabular-nums">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              isHighOpp
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {stat.percentWithoutWebsite}%{' '}
                            <span className="text-[10px] font-normal opacity-80">
                              ({stat.withoutWebsiteCount}/{stat.totalCount})
                            </span>
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono tabular-nums text-slate-300">
                          {stat.avgRating > 0 ? `${stat.avgRating} ★` : '-'}
                        </td>
                        <td className="p-3.5 text-center font-mono tabular-nums text-slate-300">
                          {stat.avgReviewCount}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => onLaunchSearch(stat.category, zone)}
                            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-[#7d39eb] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all border border-white/10"
                          >
                            <span>Ver negocios</span>
                            <ArrowRight className="w-3 h-3 text-[#c6ff33]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal before spending calls */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0819] border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  Confirmación de consumo de API Places
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Vas a escanear <strong>{selectedCategories.length} categorías</strong> en «
                  {zone}». Cada categoría realizará 1 petición de búsqueda a Google Places (New).
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 text-xs text-slate-300 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Peticiones estimadas:</span>
                <strong className="text-[#c6ff33] font-bold">
                  {selectedCategories.length} llamadas
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Consumo mensual actual:</span>
                <span>
                  {settings.quota.usedThisMonth} / {settings.quota.monthlyLimit}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="px-5 py-2 rounded-full text-white text-xs font-bold cursor-pointer shadow-lg transition-all"
                style={{ background: '#7d39eb' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#5a4be0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#7d39eb')}
              >
                Confirmar y escanear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
