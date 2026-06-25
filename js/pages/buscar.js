/**
 * BuscaVenezuela — Search Page Module
 * Handles filtered search, pagination, active filter chips, and empty state.
 */

import {
  fetchPersonas,
  showToast,
  formatDate,
  timeAgo,
  getUrlParam,
  setUrlParam,
  debounce,
} from '../app.js';

// ── DOM references ──────────────────────────────────────────────────────────

const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const filterCiudad = document.getElementById('filter-ciudad');
const filterEstado = document.getElementById('filter-estado');

const activeFiltersBar = document.getElementById('active-filters');
const clearFiltersWrapper = document.getElementById('clear-filters-wrapper');

const personList = document.getElementById('person-list');
const emptyState = document.getElementById('empty-state');
const skeletonList = document.getElementById('skeleton-list');
const resultsCount = document.getElementById('results-count');

const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const currentPageSpan = document.getElementById('current-page');

// ── State ───────────────────────────────────────────────────────────────────

const LIMIT = 20;
let currentOffset = 0;
let totalResults = 0;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build query-param object from URL and current form state. */
function buildParams() {
  return {
    search: getUrlParam('search') || '',
    ciudad: getUrlParam('ciudad') || '',
    tipo: getUrlParam('tipo') || '',
    limit: LIMIT,
    offset: currentOffset,
  };
}

/** Map the UI "estado" dropdown values to API `tipo` values. */
function uiEstadoToTipo(estadoValue) {
  const map = {
    desaparecidos: 'desaparecido',
    'estan-bien': 'estoy_bien',
    encontrados: 'encontrado',
  };
  return map[estadoValue] || '';
}

function tipoToUiEstado(tipo) {
  const map = {
    desaparecido: 'desaparecidos',
    estoy_bien: 'estan-bien',
    encontrado: 'encontrados',
  };
  return map[tipo] || '';
}

// ── Render person card ─────────────────────────────────────────────────────

function renderPersonCard(persona) {
  const foto = persona.fotos && persona.fotos.length > 0
    ? persona.fotos[0]
    : '/img/default-persona.svg';

  const ciudadName = persona.ciudad || '—';
  const tipoLabel = persona.tipo === 'desaparecido'
    ? 'Desaparecido'
    : persona.tipo === 'estoy_bien'
      ? 'Está bien'
      : persona.tipo === 'encontrado'
        ? 'Encontrado'
        : persona.tipo || 'Sin estado';

  const tipoBadgeClass = persona.tipo === 'desaparecido'
    ? 'status-badge--red'
    : persona.tipo === 'estoy_bien'
      ? 'status-badge--green'
      : persona.tipo === 'encontrado'
        ? 'status-badge--blue'
        : '';

  const timeStr = persona.fecha ? timeAgo(persona.fecha) : '';

  return `
    <a href="/persona.html?id=${encodeURIComponent(persona.id)}" class="card person-card" role="listitem">
      <img src="${escapeHtml(foto)}" alt="${escapeHtml(persona.nombre || '')}"
           class="person-card__avatar" loading="lazy"
           onerror="this.src='/img/default-persona.svg'">
      <div class="person-card__info">
        <h3 class="person-card__name">${escapeHtml(persona.nombre || 'Sin nombre')}</h3>
        <span class="person-card__ciudad">📍 ${escapeHtml(ciudadName)}</span>
        ${timeStr ? `<span class="person-card__time text-small text-muted">${escapeHtml(timeStr)}</span>` : ''}
      </div>
      <span class="status-badge ${tipoBadgeClass}">${escapeHtml(tipoLabel)}</span>
    </a>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Render results ─────────────────────────────────────────────────────────

function renderPersons(personas) {
  if (!personList) return;

  personList.innerHTML = personas.map(renderPersonCard).join('');
}

// ── Show / hide states ─────────────────────────────────────────────────────

function showEmptyState() {
  if (personList) personList.innerHTML = '';
  if (emptyState) emptyState.classList.remove('hidden');
  if (skeletonList) skeletonList.classList.add('hidden');
}

function hideEmptyState() {
  if (emptyState) emptyState.classList.add('hidden');
}

function showLoading() {
  if (personList) personList.innerHTML = '';
  if (skeletonList) skeletonList.classList.remove('hidden');
  hideEmptyState();
}

function hideLoading() {
  if (skeletonList) skeletonList.classList.add('hidden');
}

// ── Update results count ───────────────────────────────────────────────────

function updateResultsCount(count) {
  if (!resultsCount) return;
  const strong = resultsCount.querySelector('strong');
  if (strong) {
    strong.textContent = count;
  }
}

// ── Pagination ──────────────────────────────────────────────────────────────

function updatePagination() {
  if (!prevPageBtn || !nextPageBtn || !currentPageSpan) return;

  const currentPage = Math.floor(currentOffset / LIMIT) + 1;
  const totalPages = Math.ceil(totalResults / LIMIT) || 1;

  currentPageSpan.textContent = currentPage;

  if (currentPage <= 1) {
    prevPageBtn.disabled = true;
    prevPageBtn.classList.add('pagination__btn--disabled');
  } else {
    prevPageBtn.disabled = false;
    prevPageBtn.classList.remove('pagination__btn--disabled');
  }

  if (currentPage >= totalPages || totalResults === 0) {
    nextPageBtn.disabled = true;
    nextPageBtn.classList.add('pagination__btn--disabled');
  } else {
    nextPageBtn.disabled = false;
    nextPageBtn.classList.remove('pagination__btn--disabled');
  }
}

function goToPage(page) {
  const totalPages = Math.ceil(totalResults / LIMIT) || 1;
  if (page < 1 || page > totalPages) return;
  currentOffset = (page - 1) * LIMIT;
  performSearch();
}

// ── Active filter chips ────────────────────────────────────────────────────

function renderFilterChips() {
  if (!activeFiltersBar) return;

  const search = getUrlParam('search') || '';
  const ciudad = getUrlParam('ciudad') || '';
  const tipo = getUrlParam('tipo') || '';

  let html = '';

  if (search) {
    html += `
      <span class="filter-chip">
        Nombre: "${escapeHtml(search)}"
        <button class="filter-chip__remove" data-filter="search" aria-label="Quitar filtro de nombre">&times;</button>
      </span>
    `;
  }

  if (ciudad) {
    html += `
      <span class="filter-chip">
        Ciudad: ${escapeHtml(ciudad)}
        <button class="filter-chip__remove" data-filter="ciudad" aria-label="Quitar filtro de ciudad">&times;</button>
      </span>
    `;
  }

  if (tipo) {
    const estadoLabel = tipo === 'desaparecido' ? 'Desaparecidos'
      : tipo === 'estoy_bien' ? 'Están bien'
      : tipo === 'encontrado' ? 'Encontrados'
      : tipo;
    html += `
      <span class="filter-chip">
        Estado: ${escapeHtml(estadoLabel)}
        <button class="filter-chip__remove" data-filter="tipo" aria-label="Quitar filtro de estado">&times;</button>
      </span>
    `;
  }

  activeFiltersBar.innerHTML = html;

  // Show/hide "clear all filters" link
  const hasFilters = !!(search || ciudad || tipo);
  if (clearFiltersWrapper) {
    clearFiltersWrapper.classList.toggle('hidden', !hasFilters);
  }

  // Attach remove listeners
  activeFiltersBar.querySelectorAll('.filter-chip__remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = btn.dataset.filter;
      removeFilter(filter);
    });
  });
}

function removeFilter(filter) {
  const url = new URL(window.location);
  url.searchParams.delete(filter);
  window.history.replaceState({}, '', url);

  if (filter === 'search' && searchInput) {
    searchInput.value = '';
  }
  if (filter === 'ciudad' && filterCiudad) {
    filterCiudad.value = '';
  }
  if (filter === 'tipo' && filterEstado) {
    filterEstado.value = '';
  }

  currentOffset = 0;
  performSearch();
}

// ── Search execution ────────────────────────────────────────────────────────

async function performSearch() {
  showLoading();

  const params = buildParams();

  try {
    const data = await fetchPersonas(params);

    const personas = data.personas || [];
    totalResults = data.total || personas.length;

    if (personas.length === 0) {
      renderPersons([]);
      showEmptyState();
    } else {
      hideEmptyState();
      renderPersons(personas);
    }

    updateResultsCount(totalResults);
    updatePagination();
    renderFilterChips();

  } catch (err) {
    console.error('Search error:', err);
    showToast(err.message || 'Error al buscar personas.', 'error');
    hideLoading();
    if (personList) personList.innerHTML = '';
  } finally {
    hideLoading();
  }
}

// ── Sync form fields from URL params ────────────────────────────────────────

function syncFormFromUrl() {
  const search = getUrlParam('search') || '';
  const ciudad = getUrlParam('ciudad') || '';
  const tipo = getUrlParam('tipo') || '';

  if (searchInput) searchInput.value = search;
  if (filterCiudad) filterCiudad.value = ciudad;
  if (filterEstado) filterEstado.value = tipoToUiEstado(tipo);
}

// ── Update URL from form, then search ───────────────────────────────────────

function updateUrlAndSearch() {
  const search = searchInput ? searchInput.value.trim() : '';
  const ciudad = filterCiudad ? filterCiudad.value : '';
  const estado = filterEstado ? filterEstado.value : '';

  const url = new URL(window.location);

  if (search) url.searchParams.set('search', search);
  else url.searchParams.delete('search');

  if (ciudad) url.searchParams.set('ciudad', ciudad);
  else url.searchParams.delete('ciudad');

  const tipo = uiEstadoToTipo(estado);
  if (tipo) url.searchParams.set('tipo', tipo);
  else url.searchParams.delete('tipo');

  window.history.replaceState({}, '', url);

  currentOffset = 0;
  performSearch();
}

// ── Event handlers ──────────────────────────────────────────────────────────

// Debounced handler for the search input
const debouncedSearch = debounce(() => {
  updateUrlAndSearch();
}, 300);

// Immediate handler for selects (no debounce needed)
function onFilterChange() {
  updateUrlAndSearch();
}

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Sync form fields from URL params
  syncFormFromUrl();

  // Initial search
  performSearch();

  // Search input: debounced change
  if (searchInput) {
    searchInput.addEventListener('input', debouncedSearch);
  }

  // Dropdowns: immediate
  if (filterCiudad) {
    filterCiudad.addEventListener('change', onFilterChange);
  }
  if (filterEstado) {
    filterEstado.addEventListener('change', onFilterChange);
  }

  // Form submit: prevent default, trigger search via change handling
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      updateUrlAndSearch();
    });
  }

  // Pagination
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      const currentPage = Math.floor(currentOffset / LIMIT) + 1;
      goToPage(currentPage - 1);
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      const currentPage = Math.floor(currentOffset / LIMIT) + 1;
      goToPage(currentPage + 1);
    });
  }
});
