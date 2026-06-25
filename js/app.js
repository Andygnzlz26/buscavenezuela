/**
 * BuscaVenezuela — Main Application Script
 * Handles all API communication and DOM interactions.
 * Vanilla JS, no frameworks. ES6+.
 */

// ── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  // Auto-detect: localhost uses the Python demo server; production hits the Worker
  apiUrl: (() => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8081';  // Demo server (Python)
    }
    // Production: use Pages Function proxy (/api/* → Worker)
    return '/api';
  })(),
  siteUrl: window.location.origin,
  defaultImage: '/img/default-persona.svg',
};

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Debounce utility — delays function execution until after `delay` ms of inactivity.
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Get a URL query parameter by name.
 * @param {string} name
 * @returns {string|null}
 */
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Set (or update) a URL query parameter without a full page reload.
 * @param {string} name
 * @param {string} value
 */
function setUrlParam(name, value) {
  const url = new URL(window.location);
  url.searchParams.set(name, value);
  window.history.replaceState({}, '', url);
}

// ── Photo Handling ───────────────────────────────────────────────────────────

/**
 * Resize an image file client-side before upload.
 * @param {File} file — the image file selected by the user
 * @param {number} [maxWidth=800] — maximum width in pixels
 * @param {number} [quality=0.7] — JPEG quality (0–1)
 * @returns {Promise<string>} — base64-encoded data URL
 */
function resizeImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Don't upscale images that are already smaller than maxWidth
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

// ── City Helpers ─────────────────────────────────────────────────────────────

const CITY_LABELS = {
  caracas: 'Caracas',
  maracaibo: 'Maracaibo',
  valencia: 'Valencia',
  barquisimeto: 'Barquisimeto',
  maracay: 'Maracay',
  'ciudad-guayana': 'Ciudad Guayana',
  barcelona: 'Barcelona',
  maturin: 'Maturín',
  'san-cristobal': 'San Cristóbal',
  merida: 'Mérida',
};

const CITY_COLORS = {
  caracas: '#E74C3C',
  maracaibo: '#2980B9',
  valencia: '#27AE60',
  barquisimeto: '#8E44AD',
  maracay: '#F39C12',
  'ciudad-guayana': '#1ABC9C',
  barcelona: '#E67E22',
  maturin: '#2C3E50',
  'san-cristobal': '#D35400',
  merida: '#16A085',
};

/**
 * Returns the human-readable display name for a city slug.
 * @param {string} name — city slug (e.g. "san-cristobal")
 * @returns {string}
 */
function getCityLabel(name) {
  if (!name) return '';
  return CITY_LABELS[name.toLowerCase()] || name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the accent color associated with a city.
 * @param {string} name — city slug
 * @returns {string} — hex color, defaults to #555
 */
function getCityColor(name) {
  if (!name) return '#555555';
  return CITY_COLORS[name.toLowerCase()] || '#555555';
}

// ── DOM Helpers ──────────────────────────────────────────────────────────────

/**
 * Show a full-screen or container-scoped loader.
 * @param {string|HTMLElement} [container='body'] — CSS selector or element
 * @returns {HTMLElement} — the loader element
 */
function showLoader(container) {
  const parent = typeof container === 'string'
    ? document.querySelector(container) || document.body
    : container || document.body;

  // Remove any existing loader inside this parent
  hideLoader(parent);

  const loader = document.createElement('div');
  loader.className = 'loader-overlay';
  loader.innerHTML = '<div class="spinner"></div>';
  parent.appendChild(loader);
  return loader;
}

/**
 * Hide loaders. If a specific parent is given, only removes loaders inside it.
 * @param {string|HTMLElement} [container] — optional, defaults to document
 */
function hideLoader(container) {
  const scope = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (scope) {
    scope.querySelectorAll('.loader-overlay').forEach((el) => el.remove());
  } else {
    document.querySelectorAll('.loader-overlay').forEach((el) => el.remove());
  }
}

/**
 * Show a toast notification.
 * @param {string} message — text to display
 * @param {'success'|'error'|'info'} [type='info']
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');

  document.body.appendChild(toast);

  // Force reflow so the transition kicks in
  void toast.offsetWidth;
  toast.classList.add('toast--visible');

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Format an ISO date string into a human-readable Spanish format.
 * Example: "14 de junio, 2026 10:30 AM"
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return '';

  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${day} de ${month}, ${year} ${hours}:${minutes} ${ampm}`;
}

/**
 * Return a relative time string in Spanish ("hace X horas").
 * @param {string} isoString
 * @returns {string}
 */
function timeAgo(isoString) {
  if (!isoString) return '';

  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return isoString;

  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSec < 60) return 'hace unos segundos';
  if (diffMin < 2) return 'hace 1 minuto';
  if (diffMin < 60) return `hace ${diffMin} minutos`;
  if (diffHrs < 2) return 'hace 1 hora';
  if (diffHrs < 24) return `hace ${diffHrs} horas`;
  if (diffDays < 2) return 'hace 1 día';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffWeeks < 2) return 'hace 1 semana';
  if (diffWeeks < 4) return `hace ${diffWeeks} semanas`;
  if (diffMonths < 2) return 'hace 1 mes';
  if (diffMonths < 12) return `hace ${diffMonths} meses`;

  // Older than a year: show full date
  return formatDate(isoString);
}

// ── API Functions ────────────────────────────────────────────────────────────

/**
 * Generic fetch wrapper with error handling.
 * @param {string} endpoint — relative path (e.g. "/api/cities")
 * @param {object} [options] — fetch options
 * @returns {Promise<any>} — parsed JSON response
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${CONFIG.apiUrl}${endpoint}`;
  const defaultHeaders = { 'Content-Type': 'application/json' };

  let res;
  try {
    res = await fetch(url, {
      headers: defaultHeaders,
      ...options,
    });
  } catch (err) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      throw new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
    }
    throw err;
  }

  if (!res.ok) {
    let errorMsg = `Error del servidor (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
      else if (body.message) errorMsg = body.message;
    } catch {
      // Couldn't parse error body, use default
    }
    throw new Error(errorMsg);
  }

  try {
    return await res.json();
  } catch {
    throw new Error('La respuesta del servidor no es válida.');
  }
}

/**
 * Fetch the list of available cities.
 * GET /api/cities
 * @returns {Promise<Array>}
 */
function fetchCities() {
  return apiRequest('/api/cities');
}

/**
 * Search / list personas with optional filters.
 * GET /api/personas?search=&ciudad=&tipo=&limit=&offset=
 * @param {object} params — { search, ciudad, tipo, limit, offset }
 * @returns {Promise<{personas: Array, total: number}>}
 */
function fetchPersonas(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.ciudad) query.set('ciudad', params.ciudad);
  if (params.tipo) query.set('tipo', params.tipo);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));

  const qs = query.toString();
  return apiRequest(`/api/personas${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch a single persona by ID.
 * GET /api/personas/:id
 * @param {string|number} id
 * @returns {Promise<object>}
 */
function fetchPersona(id) {
  return apiRequest(`/api/personas/${encodeURIComponent(id)}`);
}

/**
 * Create a new persona listing.
 * POST /api/personas
 * @param {object} data — persona fields
 * @returns {Promise<object>} — created persona
 */
function createPersona(data) {
  return apiRequest('/api/personas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Submit a report for a missing/found person.
 * POST /api/reports
 * @param {object} data — report fields (persona_id, description, photos, etc.)
 * @returns {Promise<object>} — created report
 */
function createReporte(data) {
  return apiRequest('/api/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── WhatsApp Share ───────────────────────────────────────────────────────────

/**
 * Generate a WhatsApp share URL with the person's info pre-filled in Spanish.
 * @param {object} persona — { nombre, ciudad, descripcion, fotos, ... }
 * @returns {string} — WhatsApp share URL
 */
function shareWhatsApp(persona) {
  const lines = [];

  const name = persona.name || persona.nombre || 'Persona sin nombre';
  const city = persona.ciudad ? getCityLabel(persona.ciudad) : '';
  const date = persona.created_at || persona.fecha || null;

  if (persona.tipo === 'desaparecido') {
    lines.push(`🚨 *DESAPARECIDO/A: ${name}* 🚨`);
  } else if (persona.tipo === 'encontrado') {
    lines.push(`✅ *ENCONTRADO/A: ${name}* ✅`);
  } else if (persona.tipo === 'estoy_bien') {
    lines.push(`✅ *${name} ESTÁ BIEN* ✅`);
  } else {
    lines.push(`ℹ️ *${name}* ℹ️`);
  }

  lines.push('');

  if (city) {
    lines.push(`*Ciudad:* ${city}`);
  }
  if (persona.ultima_zona) {
    lines.push(`*Última zona:* ${persona.ultima_zona}`);
  }
  if (persona.descripcion) {
    lines.push(`*Descripción:* ${persona.descripcion}`);
  }
  if (date) {
    lines.push(`*Fecha:* ${formatDate(date)}`);
  }
  if (persona.contacto_info) {
    lines.push(`*Contacto:* ${persona.contacto_info}`);
  }

  // Social contact info
  const socialLines = [];
  if (persona.contacto_whatsapp) socialLines.push(`WhatsApp: ${persona.contacto_whatsapp}`);
  if (persona.contacto_instagram) socialLines.push(`Instagram: ${persona.contacto_instagram}`);
  if (persona.contacto_email) socialLines.push(`Email: ${persona.contacto_email}`);
  if (socialLines.length > 0) {
    lines.push('');
    lines.push('*Contacto para coordinar:*');
    socialLines.forEach((l) => lines.push(`  ${l}`));
  }

  lines.push('');
  lines.push(`🔗 Más información: ${CONFIG.siteUrl}/persona.html?id=${persona.id}`);
  lines.push('');
  lines.push('_Compartido desde BuscaVenezuela_');

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/?text=${text}`;
}

/**
 * Generate a ready-to-post social media share text for Instagram/Twitter/etc.
 * @param {object} persona — { nombre, ciudad, descripcion, id, ... }
 * @returns {string} — plain text ready to copy and paste
 */
function generateShareText(persona) {
  const lines = [];

  const name = persona.name || persona.nombre || 'Persona sin nombre';
  const city = persona.ciudad ? getCityLabel(persona.ciudad) : '';

  if (persona.tipo === 'desaparecido') {
    lines.push(`🚨 DESAPARECIDO/A: ${name} — ${city}`);
  } else if (persona.tipo === 'estoy_bien') {
    lines.push(`✅ ${name} está bien — ${city}`);
  } else {
    lines.push(`ℹ️ ${name} — ${city}`);
  }

  if (persona.descripcion) {
    lines.push(persona.descripcion);
  }
  if (persona.ultima_zona) {
    lines.push(`Última zona: ${persona.ultima_zona}`);
  }

  lines.push('');
  lines.push('Ayuda a difundir. Comparte desde BuscaVenezuela.');
  lines.push(`${CONFIG.siteUrl}/persona/${persona.id}`);

  return lines.join('\n');
}

// ── Exports ──────────────────────────────────────────────────────────────────
// ES6 module exports for type="module" scripts; also expose globally for direct <script> usage.

export {
  CONFIG,
  debounce,
  getUrlParam,
  setUrlParam,
  resizeImage,
  getCityLabel,
  getCityColor,
  showLoader,
  hideLoader,
  showToast,
  formatDate,
  timeAgo,
  apiRequest,
  fetchCities,
  fetchPersonas,
  fetchPersona,
  createPersona,
  createReporte,
  shareWhatsApp,
  generateShareText,
};
