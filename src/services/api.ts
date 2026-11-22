import {
  BusinessItem,
  NicheAnalysisResult,
  NicheCategoryStat,
  OutreachDrafts,
  OutreachTone,
  SellerProfile,
  WebAudit,
} from '../types';
import { calculateProvisionalScore, isSocialOrDirectoryUrl } from './opportunityScorer';
import { incrementPlacesCalls, isPlacesQuotaReached, syncServerQuotaToLocal, getSettings } from './storage';

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

export interface ServerConfigResponse {
  hasGoogleCloudKey: boolean;
  hasGeminiKey: boolean;
  serverQuota?: {
    month: string;
    day: string;
    monthlySearchCount: number;
    dailySearchCount: number;
    monthlyAutocompleteCount: number;
    monthlyHardLimit: number;
    dailyHardLimit: number;
  };
}

export const fetchServerConfig = async (): Promise<ServerConfigResponse | null> => {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return null;
    const data: ServerConfigResponse = await res.json();
    if (data?.serverQuota?.monthlySearchCount != null) {
      syncServerQuotaToLocal(data.serverQuota.monthlySearchCount, data.serverQuota.dailySearchCount);
    }
    return data;
  } catch {
    return null;
  }
};

export interface PlacesSearchResponse {
  places: BusinessItem[];
  nextPageToken?: string;
  totalReturned: number;
  meta?: {
    source?: string;
    isFallback?: boolean;
    notice?: string;
    originalError?: string;
  };
}

export interface PlacePrediction {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  types?: string[];
}

/**
 * Gets location autocomplete suggestions (cities, regions, neighborhoods) without specific street addresses
 */
export const getPlaceAutocomplete = async (
  input: string,
  apiKey?: string
): Promise<PlacePrediction[]> => {
  if (!input || !input.trim() || input.trim().length < 2) {
    return [];
  }

  // Hard free-tier protection: do not call Google Places if monthly limit is reached
  if (isPlacesQuotaReached()) {
    return [];
  }

  try {
    const response = await apiFetch('/api/places/autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: input.trim(),
        apiKey,
      }),
    });

    if (!response.ok) {
      console.warn('Error fetching place autocomplete:', response.status);
      return [];
    }

    const data = await response.json();
    const rawList = data.suggestions || [];
    return rawList.map((s: any) => ({
      placeId: s.placeId || s.placePrediction?.placeId || "",
      text: s.text || s.placePrediction?.text?.text || "",
      mainText: s.mainText || s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text || s.text || "",
      secondaryText: s.secondaryText || s.placePrediction?.structuredFormat?.secondaryText?.text || "",
      types: s.types || s.placePrediction?.types || [],
    }));
  } catch (error) {
    console.warn('Network error during autocomplete:', error);
    return [];
  }
};

/**
 * Searches places via backend proxy with Google Places API (New) Text Search
 */
export const searchPlaces = async (
  query: string,
  pageToken?: string,
  apiKey?: string
): Promise<PlacesSearchResponse> => {
  const quotaReached = isPlacesQuotaReached();

  const response = await apiFetch('/api/places/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      textQuery: query,
      pageToken,
      apiKey: apiKey || getSettings().googleCloudApiKey,
      geminiApiKey: getSettings().geminiApiKey,
      forceFreeFallback: quotaReached,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status} en la búsqueda de Google Places`);
  }

  // Only increment local places quota counter when a real Google Places API call was made
  if (data.meta?.source === 'google_places_api_new') {
    incrementPlacesCalls(1);
    if (data.meta?.serverQuota?.monthlySearchCount != null) {
      syncServerQuotaToLocal(data.meta.serverQuota.monthlySearchCount, data.meta.serverQuota.dailySearchCount);
    }
  }

  const rawPlaces = data.places || [];
  const nextPageToken = data.nextPageToken || undefined;

  const places: BusinessItem[] = rawPlaces.map((p: any) => {
    const rawWeb = p.websiteUri || undefined;
    const isSocialOrDir = isSocialOrDirectoryUrl(rawWeb);
    const hasWeb = !!rawWeb && !isSocialOrDir;

    const partialItem = {
      id: p.id || Math.random().toString(36).substring(2),
      name: p.displayName?.text || p.displayName || 'Sin nombre',
      category: p.primaryTypeDisplayName?.text || p.types?.[0] || 'Negocio local',
      types: p.types || [],
      address: p.formattedAddress || 'Dirección no disponible',
      location: p.location
        ? { latitude: p.location.latitude, longitude: p.location.longitude }
        : undefined,
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || undefined,
      internationalPhone: p.internationalPhoneNumber || undefined,
      websiteUri: rawWeb,
      isSocialOrDirectoryWebsite: isSocialOrDir,
      hasWebsite: hasWeb,
      rating: p.rating != null ? Number(p.rating) : undefined,
      userRatingCount: p.userRatingCount != null ? Number(p.userRatingCount) : undefined,
      googleMapsUri: p.googleMapsUri || undefined,
      businessStatus: p.businessStatus || 'OPERATIONAL',
      status: 'nuevo' as const,
    };

    const scoring = calculateProvisionalScore(partialItem);

    return {
      ...partialItem,
      provisionalOpportunityScore: scoring.score,
      opportunityBreakdown: scoring.breakdown,
    };
  });

  return {
    places,
    nextPageToken,
    totalReturned: places.length,
    meta: data.meta,
  };
};

/**
 * Validates a Google Cloud key against Places API (New)
 */
export const validatePlacesApiKey = async (
  apiKey: string
): Promise<{ valid: boolean; message: string }> => {
  const response = await apiFetch('/api/places/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  return await response.json();
};

/**
 * Validates a Gemini AI key against Google AI Studio
 */
export const validateGeminiApiKey = async (
  apiKey: string
): Promise<{ valid: boolean; message: string }> => {
  const response = await apiFetch('/api/gemini/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  return await response.json();
};

/**
 * Runs PageSpeed Insights v5 Mobile audit via backend proxy
 */
export const runPageSpeedAudit = async (
  url: string,
  apiKey?: string
): Promise<{
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  screenshot: string | null;
}> => {
  const response = await apiFetch('/api/pagespeed/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, apiKey }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status} en auditoría PageSpeed`);
  }

  return {
    scores: data.scores || { performance: null, seo: null, accessibility: null, bestPractices: null },
    screenshot: data.screenshot || null,
  };
};

/**
 * Analyzes business with Gemini 3.8 Flash via server-side route
 */
export const analyzeBusiness = async (
  business: BusinessItem,
  sellerProfile: SellerProfile,
  pageSpeedScores?: any
): Promise<{ audit: WebAudit; drafts: OutreachDrafts }> => {
  const response = await apiFetch('/api/gemini/analyze-business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: business.name,
      category: business.category,
      address: business.address,
      phone: business.phone,
      websiteUri: business.websiteUri,
      isSocialOrDirectory: business.isSocialOrDirectoryWebsite,
      pageSpeedScores,
      sellerProfile,
      geminiApiKey: getSettings().geminiApiKey,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error analizando negocio con Gemini');
  }

  const now = new Date().toISOString();

  const audit: WebAudit = {
    analyzedAt: now,
    pageSpeedScores: pageSpeedScores || undefined,
    screenshotBase64: null,
    summary: data.summary || 'Negocio local.',
    checklist: data.checklist || {
      https: false,
      mobileResponsive: false,
      whatsappButton: false,
      onlineBooking: false,
      contactForm: false,
      outdatedSignals: [],
    },
    emails: data.emails || [],
    socialLinks: data.socialLinks || [],
    painPoints: data.painPoints || [],
    recommendedService: data.recommendedService || 'web_redesign',
    recommendationReason: data.recommendationReason || 'Mejorar captación digital.',
  };

  const drafts: OutreachDrafts = {
    callScript30s: data.outreachDrafts?.callScript30s || '',
    whatsappMessage: data.outreachDrafts?.whatsappMessage || '',
    emailMessage: data.outreachDrafts?.emailMessage || '',
    generatedAt: now,
    tone: sellerProfile.preferredTone,
  };

  return { audit, drafts };
};

/**
 * Regenerates outreach drafts with a specific tone
 */
export const regenerateDraftsWithTone = async (
  business: BusinessItem,
  audit: WebAudit,
  sellerProfile: SellerProfile,
  tone: OutreachTone
): Promise<OutreachDrafts> => {
  const response = await apiFetch('/api/gemini/regenerate-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: business.name,
      summary: audit.summary,
      painPoints: audit.painPoints,
      recommendedService: audit.recommendedService,
      sellerProfile,
      tone,
      geminiApiKey: getSettings().geminiApiKey,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error regenerando borradores con Gemini');
  }

  return {
    callScript30s: data.callScript30s || '',
    whatsappMessage: data.whatsappMessage || '',
    emailMessage: data.emailMessage || '',
    generatedAt: new Date().toISOString(),
    tone,
  };
};

/**
 * Recommends best niches in a zone based on collected stats
 */
export const analyzeNichesWithGemini = async (
  zone: string,
  categoriesStats: NicheCategoryStat[],
  sellerProfile: SellerProfile
): Promise<NicheAnalysisResult> => {
  const response = await apiFetch('/api/gemini/recommend-niches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zone,
      categoriesStats,
      sellerProfile,
      geminiApiKey: getSettings().geminiApiKey,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error recomendando nichos con Gemini');
  }

  return {
    zone,
    top3Categories: data.top3Categories || [],
    executiveSummary: data.executiveSummary || '',
    analyzedAt: new Date().toISOString(),
  };
};

/**
 * Normalizes phone numbers to standard WhatsApp format (E.164 without plus).
 * Handles Argentine mobile conventions (54 + 9 + area code without leading 0/15)
 * and international prefixes.
 */
export const formatPhoneForWhatsApp = (phone?: string, internationalPhone?: string): string => {
  const raw = (internationalPhone || phone || '').trim();
  if (!raw) return '';

  let cleaned = raw.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Argentina country code is 54
  // WhatsApp requires: 54 + 9 + <area code without 0> + <number without 15>
  if (cleaned.startsWith('54')) {
    if (!cleaned.startsWith('549')) {
      cleaned = '549' + cleaned.substring(2);
    }
    if (cleaned.startsWith('5491115')) {
      cleaned = '54911' + cleaned.substring(7);
    }
  } else if (cleaned.startsWith('0')) {
    let withoutZero = cleaned.replace(/^0+/, '');
    if (withoutZero.startsWith('1115')) {
      withoutZero = '11' + withoutZero.substring(4);
    }
    cleaned = '549' + withoutZero;
  } else if (cleaned.length === 10 && cleaned.startsWith('11')) {
    cleaned = '549' + cleaned;
  }

  return cleaned;
};

