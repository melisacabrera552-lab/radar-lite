import React from 'react';
import { BusinessItem, UserSettings } from '../types';
import { Printer, ArrowLeft, Check, X, Star } from 'lucide-react';
import { PixiwebLogo } from './PixiwebLogo';

interface Props {
  business: BusinessItem;
  settings: UserSettings;
  onClose: () => void;
}

export const PrintableDossier: React.FC<Props> = ({
  business,
  settings,
  onClose,
}) => {
  const audit = business.webAudit;
  const drafts = business.outreachDrafts;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] overflow-y-auto print:bg-white print:text-black">
      {/* Floating control header (hidden on print) */}
      <div className="sticky top-0 z-10 bg-[#0a0718] border-b border-white/10 p-4 flex items-center justify-between no-print shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-white/10 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a la ficha</span>
        </button>

        <div className="text-xs text-slate-400">
          Vista previa de impresión para <strong className="text-white">{business.name}</strong>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="px-5 py-2 rounded-full text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg transition-all"
          style={{ background: '#7d39eb' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#5a4be0')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#7d39eb')}
        >
          <Printer className="w-4 h-4 text-[#c6ff33]" />
          <span>Imprimir / Guardar como PDF</span>
        </button>
      </div>

      {/* Printable Sheet (A4 styling) */}
      <div className="max-w-4xl mx-auto my-6 p-8 bg-white text-slate-900 rounded-2xl shadow-2xl print:shadow-none print:m-0 print:p-6 print:max-w-none">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
          <div>
            <div className="mb-2">
              <PixiwebLogo tone="light" size="sm" showSubtitle={false} />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7d39eb]">
              Dossier de Oportunidad y Prospección Digital
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
              {business.name}
            </h1>
            <div className="text-xs text-slate-600 mt-0.5">
              {business.category} · {business.address}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-slate-900">
              {settings.sellerProfile.agencyName || 'Tu Agencia Digital'}
            </div>
            <div className="text-[11px] text-slate-600">
              Consultor: {settings.sellerProfile.name || 'Consultor Digital'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              Fecha: {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>

        {/* Opportunity Score & Basic Contact */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              Puntuación de Oportunidad
            </div>
            <div className="text-3xl font-black font-mono mt-1 text-slate-900">
              {business.detailedOpportunityScore || business.provisionalOpportunityScore}
              <span className="text-sm font-normal text-slate-500"> / 100</span>
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              {business.detailedOpportunityScore ? 'Auditada con PageSpeed & IA' : 'Provisional (Google Places)'}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              Datos de Contacto
            </div>
            <div className="text-xs font-semibold text-slate-900 mt-1 font-mono">
              Tel: {business.phone || 'No registrado'}
            </div>
            <div className="text-xs text-slate-700 truncate mt-0.5">
              Web: {business.websiteUri || 'Sin página web'}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">
              Google Maps
            </div>
            <div className="text-xs font-semibold text-slate-900 mt-1 flex items-center gap-1">
              {business.rating != null ? (
                <>
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="font-mono">{business.rating}</span>
                  <span className="text-slate-500 font-mono">
                    ({business.userRatingCount || 0} reseñas)
                  </span>
                </>
              ) : (
                'Sin reseñas'
              )}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Estado: {business.businessStatus === 'OPERATIONAL' ? 'Operativo' : 'Cerrado/Inactivo'}
            </div>
          </div>
        </div>

        {/* Breakdown of score */}
        {business.opportunityBreakdown?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
              Desglose de Factores de Oportunidad
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {business.opportunityBreakdown.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-700">{item.label}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {item.points > 0 ? `+${item.points}` : item.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Web Audit & Diagnosis */}
        {audit ? (
          <div className="space-y-5 mb-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
                Diagnóstico del Negocio y Actividad
              </h2>
              <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
                {audit.summary}
              </p>
            </div>

            {/* PageSpeed Scores if exists */}
            {audit.pageSpeedScores && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
                  Auditoría Google PageSpeed Insights (Móvil)
                </h2>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    { label: 'Rendimiento', val: audit.pageSpeedScores.performance },
                    { label: 'SEO', val: audit.pageSpeedScores.seo },
                    { label: 'Accesibilidad', val: audit.pageSpeedScores.accessibility },
                    { label: 'Buenas Prácticas', val: audit.pageSpeedScores.bestPractices },
                  ].map((p, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold">{p.label}</div>
                      <div className="text-xl font-bold font-mono text-slate-900">{p.val ?? '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
                Comprobación de Canales Digitales
              </h2>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'Certificado HTTPS', ok: audit.checklist.https },
                  { label: 'Adaptada a móviles', ok: audit.checklist.mobileResponsive },
                  { label: 'Botón de WhatsApp', ok: audit.checklist.whatsappButton },
                  { label: 'Citas / Reservas online', ok: audit.checklist.onlineBooking },
                  { label: 'Formulario de contacto', ok: audit.checklist.contactForm },
                  {
                    label: 'Web actualizada',
                    ok: audit.checklist.outdatedSignals.length === 0,
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-700 text-[11px]">{item.label}</span>
                    {item.ok ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" /> Sí
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold flex items-center gap-0.5">
                        <X className="w-3.5 h-3.5" /> No
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Problems and Recommended service */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold text-slate-900 mb-2">
                  Problemas Detectados para el Propietario:
                </div>
                <ul className="text-xs space-y-1.5 text-slate-700">
                  {audit.painPoints.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded bg-blue-50 border border-blue-200 text-xs">
                <div className="text-xs font-bold text-blue-950 mb-1">
                  Propuesta Comercial Recomendada:
                </div>
                <div className="font-bold text-blue-900 text-sm mb-1">
                  {audit.recommendedService === 'web_redesign'
                    ? 'Nueva Web Profesional de Alta Velocidad'
                    : audit.recommendedService === 'whatsapp_ai_agent'
                    ? 'Agente de IA para WhatsApp 24/7'
                    : 'Sistema de Citas y Reservas Online'}
                </div>
                <p className="text-blue-800 leading-relaxed">
                  {audit.recommendationReason}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 mb-6 bg-slate-50 border border-slate-200 text-xs text-slate-600 rounded">
            Pendiente de auditoría completa de PageSpeed y análisis Gemini.
          </div>
        )}

        {/* Outreach Drafts */}
        {drafts && (
          <div className="space-y-4 mb-6 page-break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
              Borradores de Contacto Personalizado ({drafts.tone})
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-800 uppercase mb-1">
                  1. Guion de Llamada Telefónica (30 segundos)
                </div>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-sans">
                  {drafts.callScript30s}
                </p>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-800 uppercase mb-1">
                  2. Mensaje de WhatsApp
                </div>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-sans">
                  {drafts.whatsappMessage}
                </p>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-800 uppercase mb-1">
                  3. Correo Electrónico
                </div>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-sans">
                  {drafts.emailMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Commercial Notes / Next Steps */}
        {(business.notes || business.nextActionDate) && (
          <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs mb-4">
            <h2 className="text-xs font-bold uppercase text-slate-700 mb-1">
              Seguimiento Interno
            </h2>
            {business.nextActionDate && (
              <div className="mb-1 text-slate-600">
                Próxima acción:{' '}
                <strong className="text-slate-900 font-mono">{business.nextActionDate}</strong>
              </div>
            )}
            {business.notes && (
              <p className="text-slate-700 italic">«{business.notes}»</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">
          Generado con Radar de Clientes · Borrador de uso exclusivo interno para prospección comercial personal.
        </div>
      </div>
    </div>
  );
};
