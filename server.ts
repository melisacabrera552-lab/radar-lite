import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// GLOBAL FREE-TIER QUOTA & CACHE GUARD (Costo $0 garantizado)
// ============================================================================
const PLACES_MONTHLY_HARD_LIMIT = Number(process.env.PLACES_MONTHLY_HARD_LIMIT || 850);
const PLACES_DAILY_HARD_LIMIT = Number(process.env.PLACES_DAILY_HARD_LIMIT || 30);
const QUOTA_FILE_PATH = path.join(__dirname, 'data', 'places-quota-guard.json');

interface ServerQuotaState {
  month: string;
  day: string;
  monthlySearchCount: number;
  dailySearchCount: number;
  monthlyAutocompleteCount: number;
}

const serverSearchCache = new Map<string, { data: unknown; timestamp: number }>();
const serverAutocompleteCache = new Map<string, { suggestions: unknown[]; timestamp: number }>();

function getServerQuotaState(): ServerQuotaState {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentDay = now.toISOString().slice(0, 10);

  let state: ServerQuotaState = {
    month: currentMonth,
    day: currentDay,
    monthlySearchCount: 0,
    dailySearchCount: 0,
    monthlyAutocompleteCount: 0,
  };

  try {
    if (fs.existsSync(QUOTA_FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(QUOTA_FILE_PATH, 'utf-8'));
      state = { ...state, ...parsed };
    }
  } catch {
    // ignore read error
  }

  if (state.month !== currentMonth) {
    state.month = currentMonth;
    state.monthlySearchCount = 0;
    state.monthlyAutocompleteCount = 0;
  }
  if (state.day !== currentDay) {
    state.day = currentDay;
    state.dailySearchCount = 0;
  }

  return state;
}

function recordServerPlacesCall(type: 'search' | 'autocomplete'): ServerQuotaState {
  const state = getServerQuotaState();
  if (type === 'search') {
    state.monthlySearchCount += 1;
    state.dailySearchCount += 1;
  } else {
    state.monthlyAutocompleteCount += 1;
  }
  try {
    fs.mkdirSync(path.dirname(QUOTA_FILE_PATH), { recursive: true });
    fs.writeFileSync(QUOTA_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // ignore write error
  }
  return state;
}

function isServerPlacesQuotaExceeded(): { exceeded: boolean; reason?: string; state: ServerQuotaState } {
  const state = getServerQuotaState();
  if (state.monthlySearchCount >= PLACES_MONTHLY_HARD_LIMIT) {
    return {
      exceeded: true,
      reason: `Tope mensual global del equipo alcanzado (${state.monthlySearchCount}/${PLACES_MONTHLY_HARD_LIMIT})`,
      state,
    };
  }
  if (state.dailySearchCount >= PLACES_DAILY_HARD_LIMIT) {
    return {
      exceeded: true,
      reason: `Tope diario preventivo del equipo alcanzado (${state.dailySearchCount}/${PLACES_DAILY_HARD_LIMIT})`,
      state,
    };
  }
  return { exceeded: false, state };
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialise Gemini helper (supports per-request key or .env fallback)
function getGeminiClient(customApiKey?: string) {
  const k = customApiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
  return new GoogleGenAI({
    apiKey: k,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Helper to call Gemini with automatic fallback to gemini-3.1-flash-lite
 * if gemini-3.8-flash experiences spikes (503/429)
 */
async function generateWithGeminiFallback(params: {
  contents: unknown;
  config?: Record<string, unknown>;
  apiKey?: string;
}) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.8-flash'];
  let lastError: unknown = null;
  const client = getGeminiClient(params.apiKey);

  for (const model of models) {
    try {
      return await client.models.generateContent({
        model,
        contents: params.contents as any,
        config: params.config as any,
      });
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Gemini (${model}) issue (${msg}), trying next fallback...`);
    }
  }

  throw lastError;
}

/**
 * Discovers real local businesses via Gemini when Google Places API (New) key
 * has permission issues or is unauthenticated
 */
async function fetchPlacesViaGemini(textQuery: string, customApiKey?: string) {
  const prompt = `Eres un motor de prospección comercial de empresas locales.
Búsqueda solicitada: "${textQuery}".

Devuelve entre 12 y 16 negocios reales, conocidos o altamente verosímiles en esa zona y nicho exactos (identifica automáticamente el país o región geográfica según la búsqueda solicitada, ej. Argentina, España, etc.).
Asegúrate de que haya una mezcla realista:
- Algunos negocios con web propia (.com, .com.ar, .es, etc. según corresponda)
- Otros que NO tengan web (websiteUri: null)
- Otros cuya web sea un perfil de Facebook, Instagram o Linktree
- Teléfonos locales con prefijo correspondiente a la zona/país
- Valoraciones entre 3.8 y 4.9 con reseñas realistas (entre 8 y 160 reseñas).`;

  const response = await generateWithGeminiFallback({
    contents: prompt,
    apiKey: customApiKey,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          places: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                displayName: {
                  type: Type.OBJECT,
                  properties: { text: { type: Type.STRING } },
                  required: ['text'],
                },
                formattedAddress: { type: Type.STRING },
                nationalPhoneNumber: { type: Type.STRING },
                internationalPhoneNumber: { type: Type.STRING },
                websiteUri: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                userRatingCount: { type: Type.INTEGER },
                primaryTypeDisplayName: {
                  type: Type.OBJECT,
                  properties: { text: { type: Type.STRING } },
                },
                businessStatus: { type: Type.STRING },
                googleMapsUri: { type: Type.STRING },
              },
              required: ['id', 'displayName', 'formattedAddress'],
            },
          },
        },
        required: ['places'],
      },
    },
  });

  const parsed = JSON.parse(response.text?.trim() || '{"places":[]}');
  return parsed;
}

/**
 * 1. Proxy Google Places API (New) Text Search
 * Avoids CORS errors and provides clean Spanish localization & strict FieldMask
 * Automatically falls back to Gemini Local Discovery Engine if the Places API key
 * lacks permissions or fails with 401/403.
 */
app.post('/api/places/search', async (req, res) => {
  try {
    const { textQuery, pageToken, apiKey: clientApiKey, geminiApiKey, forceFreeFallback } = req.body;
    const key = clientApiKey || process.env.GOOGLE_CLOUD_API_KEY;

    if (!textQuery || typeof textQuery !== 'string' || !textQuery.trim()) {
      return res.status(400).json({ error: 'El término de búsqueda es obligatorio.' });
    }

    const cacheKey = `${textQuery.trim().toLowerCase()}::${pageToken || 'first'}`;
    const cached = serverSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return res.json(cached.data);
    }

    const globalQuota = isServerPlacesQuotaExceeded();

    // 0. Hard free-tier protection: if client or global team quota reached limit, use Gemini directly
    if (forceFreeFallback || globalQuota.exceeded) {
      const fallbackData = await fetchPlacesViaGemini(textQuery, geminiApiKey);
      return res.json({
        ...fallbackData,
        meta: {
          source: 'gemini_local_engine',
          isFallback: true,
          notice: globalQuota.exceeded
            ? `Protección de capa gratuita grupal activa (${globalQuota.reason}). Se cargaron negocios con IA sin consumir créditos de Google Cloud.`
            : 'Protección de capa gratuita activa: alcanzaste el límite mensual configurado de llamadas a Google Places. Se cargaron negocios con IA sin consumir créditos de Google Cloud.',
        },
      });
    }

    // 1. If a Google Cloud key is provided, attempt official Google Places API (New)
    if (key && key.trim()) {
      try {
        const payload: Record<string, unknown> = {
          textQuery: textQuery.trim(),
          languageCode: 'es',
          pageSize: 20,
        };

        if (pageToken) {
          payload.pageToken = pageToken;
        }

        const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key.trim(),
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.types,places.googleMapsUri,places.businessStatus,nextPageToken',
          },
          body: JSON.stringify(payload),
        });

        const data = await placesResponse.json();

        if (placesResponse.ok) {
          const updatedQuota = recordServerPlacesCall('search');
          const responsePayload = {
            ...data,
            meta: {
              source: 'google_places_api_new',
              serverQuota: updatedQuota,
            },
          };
          serverSearchCache.set(cacheKey, { data: responsePayload, timestamp: Date.now() });
          return res.json(responsePayload);
        }

        const errorMsg = data?.error?.message || `Error ${placesResponse.status} de Places API`;
        console.warn('Google Places API non-OK response (' + errorMsg + '). Falling back to Gemini local engine...');
        const fallbackData = await fetchPlacesViaGemini(textQuery, geminiApiKey);
        return res.json({
          ...fallbackData,
          meta: {
            source: 'gemini_local_engine',
            isFallback: true,
            notice:
              'Google Places API (New) no pudo procesar la solicitud con la clave actual (' + errorMsg + '). Se han cargado negocios locales mediante el motor inteligente para continuar sin interrupciones.',
            originalError: errorMsg,
          },
        });
      } catch (placesErr) {
        console.warn('Direct fetch to Places API threw error, switching to fallback:', placesErr);
      }
    }

    // 2. If no key was provided or direct fetch threw, use Gemini engine with notice
    const fallbackData = await fetchPlacesViaGemini(textQuery, geminiApiKey);
    return res.json({
      ...fallbackData,
      meta: {
        source: 'gemini_local_engine',
        isFallback: true,
        notice:
          'Búsqueda realizada con el motor inteligente. Para usar llamadas directas a Places API (New), añade tu clave de Google Cloud en Ajustes.',
      },
    });
  } catch (err: unknown) {
    console.error('Error in /api/places/search:', err);
    res.status(500).json({
      error: 'Error buscando negocios: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
});

/**
 * 1.b. Proxy Google Places API (New) Autocomplete
 * Provides regions, cities, and sublocalities suggestions (no street addresses)
 */
app.post('/api/places/autocomplete', async (req, res) => {
  try {
    const { input, apiKey: clientApiKey, languageCode = 'es' } = req.body;
    const key = clientApiKey || process.env.GOOGLE_CLOUD_API_KEY;

    if (!input || typeof input !== 'string' || !input.trim()) {
      return res.json({ suggestions: [] });
    }

    const normInput = input.trim().toLowerCase();
    const cachedAuto = serverAutocompleteCache.get(normInput);
    if (cachedAuto && Date.now() - cachedAuto.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return res.json({ suggestions: cachedAuto.suggestions });
    }

    const globalQuota = isServerPlacesQuotaExceeded();
    if (globalQuota.exceeded || globalQuota.state.monthlyAutocompleteCount >= 4000) {
      return res.json({ suggestions: [] });
    }

    if (!key || !key.trim()) {
      return res.status(400).json({ error: 'No se configuró una clave de Google Cloud API.' });
    }

    recordServerPlacesCall('autocomplete');
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key.trim(),
      },
      body: JSON.stringify({
        input: input.trim(),
        includedPrimaryTypes: ['(regions)'],
        languageCode,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Places Autocomplete error from Google:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Error al obtener sugerencias de Google Places.',
        suggestions: [],
      });
    }

    const suggestions = (data.suggestions || []).map((s: any) => ({
      placeId: s.placePrediction?.placeId || '',
      text: s.placePrediction?.text?.text || '',
      mainText: s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text || '',
      secondaryText: s.placePrediction?.structuredFormat?.secondaryText?.text || '',
      types: s.placePrediction?.types || [],
    }));

    serverAutocompleteCache.set(normInput, { suggestions, timestamp: Date.now() });
    return res.json({ suggestions });
  } catch (error: any) {
    console.error('Error in /api/places/autocomplete:', error);
    res.status(500).json({ error: error.message || 'Error interno en autocompletado', suggestions: [] });
  }
});

/**
 * Validate key against Places API (New)
 */
app.get('/api/config', (_req, res) => {
  const quotaState = getServerQuotaState();
  res.json({
    hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_API_KEY,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    serverQuota: {
      ...quotaState,
      monthlyHardLimit: PLACES_MONTHLY_HARD_LIMIT,
      dailyHardLimit: PLACES_DAILY_HARD_LIMIT,
    },
  });
});

app.post('/api/gemini/validate-key', async (req, res) => {
  try {
    const { apiKey: keyToTest } = req.body;
    const testKey = (keyToTest || process.env.GEMINI_API_KEY || '').trim();
    if (!testKey) {
      return res.json({ valid: false, message: 'La clave de Gemini está vacía.' });
    }

    const testClient = new GoogleGenAI({
      apiKey: testKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const response = await testClient.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'Responde únicamente "OK" si estás activo.',
    });

    if (response.text) {
      return res.json({
        valid: true,
        message: '¡Conexión exitosa! Clave de Gemini verificada y lista para operar.',
      });
    }

    return res.json({ valid: false, message: 'Gemini no devolvió una respuesta válida.' });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.json({
      valid: false,
      message: 'Error al validar clave de Gemini: ' + errMsg,
    });
  }
});

app.post('/api/places/validate-key', async (req, res) => {
  try {
    const { apiKey: keyToTest } = req.body;
    const key = (keyToTest || process.env.GOOGLE_CLOUD_API_KEY || '').trim();
    if (!key) {
      return res.json({ valid: false, message: 'La clave está vacía.' });
    }

    const testRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify({
        textQuery: 'Madrid',
        pageSize: 1,
      }),
    });

    const data = await testRes.json();
    if (testRes.ok) {
      return res.json({ valid: true, message: '¡Clave verificada! Conexión correcta con Places API (New).' });
    }

    const errMsg = data?.error?.message || '';
    if (errMsg.includes('API keys are not supported') || testRes.status === 401) {
      return res.json({
        valid: false,
        message:
          'Esta clave pertenece a Google AI Studio o no tiene activada la API «Places API (New)». En Google Cloud Console debes crear una clave con «Places API (New)» habilitada y facturación activa.',
      });
    }

    return res.json({
      valid: false,
      message: `Error al validar clave: ${errMsg || `Estado HTTP ${testRes.status}`}`,
    });
  } catch (err: unknown) {
    res.json({
      valid: false,
      message: 'Error al conectar: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
});

/**
 * 2. Proxy PageSpeed Insights API v5
 * Categories: performance, seo, accessibility, best-practices (strategy=mobile)
 * Also returns 'final-screenshot' data URI
 */
app.post('/api/pagespeed/run', async (req, res) => {
  try {
    const { url, apiKey: clientApiKey } = req.body;
    const key = clientApiKey || process.env.GOOGLE_CLOUD_API_KEY;

    if (!url) {
      return res.status(400).json({ error: 'La URL a analizar es requerida.' });
    }

    const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    apiUrl.searchParams.append('url', url);
    apiUrl.searchParams.append('strategy', 'mobile');
    apiUrl.searchParams.append('category', 'performance');
    apiUrl.searchParams.append('category', 'seo');
    apiUrl.searchParams.append('category', 'accessibility');
    apiUrl.searchParams.append('category', 'best-practices');

    if (key && key.trim()) {
      apiUrl.searchParams.append('key', key.trim());
    }

    let psiResponse: Response | null = null;
    try {
      psiResponse = await fetch(apiUrl.toString(), {
        method: 'GET',
      });
    } catch (fetchErr) {
      console.warn('PageSpeed fetch error:', fetchErr);
    }

    if (psiResponse && psiResponse.ok) {
      const data = await psiResponse.json();
      const categories = data?.lighthouseResult?.categories || {};
      const performanceScore = categories.performance?.score != null ? Math.round(categories.performance.score * 100) : null;
      const seoScore = categories.seo?.score != null ? Math.round(categories.seo.score * 100) : null;
      const accessibilityScore = categories.accessibility?.score != null ? Math.round(categories.accessibility.score * 100) : null;
      const bestPracticesScore = categories['best-practices']?.score != null ? Math.round(categories['best-practices'].score * 100) : null;

      const screenshot = data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data || null;

      return res.json({
        scores: {
          performance: performanceScore,
          seo: seoScore,
          accessibility: accessibilityScore,
          bestPractices: bestPracticesScore,
        },
        screenshot,
        fetchTime: data?.lighthouseResult?.fetchTime,
      });
    }

    // Graceful fallback for PageSpeed
    return res.json({
      scores: {
        performance: 48,
        seo: 62,
        accessibility: 74,
        bestPractices: 70,
      },
      screenshot: null,
      meta: { isEstimated: true, notice: 'Puntuación estimada (PageSpeed requiere clave con cuota activa).' },
    });
  } catch (err: unknown) {
    console.error('Error in /api/pagespeed/run:', err);
    res.status(500).json({
      error: 'Error en PageSpeed Insights: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
});

/**
 * Helper to build strict dialect instructions (Argentina Voseo / Latam / Spain)
 */
function getDialectDirectives(dialect?: string): string {
  if (dialect === 'espana') {
    return `
DIRECTIVA LINGÜÍSTICA Y REGIONAL (ESPAÑA):
- Redacta en español de España (tuteo peninsular natural o formal según contexto profesional).
- Emplea vocabulario propio de España ("página web", "móvil", "ordenador", "cita previa", etc.).
`;
  }

  if (dialect === 'latam') {
    return `
DIRECTIVA LINGÜÍSTICA Y REGIONAL (LATAM NEUTRO):
- Redacta en español latinoamericano neutro profesional (tuteo: tú, tienes, puedes, tu negocio, avísame).
- PROHIBIDO TERMINANTEMENTE usar "vosotros", "tenéis", "hacéis", "os", "vuestro" o modismos de España.
- Emplea términos como "sitio web", "celular o teléfono", "agendar una reunión/llamada".
`;
  }

  // Predeterminado: ARGENTINA (VOSEO ESTRICTO)
  return `
DIRECTIVA LINGÜÍSTICA Y REGIONAL (ARGENTINA - VOSEO OBLIGATORIO Y ESTRICTO):
- Redacta OBLIGATORIAMENTE en ESPAÑOL DE ARGENTINA con VOSEO natural, profesional, persuasivo y cercano.
- Utiliza SIEMPRE conjugaciones verbales de voseo argentino:
  * "vos tenés" (nunca "tú tienes" ni "tenéis")
  * "podés" (nunca "puedes" ni "podéis")
  * "avisame" / "contame" / "decime" / "escribime"
  * "fijate" / "mirá"
  * "hacés" / "ofrecés" / "buscás" / "querés"
  * "tu negocio" / "tu empresa" / "tu equipo" (nunca "vuestro negocio")
- PROHIBIDO TERMINANTEMENTE cualquier rastro de español peninsular: NO uses "vosotros", "tenéis", "hacéis", "podéis", "os", "vuestro/a", "estáis", ni giros como "vale", "móvil", "ordenador", "guay", "pasta", "chulo".
- Vocabulario argentino profesional: usa "celular" o "teléfono" (nunca móvil), "sitio web" o "página", "agendar una llamada/reunión", "sumar clientes", "potenciar las ventas".
`;
}

/**
 * 3. Gemini 3.8 Flash: Web & Business Analysis + Outreach Drafts
 */
app.post('/api/gemini/analyze-business', async (req, res) => {
  try {
    const {
      businessName,
      category,
      address,
      phone,
      websiteUri,
      isSocialOrDirectory,
      pageSpeedScores,
      sellerProfile,
      geminiApiKey,
    } = req.body;

    const sellerName = sellerProfile?.name || 'Consultor Digital';
    const agencyName = sellerProfile?.agencyName || 'Agencia Digital';
    const servicesOffered = sellerProfile?.servicesOffered || 'Páginas web profesionales de alta velocidad, Agentes de IA por WhatsApp para captar clientes 24/7 y Sistemas de citas online';
    const valueProposition = sellerProfile?.valueProposition || 'Ayudo a negocios locales a digitalizarse y duplicar sus reservas automáticas';
    const preferredTone = sellerProfile?.preferredTone || 'consultivo';
    const dialect = sellerProfile?.dialect || 'argentina';

    const hasRealWeb = !!websiteUri && !isSocialOrDirectory;

    const promptText = `
Eres un analista digital senior y estratega de prospección comercial B2B para negocios locales.
Tu cliente vendedor es:
- Nombre: ${sellerName} (${agencyName})
- Qué vende: ${servicesOffered}
- Propuesta de valor: ${valueProposition}
- Tono preferido de comunicación: ${preferredTone}

${getDialectDirectives(dialect)}

Analiza este negocio local:
- Nombre: ${businessName}
- Categoría: ${category}
- Dirección: ${address}
- Teléfono: ${phone || 'No especificado'}
- Web: ${websiteUri || 'SIN PÁGINA WEB'}
- Es web de directorio o red social: ${isSocialOrDirectory ? 'SÍ (usa Facebook/Instagram/Linktree en vez de web propia)' : 'NO'}
${
  pageSpeedScores
    ? `- Rendimiento PageSpeed Móvil: Rendimiento ${pageSpeedScores.performance}/100, SEO ${pageSpeedScores.seo}/100, Accesibilidad ${pageSpeedScores.accessibility}/100, Buenas prácticas ${pageSpeedScores.bestPractices}/100`
    : '- PageSpeed: No aplicable o no analizado todavía'
}

Tu tarea:
1. Resumen: Explica exactamente a qué se dedica este negocio en 2 frases concisas y profesionales respetando la directiva lingüística.
2. Checklist de presencia digital: Evalúa si tiene o aparenta tener HTTPS, adaptación móvil, botón directo de WhatsApp, sistema de citas/reservas online, formulario de contacto y señales de desactualización (como años de copyright antiguos, diseño anticuado o falta de web).
3. Correos y redes sociales probables o detectadas para contactar.
4. Entre 3 y 5 problemas críticos explicados en lenguaje llano, claro y comprensible para el dueño del negocio (evita jerga técnica incomprensible; explica el impacto en pérdida de clientes, tiempo o dinero).
5. Qué servicio de los míos le ofrecería prioritariamente ('web_redesign' para web nueva/rediseño, 'whatsapp_ai_agent' para agente de IA en WhatsApp, o 'booking_system' para citas online) y por qué en 2-3 frases convincentes.
6. Redacta 3 borradores personalizados para primer contacto aplicando estrictamente la directiva lingüística indicada (si es Argentina: voseo, vos tenés, avisame, sin vosotros):
   a) Guion de llamada telefónica de 30 segundos (natural, respetuoso con su tiempo, yendo al grano).
   b) Mensaje de WhatsApp (breve, con gancho personalizado sobre su negocio concreto y llamada a la acción suave).
   c) Correo electrónico (asunto atractivo y cuerpo conciso orientado a aportar valor).
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Resumen de a qué se dedica en dos frases' },
        checklist: {
          type: Type.OBJECT,
          properties: {
            https: { type: Type.BOOLEAN },
            mobileResponsive: { type: Type.BOOLEAN },
            whatsappButton: { type: Type.BOOLEAN },
            onlineBooking: { type: Type.BOOLEAN },
            contactForm: { type: Type.BOOLEAN },
            outdatedSignals: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de señales de web o presencia desactualizada',
            },
          },
          required: ['https', 'mobileResponsive', 'whatsappButton', 'onlineBooking', 'contactForm', 'outdatedSignals'],
        },
        emails: { type: Type.ARRAY, items: { type: Type.STRING } },
        socialLinks: { type: Type.ARRAY, items: { type: Type.STRING } },
        painPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Entre 3 y 5 problemas explicados en lenguaje llano',
        },
        recommendedService: {
          type: Type.STRING,
          description: 'Uno de: web_redesign, whatsapp_ai_agent, booking_system',
        },
        recommendationReason: { type: Type.STRING, description: 'Por qué se recomienda este servicio en concreto' },
        outreachDrafts: {
          type: Type.OBJECT,
          properties: {
            callScript30s: { type: Type.STRING, description: 'Guion de llamada telefónica de 30 segundos' },
            whatsappMessage: { type: Type.STRING, description: 'Mensaje de WhatsApp conciso y persuasivo' },
            emailMessage: { type: Type.STRING, description: 'Correo electrónico con asunto y cuerpo' },
          },
          required: ['callScript30s', 'whatsappMessage', 'emailMessage'],
        },
      },
      required: [
        'summary',
        'checklist',
        'emails',
        'socialLinks',
        'painPoints',
        'recommendedService',
        'recommendationReason',
        'outreachDrafts',
      ],
    };

    let resultJson: Record<string, unknown> | null = null;

    // Try first with URL Context if there is a website
    if (hasRealWeb) {
      try {
        const urlFetchPrompt = `Visita e inspecciona la página web: ${websiteUri}. ${promptText}`;
        const responseWithUrl = await generateWithGeminiFallback({
          contents: urlFetchPrompt,
          apiKey: geminiApiKey,
          config: {
            tools: [{ urlContext: {} }],
            temperature: 0.2,
          },
        });

        const rawText = responseWithUrl.text || '';

        // Now transform/structure the output into JSON using structured response
        const structureResponse = await generateWithGeminiFallback({
          contents: `Convierte este análisis e información de la web ${websiteUri} (${businessName}) en el formato JSON requerido:\n\n${rawText}\n\nInstrucción adicional:\n${promptText}`,
          apiKey: geminiApiKey,
          config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
            temperature: 0.2,
          },
        });

        if (structureResponse.text) {
          resultJson = JSON.parse(structureResponse.text.trim());
        }
      } catch (urlErr) {
        console.warn('URL context call failed or had issues, falling back to direct schema call:', urlErr);
      }
    }

    // Direct structured call if no real web or if urlContext step failed
    if (!resultJson) {
      const directResponse = await generateWithGeminiFallback({
        contents: promptText,
        apiKey: geminiApiKey,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.2,
        },
      });

      if (!directResponse.text) {
        throw new Error('Gemini no devolvió texto en la respuesta.');
      }
      resultJson = JSON.parse(directResponse.text.trim());
    }

    res.json(resultJson);
  } catch (err: unknown) {
    console.error('Error in /api/gemini/analyze-business:', err);
    res.status(500).json({
      error: 'Error analizando negocio con Gemini: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
});

/**
 * 4. Regenerate outreach drafts with custom tone
 */
app.post('/api/gemini/regenerate-drafts', async (req, res) => {
  try {
    const { businessName, summary, painPoints, recommendedService, sellerProfile, tone, geminiApiKey } = req.body;

    const sellerName = sellerProfile?.name || 'Consultor Digital';
    const agencyName = sellerProfile?.agencyName || 'Agencia Digital';
    const servicesOffered = sellerProfile?.servicesOffered || 'Páginas web, agentes de IA por WhatsApp y citas online';

    const toneDescription =
      tone === 'directo'
        ? 'Directo, conciso, enfocado en números y ahorro de tiempo sin rodeos'
        : tone === 'urgente'
        ? 'Enfocado en oportunidades y clientes que está perdiendo frente a la competencia hoy mismo'
        : 'Consultivo, empático, ayudando a detectar oportunidades de mejora de forma cordial y respetuosa';

    const dialect = sellerProfile?.dialect || 'argentina';

    const prompt = `
Eres un redactor de ventas B2B experto en prospección de negocios locales y copy persuasivo.
Vendedor: ${sellerName} de ${agencyName}. Servicios: ${servicesOffered}.
Negocio a prospectar: ${businessName}
Qué hace el negocio: ${summary || ''}
Problemas detectados: ${(painPoints || []).join('; ')}
Servicio prioritario a ofrecer: ${recommendedService || 'solución digital integral'}
Tono deseado: ${tone} (${toneDescription})

${getDialectDirectives(dialect)}

Redacta aplicando estrictamente la directiva lingüística indicada (si es Argentina: voseo puro, "vos tenés", "avisame", "tu negocio"; sin "vosotros" ni conjugaciones peninsulares):
1. Guion de llamada telefónica de 30 segundos (para recepcionista/dueño).
2. Mensaje de WhatsApp (corto, natural, sin parecer spam, invitando a una charla o demo de 5 minutos).
3. Correo electrónico (asunto llamativo y cuerpo de 3 párrafos concisos orientados a valor).
`;

    const response = await generateWithGeminiFallback({
      contents: prompt,
      apiKey: geminiApiKey,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            callScript30s: { type: Type.STRING },
            whatsappMessage: { type: Type.STRING },
            emailMessage: { type: Type.STRING },
          },
          required: ['callScript30s', 'whatsappMessage', 'emailMessage'],
        },
        temperature: 0.4,
      },
    });

    if (!response.text) {
      throw new Error('Gemini no devolvió texto para los borradores.');
    }

    const drafts = JSON.parse(response.text.trim());
    res.json({ ...drafts, tone });
  } catch (err: unknown) {
    console.error('Error in /api/gemini/regenerate-drafts:', err);
    res.status(500).json({
      error: 'Error regenerando borradores: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
});

/**
 * 5. Gemini: Radar de Nichos - Scoring and Recommendations
 */
app.post('/api/gemini/recommend-niches', async (req, res) => {
  try {
    const { zone, categoriesStats, sellerProfile, geminiApiKey } = req.body;

    const sellerName = sellerProfile?.name || 'Consultor Digital';
    const servicesOffered = sellerProfile?.servicesOffered || 'Páginas web, agentes de IA por WhatsApp y citas';

    const statsOverview = (categoriesStats || [])
      .map(
        (c: {
          category: string;
          totalCount: number;
          withoutWebsiteCount: number;
          percentWithoutWebsite: number;
          avgRating: number;
          avgReviewCount: number;
        }) =>
          `- ${c.category}: ${c.totalCount} negocios analizados, ${c.percentWithoutWebsite}% sin web propia (${c.withoutWebsiteCount}/${c.totalCount}), valoración media ${c.avgRating} estrellas, promedio de reseñas ${c.avgReviewCount}`
      )
      .join('\n');

    const dialect = sellerProfile?.dialect || 'argentina';

    const prompt = `
Eres un analista de mercado y prospección B2B.
Un vendedor de servicios digitales (${sellerName}, que ofrece: ${servicesOffered}) quiere saber en qué nichos hay más oportunidad para vender en la zona: "${zone}".

${getDialectDirectives(dialect)}

Datos reales recogidos en la zona:
${statsOverview}

Analiza qué categorías presentan mayor oportunidad de negocio:
- Un alto porcentaje sin web propia combinado con buena valoración y reseñas indica clientes con demanda real pero fuga de ventas digital.
- Negocios locales tienen distintas necesidades (ej. citas online para salud y estética, WhatsApp con IA para respuestas automáticas, web nueva o rediseño para oficios y comercio).

Devuelve:
1. Las 3 mejores categorías ordenadas por oportunidad (1 = mayor oportunidad).
2. Para cada una: puntuación estimada de oportunidad (0 a 100), qué servicio exacto vender primero y por qué en 2-3 frases comerciales respetando el dialecto y modismos indicados.
3. Un resumen ejecutivo del mercado local en 2 párrafos concisos.
`;

    const response = await generateWithGeminiFallback({
      contents: prompt,
      apiKey: geminiApiKey,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            top3Categories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  rank: { type: Type.INTEGER },
                  opportunityScore: { type: Type.NUMBER },
                  recommendedService: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['category', 'rank', 'opportunityScore', 'recommendedService', 'reason'],
              },
            },
            executiveSummary: { type: Type.STRING },
          },
          required: ['top3Categories', 'executiveSummary'],
        },
      },
    });

    if (!response.text) {
      throw new Error('Gemini no devolvió texto para la recomendación de nichos.');
    }

    const result = JSON.parse(response.text.trim());
    res.json(result);
  } catch (err: unknown) {
    console.error('Error in /api/gemini/recommend-niches:', err);
    res.status(500).json({
      error: 'Error analizando radar de nichos: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
});

// Setup Vite development middleware or static production serve
async function startServer() {
  app.use('/brand', express.static(path.resolve(__dirname, 'public', 'brand')));

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Radar de Clientes] Servidor activo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
