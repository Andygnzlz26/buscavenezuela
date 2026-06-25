/**
 * BuscaVenezuela — "Estoy Bien" (I'm OK) Page Module
 * Handles self-report form submission, photo resizing (max 1), green styling,
 * and survivor-tone WhatsApp sharing.
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
const estoyBienForm = document.getElementById('estoyBienForm');
const submitBtn = document.getElementById('submitBtn');

// Success section
const successSection = document.getElementById('successSection');
const personLink = document.getElementById('personLink');
const whatsappShareBtn = document.getElementById('whatsappShareBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const copyShareTextBtn = document.getElementById('copyShareTextBtn');
const shareTextPreview = document.getElementById('shareTextPreview');

// Photo
const fotoInput = document.getElementById('foto');
const photoPreview = document.getElementById('photoPreview');
const photoCount = document.getElementById('photoCount');

// ── State ───────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 1;
let selectedPhoto = null; // { file, dataUrl } or null

// ── Helpers ─────────────────────────────────────────────────────────────────

function showError(fieldId, message) {
  const el = document.getElementById(`error-${fieldId}`);
  if (!el) return;
  el.textContent = message;
  el.classList.add('form-error--visible');

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
  const fields = ['nombre', 'ciudad', 'zona', 'mensaje', 'foto', 'contacto', 'contacto_whatsapp', 'contacto_instagram', 'contacto_email'];
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
    submitBtn.textContent = '✓ Estoy bien — Reportar';
  }
}

// ── Validation ──────────────────────────────────────────────────────────────

function validate() {
  let valid = true;
  clearAllErrors();

  const nombre = document.getElementById('nombre')?.value.trim();
  const ciudad = document.getElementById('ciudad')?.value;

  if (!nombre || nombre.length < 2) {
    showError('nombre', 'Tu nombre debe tener al menos 2 caracteres.');
    valid = false;
  }

  if (!ciudad) {
    showError('ciudad', 'Selecciona la ciudad donde te encuentras.');
    valid = false;
  }

  // At least one contact required
  const contacto = document.getElementById('contacto')?.value.trim() || '';
  const contactoWhatsapp = document.getElementById('contacto_whatsapp')?.value.trim() || '';
  const contactoInstagram = document.getElementById('contacto_instagram')?.value.trim() || '';
  const contactoEmail = document.getElementById('contacto_email')?.value.trim() || '';

  const hasContact = contacto || contactoWhatsapp || contactoInstagram || contactoEmail;
  if (!hasContact) {
    showError('contacto', 'Debes proporcionar al menos un medio de contacto para que tu familia pueda confirmar (WhatsApp, Instagram, Email u otro).');
    valid = false;
  }

  return valid;
}

// ── Photo handling ──────────────────────────────────────────────────────────

function updatePhotoPreview() {
  if (!photoPreview) return;

  if (!selectedPhoto) {
    photoPreview.innerHTML = '';
  } else {
    photoPreview.innerHTML = `
      <div class="photo-preview__item">
        <img src="${selectedPhoto.dataUrl}" alt="Tu foto">
        <button type="button" class="photo-preview__remove"
                aria-label="Quitar foto">&times;</button>
      </div>
    `;

    photoPreview.querySelector('.photo-preview__remove')?.addEventListener('click', () => {
      selectedPhoto = null;
      updatePhotoPreview();
      updatePhotoCount();
      clearError('foto');
    });
  }

  updatePhotoCount();
}

function updatePhotoCount() {
  if (!photoCount) return;
  photoCount.textContent = selectedPhoto
    ? '1 foto seleccionada. Formatos: JPG, PNG, WebP.'
    : `Máximo ${MAX_PHOTOS} foto. Para que tu familia te reconozca. Formatos: JPG, PNG, WebP.`;
}

function setupPhotoInput() {
  if (!fotoInput) return;

  fotoInput.addEventListener('change', async () => {
    clearError('foto');

    const files = Array.from(fotoInput.files || []);
    if (files.length === 0) return;

    // Only take the first file (max 1 photo)
    const file = files[0];

    try {
      const dataUrl = await resizeImage(file, 800);
      selectedPhoto = { file, dataUrl };
      updatePhotoPreview();
    } catch (err) {
      showError('foto', `Error al procesar la foto. Intenta con otra imagen.`);
      console.error('Photo resize error:', err);
    }

    fotoInput.value = '';
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

  // Set up WhatsApp share button with survivor-tone message
  if (whatsappShareBtn && persona) {
    const waPersona = {
      id: persona.id,
      nombre: persona.nombre,
      ciudad: persona.ciudad,
      ultima_zona: persona.ultima_zona,
      descripcion: persona.descripcion,
      tipo: 'estoy_bien',
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
      tipo: 'estoy_bien',
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
  const mensaje = document.getElementById('mensaje')?.value.trim() || '';
  const contacto = document.getElementById('contacto')?.value.trim() || '';
  const contactoWhatsapp = document.getElementById('contacto_whatsapp')?.value.trim() || '';
  const contactoInstagram = document.getElementById('contacto_instagram')?.value.trim() || '';
  const contactoEmail = document.getElementById('contacto_email')?.value.trim() || '';

  const fotos = selectedPhoto ? [selectedPhoto.dataUrl] : [];

  const payload = {
    name: nombre,
    ciudad,
    ultima_zona: zona,
    descripcion: mensaje,
    contacto_info: contacto || '',
    contacto_whatsapp: contactoWhatsapp || undefined,
    contacto_instagram: contactoInstagram || undefined,
    contacto_email: contactoEmail || undefined,
    tipo: 'estoy_bien',
    fotos: fotos.length > 0 ? fotos : undefined,
  };

  try {
    const persona = await createPersona(payload);
    showToast('¡Reportado! Tu información está visible para tu familia.', 'success');
    showSuccess(persona);
  } catch (err) {
    showToast(err.message || 'Error al enviar tu reporte. Intenta de nuevo.', 'error');
  } finally {
    setSubmitLoading(false);
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupPhotoInput();

  if (estoyBienForm) {
    estoyBienForm.addEventListener('submit', handleSubmit);
  }

  // Clear errors on input
  estoyBienForm?.querySelectorAll('input, select, textarea').forEach((el) => {
    el.addEventListener('input', () => {
      const fieldId = el.id || el.name;
      clearError(fieldId);
    });
  });
});
