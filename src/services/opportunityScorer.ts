import { BusinessItem, OpportunityBreakdownItem, WebAudit } from '../types';

/**
 * Checks if a URL points to social media or directory rather than an own website
 */
export const isSocialOrDirectoryUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  const domains = [
    'facebook.com',
    'fb.me',
    'fb.com',
    'instagram.com',
    'instagr.am',
    'linktr.ee',
    'linktree',
    'tiktok.com',
    'twitter.com',
    'x.com',
    'paginasamarillas.es',
    'qdq.com',
    'directorio',
    'milanuncios.com',
    'wallapop.com',
    'habitissimo.es',
    'doctoralia.es',
    'linkedin.com',
    'youtube.com',
    'google.com',
    'goo.gl',
    'maps.google',
    'wa.me',
    'whatsapp.com',
  ];
  return domains.some((domain) => lower.includes(domain));
};

/**
 * Calculates provisional opportunity score (0 to 100) using Places API data
 */
export const calculateProvisionalScore = (
  business: Pick<
    BusinessItem,
    'websiteUri' | 'isSocialOrDirectoryWebsite' | 'phone' | 'rating' | 'userRatingCount' | 'businessStatus'
  >
): { score: number; breakdown: OpportunityBreakdownItem[] } => {
  let score = 0;
  const breakdown: OpportunityBreakdownItem[] = [];

  // 1. Web presence
  if (!business.websiteUri) {
    score += 45;
    breakdown.push({ label: 'Sin página web registrada (+45)', points: 45 });
  } else if (business.isSocialOrDirectoryWebsite) {
    score += 35;
    breakdown.push({ label: 'Web es perfil en red social o directorio (+35)', points: 35 });
  } else {
    score += 10;
    breakdown.push({ label: 'Tiene página web propia (+10 base)', points: 10 });
  }

  // 2. Active business / reputation (Customers exist and rate it)
  const rating = business.rating || 0;
  const reviews = business.userRatingCount || 0;

  if (reviews >= 50 && rating >= 4.0) {
    score += 25;
    breakdown.push({ label: 'Muy activo: >50 reseñas y nota >4.0 (+25)', points: 25 });
  } else if (reviews >= 20 && rating >= 3.8) {
    score += 20;
    breakdown.push({ label: 'Activo con clientela: 20-50 reseñas (+20)', points: 20 });
  } else if (reviews >= 5) {
    score += 15;
    breakdown.push({ label: 'Demanda verificada: al menos 5 reseñas (+15)', points: 15 });
  } else {
    score += 5;
    breakdown.push({ label: 'Pocas reseñas registradas (+5)', points: 5 });
  }

  // 3. Contactability (Direct phone ready for outreach)
  if (business.phone) {
    score += 15;
    breakdown.push({ label: 'Teléfono directo verificado para llamar (+15)', points: 15 });
  } else {
    breakdown.push({ label: 'Sin teléfono público directo (0)', points: 0 });
  }

  // 4. Status
  if (business.businessStatus === 'OPERATIONAL' || !business.businessStatus) {
    score += 10;
    breakdown.push({ label: 'Negocio operativo y abierto (+10)', points: 10 });
  } else if (business.businessStatus === 'CLOSED_PERMANENTLY') {
    score -= 60;
    breakdown.push({ label: 'Negocio cerrado permanentemente (-60)', points: -60 });
  } else if (business.businessStatus === 'CLOSED_TEMPORARILY') {
    score -= 30;
    breakdown.push({ label: 'Cerrado temporalmente (-30)', points: -30 });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return { score: finalScore, breakdown };
};

/**
 * Calculates refined opportunity score (0 to 100) after PageSpeed & Gemini Web Audit
 */
export const calculateDetailedScore = (
  provisional: { score: number; breakdown: OpportunityBreakdownItem[] },
  audit?: WebAudit
): { score: number; breakdown: OpportunityBreakdownItem[] } => {
  if (!audit) return provisional;

  let score = provisional.score;
  const breakdown = [...provisional.breakdown];

  // If the business has no web, it already scored very high
  if (audit.summary && audit.summary.toLowerCase().includes('sin página web')) {
    score = Math.max(88, score);
    breakdown.push({ label: 'Confirmado sin web propia (+10)', points: 10 });
    return { score: Math.min(100, score), breakdown };
  }

  // Performance Mobile
  const perf = audit.pageSpeedScores?.performance;
  if (perf != null) {
    if (perf < 45) {
      score += 20;
      breakdown.push({ label: `Velocidad móvil crítica (${perf}/100) (+20)`, points: 20 });
    } else if (perf < 75) {
      score += 10;
      breakdown.push({ label: `Velocidad móvil mejorable (${perf}/100) (+10)`, points: 10 });
    } else if (perf >= 90) {
      score -= 20;
      breakdown.push({ label: `Web móvil muy rápida (${perf}/100) (-20)`, points: -20 });
    }
  }

  // Missing modern channels
  if (audit.checklist) {
    if (!audit.checklist.whatsappButton) {
      score += 15;
      breakdown.push({ label: 'Falta canal de WhatsApp directo (+15)', points: 15 });
    }
    if (!audit.checklist.onlineBooking) {
      score += 15;
      breakdown.push({ label: 'Falta sistema de cita previa o reserva online (+15)', points: 15 });
    }
    if (!audit.checklist.mobileResponsive) {
      score += 20;
      breakdown.push({ label: 'No adaptada a pantallas móviles (+20)', points: 20 });
    }
    if (!audit.checklist.https) {
      score += 15;
      breakdown.push({ label: 'Sin certificado de seguridad HTTPS (+15)', points: 15 });
    }
    if (audit.checklist.outdatedSignals?.length > 0) {
      score += 10;
      breakdown.push({
        label: `Web desactualizada: ${audit.checklist.outdatedSignals[0]} (+10)`,
        points: 10,
      });
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return { score: finalScore, breakdown };
};
