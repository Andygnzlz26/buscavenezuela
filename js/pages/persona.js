/**
 * BuscaVenezuela — Person Detail Page Module
 * Renders a single person's profile, report timeline, report form, and share.
 */

import {
  fetchPersona,
  createReporte,
  resizeImage,
  showToast,
  formatDate,
  timeAgo,
  getUrlParam,
  shareWhatsApp,
  generateShareText,
} from '../app.js';

// ── DOM references ──────────────────────────────────────────────────────────

const personName = document.getElementById('person-name');
const personPhoto = document.getElementById('person-photo');
const personCiudad = document.getElementById('person-ciudad');
const personStatusBadge = document.getElementById('person-status-badge');
const personLastReport = document.getElementById('person-last-report');

const reportTimeline = document.getElementById('report-timeline');
const noReportsState = document.getElementById('no-reports-state');
const reportSkeleton1 = document.getElementById('report-skeleton-1');
const reportSkeleton2 = document.getElementById('report-skeleton-2');

const toggleReportFormBtn = document.getElementById('toggle-report-form');
const reportForm = document.getElementById('report-form');
const reportTipo = document.getElementById('report-tipo');
const reportDescripcion = document.getElementById('report-descripcion');
const reportFotos = document.getElementById('report-fotos');
const reportContacto = document.getElementById('report-contacto');
const submitReportBtn = document.getElementById('submit-report-btn');
const cancelReportBtn = document.getElementById('cancel-report-btn');
const reportFormStatus = document.getElementById('report-form-status');

const whatsappShareBtn = document.getElementById('whatsapp-share-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');
const copyShareTextBtn = document.getElementById('copy-share-text-btn');
const shareTextPreview = document.getElementById('share-text-preview');

// Social contact elements
const toggleContactBtn = document.getElementById('toggle-contact-btn');
const personSocialContacts = document.getElementById('person-social-contacts');
const socialWhatsappValue = document.getElementById('social-whatsapp-value');
const socialInstagramValue = document.getElementById('social-instagram-value');
const socialEmailValue = document.getElementById('social-email-value');
const socialOtroValue = document.getElementById('social-otro-value');
const socialWhatsappRow = document.getElementById('social-whatsapp');
const socialInstagramRow = document.getElementById('social-instagram');
const socialEmailRow = document.getElementById('social-email');
const socialOtroRow = document.getElementById('social-otro');

// ── State ───────────────────────────────────────────────────────────────────

let currentPersona = null;

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Render person header ────────────────────────────────────────────────────

function renderPersonHeader(persona) {
  currentPersona = persona;

  // Name
  if (personName) {
    personName.textContent = persona.nombre || 'Sin nombre';
    document.title = `${persona.nombre || 'Persona'} — BuscaVenezuela`;
  }

  // Photo
  if (personPhoto) {
    const foto = persona.fotos && persona.fotos.length > 0
      ? persona.fotos[0]
      : null;

    if (foto) {
      personPhoto.classList.remove('person-detail__photo--placeholder');
      personPhoto.innerHTML = `
        <img src="${escapeHtml(foto)}" alt="${escapeHtml(persona.nombre || '')}"
             style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md);"
             loading="lazy"
             onerror="this.style.display='none';this.parentElement.classList.add('person-detail__photo--placeholder');">
      `;
    }
  }

  // Ciudad
  if (personCiudad) {
    const span = personCiudad.querySelector('span');
    if (span) {
      span.textContent = persona.ciudad || 'Sin ciudad';
    }
  }

  // Status badge
  if (personStatusBadge) {
    const tipo = persona.tipo || '';
    let label = '';
    let badgeClass = 'status-badge';

    if (tipo === 'desaparecido') {
      label = 'Desaparecido';
      badgeClass += ' status-badge--red';
    } else if (tipo === 'estoy_bien') {
      label = 'Está bien';
      badgeClass += ' status-badge--green';
    } else if (tipo === 'encontrado') {
      label = 'Encontrado';
      badgeClass += ' status-badge--blue';
    } else {
      label = tipo || 'Sin estado';
    }

    personStatusBadge.innerHTML = `<span class="${badgeClass}">${escapeHtml(label)}</span>`;
  }

  // Last report time
  if (personLastReport) {
    const lastDate = persona.fecha || persona.created_at || '';
    personLastReport.textContent = lastDate
      ? `Último reporte: ${formatDate(lastDate)}`
      : 'Último reporte: —';
  }

  // Update WhatsApp share link
  if (whatsappShareBtn) {
    whatsappShareBtn.href = shareWhatsApp(persona);
  }

  // Update OG meta tags if possible
  if (persona.nombre) {
    updateMetaTag('og:title', `${persona.nombre} — BuscaVenezuela`);
  }
  if (persona.descripcion) {
    updateMetaTag('og:description', persona.descripcion);
  }

  // ── Render social contacts ──────────────────────────────────────────────
  renderSocialContacts(persona);

  // ── Set up copy/share buttons ───────────────────────────────────────────
  setupPersonaShareButtons(persona);
}

function updateMetaTag(property, content) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

// ── Render social contacts (hidden behind "Ver contacto") ─────────────────

function renderSocialContacts(persona) {
  // Toggle button
  if (toggleContactBtn && personSocialContacts) {
    toggleContactBtn.addEventListener('click', () => {
      const isVisible = personSocialContacts.style.display !== 'none';
      if (isVisible) {
        personSocialContacts.style.display = 'none';
        toggleContactBtn.textContent = '📞 Ver contacto';
      } else {
        personSocialContacts.style.display = 'block';
        toggleContactBtn.textContent = '🔒 Ocultar contacto';
      }
    });
  }

  const hasData = persona.contacto_whatsapp || persona.contacto_instagram
    || persona.contacto_email || persona.contacto;

  if (!hasData) {
    // Hide the toggle button if there's no contact data at all
    if (toggleContactBtn) {
      toggleContactBtn.style.display = 'none';
    }
    return;
  }

  // Show toggle button
  if (toggleContactBtn) {
    toggleContactBtn.style.display = '';
  }

  // Populate WhatsApp
  if (socialWhatsappValue && socialWhatsappRow) {
    if (persona.contacto_whatsapp) {
      socialWhatsappValue.textContent = persona.contacto_whatsapp;
    } else {
      socialWhatsappRow.style.display = 'none';
    }
  }

  // Populate Instagram
  if (socialInstagramValue && socialInstagramRow) {
    if (persona.contacto_instagram) {
      socialInstagramValue.textContent = persona.contacto_instagram;
    } else {
      socialInstagramRow.style.display = 'none';
    }
  }

  // Populate Email
  if (socialEmailValue && socialEmailRow) {
    if (persona.contacto_email) {
      socialEmailValue.textContent = persona.contacto_email;
    } else {
      socialEmailRow.style.display = 'none';
    }
  }

  // Populate Other
  if (socialOtroValue && socialOtroRow) {
    if (persona.contacto || persona.contacto_info) {
      socialOtroValue.textContent = persona.contacto || persona.contacto_info || '';
    } else {
      socialOtroRow.style.display = 'none';
    }
  }
}

// ── Setup persona page share buttons ──────────────────────────────────────

function setupPersonaShareButtons(persona) {
  const personaUrl = `${window.location.origin}/persona.html?id=${encodeURIComponent(persona.id)}`;

  // Copy link button
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(personaUrl);
        showToast('¡Enlace copiado al portapapeles!', 'success');
      } catch {
        showToast('No se pudo copiar el enlace. Copia manualmente.', 'error');
      }
    });
  }

  // Copy share text button
  if (copyShareTextBtn && shareTextPreview && persona) {
    const shareText = generateShareText({
      id: persona.id,
      nombre: persona.nombre,
      ciudad: persona.ciudad,
      ultima_zona: persona.ultima_zona,
      descripcion: persona.descripcion,
      tipo: persona.tipo,
    });
    shareTextPreview.textContent = shareText;
    shareTextPreview.style.display = 'block';

    copyShareTextBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareText);
        showToast('¡Texto copiado! Pégalo en Instagram, Twitter o donde quieras.', 'success');
      } catch {
        showToast('No se pudo copiar. Intenta de nuevo.', 'error');
      }
    });
  }
}

// ── Render report timeline ──────────────────────────────────────────────────

function renderTimeline(reportes) {
  if (!reportTimeline) return;

  // Hide skeletons
  if (reportSkeleton1) reportSkeleton1.remove();
  if (reportSkeleton2) reportSkeleton2.remove();
  const allSkeletons = reportTimeline.querySelectorAll('.skeleton');
  allSkeletons.forEach((s) => s.remove());

  if (!reportes || reportes.length === 0) {
    if (noReportsState) noReportsState.classList.remove('hidden');
    return;
  }

  if (noReportsState) noReportsState.classList.add('hidden');

  // Sort newest first
  const sorted = [...reportes].sort((a, b) => {
    const da = a.fecha ? new Date(a.fecha).getTime() : 0;
    const db = b.fecha ? new Date(b.fecha).getTime() : 0;
    return db - da;
  });

  const html = sorted.map((report) => {
    const tipoLabel = report.tipo === 'esta-bien' ? 'Está bien'
      : report.tipo === 'fue-visto' ? 'Fue visto/a'
      : report.tipo === 'encontrado' ? 'Encontrado'
      : report.tipo || 'Reporte';

    const fotoHtml = report.fotos && report.fotos.length > 0
      ? report.fotos.map((f) => `
          <img src="${escapeHtml(f)}" alt="Foto del reporte"
               class="report-timeline__photo"
               style="width:100%;max-width:200px;border-radius:var(--radius-sm);cursor:pointer;margin-top:var(--space-2);"
               loading="lazy"
               onclick="this.style.maxWidth='100%';this.style.cursor='default';">
        `).join('')
      : '';

    const dateStr = report.fecha
      ? formatDate(report.fecha)
      : '';

    return `
      <div class="card report-card">
        <div class="report-card__header">
          <span class="report-card__type">${escapeHtml(tipoLabel)}</span>
          ${dateStr ? `<span class="report-card__date text-small text-muted">${escapeHtml(dateStr)}</span>` : ''}
        </div>
        <p class="report-card__desc">${escapeHtml(report.descripcion || '(Sin descripción)')}</p>
        ${fotoHtml}
        ${report.contacto ? `<p class="report-card__contact text-small text-muted">Contacto: ${escapeHtml(report.contacto)}</p>` : ''}
      </div>
    `;
  }).join('');

  reportTimeline.innerHTML = html;
}

// ── Report form toggle ──────────────────────────────────────────────────────

function setupReportForm() {
  if (!toggleReportFormBtn || !reportForm) return;

  toggleReportFormBtn.addEventListener('click', () => {
    const isHidden = reportForm.classList.toggle('hidden');
    toggleReportFormBtn.textContent = isHidden
      ? 'Reportar información'
      : 'Ocultar formulario';
  });

  if (cancelReportBtn) {
    cancelReportBtn.addEventListener('click', () => {
      reportForm.classList.add('hidden');
      toggleReportFormBtn.textContent = 'Reportar información';
      if (reportFormStatus) {
        reportFormStatus.classList.add('hidden');
        reportFormStatus.textContent = '';
      }
    });
  }

  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate
    const tipo = reportTipo ? reportTipo.value : '';
    const descripcion = reportDescripcion ? reportDescripcion.value.trim() : '';
    const contacto = reportContacto ? reportContacto.value.trim() : '';

    if (!tipo) {
      showFormStatus('Selecciona un tipo de reporte.', 'error');
      return;
    }
    if (!descripcion) {
      showFormStatus('Escribe una descripción.', 'error');
      return;
    }

    // Process photos
    let fotosBase64 = [];
    if (reportFotos && reportFotos.files.length > 0) {
      try {
        for (const file of reportFotos.files) {
          const resized = await resizeImage(file, 800);
          fotosBase64.push(resized);
        }
      } catch (err) {
        showFormStatus('Error al procesar las fotos. Intenta de nuevo.', 'error');
        return;
      }
    }

    // Submit
    setSubmitLoading(true);
    clearFormStatus();

    try {
      await createReporte({
        persona_id: currentPersona ? currentPersona.id : null,
        tipo,
        descripcion,
        fotos: fotosBase64,
        contacto: contacto || undefined,
      });

      showFormStatus('¡Reporte enviado exitosamente!', 'success');
      showToast('Reporte enviado exitosamente.', 'success');

      // Reset form
      reportForm.reset();
      reportForm.classList.add('hidden');
      if (toggleReportFormBtn) {
        toggleReportFormBtn.textContent = 'Reportar información';
      }

      // Refresh the timeline
      if (currentPersona) {
        await loadPersona(currentPersona.id);
      }

    } catch (err) {
      showFormStatus(err.message || 'Error al enviar el reporte.', 'error');
      showToast('Error al enviar el reporte.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  });
}

function showFormStatus(message, type) {
  if (!reportFormStatus) return;
  reportFormStatus.textContent = message;
  reportFormStatus.className = 'text-small mt-4';
  if (type === 'error') {
    reportFormStatus.style.color = 'var(--error)';
  } else if (type === 'success') {
    reportFormStatus.style.color = 'var(--success)';
  }
  reportFormStatus.classList.remove('hidden');
}

function clearFormStatus() {
  if (reportFormStatus) {
    reportFormStatus.classList.add('hidden');
    reportFormStatus.textContent = '';
  }
}

function setSubmitLoading(loading) {
  if (!submitReportBtn) return;
  if (loading) {
    submitReportBtn.classList.add('btn--loading');
    submitReportBtn.disabled = true;
  } else {
    submitReportBtn.classList.remove('btn--loading');
    submitReportBtn.disabled = false;
  }
}

// ── Load persona data ───────────────────────────────────────────────────────

async function loadPersona(id) {
  if (!id) {
    showError('No se especificó una persona.');
    return;
  }

  try {
    const persona = await fetchPersona(id);
    renderPersonHeader(persona);

    const reportes = persona.reportes || persona.reports || [];
    renderTimeline(reportes);

  } catch (err) {
    console.error('Error loading persona:', err);
    showError(err.message || 'No se pudo cargar la información de la persona.');
  }
}

function showError(message) {
  if (personName) personName.textContent = 'Error';
  if (personLastReport) personLastReport.textContent = message;
  if (reportTimeline) {
    if (reportSkeleton1) reportSkeleton1.remove();
    if (reportSkeleton2) reportSkeleton2.remove();
    reportTimeline.innerHTML = '';
  }
  showToast(message, 'error');
}

// ── Photo gallery full-size view ────────────────────────────────────────────

function setupPhotoGallery() {
  document.addEventListener('click', (e) => {
    const img = e.target.closest('.report-timeline__photo');
    if (!img) return;

    // Toggle full size
    if (img.style.maxWidth === '100%') {
      img.style.maxWidth = '200px';
      img.style.cursor = 'pointer';
    } else {
      img.style.maxWidth = '100%';
      img.style.cursor = 'default';
    }
  });
}

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const id = getUrlParam('id');
  if (!id) {
    showError('No se especificó un ID de persona en la URL (?id=).');
    return;
  }

  loadPersona(id);
  setupReportForm();
  setupPhotoGallery();
});
