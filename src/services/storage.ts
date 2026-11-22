import {
  BusinessItem,
  UserSettings,
  LeadStatus,
  NicheCategoryStat,
  NicheAnalysisResult,
} from '../types';

const SETTINGS_KEY = 'radar_clientes_settings';
const LEADS_KEY = 'radar_clientes_saved_leads';
const SEARCH_CACHE_KEY_PREFIX = 'radar_clientes_cache_';
const RADAR_CACHE_KEY_PREFIX = 'radar_clientes_niche_cache_';
const RADAR_LAST_ZONE_KEY = 'radar_clientes_last_zone';

const currentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const currentDayStr = () => {
  return new Date().toISOString().slice(0, 10);
};

export const MAX_FREE_TIER_LIMIT = 850;
export const MAX_DAILY_FREE_LIMIT = 30;

export const DEFAULT_SETTINGS: UserSettings = {
  googleCloudApiKey: '',
  geminiApiKey: '',
  sellerProfile: {
    name: 'Tu Nombre',
    agencyName: 'Tu Agencia Digital',
    servicesOffered:
      'Páginas web modernas de alta velocidad, Agentes de IA por WhatsApp 24/7 y Sistemas de citas online',
    valueProposition:
      'Ayudo a negocios locales a digitalizarse, captar más clientes en piloto automático y no perder llamadas ni reservas.',
    preferredTone: 'consultivo',
    dialect: 'argentina',
    senderPhone: '',
    senderEmail: '',
  },
  quota: {
    monthlyLimit: MAX_FREE_TIER_LIMIT,
    usedThisMonth: 0,
    lastResetMonth: currentMonthStr(),
    dailyLimit: MAX_DAILY_FREE_LIMIT,
    usedToday: 0,
    lastResetDay: currentDayStr(),
  },
};

export const getSettings = (): UserSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);

    // Check if month or day has rolled over
    const thisMonth = currentMonthStr();
    const today = currentDayStr();
    let needsSave = false;

    if (parsed.quota?.lastResetMonth !== thisMonth) {
      parsed.quota = {
        ...parsed.quota,
        monthlyLimit: parsed.quota?.monthlyLimit || MAX_FREE_TIER_LIMIT,
        usedThisMonth: 0,
        lastResetMonth: thisMonth,
      };
      needsSave = true;
    }

    if (parsed.quota?.lastResetDay !== today) {
      parsed.quota = {
        ...parsed.quota,
        dailyLimit: MAX_DAILY_FREE_LIMIT,
        usedToday: 0,
        lastResetDay: today,
      };
      needsSave = true;
    }

    if (needsSave) {
      saveSettings(parsed);
    }

    const sellerProfile = {
      ...DEFAULT_SETTINGS.sellerProfile,
      ...(parsed.sellerProfile || {}),
    };

    const rawQuota = {
      ...DEFAULT_SETTINGS.quota,
      ...(parsed.quota || {}),
    };
    // Hard software lock: never allow monthlyLimit > 850 or dailyLimit > 30
    rawQuota.monthlyLimit = Math.min(MAX_FREE_TIER_LIMIT, Math.max(50, Number(rawQuota.monthlyLimit) || MAX_FREE_TIER_LIMIT));
    rawQuota.dailyLimit = MAX_DAILY_FREE_LIMIT;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      googleCloudApiKey: parsed.googleCloudApiKey || DEFAULT_SETTINGS.googleCloudApiKey,
      geminiApiKey: parsed.geminiApiKey || DEFAULT_SETTINGS.geminiApiKey,
      sellerProfile,
      quota: rawQuota,
    };
  } catch (e) {
    console.error('Error loading settings from localStorage:', e);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: UserSettings): void => {
  try {
    const safeSettings: UserSettings = {
      ...settings,
      quota: {
        ...settings.quota,
        monthlyLimit: Math.min(MAX_FREE_TIER_LIMIT, Math.max(50, Number(settings.quota?.monthlyLimit) || MAX_FREE_TIER_LIMIT)),
        dailyLimit: MAX_DAILY_FREE_LIMIT,
      },
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeSettings));
  } catch (e) {
    console.error('Error saving settings to localStorage:', e);
  }
};

export const syncServerQuotaToLocal = (serverMonthlyUsed?: number, serverDailyUsed?: number): void => {
  const settings = getSettings();
  let changed = false;
  if (typeof serverMonthlyUsed === 'number' && serverMonthlyUsed > (settings.quota.usedThisMonth || 0)) {
    settings.quota.usedThisMonth = serverMonthlyUsed;
    changed = true;
  }
  if (typeof serverDailyUsed === 'number' && serverDailyUsed > (settings.quota.usedToday || 0)) {
    settings.quota.usedToday = serverDailyUsed;
    changed = true;
  }
  if (changed) {
    saveSettings(settings);
  }
};

export const incrementPlacesCalls = (count = 1): number => {
  const settings = getSettings();
  settings.quota.usedThisMonth = (settings.quota.usedThisMonth || 0) + count;
  settings.quota.usedToday = (settings.quota.usedToday || 0) + count;
  saveSettings(settings);
  return settings.quota.usedThisMonth;
};

export const isPlacesQuotaReached = (): boolean => {
  const settings = getSettings();
  const monthlyLimit = Math.min(MAX_FREE_TIER_LIMIT, settings.quota?.monthlyLimit || MAX_FREE_TIER_LIMIT);
  const usedMonth = settings.quota?.usedThisMonth || 0;
  const usedDay = settings.quota?.usedToday || 0;
  return usedMonth >= monthlyLimit || usedDay >= MAX_DAILY_FREE_LIMIT;
};

// LEADS MANAGEMENT
export const getSavedLeads = (): BusinessItem[] => {
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading saved leads:', e);
    return [];
  }
};

export const saveLead = (lead: BusinessItem): BusinessItem => {
  const leads = getSavedLeads();
  const existingIdx = leads.findIndex((l) => l.id === lead.id);
  const now = new Date().toISOString();

  const leadToSave: BusinessItem = {
    ...lead,
    savedAt: lead.savedAt || now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    leads[existingIdx] = leadToSave;
  } else {
    leads.unshift(leadToSave);
  }

  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  return leadToSave;
};

export const batchSaveLeads = (newLeads: BusinessItem[]): number => {
  const leads = getSavedLeads();
  const now = new Date().toISOString();
  let addedCount = 0;

  for (const item of newLeads) {
    const idx = leads.findIndex((l) => l.id === item.id);
    if (idx >= 0) {
      leads[idx] = { ...leads[idx], ...item, updatedAt: now };
    } else {
      leads.unshift({ ...item, savedAt: now, updatedAt: now });
      addedCount++;
    }
  }

  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  return addedCount;
};

export const updateLeadStatus = (leadId: string, status: LeadStatus, notes?: string): void => {
  const leads = getSavedLeads();
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx >= 0) {
    leads[idx].status = status;
    if (notes !== undefined) leads[idx].notes = notes;
    leads[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  }
};

export const deleteLead = (leadId: string): void => {
  const leads = getSavedLeads().filter((l) => l.id !== leadId);
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
};

// CACHE FOR PLACES SEARCHES
export const getCachedSearch = (queryKey: string): { results: BusinessItem[]; nextPageToken?: string } | null => {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY_PREFIX + queryKey.toLowerCase().trim());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache TTL 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SEARCH_CACHE_KEY_PREFIX + queryKey.toLowerCase().trim());
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

export const setCachedSearch = (
  queryKey: string,
  data: { results: BusinessItem[]; nextPageToken?: string }
): void => {
  try {
    localStorage.setItem(
      SEARCH_CACHE_KEY_PREFIX + queryKey.toLowerCase().trim(),
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn('LocalStorage full or error caching search results:', e);
  }
};

// CACHE FOR NICHE RADAR SCANS
export interface CachedNicheRadarScan {
  zone: string;
  selectedCategories: string[];
  categoryStats: NicheCategoryStat[];
  geminiResult: NicheAnalysisResult | null;
  timestamp: number;
}

export const getCachedNicheRadarScan = (targetZone?: string): CachedNicheRadarScan | null => {
  try {
    const zoneKey = targetZone?.toLowerCase().trim() || localStorage.getItem(RADAR_LAST_ZONE_KEY);
    if (!zoneKey) return null;

    const raw = localStorage.getItem(RADAR_CACHE_KEY_PREFIX + zoneKey);
    if (!raw) return null;

    const parsed: CachedNicheRadarScan = JSON.parse(raw);
    // Cache TTL 7 days (7 * 24 * 60 * 60 * 1000)
    if (Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(RADAR_CACHE_KEY_PREFIX + zoneKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const setCachedNicheRadarScan = (
  scan: Omit<CachedNicheRadarScan, 'timestamp'>
): void => {
  if (!scan.zone || !scan.zone.trim()) return;
  try {
    const zoneKey = scan.zone.toLowerCase().trim();
    const data: CachedNicheRadarScan = {
      ...scan,
      timestamp: Date.now(),
    };
    localStorage.setItem(RADAR_CACHE_KEY_PREFIX + zoneKey, JSON.stringify(data));
    localStorage.setItem(RADAR_LAST_ZONE_KEY, zoneKey);
  } catch (e) {
    console.warn('LocalStorage error caching niche radar scan:', e);
  }
};

export const clearCachedNicheRadarScan = (zoneToClear?: string): void => {
  try {
    if (zoneToClear) {
      localStorage.removeItem(RADAR_CACHE_KEY_PREFIX + zoneToClear.toLowerCase().trim());
    } else {
      const lastZone = localStorage.getItem(RADAR_LAST_ZONE_KEY);
      if (lastZone) {
        localStorage.removeItem(RADAR_CACHE_KEY_PREFIX + lastZone);
      }
      localStorage.removeItem(RADAR_LAST_ZONE_KEY);
    }
  } catch (e) {
    console.warn('Error clearing cached niche radar scan:', e);
  }
};

// CUSTOM RADAR CATEGORIES
const CUSTOM_CATEGORIES_KEY = 'radar_clientes_custom_categories';

export const getCustomCategories = (): string[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const saveCustomCategory = (category: string): string[] => {
  const clean = category.toLowerCase().trim();
  if (!clean) return getCustomCategories();
  try {
    const current = getCustomCategories();
    if (!current.includes(clean)) {
      const updated = [...current, clean];
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(updated));
      return updated;
    }
    return current;
  } catch (e) {
    console.warn('Error saving custom category:', e);
    return getCustomCategories();
  }
};

export const removeCustomCategory = (category: string): string[] => {
  const clean = category.toLowerCase().trim();
  try {
    const current = getCustomCategories();
    const updated = current.filter((c) => c !== clean);
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Error removing custom category:', e);
    return getCustomCategories();
  }
};

// EXPORT TO CSV
export const exportLeadsToCsv = (leads: BusinessItem[]): void => {
  const headers = [
    'ID',
    'Nombre',
    'Categoría',
    'Dirección',
    'Teléfono',
    'Página Web',
    'Tiene Web Propia',
    'Valoración',
    'Número Reseñas',
    'Puntuación Oportunidad',
    'Estado Lead',
    'Servicio Recomendado',
    'Notas',
    'Fecha Próxima Acción',
    'Enlace Google Maps',
    'Fecha Guardado',
  ];

  const rows = leads.map((l) => [
    l.id,
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.category || '').replace(/"/g, '""')}"`,
    `"${(l.address || '').replace(/"/g, '""')}"`,
    l.phone || '',
    l.websiteUri || '',
    l.hasWebsite ? 'Sí' : 'No',
    l.rating != null ? l.rating.toString() : '',
    l.userRatingCount != null ? l.userRatingCount.toString() : '',
    l.detailedOpportunityScore != null ? l.detailedOpportunityScore : l.provisionalOpportunityScore,
    l.status,
    l.webAudit?.recommendedService || '',
    `"${(l.notes || '').replace(/"/g, '""')}"`,
    l.nextActionDate || '',
    l.googleMapsUri || '',
    l.savedAt || '',
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `radar_clientes_leads_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
