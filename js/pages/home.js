/**
 * BuscaVenezuela — Home Page Module
 * Fetches live stats and renders the missing-persons carousel.
 */

import {
  fetchPersonas,
  getUrlParam,
} from '../app.js';

// ── DOM references ──────────────────────────────────────────────────────────

const statReportados = document.getElementById('stat-reportados');
const statDesaparecidos = document.getElementById('stat-desaparecidos');
const statBien = document.getElementById('stat-bien');
const statCiudades = document.getElementById('stat-ciudades');

const carousel = document.getElementById('missing-carousel');
const carouselEmpty = document.getElementById('carousel-empty');

const searchInput = document.getElementById('hero-search-input');
const searchBtn = document.getElementById('hero-search-btn');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Animate a number counting up from its current text to the target value.
 */
function animateCounter(el, target) {
  if (!el) return;
  const start = parseInt(el.textContent, 10) || 0;
  const diff = target - start;
  if (diff === 0) {
    el.textContent = target;
    return;
  }
  const duration = 600;
  const step = Math.ceil(Math.abs(diff) / (duration / 16));
  let current = start;
  const interval = setInterval(() => {
    if (Math.abs(target - current) <= step) {
      current = target;
      clearInterval(interval);
    } else {
      current += diff > 0 ? step : -step;
    }
    el.textContent = current;
  }, 16);
}

/**
 * Get initials from a person's name (up to 2 letters).
 * e.g. "Carlos Pérez" → "CP"
 */
function getInitials(nombre) {
  if (!nombre) return '?';
  const parts = nombre.trim().split(/\s+/);
  const first = parts[0] ? parts[0][0] : '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || first.toUpperCase() || '?';
}

/**
 * Build a single carousel card HTML string.
 */
function buildCarouselCard(persona) {
  const id = persona.id || '';
  const nombre = persona.nombre || 'Sin nombre';
  const ciudad = persona.ciudad || '';
  const foto = (persona.fotos && persona.fotos.length > 0) ? persona.fotos[0] : null;

  let photoHtml;
  if (foto) {
    photoHtml = `<img src="${escapeHtml(foto)}" alt="Foto de ${escapeHtml(nombre)}" loading="lazy">`;
  } else {
    photoHtml = `<span class="carousel-card__initials">${getInitials(nombre)}</span>`;
  }

  return `
    <a href="/persona.html?id=${escapeHtml(String(id))}" class="carousel-card" role="listitem">
      <div class="carousel-card__photo${foto ? '' : ' carousel-card__photo--placeholder'}">
        ${photoHtml}
        <span class="carousel-card__badge">DESAPARECIDO</span>
      </div>
      <div class="carousel-card__body">
        <div class="carousel-card__name">${escapeHtml(nombre)}</div>
        ${ciudad ? `<div class="carousel-card__meta">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escapeHtml(ciudad)}
        </div>` : ''}
      </div>
    </a>
  `;
}

/**
 * Simple HTML entity escape.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Stats loading ───────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const data = await fetchPersonas({ limit: 1 }); // just to get total count

    let total = 0;
    let desaparecidos = 0;
    let estoyBien = 0;

    if (data && typeof data.total === 'number') {
      total = data.total;
    }

    // Fetch counts by tipo with separate calls
    const [desapData, bienData] = await Promise.all([
      fetchPersonas({ tipo: 'desaparecido', limit: 1 }),
      fetchPersonas({ tipo: 'estoy_bien', limit: 1 }),
    ]);

    if (desapData && typeof desapData.total === 'number') {
      desaparecidos = desapData.total;
    }
    if (bienData && typeof bienData.total === 'number') {
      estoyBien = bienData.total;
    }

    // Update ciudades count from the desaparecidos data too
    // We'll set it to a conservative count; the API may not have a direct endpoint
    // For now, set ciudad count as total unique if available. Otherwise keep at the desaparecidos total.
    if (statCiudades && desaparecidos > 0) {
      // No direct cities count from this API call, leave as is or set a reasonable value
      // We'll leave it at 0 unless we can derive it
    }

    // Animate counters
    animateCounter(statReportados, total);
    animateCounter(statDesaparecidos, desaparecidos);
    animateCounter(statBien, estoyBien);

  } catch (err) {
    console.error('Error loading stats:', err);
    // Silently fail — counters stay at 0
  }
}

// ── Carousel loading ────────────────────────────────────────────────────────

async function loadCarousel() {
  if (!carousel) return;

  try {
    // Fetch up to 10 most recent desaparecido persons
    const data = await fetchPersonas({
      tipo: 'desaparecido',
      limit: 10,
      offset: 0,
    });

    const personas = (data && Array.isArray(data.personas))
      ? data.personas
      : (Array.isArray(data) ? data : []);

    if (personas.length === 0) {
      // Show empty state
      carousel.innerHTML = '';
      if (carouselEmpty) {
        carouselEmpty.classList.remove('hidden');
      }
      return;
    }

    // Hide empty message
    if (carouselEmpty) {
      carouselEmpty.classList.add('hidden');
    }

    // Build and inject cards
    const cardsHtml = personas.map(buildCarouselCard).join('');
    carousel.innerHTML = cardsHtml;

  } catch (err) {
    console.error('Error loading carousel:', err);
    // Show empty state on error
    carousel.innerHTML = '';
    if (carouselEmpty) {
      carouselEmpty.classList.remove('hidden');
    }
  }
}

// ── Search Bar ──────────────────────────────────────────────────────────────

function handleSearch() {
  if (!searchInput) return;
  const query = searchInput.value.trim();
  if (query) {
    window.location.href = `/buscar.html?search=${encodeURIComponent(query)}`;
  }
}

function setupSearch() {
  if (!searchInput) return;

  // Search on Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  });

  // Search on button click
  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSearch();
    });
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadCarousel();
  setupSearch();
});
