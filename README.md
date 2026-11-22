# 🧭 Radar Lite · Buscador y Auditor de Prospectos B2B

**Radar Lite** es una aplicación web local para encontrar negocios locales, auditar su presencia digital (sitio web, velocidad móvil, SEO, WhatsApp, reservas) y generar guiones comerciales personalizados listos para enviar por WhatsApp, llamada o correo electrónico.

---

## 📋 Guía de Onboarding · Paso a Paso

Esta versión es **100% personal y privada**: corre en tu propia computadora y se conecta con **tus propias credenciales de Google**.

### Paso 1: Requisitos previos
Solo necesitás tener instalado **Node.js** (versión 18 o superior, recomendada LTS).
- Si no lo tenés, descargalo gratis desde: **[https://nodejs.org/](https://nodejs.org/)** *(botón verde «LTS»)*.

---

### Paso 2: Obtener tus Credenciales de Google

Para usar el sistema al 100%, necesitás **2 claves** (ambas se configuran desde tu propia cuenta de Google):

#### A) Clave de Google Gemini AI *(Gratuita · Requerida)*
Se utiliza para las auditorías inteligentes, detección de dolores del negocio y redacción de los mensajes de venta.

1. Entrá a **[Google AI Studio](https://aistudio.google.com/apikey)** con tu cuenta de Google.
2. Hacé clic en **«Create API key»**.
3. Copiá la clave generada (empieza con `AIzaSy...` o `AQ...`). *Guardala, la vamos a pegar en Ajustes.*

---

#### B) Clave de Google Cloud: Places API (New) + PageSpeed *(Tus credenciales de Google Cloud)*
Se utiliza para buscar negocios reales en Google Maps y medir el rendimiento real de sus páginas web en celulares.

> 💡 **¿Tiene costo?** Google Cloud otorga **$200 USD de crédito gratuito todos los meses** para Google Maps/Places, además de que Radar Lite incluye un **protector automático de cuota gratuita** (máximo 30 búsquedas por día y 850 al mes) para que nunca superes el nivel gratuito.

**Cómo generarla paso a paso:**
1. Entrá a **[Google Cloud Console](https://console.cloud.google.com/)** e iniciá sesión con tu Gmail.
2. Arriba a la izquierda, hacé clic en el selector de proyectos y creá un **Proyecto Nuevo** (ej: `radar-prospectos`).
3. En el menú lateral izquierdo, andá a **Facturación (Billing)** y vinculá una cuenta de facturación *(Google te la pide para habilitar las APIs, pero no te cobrará mientras te mantengas dentro del nivel gratuito protegido)*.
4. Andá a **APIs y servicios → Biblioteca (Library)** y activá estas **2 APIs**:
   - Buscá **`Places API (New)`** → Hacé clic en **Habilitar (Enable)**.
   - Buscá **`PageSpeed Insights API`** → Hacé clic en **Habilitar (Enable)**.
5. Andá a **APIs y servicios → Credenciales (Credentials)**:
   - Hacé clic en **«+ Crear credenciales» → «Clave de API» (API Key)**.
   - Copiá la clave generada (`AIzaSy...`).
6. *(Recomendado por seguridad)* Hacé clic en **«Restringir clave»**:
   - En *Restricciones de API*, seleccioná **«Restringir clave»** y tildá únicamente **Places API (New)** y **PageSpeed Insights API**. Guardá los cambios.

---

### Paso 3: Iniciar la Aplicación

#### Opción A — Si descargaste el paquete ZIP listo para usar:
1. Descomprimí la carpeta en tu computadora.
2. Hacé doble clic en **`iniciar.bat`** (Windows) o ejecutá `bash iniciar.sh` (Mac/Linux).
3. La primera vez instalará lo necesario en unos segundos y abrirá automáticamente **`http://localhost:3000`** en tu navegador.

#### Opción B — Si clonaste el repositorio desde GitHub:
```bash
git clone https://github.com/melisacabrera552-lab/radar-lite.git
cd radar-lite
npm install
cp .env.example .env
npm run build
npm start
```
Luego abrí **`http://localhost:3000`** en tu navegador.

*(Para desarrollo con recarga en vivo podés usar `npm run dev` en lugar de `npm run build && npm start`.)*

---

### Paso 4: Configurar tus Claves y Perfil en la App

Una vez abierta la aplicación en **`http://localhost:3000`**:

1. Andá a la pestaña **⚙️ Ajustes** en el menú izquierdo.
2. En **Clave de Inteligencia Artificial (Google Gemini)** pegá tu clave de Google AI Studio y tocá **«Probar clave de Gemini»** para confirmar que responde bien.
3. En **Clave de Google Cloud (Places API New & PageSpeed)** pegá tu clave de Google Cloud Console y tocá **«Probar conexión con Places API»**.
4. Completá tu **Perfil de Vendedor**:
   - Tu nombre, nombre de tu agencia o marca, servicios que ofrecés, teléfono/WhatsApp y tono preferido.
5. Hacé clic en **«Guardar Ajustes»** abajo a la derecha.

*(Opcional: también podés pegar `GEMINI_API_KEY` y `GOOGLE_CLOUD_API_KEY` directamente en el archivo `.env` antes de arrancar el servidor).*

---

## 🎯 Cómo usar Radar Lite

1. **Buscar Negocios:** Escribí el rubro (ej. *Odontólogos*, *Gimnasios*, *Peluquerías*) y la ciudad/barrio. Filtrá por *"Sin web"* o *"Con teléfono"* para detectar oportunidades rápidas.
2. **Radar de Nichos:** Analizá qué rubros de una zona tienen mayor porcentaje de negocios sin sitio web o con oportunidades digitales.
3. **Ficha y Auditoría IA:** Tocá cualquier negocio para ver su ficha. Hacé clic en **«Analizar con Inteligencia Artificial»** para obtener el diagnóstico de su web (PageSpeed móvil + checklist) y guiones personalizados de llamada, WhatsApp y email.
4. **Mis Leads:** Guardá tus mejores prospectos, organizalos en el tablero Kanban por estado (*Nuevo*, *Contactado*, *Reunión*, *Cliente*), exportá a **CSV** o descargá su ficha en **PDF**.

---

## 🔒 Seguridad y Privacidad
- Todas tus claves se guardan localmente en tu navegador (`localStorage`) o en tu archivo `.env` local.
- Nunca subas tu archivo `.env` a GitHub (el `.gitignore` ya lo bloquea por defecto).
