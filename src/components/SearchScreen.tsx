import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  LayoutGrid,
  List,
  Phone,
  Globe,
  MapPin,
  Star,
  ExternalLink,
  BookmarkPlus,
  Zap,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { BusinessItem, SearchFilterState, UserSettings } from '../types';
import { OpportunityScoreBadge } from './OpportunityScoreBadge';
import { LocationAutocomplete } from './LocationAutocomplete';
import { searchPlaces, analyzeBusiness, runPageSpeedAudit } from '../services/api';
import {
  getCachedSearch,
  setCachedSearch,
  batchSaveLeads,
  getCustomCategories,
} from '../services/storage';

const NICHE_SUGGESTIONS = [
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
  onSelectBusiness: (business: BusinessItem) => void;
  onRefreshLeads: () => void;
  onNavigateToSettings: () => void;
  initialCategory?: string;
  initialZone?: string;
}

export const SearchScreen: React.FC<Props> = ({
  settings,
  onSelectBusiness,
  onRefreshLeads,
  onNavigateToSettings,
  initialCategory,
  initialZone,
}) => {
  const [zone, setZone] = useState(initialZone || '');
  const [niche, setNiche] = useState(initialCategory || '');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Search Results
  const [results, setResults] = useState<BusinessItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters State
  const [filters, setFilters] = useState<SearchFilterState>({
    onlyWithoutWebsite: false,
    onlyWithPhone: false,
    minRating: 0,
    minReviews: 0,
    hideClosed: true,
    keyword: '',
  });
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Batch Analysis State
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: '',
  });

  useEffect(() => {
    if (initialCategory) setNiche(initialCategory);
    if (initialZone) setZone(initialZone);
  }, [initialCategory, initialZone]);

  const buildQuery = () => {
    const cleanNiche = niche.trim();
    const cleanZone = zone.trim();
    if (!cleanNiche && !cleanZone) return '';
    if (!cleanNiche) return cleanZone;
    if (!cleanZone) return cleanNiche;
    return `${cleanNiche} en ${cleanZone}`;
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = buildQuery();
    if (!query) return;

    setErrorMessage(null);
    setSearchNotice(null);
    setIsLoading(true);
    setHasSearched(true);
    setSelectedIds(new Set());

    // 1. Check local search cache first
    const cached = getCachedSearch(query);
    if (cached && cached.results?.length > 0) {
      setResults(cached.results);
      setNextPageToken(cached.nextPageToken);
      setIsLoading(false);
      return;
    }

    try {
      const res = await searchPlaces(query, undefined, settings.googleCloudApiKey);
      setResults(res.places);
      setNextPageToken(res.nextPageToken);
      if (res.meta?.notice) {
        setSearchNotice(res.meta.notice);
      }

      // Save to cache
      setCachedSearch(query, {
        results: res.places,
        nextPageToken: res.nextPageToken,
      });
    } catch (err: unknown) {
      console.error('Search error:', err);
      const rawError = err instanceof Error ? err.message : 'Error desconocido al buscar negocios con Google Places.';
      if (rawError.includes('API keys are not supported') || rawError.includes('Expected OAuth2 access token')) {
        setErrorMessage(
          'La clave de Google Cloud API introducida no tiene habilitado el servicio «Places API (New)» o es una clave de Google AI Studio / Gemini. En Google Cloud Console debes habilitar «Places API (New)» y vincular una cuenta de facturación.'
        );
      } else {
        setErrorMessage(rawError);
      }
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    const query = buildQuery();
    setIsLoadingMore(true);

    try {
      const res = await searchPlaces(query, nextPageToken, settings.googleCloudApiKey);
      const combined = [...results, ...res.places];
      setResults(combined);
      setNextPageToken(res.nextPageToken);

      setCachedSearch(query, {
        results: combined,
        nextPageToken: res.nextPageToken,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al cargar más resultados.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Filter application
  const filteredResults = results.filter((item) => {
    if (filters.onlyWithoutWebsite && item.hasWebsite) return false;
    if (filters.onlyWithPhone && !item.phone) return false;
    if (filters.minRating > 0 && (item.rating || 0) < filters.minRating) return false;
    if (filters.minReviews > 0 && (item.userRatingCount || 0) < filters.minReviews) return false;
    if (filters.hideClosed && (item.businessStatus === 'CLOSED_PERMANENTLY' || item.businessStatus === 'CLOSED_TEMPORARILY'))
      return false;
    if (filters.keyword.trim()) {
      const kw = filters.keyword.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(kw);
      const matchCat = item.category.toLowerCase().includes(kw);
      const matchAddr = item.address.toLowerCase().includes(kw);
      if (!matchName && !matchCat && !matchAddr) return false;
    }
    return true;
  });

  // Toggle selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map((r) => r.id)));
    }
  };

  // Save selected to leads
  const handleSaveSelected = () => {
    const toSave = results.filter((r) => selectedIds.has(r.id));
    if (toSave.length === 0) return;
    batchSaveLeads(toSave);
    onRefreshLeads();
    setSelectedIds(new Set());
  };

  // Analyze selected (concurrency max 2 at a time)
  const handleBatchAnalyze = async () => {
    const selectedItems = results.filter((r) => selectedIds.has(r.id));
    if (selectedItems.length === 0) return;

    setBatchAnalyzing(true);
    const total = selectedItems.length;
    let completed = 0;
    const updatedMap = new Map<string, BusinessItem>();

    setBatchProgress({ current: 0, total, currentName: 'Iniciando análisis...' });

    // Process in chunks of 2
    for (let i = 0; i < selectedItems.length; i += 2) {
      const chunk = selectedItems.slice(i, i + 2);

      await Promise.all(
        chunk.map(async (item) => {
          setBatchProgress({
            current: completed + 1,
            total,
            currentName: item.name,
          });

          try {
            let pageSpeedScores = null;
            if (item.hasWebsite && item.websiteUri) {
              try {
                const psi = await runPageSpeedAudit(item.websiteUri, settings.googleCloudApiKey);
                pageSpeedScores = psi.scores;
              } catch (psiErr) {
                console.warn(`PageSpeed failed for ${item.websiteUri}:`, psiErr);
              }
            }

            const { audit, drafts } = await analyzeBusiness(item, settings.sellerProfile, pageSpeedScores);

            const updatedItem: BusinessItem = {
              ...item,
              webAudit: audit,
              outreachDrafts: drafts,
              status: 'analizado',
            };

            updatedMap.set(item.id, updatedItem);
          } catch (itemErr) {
            console.error(`Error analyzing ${item.name}:`, itemErr);
          } finally {
            completed++;
            setBatchProgress((prev) => ({ ...prev, current: completed }));
          }
        })
      );
    }

    // Merge updated items back into results & storage
    const newResults = results.map((item) => updatedMap.get(item.id) || item);
    setResults(newResults);
    batchSaveLeads(Array.from(updatedMap.values()));
    onRefreshLeads();

    setBatchAnalyzing(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#000000]">
      {/* Search Header Form */}
      <div className="p-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-md shrink-0 relative z-30">
        <form onSubmit={handleSearch} className="space-y-3 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-stretch gap-2.5">
            {/* Zona Input */}
            <div className="flex-1 relative">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#c6ff33]" />
                <span>Zona (ciudad, barrio o código postal)</span>
              </label>
              <LocationAutocomplete
                value={zone}
                onChange={setZone}
                apiKey={settings.googleCloudApiKey}
                placeholder="Buscar ciudad o zona (ej: Santa Rosa, La Pampa)..."
              />
            </div>

            {/* Nicho Input */}
            <div className="flex-1 relative">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#b9a0ff]" />
                <span>Nicho / Actividad comercial</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Ej: talleres mecánicos, clínicas dentales..."
                  className="w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#7d39eb] focus:ring-1 focus:ring-[#7d39eb]"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="md:w-36 flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[38px] rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all disabled:opacity-50"
                style={{
                  background: '#7d39eb',
                  color: '#ffffff',
                  boxShadow: '0 4px 18px -2px rgba(125, 57, 235, 0.5)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#5a4be0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#7d39eb';
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Rastrear</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Niche Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-slate-400 shrink-0 font-medium mr-1">Sugerencias:</span>
            {Array.from(new Set([...NICHE_SUGGESTIONS, ...getCustomCategories()])).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setNiche(item);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all cursor-pointer border ${
                  niche.toLowerCase() === item.toLowerCase()
                    ? 'bg-[#7d39eb]/25 text-white border-[#7d39eb]/60 font-semibold shadow-sm'
                    : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Control Bar: Filters, Multi-selection & View Toggle */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 relative z-30">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Filter Buttons */}
          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                onlyWithoutWebsite: !prev.onlyWithoutWebsite,
              }))
            }
            className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-all cursor-pointer ${
              filters.onlyWithoutWebsite
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                : 'bg-white/[0.04] text-slate-300 border-white/10 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            Solo sin web
          </button>

          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                onlyWithPhone: !prev.onlyWithPhone,
              }))
            }
            className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-all cursor-pointer ${
              filters.onlyWithPhone
                ? 'bg-[#c6ff33]/20 text-[#c6ff33] border-[#c6ff33]/50 shadow-sm'
                : 'bg-white/[0.04] text-slate-300 border-white/10 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            Solo con teléfono
          </button>

          {/* More filters dropdown toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
              className="px-3 py-1.5 rounded-full text-xs border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Filter className="w-3 h-3 text-[#b9a0ff]" />
              <span>Filtros avanzados</span>
              {(filters.minRating > 0 || filters.minReviews > 0 || !filters.hideClosed) && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#c6ff33]" />
              )}
            </button>

            {showFiltersDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowFiltersDropdown(false)}
                />
                <div className="absolute left-0 mt-2 w-72 bg-[#0c0a1a] border border-white/20 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-50 space-y-3 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 font-medium">
                      Valoración mínima
                    </label>
                    <select
                      value={filters.minRating}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          minRating: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-black/60 border border-white/15 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
                    >
                      <option value="0">Cualquier nota</option>
                      <option value="3.5">3.5 estrellas o más</option>
                      <option value="4.0">4.0 estrellas o más</option>
                      <option value="4.5">4.5 estrellas o más</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 font-medium">
                      Mínimo de reseñas
                    </label>
                    <select
                      value={filters.minReviews}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          minReviews: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-black/60 border border-white/15 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
                    >
                      <option value="0">Sin mínimo</option>
                      <option value="5">Al menos 5 reseñas</option>
                      <option value="20">Al menos 20 reseñas</option>
                      <option value="50">Al menos 50 reseñas</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hideClosed"
                      checked={filters.hideClosed}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          hideClosed: e.target.checked,
                        }))
                      }
                      className="rounded bg-black/60 border-white/20 text-[#7d39eb] focus:ring-0"
                    />
                    <label htmlFor="hideClosed" className="text-xs text-slate-300">
                      Ocultar negocios cerrados
                    </label>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setFilters({
                          onlyWithoutWebsite: false,
                          onlyWithPhone: false,
                          minRating: 0,
                          minReviews: 0,
                          hideClosed: true,
                          keyword: '',
                        })
                      }
                      className="text-[11px] text-slate-400 hover:text-[#c6ff33] transition-colors"
                    >
                      Restablecer filtros
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick text filter within results */}
          {results.length > 0 && (
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))}
              placeholder="Filtrar en esta lista..."
              className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 w-40 focus:outline-none focus:border-[#7d39eb]"
            />
          )}
        </div>

        {/* View switcher & Selection Actions */}
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-[#7d39eb]/20 border border-[#7d39eb]/40 px-3 py-1 rounded-full text-xs text-white">
              <span className="font-mono tabular-nums font-bold text-[#c6ff33]">
                {selectedIds.size}
              </span>{' '}
              seleccionados
              <button
                type="button"
                onClick={handleSaveSelected}
                className="ml-1 px-2.5 py-1 rounded-full text-white font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                style={{ background: '#7d39eb' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#5a4be0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#7d39eb')}
              >
                <BookmarkPlus className="w-3 h-3" />
                <span>Guardar en leads</span>
              </button>
              <button
                type="button"
                onClick={handleBatchAnalyze}
                disabled={batchAnalyzing}
                className="px-2.5 py-1 rounded-full text-black font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                style={{ background: '#c6ff33' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#b0f020')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#c6ff33')}
              >
                <Zap className="w-3 h-3 text-black" />
                <span>Analizar seleccionados</span>
              </button>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center border border-white/10 rounded-xl bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista en tabla"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'cards' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista en tarjetas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Analysis Progress Bar Overlay */}
      {batchAnalyzing && (
        <div className="bg-[#130d2a]/95 border-b border-[#7d39eb]/40 px-4 py-2.5 flex items-center justify-between text-xs text-[#b9a0ff]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#c6ff33]" />
            <span>
              Analizando webs de 2 en 2 ({batchProgress.current} de {batchProgress.total}):{' '}
              <strong className="text-white font-medium">{batchProgress.currentName}</strong>
            </span>
          </div>
          <span className="font-mono tabular-nums font-bold text-[#c6ff33]">
            {Math.round((batchProgress.current / batchProgress.total) * 100)}%
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold text-rose-100">Error en la consulta</div>
              <p className="text-rose-300">{errorMessage}</p>
              {errorMessage.includes('clave') && (
                <button
                  type="button"
                  onClick={onNavigateToSettings}
                  className="mt-2 text-xs font-semibold underline text-rose-200 hover:text-white"
                >
                  Configurar clave en Ajustes →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notice Notification */}
        {searchNotice && (
          <div className="mb-4 p-3.5 rounded-2xl bg-[#7d39eb]/15 border border-[#7d39eb]/40 text-white text-xs flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#c6ff33] shrink-0 mt-0.5" />
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-slate-200 leading-relaxed">{searchNotice}</p>
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="text-xs font-semibold underline text-[#b9a0ff] hover:text-[#c6ff33] shrink-0 transition-colors"
              >
                Revisar clave en Ajustes →
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#7d39eb]" />
            <p>Rastreando negocios en la zona con el motor inteligente de prospección...</p>
          </div>
        )}

        {/* Empty State before search */}
        {!isLoading && !hasSearched && (
          <div className="h-80 flex flex-col items-center justify-center text-center p-8 border border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-md max-w-lg mx-auto mt-8 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-[#7d39eb]/20 border border-[#7d39eb]/40 flex items-center justify-center text-[#c6ff33] mb-4">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-base font-extrabold text-white mb-1 tracking-tight">
              Rastrea negocios locales en cualquier zona
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
              Escribe una localidad y un nicho para localizar empresas, descubrir si carecen de web propia y evaluar oportunidades para servicios digitales.
            </p>
            <button
              type="button"
              onClick={() => handleSearch()}
              className="px-5 py-2.5 text-white text-xs font-bold rounded-full cursor-pointer transition-all shadow-lg"
              style={{
                background: '#7d39eb',
                boxShadow: '0 4px 20px -2px rgba(125, 57, 235, 0.5)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#5a4be0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#7d39eb')}
            >
              Buscar «{niche} en {zone}»
            </button>
          </div>
        )}

        {/* No Results found */}
        {!isLoading && hasSearched && results.length === 0 && !errorMessage && (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-slate-800 rounded-xl bg-slate-900/30 max-w-md mx-auto mt-8">
            <AlertCircle className="w-8 h-8 text-slate-500 mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">No se encontraron negocios</h3>
            <p className="text-xs text-slate-400">
              No hemos obtenido resultados para «{buildQuery()}». Prueba a ampliar la zona o a cambiar el nicho.
            </p>
          </div>
        )}

        {/* Results View */}
        {!isLoading && filteredResults.length > 0 && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Mostrando <strong className="text-white font-mono tabular-nums">{filteredResults.length}</strong> negocios{' '}
                {results.length !== filteredResults.length && (
                  <span>(filtrados de {results.length} cargados)</span>
                )}
              </span>
              <button
                type="button"
                onClick={selectAll}
                className="text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                {selectedIds.size === filteredResults.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Deseleccionar todos</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Seleccionar todos</span>
                  </>
                )}
              </button>
            </div>

            {/* Table View */}
            {viewMode === 'table' ? (
              <div className="border border-white/10 rounded-2xl overflow-x-auto bg-white/[0.02] backdrop-blur-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-semibold text-slate-400">
                      <th className="p-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.size > 0 && selectedIds.size === filteredResults.length}
                          onChange={selectAll}
                          className="rounded bg-black/60 border-white/20 text-[#7d39eb] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Negocio</th>
                      <th className="p-3">Contacto</th>
                      <th className="p-3">Página Web</th>
                      <th className="p-3 text-center">Reseñas</th>
                      <th className="p-3 text-center">Oportunidad</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredResults.map((item) => {
                      const isSelected = selectedIds.has(item.id);

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-[#7d39eb]/10 transition-colors ${
                            isSelected ? 'bg-[#7d39eb]/15' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              className="rounded bg-black/60 border-white/20 text-[#7d39eb] focus:ring-0 cursor-pointer"
                            />
                          </td>

                          {/* Business Info */}
                          <td className="p-3">
                            <div className="font-bold text-white hover:text-[#b9a0ff] transition-colors cursor-pointer"
                              onClick={() => onSelectBusiness(item)}
                            >
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className="text-[#b9a0ff]">{item.category}</span>
                              <span aria-hidden="true" className="text-slate-600">·</span>
                              <span className="truncate max-w-[220px]" title={item.address}>
                                {item.address}
                              </span>
                            </div>
                          </td>

                          {/* Phone / Maps */}
                          <td className="p-3 whitespace-nowrap">
                            {item.phone ? (
                              <a
                                href={`tel:${item.phone}`}
                                className="inline-flex items-center gap-1.5 text-slate-200 hover:text-[#c6ff33] font-mono transition-colors"
                                title="Llamar directamente"
                              >
                                <Phone className="w-3 h-3 text-[#c6ff33]" />
                                <span>{item.phone}</span>
                              </a>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Sin teléfono</span>
                            )}
                          </td>

                          {/* Website column */}
                          <td className="p-3">
                            {item.websiteUri ? (
                              item.isSocialOrDirectoryWebsite ? (
                                <div className="space-y-0.5">
                                  <span className="inline-block text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                                    Sin web propia (red/directorio)
                                  </span>
                                  <div>
                                    <a
                                      href={item.websiteUri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-[#b9a0ff] truncate max-w-[180px]"
                                    >
                                      <span className="truncate">{item.websiteUri.replace(/^https?:\/\//, '')}</span>
                                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <a
                                  href={item.websiteUri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[#b9a0ff] hover:text-[#c6ff33] hover:underline max-w-[180px] truncate transition-colors"
                                >
                                  <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{item.websiteUri.replace(/^https?:\/\//, '')}</span>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                </a>
                              )
                            ) : (
                              <span className="inline-block text-[11px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                                Sin web
                              </span>
                            )}
                          </td>

                          {/* Rating & Review Count */}
                          <td className="p-3 text-center whitespace-nowrap">
                            {item.rating != null ? (
                              <div className="inline-flex items-center gap-1 text-slate-200">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                <span className="font-mono font-medium">{item.rating}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({item.userRatingCount || 0})
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">-</span>
                            )}
                          </td>

                          {/* Opportunity Score */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <OpportunityScoreBadge
                              score={item.detailedOpportunityScore || item.provisionalOpportunityScore}
                              breakdown={item.opportunityBreakdown}
                              isDetailed={!!item.detailedOpportunityScore}
                              size="sm"
                            />
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onSelectBusiness(item)}
                                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-[#7d39eb] text-white text-xs font-semibold cursor-pointer transition-all border border-white/10"
                              >
                                Ver ficha
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Cards View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredResults.map((item) => {
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-[#7d39eb]/15 border-[#7d39eb] shadow-[0_0_20px_-4px_rgba(125,57,235,0.4)]'
                          : 'bg-white/[0.03] border-white/10 hover:border-[#7d39eb]/50 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <h4
                            onClick={() => onSelectBusiness(item)}
                            className="font-bold text-white hover:text-[#b9a0ff] transition-colors text-xs truncate cursor-pointer"
                          >
                            {item.name}
                          </h4>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="text-[#b9a0ff]">{item.category}</span>
                            {item.rating != null && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-0.5 text-amber-400 font-mono">
                                  <Star className="w-2.5 h-2.5 fill-amber-400" />
                                  <span>{item.rating}</span>
                                  <span className="text-slate-500">({item.userRatingCount || 0})</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <OpportunityScoreBadge
                          score={item.detailedOpportunityScore || item.provisionalOpportunityScore}
                          breakdown={item.opportunityBreakdown}
                          isDetailed={!!item.detailedOpportunityScore}
                          size="sm"
                        />
                      </div>

                      <div className="text-[11px] text-slate-400 mb-3 line-clamp-1" title={item.address}>
                        <MapPin className="w-3 h-3 inline mr-1 text-slate-500" />
                        {item.address}
                      </div>

                      {/* Web and phone status */}
                      <div className="space-y-1 mb-3 text-[11px] border-t border-white/10 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Web:</span>
                          {item.websiteUri ? (
                            item.isSocialOrDirectoryWebsite ? (
                              <span className="text-amber-300 text-[10px] font-medium bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                Solo red/directorio
                              </span>
                            ) : (
                              <a
                                href={item.websiteUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#b9a0ff] hover:text-[#c6ff33] hover:underline truncate max-w-[160px] inline-flex items-center gap-1 transition-colors"
                              >
                                <span className="truncate">{item.websiteUri.replace(/^https?:\/\//, '')}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </a>
                            )
                          ) : (
                            <span className="text-rose-300 font-bold bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px]">
                              Sin web
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Teléfono:</span>
                          {item.phone ? (
                            <a
                              href={`tel:${item.phone}`}
                              className="text-slate-200 font-mono hover:text-[#c6ff33] inline-flex items-center gap-1 transition-colors"
                            >
                              <Phone className="w-2.5 h-2.5 text-[#c6ff33]" />
                              {item.phone}
                            </a>
                          ) : (
                            <span className="text-slate-500">No disponible</span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                        <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer text-[11px]">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded bg-black/60 border-white/20 text-[#7d39eb] focus:ring-0"
                          />
                          <span>Elegir</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => onSelectBusiness(item)}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-[#7d39eb] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all border border-white/10"
                        >
                          <span>Ficha</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Load more button */}
            {nextPageToken && (
              <div className="pt-4 pb-8 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-3 rounded-full text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 shadow-xl border border-white/15 bg-white/[0.05] hover:bg-[#7d39eb]"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cargando más negocios...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#c6ff33]" />
                      <span>Cargar más resultados (vía pageToken)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
