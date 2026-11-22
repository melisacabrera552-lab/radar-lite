export type LeadStatus =
  | 'nuevo'
  | 'analizado'
  | 'contactado'
  | 'respondio'
  | 'reunion'
  | 'cliente'
  | 'descartado';

export type ServiceType = 'web_redesign' | 'whatsapp_ai_agent' | 'booking_system';

export type OutreachTone = 'directo' | 'consultivo' | 'urgente';

export interface OpportunityBreakdownItem {
  label: string;
  points: number;
}

export interface WebAudit {
  analyzedAt: string;
  pageSpeedScores?: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  screenshotBase64?: string | null;
  summary: string;
  checklist: {
    https: boolean;
    mobileResponsive: boolean;
    whatsappButton: boolean;
    onlineBooking: boolean;
    contactForm: boolean;
    outdatedSignals: string[];
  };
  emails: string[];
  socialLinks: string[];
  painPoints: string[];
  recommendedService: ServiceType;
  recommendationReason: string;
}

export interface OutreachDrafts {
  callScript30s: string;
  whatsappMessage: string;
  emailMessage: string;
  generatedAt: string;
  tone: OutreachTone;
}

export interface BusinessItem {
  id: string; // Google Place ID
  name: string;
  category: string;
  types: string[];
  address: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  internationalPhone?: string;
  email?: string;
  websiteUri?: string;
  isSocialOrDirectoryWebsite: boolean;
  hasWebsite: boolean;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: string;

  // Opportunity Scores
  provisionalOpportunityScore: number;
  detailedOpportunityScore?: number;
  opportunityBreakdown: OpportunityBreakdownItem[];

  // Audit and Outreach
  webAudit?: WebAudit;
  outreachDrafts?: OutreachDrafts;

  // Lead tracking
  status: LeadStatus;
  notes?: string;
  nextActionDate?: string;
  savedAt?: string;
  updatedAt?: string;
}

export type RegionalDialect = 'argentina' | 'latam' | 'espana';

export interface SellerProfile {
  name: string;
  agencyName: string;
  servicesOffered: string;
  valueProposition: string;
  preferredTone: OutreachTone;
  dialect?: RegionalDialect;
  senderPhone: string;
  senderEmail: string;
}

export interface QuotaSettings {
  monthlyLimit: number;
  usedThisMonth: number;
  lastResetMonth: string; // "YYYY-MM"
  dailyLimit?: number;
  usedToday?: number;
  lastResetDay?: string; // "YYYY-MM-DD"
}

export interface UserSettings {
  googleCloudApiKey: string;
  geminiApiKey?: string;
  sellerProfile: SellerProfile;
  quota: QuotaSettings;
}

export interface SearchFilterState {
  onlyWithoutWebsite: boolean;
  onlyWithPhone: boolean;
  minRating: number;
  minReviews: number;
  hideClosed: boolean;
  keyword: string;
}

export interface NicheCategoryStat {
  category: string;
  totalCount: number;
  withoutWebsiteCount: number;
  percentWithoutWebsite: number;
  avgRating: number;
  avgReviewCount: number;
  sampleBusinesses?: BusinessItem[];
}

export interface TopRecommendedCategory {
  category: string;
  rank: number;
  opportunityScore: number;
  recommendedService: string;
  reason: string;
}

export interface NicheAnalysisResult {
  zone: string;
  top3Categories: TopRecommendedCategory[];
  executiveSummary: string;
  analyzedAt: string;
}
