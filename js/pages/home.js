/**
 * BuscaVenezuela — Home Page Module
 * Fetches live stats and renders the missing-persons carousel.
 */

import {
  fetchPersonas,
  fetchCities,
  getCityLabel,
  getUrlParam,
} from '../app.js';

// ── DOM references ──────────────────────────────────────────────────────────

const statReportados = document.getElementById('stat-reportados');
const statDesaparecidos = document.getElementById('stat-desaparecidos');
const statEncontrados = document.getElementById('stat-encontrados');
const statBien = document.getElementById('stat-bien');
const statCiudades = document.getElementById('stat-ciudades');

const carousel = document.getElementById('missing-carousel');
const carouselEmpty = document.getElementById('carousel-empty');

const searchInput = document.getElementById('hero-search-input');
const searchBtn = document.getElementById('hero-search-btn');

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function getInitials(nombre) {
  if (!nombre) return '?';
  const parts = nombre.trim().split(/\s+/);
  const first = parts[0] ? parts[0][0] : '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || first.toUpperCase() || '?';
}

function buildCarouselCard(persona) {
  const id = persona.id || '';
  const nombre = persona.name || persona.nombre || 'Sin nombre';
  const ciudad = getCityLabel(persona.ciudad) || persona.ciudad || '';
  const foto = persona.foto_thumb || null;

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
        ${ciudad ? `<div class="carousel-card__meta">📍 ${escapeHtml(ciudad)}</div>` : ''}
      </div>
    </a>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Stats loading ───────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const data = await fetchPersonas({ limit: 1 });

    let total = 0;
    let desaparecidos = 0;
    let encontrados = 0;
    let estoyBien = 0;

    if (data && typeof data.total === 'number') {
      total = data.total;
    }

    const [desapData, bienData, encontData] = await Promise.all([
      fetchPersonas({ tipo: 'desaparecido', limit: 1 }),
      fetchPersonas({ tipo: 'estoy_bien', limit: 1 }),
      fetchPersonas({ tipo: 'encontrado', limit: 1 }),
    ]);

    if (desapData && typeof desapData.total === 'number') {
      desaparecidos = desapData.total;
    }
    if (bienData && typeof bienData.total === 'number') {
      estoyBien = bienData.total;
    }
    if (encontData && typeof encontData.total === 'number') {
      encontrados = encontData.total;
    }

    animateCounter(statReportados, total);
    animateCounter(statDesaparecidos, desaparecidos);
    animateCounter(statEncontrados, encontrados);
    animateCounter(statBien, estoyBien);

    // Cities count from API
    try {
      const citiesData = await fetchCities();
      if (citiesData && Array.isArray(citiesData.data)) {
        let count = 0;
        citiesData.data.forEach(c => { if (c.affected_count > 0) count++; });
        animateCounter(statCiudades, Math.max(count, 1));
      }
    } catch (e) { /* ignore */ }

  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// ── Carousel loading ────────────────────────────────────────────────────────

async function loadCarousel() {
  if (!carousel) return;

  try {
    const data = await fetchPersonas({
      tipo: 'desaparecido',
      limit: 10,
      offset: 0,
    });

    const personas = (data && Array.isArray(data.data))
      ? data.data
      : (Array.isArray(data) ? data : []);

    if (personas.length === 0) {
      carousel.innerHTML = '';
      if (carouselEmpty) {
        carouselEmpty.classList.remove('hidden');
      }
      return;
    }

    if (carouselEmpty) {
      carouselEmpty.classList.add('hidden');
    }

    const cardsHtml = personas.map(buildCarouselCard).join('');
    carousel.innerHTML = cardsHtml;

  } catch (err) {
    console.error('Error loading carousel:', err);
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

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  });

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
