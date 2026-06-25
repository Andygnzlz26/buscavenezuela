/**
 * BuscaVenezuela — Report Missing Person Page Module
 * Handles form submission, photo resizing, validation, and success state.
 */

import {
  createPersona,
  resizeImage,
  showToast,
  shareWhatsApp,
  generateShareText,
} from '../app.js';

// ── DOM references ──────────────────────────────────────────────────────────

const formSection = document.getElementById('formSection');
const reportForm = document.getElementById('reportForm');
const submitBtn = document.getElementById('submitBtn');

// Success section
const successSection = document.getElementById('successSection');
const personLink = document.getElementById('personLink');
const whatsappShareBtn = document.getElementById('whatsappShareBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const copyShareTextBtn = document.getElementById('copyShareTextBtn');
const shareTextPreview = document.getElementById('shareTextPreview');

// Photo
const fotosInput = document.getElementById('fotos');
const photoPreview = document.getElementById('photoPreview');
const photoCount = document.getElementById('photoCount');

// ── State ───────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 3;
let selectedPhotos = []; // Array of { file, dataUrl }

// ── Helpers ─────────────────────────────────────────────────────────────────

function showError(fieldId, message) {
  const el = document.getElementById(`error-${fieldId}`);
  if (!el) return;
  el.textContent = message;
  el.classList.add('form-error--visible');

  // Also add error class to the input
  const input = document.getElementById(fieldId);
  if (input) input.classList.add('error');
}

function clearError(fieldId) {
  const el = document.getElementById(`error-${fieldId}`);
  if (!el) return;
  el.textContent = '';
  el.classList.remove('form-error--visible');

  const input = document.getElementById(fieldId);
  if (input) input.classList.remove('error');
}

function clearAllErrors() {
  const fields = ['nombre', 'ciudad', 'zona', 'descripcion', 'fotos', 'reportante', 'contacto', 'contacto_whatsapp', 'contacto_instagram', 'contacto_email'];
  fields.forEach(clearError);
}

function setSubmitLoading(loading) {
  if (!submitBtn) return;
  if (loading) {
    submitBtn.classList.add('btn--loading');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
  } else {
    submitBtn.classList.remove('btn--loading');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Reportar desaparecido';
  }
}

// ── Validation ──────────────────────────────────────────────────────────────

function validate() {
  let valid = true;
  clearAllErrors();

  const nombre = document.getElementById('nombre')?.value.trim();
  const ciudad = document.getElementById('ciudad')?.value;

  if (!nombre || nombre.length < 2) {
    showError('nombre', 'El nombre debe tener al menos 2 caracteres.');
    valid = false;
  }

  if (!ciudad) {
    showError('ciudad', 'Selecciona una ciudad.');
    valid = false;
  }

  // Description required
  const descripcion = document.getElementById('descripcion')?.value.trim() || '';
  if (!descripcion || descripcion.length < 5) {
    showError('descripcion', 'Describe a la persona o la situación (mínimo 5 caracteres).');
    valid = false;
  }

  const contactoWhatsapp = document.getElementById('contacto_whatsapp')?.value.trim() || '';
  const contactoInstagram = document.getElementById('contacto_instagram')?.value.trim() || '';
  const contactoEmail = document.getElementById('contacto_email')?.value.trim() || '';
  const contacto = document.getElementById('contacto')?.value.trim() || '';

  const hasContact = contactoWhatsapp || contactoInstagram || contactoEmail || contacto;
  if (!hasContact) {
    showError('contacto', 'Debes proporcionar al menos un medio de contacto (WhatsApp, Instagram, Email u otro).');
    valid = false;
  }

  return valid;
}

// ── Photo handling ──────────────────────────────────────────────────────────

function updatePhotoPreview() {
  if (!photoPreview) return;

  photoPreview.innerHTML = selectedPhotos.map((photo, index) => `
    <div class="photo-preview__item">
      <img src="${photo.dataUrl}" alt="Foto ${index + 1}">
      <button type="button" class="photo-preview__remove"
              data-index="${index}"
              aria-label="Quitar foto ${index + 1}">&times;</button>
    </div>
  `).join('');

  // Add remove listeners
  photoPreview.querySelectorAll('.photo-preview__remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      selectedPhotos.splice(idx, 1);
      updatePhotoPreview();
      updatePhotoCount();
      clearError('fotos');
    });
  });

  updatePhotoCount();
}

function updatePhotoCount() {
  if (!photoCount) return;
  photoCount.textContent = selectedPhotos.length === 0
    ? `Máximo ${MAX_PHOTOS} fotos. Formatos: JPG, PNG, WebP.`
    : `${selectedPhotos.length} de ${MAX_PHOTOS} foto(s) seleccionada(s). Formatos: JPG, PNG, WebP.`;
}

function setupPhotoInput() {
  if (!fotosInput) return;

  fotosInput.addEventListener('change', async () => {
    clearError('fotos');

    const files = Array.from(fotosInput.files || []);

    // Check max photos limit
    if (selectedPhotos.length + files.length > MAX_PHOTOS) {
      showError('fotos', `Máximo ${MAX_PHOTOS} fotos permitidas.`);
      fotosInput.value = '';
      return;
    }

    // Resize each photo
    for (const file of files) {
      try {
        const dataUrl = await resizeImage(file, 800);
        selectedPhotos.push({ file, dataUrl });
      } catch (err) {
        showError('fotos', `Error al procesar "${file.name}".`);
        console.error('Photo resize error:', err);
      }
    }

    updatePhotoPreview();
    fotosInput.value = ''; // Reset input so the same file can be re-selected
  });
}

// ── Show success ────────────────────────────────────────────────────────────

function showSuccess(persona) {
  if (formSection) formSection.style.display = 'none';
  if (successSection) successSection.classList.add('success-section--visible');

  // Set person link
  const personaUrl = `${window.location.origin}/persona.html?id=${encodeURIComponent(persona.id)}`;
  if (personLink) {
    personLink.href = personaUrl;
  }

  // Set up WhatsApp share button
  if (whatsappShareBtn && persona) {
    const waPersona = {
      id: persona.id,
      nombre: persona.nombre,
      ciudad: persona.ciudad,
      ultima_zona: persona.ultima_zona,
      descripcion: persona.descripcion,
      tipo: 'desaparecido',
      fecha: persona.fecha,
      contacto_whatsapp: persona.contacto_whatsapp,
      contacto_instagram: persona.contacto_instagram,
      contacto_email: persona.contacto_email,
    };
    const url = shareWhatsApp(waPersona);
    whatsappShareBtn.onclick = () => {
      window.open(url, '_blank', 'noopener,noreferrer');
    };
  }

  // Set up copy link button
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

  // Set up copy share text button
  if (copyShareTextBtn && shareTextPreview && persona) {
    const shareText = generateShareText({
      id: persona.id,
      nombre: persona.nombre,
      ciudad: persona.ciudad,
      ultima_zona: persona.ultima_zona,
      descripcion: persona.descripcion,
      tipo: 'desaparecido',
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

  // Scroll to success section
  if (successSection) {
    successSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ── Form submission ─────────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();

  if (!validate()) {
    // Scroll to first error
    const firstError = document.querySelector('.form-error--visible');
    if (firstError) {
      firstError.closest('.form-group')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  setSubmitLoading(true);

  const nombre = document.getElementById('nombre')?.value.trim();
  const ciudad = document.getElementById('ciudad')?.value;
  const zona = document.getElementById('zona')?.value.trim() || '';
  const descripcion = document.getElementById('descripcion')?.value.trim() || '';
  const reportante = document.getElementById('reportante')?.value.trim() || '';
  const contacto = document.getElementById('contacto')?.value.trim() || '';
  const contactoWhatsapp = document.getElementById('contacto_whatsapp')?.value.trim() || '';
  const contactoInstagram = document.getElementById('contacto_instagram')?.value.trim() || '';
  const contactoEmail = document.getElementById('contacto_email')?.value.trim() || '';

  const fotos = selectedPhotos.map((p) => p.dataUrl);

  const payload = {
    name: nombre,
    ciudad,
    ultima_zona: zona,
    descripcion,
    contacto_info: `${reportante ? reportante + (contacto ? ' — ' + contacto : contacto) : (contacto || '')}`.trim() || undefined,
    contacto_whatsapp: contactoWhatsapp || undefined,
    contacto_instagram: contactoInstagram || undefined,
    contacto_email: contactoEmail || undefined,
    tipo: 'desaparecido',
    fotos: fotos.length > 0 ? fotos : undefined,
  };

  try {
    const persona = await createPersona(payload);
    showToast('Reporte creado exitosamente.', 'success');
    showSuccess(persona);
  } catch (err) {
    showToast(err.message || 'Error al crear el reporte. Intenta de nuevo.', 'error');
  } finally {
    setSubmitLoading(false);
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupPhotoInput();

  if (reportForm) {
    reportForm.addEventListener('submit', handleSubmit);
  }

  // Clear errors on input
  reportForm?.querySelectorAll('input, select, textarea').forEach((el) => {
    el.addEventListener('input', () => {
      const fieldId = el.id || el.name;
      clearError(fieldId);
    });
  });
});
