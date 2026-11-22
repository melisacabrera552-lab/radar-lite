import React, { useState, useEffect } from 'react';
import {
  Phone,
  Globe,
  MapPin,
  ExternalLink,
  Star,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Printer,
  Calendar,
  Save,
  Loader2,
  AlertTriangle,
  Mail,
  ShieldCheck,
  Smartphone,
  MessageCircle,
  Clock,
  Sparkles,
  ArrowLeft,
  Send,
  AlertCircle,
} from 'lucide-react';
import { BusinessItem, LeadStatus, OutreachTone, RegionalDialect, UserSettings, WebAudit } from '../types';
import { OpportunityScoreBadge } from './OpportunityScoreBadge';
import { runPageSpeedAudit, analyzeBusiness, regenerateDraftsWithTone, formatPhoneForWhatsApp } from '../services/api';
import { saveLead } from '../services/storage';
import { calculateDetailedScore } from '../services/opportunityScorer';

interface Props {
  business: BusinessItem;
  settings: UserSettings;
  onUpdateBusiness: (updated: BusinessItem) => void;
  onClose: () => void;
  onOpenPrintView: () => void;
}

export const BusinessDetailModal: React.FC<Props> = ({
  business,
  settings,
  onUpdateBusiness,
  onClose,
  onOpenPrintView,
}) => {
  const [currentBusiness, setCurrentBusiness] = useState<BusinessItem>(business);

  // Commercial lead state
  const [status, setStatus] = useState<LeadStatus>(business.status || 'nuevo');
  const [email, setEmail] = useState(business.email || business.webAudit?.emails?.[0] || '');
  const [notes, setNotes] = useState(business.notes || '');
  const [nextActionDate, setNextActionDate] = useState(business.nextActionDate || '');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisTimer, setAnalysisTimer] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Outreach Drafts
  const [activeDraftTab, setActiveDraftTab] = useState<'whatsapp' | 'call' | 'email'>('whatsapp');
  const [selectedTone, setSelectedTone] = useState<OutreachTone>(
    settings.sellerProfile.preferredTone || 'consultivo'
  );
  const [selectedDialect, setSelectedDialect] = useState<RegionalDialect>(
    settings.sellerProfile.dialect || 'argentina'
  );
  const [isRegeneratingDrafts, setIsRegeneratingDrafts] = useState(false);
  const [copiedDraftKey, setCopiedDraftKey] = useState<string | null>(null);

  useEffect(() => {
    setCurrentBusiness(business);
    setStatus(business.status || 'nuevo');
    setEmail(business.email || business.webAudit?.emails?.[0] || '');
    setNotes(business.notes || '');
    setNextActionDate(business.nextActionDate || '');
  }, [business]);

  // Live timer while analyzing
  useEffect(() => {
    let interval: any = null;
    if (isAnalyzing) {
      setAnalysisTimer(0);
      interval = setInterval(() => {
        setAnalysisTimer((t) => t + 1);
      }, 1000);
    } else {
      setAnalysisTimer(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Run full analysis
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      let pageSpeedResult: {
        scores: {
          performance: number | null;
          seo: number | null;
          accessibility: number | null;
          bestPractices: number | null;
        };
        screenshot: string | null;
      } | null = null;

      // 1. If business has own website, run PageSpeed Insights v5
      if (currentBusiness.hasWebsite && currentBusiness.websiteUri) {
        try {
          pageSpeedResult = await runPageSpeedAudit(
            currentBusiness.websiteUri,
            settings.googleCloudApiKey
          );
        } catch (psiErr) {
          console.warn('PageSpeed execution error (proceeding with Gemini):', psiErr);
        }
      }

      // 2. Run Gemini 3.8 Flash business & website diagnostic
      const geminiAnalysis = await analyzeBusiness(
        currentBusiness,
        settings.sellerProfile,
        pageSpeedResult?.scores
      );

      // 3. Assemble complete WebAudit object
      const completeAudit: WebAudit = {
        ...geminiAnalysis.audit,
        screenshotBase64: pageSpeedResult?.screenshot || geminiAnalysis.audit.screenshotBase64 || undefined,
      };

      // 4. Recalculate Detailed Opportunity Score
      const provisional = {
        score: currentBusiness.detailedOpportunityScore || currentBusiness.provisionalOpportunityScore,
        breakdown: currentBusiness.opportunityBreakdown || [],
      };
      const detailedScoreResult = calculateDetailedScore(provisional, completeAudit);

      const detectedEmail = completeAudit.emails && completeAudit.emails.length > 0 ? completeAudit.emails[0] : undefined;
      if (detectedEmail && !email) {
        setEmail(detectedEmail);
      }

      const updatedBusiness: BusinessItem = {
        ...currentBusiness,
        email: email.trim() || detectedEmail || currentBusiness.email,
        webAudit: completeAudit,
        outreachDrafts: geminiAnalysis.drafts,
        detailedOpportunityScore: detailedScoreResult.score,
        opportunityBreakdown: detailedScoreResult.breakdown,
        status: currentBusiness.status === 'nuevo' ? 'analizado' : currentBusiness.status,
      };

      setCurrentBusiness(updatedBusiness);
      saveLead(updatedBusiness);
      onUpdateBusiness(updatedBusiness);
    } catch (err: unknown) {
      console.error('Error during business web analysis:', err);
      setAnalysisError(
        err instanceof Error ? err.message : 'Error al analizar la web y el negocio con IA.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Regenerate drafts with another tone or dialect
  const handleRegenerateDrafts = async (
    tone: OutreachTone,
    dialectOverride?: RegionalDialect
  ) => {
    if (!currentBusiness.webAudit) return;
    const targetDialect = dialectOverride || selectedDialect;
    setSelectedTone(tone);
    if (dialectOverride) setSelectedDialect(dialectOverride);
    setIsRegeneratingDrafts(true);

    try {
      const effectiveProfile = {
        ...settings.sellerProfile,
        preferredTone: tone,
        dialect: targetDialect,
      };

      const newDrafts = await regenerateDraftsWithTone(
        currentBusiness,
        currentBusiness.webAudit,
        effectiveProfile,
        tone
      );

      const updatedBusiness: BusinessItem = {
        ...currentBusiness,
        outreachDrafts: newDrafts,
      };

      setCurrentBusiness(updatedBusiness);
      saveLead(updatedBusiness);
      onUpdateBusiness(updatedBusiness);
    } catch (err) {
      console.error('Error regenerating drafts:', err);
    } finally {
      setIsRegeneratingDrafts(false);
    }
  };

  // Save manual changes (Status, notes, next action, email)
  const handleSaveLeadDetails = () => {
    const updated: BusinessItem = {
      ...currentBusiness,
      status,
      email: email.trim() || undefined,
      notes,
      nextActionDate,
    };
    setCurrentBusiness(updated);
    saveLead(updated);
    onUpdateBusiness(updated);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraftKey(key);
    setTimeout(() => setCopiedDraftKey(null), 2000);
  };

  const audit = currentBusiness.webAudit;
  const drafts = currentBusiness.outreachDrafts;

  const waPhone = formatPhoneForWhatsApp(currentBusiness.phone, currentBusiness.internationalPhone);

  const getWhatsAppUrl = () => {
    if (!waPhone) return null;
    let message = currentBusiness.outreachDrafts?.whatsappMessage?.trim();
    if (!message) {
      const agencyName = settings.sellerProfile.agencyName || 'Pixiweb';
      message = `Hola ${currentBusiness.name}, ¿cómo estás? Te contacto desde ${agencyName}. Estuve revisando tu ficha en Google y me gustaría hacerte una consulta breve sobre tus canales digitales. ¿Tenés unos minutos para conversar?`;
    }
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#000000] text-white">
      {/* Top action bar */}
      <div className="px-6 py-3.5 border-b border-white/10 bg-white/[0.02] backdrop-blur-md flex items-center justify-between shrink-0 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.05] text-slate-300 hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer border border-white/10"
            title="Volver al buscador"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>{currentBusiness.name}</span>
              {currentBusiness.businessStatus === 'OPERATIONAL' && (
                <span className="text-[10px] text-[#c6ff33] font-mono px-2 py-0.5 rounded-full bg-[#c6ff33]/15 border border-[#c6ff33]/30">
                  Operativo
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="text-[#b9a0ff] font-medium">{currentBusiness.category}</span> · {currentBusiness.address}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Opportunity score */}
          <OpportunityScoreBadge
            score={
              currentBusiness.detailedOpportunityScore ||
              currentBusiness.provisionalOpportunityScore
            }
            breakdown={currentBusiness.opportunityBreakdown}
            isDetailed={!!currentBusiness.detailedOpportunityScore}
            size="md"
          />

          {/* Export / Print Button */}
          <button
            type="button"
            onClick={onOpenPrintView}
            className="px-4 py-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Printer className="w-3.5 h-3.5 text-[#b9a0ff]" />
            <span>Exportar ficha (PDF)</span>
          </button>
        </div>
      </div>

      {/* Main scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Error message */}
        {analysisError && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{analysisError}</span>
          </div>
        )}

        {/* 1. CONTACT & BASIC INFO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Phone card */}
          <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md flex items-center justify-between shadow-lg">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold">Teléfono de contacto</div>
              <div className="text-sm font-bold font-mono text-white mt-1">
                {currentBusiness.phone || 'No disponible'}
              </div>
            </div>
            {waPhone ? (
              <a
                href={getWhatsAppUrl()!}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-full bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 hover:bg-[#25D366]/30 hover:border-[#25D366]/60 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm group"
                title="Abrir chat de WhatsApp con mensaje precargado"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-[#25D366]/20 group-hover:scale-110 transition-transform" />
                <span>WhatsApp</span>
              </a>
            ) : currentBusiness.phone ? (
              <a
                href={`tel:${currentBusiness.phone}`}
                className="px-3 py-1.5 rounded-full bg-white/10 text-slate-300 border border-white/20 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Llamar</span>
              </a>
            ) : null}
          </div>

          {/* Website Card */}
          <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md flex items-center justify-between shadow-lg">
            <div className="min-w-0 pr-2">
              <div className="text-[11px] text-slate-400 font-semibold">Presencia web</div>
              <div className="text-sm font-bold text-white mt-1 truncate">
                {currentBusiness.websiteUri ? (
                  currentBusiness.isSocialOrDirectoryWebsite ? (
                    <span className="text-amber-300 text-xs font-medium bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      Red social / Directorio
                    </span>
                  ) : (
                    <span className="text-[#b9a0ff] text-xs truncate font-mono">
                      {currentBusiness.websiteUri.replace(/^https?:\/\//, '')}
                    </span>
                  )
                ) : (
                  <span className="text-rose-300 text-xs font-bold bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                    Sin página web
                  </span>
                )}
              </div>
            </div>
            {currentBusiness.websiteUri ? (
              <a
                href={currentBusiness.websiteUri}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full bg-[#7d39eb]/20 text-[#b9a0ff] border border-[#7d39eb]/40 hover:bg-[#7d39eb]/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Abrir web</span>
              </a>
            ) : null}
          </div>

          {/* Google Maps Card */}
          <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md flex items-center justify-between shadow-lg">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold">Google Maps</div>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                {currentBusiness.rating != null ? (
                  <>
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="font-mono">{currentBusiness.rating}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      ({currentBusiness.userRatingCount || 0} reseñas)
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 text-xs">Sin reseñas</span>
                )}
              </div>
            </div>
            {currentBusiness.googleMapsUri ? (
              <a
                href={currentBusiness.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.12] text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0"
              >
                <MapPin className="w-3.5 h-3.5 text-[#c6ff33]" />
                <span>Ver en Maps</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* 2. AUDITORÍA WEB Y ANÁLISIS DIGITAL */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 space-y-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#c6ff33]" />
                <span>Auditoría de Presencia Web y Diagnóstico IA</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {currentBusiness.hasWebsite
                  ? 'Medición de velocidad móvil con PageSpeed Insights v5 y análisis de oportunidades con Gemini.'
                  : 'Negocio sin página web propia. Análisis enfocado en captación mediante web y WhatsApp.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="px-5 py-2.5 rounded-full text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-xl"
              style={{
                background: '#7d39eb',
                boxShadow: '0 4px 18px -2px rgba(125, 57, 235, 0.5)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#5a4be0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#7d39eb')}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analizando ({analysisTimer}s)...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{audit ? 'Reanalizar negocio' : 'Analizar web y negocio'}</span>
                </>
              )}
            </button>
          </div>

          {/* Notice while analyzing */}
          {isAnalyzing && (
            <div className="p-4 rounded-2xl bg-[#7d39eb]/15 border border-[#7d39eb]/40 text-xs text-white flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#c6ff33]" />
              <span>
                Auditoría en curso: consultando PageSpeed Insights móvil y analizando contenidos con Gemini... (Suele tardar entre 10 y 25 segundos)
              </span>
            </div>
          )}

          {/* No website banner */}
          {!currentBusiness.hasWebsite && !audit && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block mb-0.5 text-white">Oportunidad Directa: Sin Web Propia</strong>
                <p className="text-amber-300/90 leading-relaxed">
                  Este negocio no cuenta con página web registrada o utiliza un perfil genérico en redes sociales. Pulsa «Analizar web y negocio» para generar los argumentos de venta y borradores de contacto centrados en la creación de su primera web y canal de WhatsApp.
                </p>
              </div>
            </div>
          )}

          {/* Audit Results Populated */}
          {audit && (
            <div className="space-y-5">
              {/* Summary in 2 sentences */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                <span className="text-[11px] font-bold text-[#b9a0ff] block mb-1">
                  Resumen de actividad comercial:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {audit.summary}
                </p>
              </div>

              {/* PageSpeed 4 gauges + Screenshot Grid */}
              {currentBusiness.hasWebsite && audit.pageSpeedScores && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  {/* Scores */}
                  <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Rendimiento Móvil', val: audit.pageSpeedScores.performance },
                      { label: 'SEO Móvil', val: audit.pageSpeedScores.seo },
                      { label: 'Accesibilidad', val: audit.pageSpeedScores.accessibility },
                      { label: 'Buenas Prácticas', val: audit.pageSpeedScores.bestPractices },
                    ].map((item, idx) => {
                      const v = item.val ?? 0;
                      const color =
                        v >= 90
                          ? 'text-[#c6ff33] border-emerald-500/30 bg-emerald-950/20'
                          : v >= 50
                          ? 'text-amber-400 border-amber-500/30 bg-amber-950/20'
                          : 'text-rose-400 border-rose-500/30 bg-rose-950/20';

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border text-center ${color}`}
                        >
                          <div className="text-[11px] text-slate-400 font-medium truncate mb-1">
                            {item.label}
                          </div>
                          <div className="text-2xl font-extrabold font-mono tabular-nums">
                            {item.val != null ? item.val : '-'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {v < 50 ? 'Crítico' : v < 90 ? 'Mejorable' : 'Óptimo'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Screenshot thumbnail */}
                  <div className="p-3 rounded-2xl border border-white/10 bg-black/40 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-400 font-medium mb-1.5">
                      Captura móvil auditada:
                    </span>
                    {audit.screenshotBase64 ? (
                      <img
                        src={audit.screenshotBase64}
                        alt={`Captura web ${currentBusiness.name}`}
                        className="max-h-28 rounded-xl object-cover border border-white/10 shadow-md"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-24 w-full bg-white/[0.04] rounded-xl flex items-center justify-center text-[10px] text-slate-500">
                        Sin captura disponible
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Technical Checklist Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {[
                  { label: 'Certificado HTTPS', ok: audit.checklist.https, icon: ShieldCheck },
                  { label: 'Adaptada a móvil', ok: audit.checklist.mobileResponsive, icon: Smartphone },
                  { label: 'Botón WhatsApp', ok: audit.checklist.whatsappButton, icon: MessageCircle },
                  { label: 'Citas / Reservas online', ok: audit.checklist.onlineBooking, icon: Clock },
                  { label: 'Formulario contacto', ok: audit.checklist.contactForm, icon: Mail },
                  {
                    label: 'Señales web antigua',
                    ok: audit.checklist.outdatedSignals.length === 0,
                    icon: AlertTriangle,
                    invert: true,
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  const isGood = item.invert ? !item.ok : item.ok;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-white/10 bg-black/40 text-center"
                    >
                      <Icon className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" />
                      <div className="text-[10px] text-slate-300 font-medium truncate mb-1">
                        {item.label}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                        {isGood ? (
                          <span className="text-[#c6ff33] flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Sí</span>
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-0.5">
                            <XCircle className="w-3 h-3" />
                            <span>No</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Outdated signals if any */}
              {audit.checklist.outdatedSignals.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/25 text-xs text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Señales de abandono o antigüedad: </span>
                    <span>{audit.checklist.outdatedSignals.join(', ')}</span>
                  </div>
                </div>
              )}

              {/* Pain points & Recommended Service */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 3-5 Pain points */}
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                  <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Problemas detectados (lenguaje llano):</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {audit.painPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-rose-400 font-bold">·</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended service */}
                <div className="p-4 rounded-2xl bg-[#7d39eb]/15 border border-[#7d39eb]/40 space-y-2">
                  <div className="text-xs font-bold text-[#c6ff33] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Qué servicio ofrecerle y por qué:</span>
                  </div>
                  <div className="text-sm font-extrabold text-white">
                    {audit.recommendedService === 'web_redesign'
                      ? 'Nueva Página Web de Alta Conversión'
                      : audit.recommendedService === 'whatsapp_ai_agent'
                      ? 'Agente de IA para WhatsApp 24/7'
                      : 'Sistema de Reservas y Cita Previa Automatizada'}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {audit.recommendationReason}
                  </p>
                </div>
              </div>

              {/* Contact info found on web (emails / social) */}
              {(audit.emails.length > 0 || audit.socialLinks.length > 0) && (
                <div className="text-xs text-slate-400 flex flex-wrap gap-4 border-t border-white/10 pt-3">
                  {audit.emails.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#b9a0ff]" />
                      <span>Emails detectados: </span>
                      <strong className="text-white font-mono">{audit.emails.join(', ')}</strong>
                    </div>
                  )}
                  {audit.socialLinks.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#b9a0ff]" />
                      <span>Redes: </span>
                      <span className="text-slate-300">{audit.socialLinks.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. BORRADORES DE PRIMER CONTACTO */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 space-y-4 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#c6ff33]" />
                <span>Borradores de Primer Contacto Personalizado</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Generados con el perfil de vendedor ({settings.sellerProfile.name}) y los problemas reales de {currentBusiness.name}.
              </p>
            </div>

            {/* Tone & Dialect selector & Regenerate */}
            {audit && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Estilo:</span>
                  <select
                    value={selectedDialect}
                    onChange={(e) => handleRegenerateDrafts(selectedTone, e.target.value as RegionalDialect)}
                    disabled={isRegeneratingDrafts}
                    className="bg-black/60 border border-white/15 rounded-xl px-2 py-1 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
                  >
                    <option value="argentina">🇦🇷 Voseo Arg.</option>
                    <option value="latam">🌎 Latam Neutro</option>
                    <option value="espana">🇪🇸 España</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Tono:</span>
                  <select
                    value={selectedTone}
                    onChange={(e) => handleRegenerateDrafts(e.target.value as OutreachTone)}
                    disabled={isRegeneratingDrafts}
                    className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
                  >
                    <option value="consultivo">Consultivo</option>
                    <option value="directo">Directo</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                {isRegeneratingDrafts && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c6ff33]" />
                )}
              </div>
            )}
          </div>

          {/* Mandatory Legal Warning */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-[11px] text-slate-400 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-white">Aviso legal:</strong> Borradores para contactar de forma personal. No envíes mensajes comerciales masivos sin consentimiento.
            </span>
          </div>

          {/* Drafts Tabs */}
          {drafts ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 border-b border-white/10">
                {[
                  { id: 'whatsapp' as const, label: 'Mensaje de WhatsApp' },
                  { id: 'call' as const, label: 'Guion de llamada (30s)' },
                  { id: 'email' as const, label: 'Correo electrónico' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDraftTab(tab.id)}
                    className={`pb-2.5 text-xs font-bold cursor-pointer border-b-2 transition-all ${
                      activeDraftTab === tab.id
                        ? 'border-[#7d39eb] text-white shadow-sm'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="relative">
                {activeDraftTab === 'whatsapp' && (
                  <div className="p-5 rounded-2xl bg-black/50 border border-white/10 text-xs text-slate-100 whitespace-pre-wrap leading-relaxed font-sans shadow-inner">
                    {drafts.whatsappMessage}
                  </div>
                )}

                {activeDraftTab === 'call' && (
                  <div className="p-5 rounded-2xl bg-black/50 border border-white/10 text-xs text-slate-100 whitespace-pre-wrap leading-relaxed font-sans shadow-inner">
                    {drafts.callScript30s}
                  </div>
                )}

                {activeDraftTab === 'email' && (
                  <div className="p-5 rounded-2xl bg-black/50 border border-white/10 text-xs text-slate-100 whitespace-pre-wrap leading-relaxed font-sans shadow-inner">
                    {drafts.emailMessage}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-3 flex justify-end gap-2.5">
                  {activeDraftTab === 'whatsapp' && waPhone && (
                    <a
                      href={getWhatsAppUrl()!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-full bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md group"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-[#25D366]/20 group-hover:scale-110 transition-transform" />
                      <span>Abrir en WhatsApp</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const text =
                        activeDraftTab === 'whatsapp'
                          ? drafts.whatsappMessage
                          : activeDraftTab === 'call'
                          ? drafts.callScript30s
                          : drafts.emailMessage;
                      handleCopyText(text, activeDraftTab);
                    }}
                    className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-[#7d39eb] text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all border border-white/10 shadow-md"
                  >
                    {copiedDraftKey === activeDraftTab ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#c6ff33]" />
                        <span className="text-[#c6ff33]">¡Copiado al portapapeles!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#b9a0ff]" />
                        <span>Copiar borrador</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl bg-black/30">
              Pulsa «Analizar web y negocio» para redactar los borradores personalizados según los problemas detectados.
            </div>
          )}
        </div>

        {/* 4. GESTIÓN COMERCIAL Y SEGUIMIENTO DEL LEAD */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#c6ff33]" />
              <span>Seguimiento y Estado en «Mis Leads»</span>
            </h3>
            {isSavedNotice && (
              <span className="text-xs text-[#c6ff33] flex items-center gap-1 font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Guardado correctamente</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status, Real Email & Next Action Date */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Estado en el pipeline de ventas
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
                >
                  <option value="nuevo">Nuevo</option>
                  <option value="analizado">Analizado</option>
                  <option value="contactado">Contactado</option>
                  <option value="respondio">Respondió</option>
                  <option value="reunion">Reunión fijada</option>
                  <option value="cliente">Cliente cerrado</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#b9a0ff]" />
                    Correo electrónico real
                  </span>
                  {email ? (
                    <span className="text-[10px] text-emerald-400 font-mono">Listo para contactar</span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-normal">Opcional (podes usar solo teléfono)</span>
                  )}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej: contacto@clinica.com"
                  className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#7d39eb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Fecha de la próxima acción
                </label>
                <input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
                />
              </div>
            </div>

            {/* Internal Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Notas internas del vendedor
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Ej: He hablado con recepción. Quedamos en llamarla el martes a las 11:00..."
                className="w-full bg-black/60 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#7d39eb]"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10 mt-2">
            <button
              type="button"
              onClick={handleSaveLeadDetails}
              className="px-5 py-2.5 rounded-full text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-xl"
              style={{ background: '#7d39eb' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#5a4be0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#7d39eb')}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar en mis leads</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
