import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  User,
  Flame,
  Save,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Shield,
  HelpCircle,
  Lock,
  LogOut,
  Sparkles,
  Send,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { UserSettings, OutreachTone, RegionalDialect } from '../types';
import { saveSettings } from '../services/storage';
import { validatePlacesApiKey, validateGeminiApiKey, fetchServerConfig } from '../services/api';

interface Props {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
}

export const SettingsScreen: React.FC<Props> = ({
  settings,
  onUpdateSettings,
}) => {
  // Gemini AI Key
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasServerGeminiKey, setHasServerGeminiKey] = useState(false);

  // Google Cloud Places API
  const [apiKey, setApiKey] = useState(settings.googleCloudApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Seller profile
  const [name, setName] = useState(settings.sellerProfile.name || 'Tu Nombre');
  const [agencyName, setAgencyName] = useState(settings.sellerProfile.agencyName || 'Tu Agencia Digital');
  const [servicesOffered, setServicesOffered] = useState(
    settings.sellerProfile.servicesOffered ||
      'Páginas web modernas, agentes inteligentes de IA por WhatsApp y sistemas automatizados de reservas y citas'
  );
  const [valueProposition, setValueProposition] = useState(
    settings.sellerProfile.valueProposition ||
      'Ayudo a negocios locales a digitalizarse, captar más clientes en piloto automático y no perder llamadas ni reservas gracias a la IA.'
  );
  const [preferredTone, setPreferredTone] = useState<OutreachTone>(
    settings.sellerProfile.preferredTone || 'consultivo'
  );
  const [dialect, setDialect] = useState<RegionalDialect>(
    settings.sellerProfile.dialect || 'argentina'
  );
  const [senderPhone, setSenderPhone] = useState(settings.sellerProfile.senderPhone || '');
  const [senderEmail, setSenderEmail] = useState(settings.sellerProfile.senderEmail || '');

  // Quota
  const [monthlyLimit, setMonthlyLimit] = useState(settings.quota.monthlyLimit || 850);
  const [usedThisMonth, setUsedThisMonth] = useState(settings.quota.usedThisMonth || 0);
  const [hasServerGoogleKey, setHasServerGoogleKey] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetchServerConfig().then((cfg) => {
      if (cfg) {
        setHasServerGoogleKey(cfg.hasGoogleCloudKey);
        setHasServerGeminiKey(cfg.hasGeminiKey);
      }
    });
  }, []);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const newSettings: UserSettings = {
      ...settings,
      geminiApiKey: geminiApiKey.trim(),
      googleCloudApiKey: apiKey.trim(),
      sellerProfile: {
        name: name.trim(),
        agencyName: agencyName.trim(),
        servicesOffered: servicesOffered.trim(),
        valueProposition: valueProposition.trim(),
        preferredTone,
        dialect,
        senderPhone: senderPhone.trim(),
        senderEmail: senderEmail.trim(),
      },
      quota: {
        ...settings.quota,
        monthlyLimit: Number(monthlyLimit) || 850,
        usedThisMonth: Number(usedThisMonth) || 0,
      },
    };

    saveSettings(newSettings);
    onUpdateSettings(newSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleResetQuota = () => {
    if (window.confirm('¿Reiniciar a 0 el contador de llamadas de este mes?')) {
      setUsedThisMonth(0);
      const updated = {
        ...settings,
        quota: {
          ...settings.quota,
          usedThisMonth: 0,
        },
      };
      saveSettings(updated);
      onUpdateSettings(updated);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#000000] text-white">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/[0.02] backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#c6ff33]" />
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Ajustes del Sistema</span>
                <span className="font-serif italic text-[#b9a0ff] font-normal text-lg">Radar Lite</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configura tus propias credenciales de Google (Gemini, Places, PageSpeed), tu perfil de prospección y control de cuotas.
            </p>
          </div>

          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5 bg-emerald-950/50 border border-emerald-500/40 px-3.5 py-1.5 rounded-full shadow">
              <Check className="w-4 h-4 text-[#c6ff33]" />
              <span>Guardado en este navegador</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6">
          {/* SECTION 0: GOOGLE GEMINI AI KEY */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
              <div className="w-8 h-8 rounded-full bg-[#7d39eb]/20 border border-[#7d39eb]/40 flex items-center justify-center text-[#c6ff33]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Clave de Inteligencia Artificial (Google Gemini)</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-[#7d39eb]/20 text-[#b9a0ff] px-2 py-0.5 rounded-full border border-[#7d39eb]/40">
                    Requerida (Gratis)
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Impulsa las auditorías web, el análisis de nichos y la redacción de guiones y mensajes comerciales.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Gemini API Key (Google AI Studio)
                  </label>
                  {hasServerGeminiKey && !geminiApiKey && (
                    <span className="text-[10px] font-mono text-emerald-400">
                      ✓ Configurada en .env del servidor
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder={hasServerGeminiKey ? 'Usando clave del servidor (.env) — opcional sobreescribir aquí' : 'AIzaSy... o AQ...'}
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-3 pr-10 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-[#7d39eb] focus:ring-1 focus:ring-[#7d39eb]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    setIsTestingGemini(true);
                    setGeminiTestResult(null);
                    try {
                      const res = await validateGeminiApiKey(geminiApiKey.trim());
                      setGeminiTestResult({
                        success: res.valid,
                        message: res.message,
                      });
                    } catch (err: unknown) {
                      setGeminiTestResult({
                        success: false,
                        message: 'Error al probar clave: ' + (err instanceof Error ? err.message : String(err)),
                      });
                    } finally {
                      setIsTestingGemini(false);
                    }
                  }}
                  disabled={isTestingGemini}
                  className="px-3.5 py-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#c6ff33]" />
                  <span>{isTestingGemini ? 'Comprobando conexión...' : 'Probar clave de Gemini'}</span>
                </button>

                {geminiTestResult && (
                  <div
                    className={`text-xs p-2.5 rounded-xl border flex-1 ${
                      geminiTestResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    {geminiTestResult.message}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-[11px] text-slate-400">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-[#c6ff33] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">¿Cómo obtener tu clave gratuita? </strong>
                    Entrá a Google AI Studio con tu cuenta de Google, presioná «Create API key» y pegala aquí (o en tu archivo <code className="text-[#b9a0ff]">.env</code>).{' '}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#b9a0ff] hover:text-[#c6ff33] font-medium transition-colors"
                    >
                      <span>Abrir Google AI Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: GOOGLE CLOUD API KEY */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Clave de Google Cloud (Places API New & PageSpeed)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Almacenada de forma privada en tu navegador. Si no se introduce, el sistema opera con el motor inteligente.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Google Cloud API Key (Places API New + PageSpeed Insights API)
                  </label>
                  {hasServerGoogleKey && !apiKey.trim() && (
                    <span className="text-[10px] font-mono text-[#c6ff33] bg-[#c6ff33]/10 border border-[#c6ff33]/30 px-2 py-0.5 rounded-full">
                      Activa por variable de entorno (.env)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      hasServerGoogleKey
                        ? 'Usando GOOGLE_CLOUD_API_KEY de .env (opcional sobreescribir)...'
                        : 'AIzaSy...'
                    }
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-3 pr-10 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#7d39eb] focus:ring-1 focus:ring-[#7d39eb]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Validate Key Button & Feedback */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!apiKey.trim() && !hasServerGoogleKey) {
                      setTestResult({
                        success: false,
                        message: 'Por favor, escribe una clave o configúrala en .env para probarla.',
                      });
                      return;
                    }
                    setIsTestingKey(true);
                    setTestResult(null);
                    try {
                      const res = await validatePlacesApiKey(apiKey.trim());
                      setTestResult({
                        success: res.valid,
                        message: res.message,
                      });
                    } catch (err: unknown) {
                      setTestResult({
                        success: false,
                        message: 'Error al probar clave: ' + (err instanceof Error ? err.message : String(err)),
                      });
                    } finally {
                      setIsTestingKey(false);
                    }
                  }}
                  disabled={isTestingKey}
                  className="px-3.5 py-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                >
                  {isTestingKey ? 'Comprobando clave...' : 'Probar conexión con Places API'}
                </button>

                {testResult && (
                  <div
                    className={`text-xs p-2.5 rounded-xl border flex-1 ${
                      testResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>

              {/* Security info box */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-[11px] text-slate-400 space-y-2">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-[#c6ff33] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Almacenamiento seguro: </strong>
                    Tu clave se guarda estrictamente en el <code className="text-[#b9a0ff]">localStorage</code> de tu navegador y nunca se comparte con terceros ni se expone públicamente.
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-[#b9a0ff] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Requisitos en Google Cloud Console:</strong>
                    <ul className="list-disc list-inside mt-0.5 text-slate-300 space-y-0.5">
                      <li>Habilitar la API <strong>Places API (New)</strong> (places.googleapis.com).</li>
                      <li>Habilitar <strong>PageSpeed Insights API</strong>.</li>
                      <li>Tener facturación habilitada en el proyecto de Google Cloud.</li>
                    </ul>
                    <a
                      href="https://console.cloud.google.com/apis/library"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#b9a0ff] hover:text-[#c6ff33] mt-1 font-medium transition-colors"
                    >
                      <span>Abrir Google Cloud Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: SELLER PROFILE */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
              <div className="w-8 h-8 rounded-full bg-[#7d39eb]/20 border border-[#7d39eb]/40 flex items-center justify-center text-[#b9a0ff]">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Perfil de Vendedor (Personalización de Borradores IA)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Estos datos alimentan los guiones de llamada, mensajes de WhatsApp y correos que redacta Gemini Flash.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Tu nombre profesional
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#7d39eb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Nombre de tu agencia o marca comercial
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Mi Agencia Digital"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#7d39eb]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Servicios que vendes
                </label>
                <input
                  type="text"
                  value={servicesOffered}
                  onChange={(e) => setServicesOffered(e.target.value)}
                  placeholder="Páginas web, agentes de IA por WhatsApp, sistemas de citas..."
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#7d39eb]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Tu propuesta de valor principal
                </label>
                <textarea
                  value={valueProposition}
                  onChange={(e) => setValueProposition(e.target.value)}
                  rows={2}
                  placeholder="Ayudo a negocios locales a digitalizarse y duplicar sus citas automáticas..."
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#7d39eb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Tono preferido por defecto para los borradores
                </label>
                <select
                  value={preferredTone}
                  onChange={(e) => setPreferredTone(e.target.value as OutreachTone)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
                >
                  <option value="consultivo">Consultivo (cordial, aporta valor primero)</option>
                  <option value="directo">Directo (va al grano con números y tiempo)</option>
                  <option value="urgente">Urgente (enfocado en fugas de clientes)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Variante lingüística / Región de redacción
                </label>
                <select
                  value={dialect}
                  onChange={(e) => setDialect(e.target.value as RegionalDialect)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
                >
                  <option value="argentina">🇦🇷 Argentina (Voseo: vos tenés, avisame, tu negocio)</option>
                  <option value="latam">🌎 Latam Neutro (Tuteo: tú tienes, avísame)</option>
                  <option value="espana">🇪🇸 España (Vosotros / Tuteo peninsular)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Teléfono / WhatsApp de contacto propio
                </label>
                <input
                  type="text"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="+54 9 11 1234-5678"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-[#7d39eb]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Email de contacto propio
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="tu.email@gmail.com"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-[#7d39eb]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: PLACES API CALLS QUOTA MONITOR */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#c6ff33]/15 border border-[#c6ff33]/30 flex items-center justify-center text-[#c6ff33]">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Control de Cuota Mensual de Google Places
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Evita costes imprevistos manteniendo un control exacto de peticiones.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetQuota}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reiniciar contador</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Límite mensual protegido por software (máx. 850)
                </label>
                <input
                  type="number"
                  min="50"
                  max="850"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(Math.min(850, Number(e.target.value)))}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#7d39eb]"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Traba dura por software activa: máximo 30 llamadas/día y 850 llamadas/mes entre todo el equipo (debajo de las 1.000 gratuitas de Google Cloud). Al llegar al tope, corta Places API y usa IA gratis.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Llamadas realizadas este mes ({settings.quota.lastResetMonth})
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    value={usedThisMonth}
                    onChange={(e) => setUsedThisMonth(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#7d39eb]"
                  />
                  <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                    / {monthlyLimit}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning indicator */}
            {usedThisMonth >= 800 && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Aviso preventivo:</strong> Has alcanzado {usedThisMonth} llamadas. Estás por encima del 80% del límite de llamadas mensuales sugerido.
                </span>
              </div>
            )}
          </div>

          {/* Submit button */}
          <div className="flex justify-end pt-2 pb-6">
            <button
              type="submit"
              className="px-6 py-3 rounded-full font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xl transition-all"
              style={{
                background: '#7d39eb',
                color: '#ffffff',
                boxShadow: '0 8px 24px -4px rgba(125, 57, 235, 0.5)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#5a4be0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#7d39eb';
              }}
            >
              <Save className="w-4 h-4" />
              <span>Guardar todos los ajustes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
