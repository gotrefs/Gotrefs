/**
 * GoTRefs — script.js
 *
 * Submits referee onboarding to Supabase `profiles` (role = ref) and
 * organizer requests to `events`. Verification files go to the
 * `verification_documents` storage bucket.
 *
 * Configuration: copy `officialconnect_config.example.json` to
 * `officialconnect_config.json` and set `supabaseUrl` + `supabaseAnonKey`
 * from Project Settings → API in the Supabase dashboard.
 */

let supabaseClient = null;

async function ensureSupabase() {
  if (supabaseClient) return supabaseClient;

  const [{ createClient }, cfg] = await Promise.all([
    import('https://esm.sh/@supabase/supabase-js@2'),
    fetch(new URL('officialconnect_config.json', window.location.href)).then((r) => {
      if (!r.ok) {
        throw new Error(
          'Could not load officialconnect_config.json. Copy officialconnect_config.example.json and add your Supabase URL and anon key.'
        );
      }
      return r.json();
    })
  ]);

  const url = cfg.supabaseUrl?.trim();
  const key = cfg.supabaseAnonKey?.trim();
  if (!url || !key || url.includes('YOUR_PROJECT') || key.includes('YOUR_SUPABASE')) {
    throw new Error('Update officialconnect_config.json with your real Supabase URL and anon key.');
  }

  supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseClient;
}

function sanitizeStorageFilename(name) {
  const base = (name || 'document').split(/[/\\]/).pop();
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'document';
}

async function uploadVerificationDocument(client, file) {
  const path = `${crypto.randomUUID()}_${sanitizeStorageFilename(file.name)}`;
  const { error } = await client.storage.from('verification_documents').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined
  });
  if (error) throw new Error(error.message || 'Upload failed');
  return path;
}

function collectAvailabilityDays(raw) {
  const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return labels.filter((d) => raw[`avail_${d.slice(0, 3).toLowerCase()}`]).join(', ');
}

function hideInlineBanners() {
  ['refSuccess', 'refError', 'orgSuccess', 'orgError'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function showInlineError(type, message) {
  hideInlineBanners();
  const id = type === 'referee' ? 'refError' : 'orgError';
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  const box = document.getElementById('modalBox');
  if (box) box.scrollTop = 0;
}

function resetRefUploadUi() {
  const label = document.getElementById('refUploadLabel');
  const dropzone = document.getElementById('refDropzone');
  if (label) {
    label.textContent = 'Click to upload or drag & drop';
  }
  if (dropzone) {
    dropzone.classList.remove('upload-active', 'upload-error', 'upload-drag-over');
  }
}

/* ═══════════════════════════════════════
   FILE UPLOAD — visual feedback
═══════════════════════════════════════ */
function handleFileSelect(event, labelId, dropzoneId) {
  const file = event.target.files[0];
  const label = document.getElementById(labelId);
  const dropzone = document.getElementById(dropzoneId);
  const MAX_BYTES = 10 * 1024 * 1024;

  if (!file) return;

  if (file.size > MAX_BYTES) {
    label.textContent = '⚠ File exceeds 10 MB — please choose a smaller file';
    dropzone.classList.add('upload-error');
    dropzone.classList.remove('upload-active');
    event.target.value = '';
    return;
  }

  label.textContent = `✓ ${file.name}`;
  dropzone.classList.add('upload-active');
  dropzone.classList.remove('upload-error');
}

/* ═══════════════════════════════════════
   DRAG-AND-DROP support for the dropzone
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  const dropzone = document.getElementById('refDropzone');
  const fileInput = document.getElementById('ref_doc');
  if (!dropzone || !fileInput) return;

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('upload-drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('upload-drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) {
      fileInput.files = files;
      handleFileSelect({ target: fileInput }, 'refUploadLabel', 'refDropzone');
    }
  });
});

/* ═══════════════════════════════════════
   MODAL MANAGEMENT
═══════════════════════════════════════ */
function openModal(type) {
  const overlay = document.getElementById('modalOverlay');
  const refForm = document.getElementById('refForm');
  const orgForm = document.getElementById('orgForm');
  const success = document.getElementById('successState');
  const tag = document.getElementById('modalTag');
  const title = document.getElementById('modalTitle');
  const header = document.getElementById('modalHeader');

  hideInlineBanners();
  refForm.classList.add('hidden');
  orgForm.classList.add('hidden');
  success.classList.add('hidden');
  header.classList.remove('hidden');

  if (type === 'referee') {
    tag.textContent = 'Referee Sign-Up';
    title.textContent = 'Join as a Referee';
    header.style.borderTopColor = 'var(--orange)';
    refForm.classList.remove('hidden');
  } else {
    tag.textContent = 'Event Request';
    title.textContent = 'Find Refs for Your Event';
    header.style.borderTopColor = 'var(--navy)';
    orgForm.classList.remove('hidden');
  }

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    const firstInput = overlay.querySelector('input:not([type="hidden"]), select');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

function closeModalOutside(event) {
  if (event.target === document.getElementById('modalOverlay')) closeModal();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

/* ═══════════════════════════════════════
   FORM SUBMISSION → SUPABASE
═══════════════════════════════════════ */
async function handleSubmit(event, type) {
  event.preventDefault();
  hideInlineBanners();

  const form = event.target;
  const btnText = document.getElementById(type === 'referee' ? 'refBtnText' : 'orgBtnText');
  const btnLoad = document.getElementById(type === 'referee' ? 'refBtnLoading' : 'orgBtnLoading');
  const submitBtn = form.querySelector('button[type="submit"]');

  btnText.classList.add('hidden');
  btnLoad.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const client = await ensureSupabase();
    const raw = collectFormData(form);

    if (type === 'referee') {
      const availability = collectAvailabilityDays(raw);
      if (!availability) {
        throw new Error('Please select at least one day for general availability.');
      }

      const fileInput = document.getElementById('ref_doc');
      const file = fileInput?.files?.[0];
      if (!file) {
        throw new Error('Please upload a verification document.');
      }

      const storagePath = await uploadVerificationDocument(client, file);

      const rateVal = raw.rate_per_game;
      const rate =
        rateVal === '' || rateVal === undefined || rateVal === null ? null : Number(rateVal);

      const { error } = await client.from('profiles').insert({
        role: 'ref',
        full_name: String(raw.name || '').trim(),
        email: String(raw.email || '').trim(),
        phone: String(raw.phone || '').trim() || null,
        zip_code: String(raw.zip_code || '').trim(),
        sport: String(raw.sport || '').trim(),
        certification_level: String(raw.certification_level || '').trim(),
        availability,
        rate_per_game: Number.isFinite(rate) ? rate : null,
        verification_document_storage_path: storagePath
      });

      if (error) throw new Error(error.message || 'Could not save referee profile.');
    } else {
      const { error } = await client.from('events').insert({
        organizer_name: String(raw.name || '').trim(),
        organizer_email: String(raw.email || '').trim(),
        organizer_phone: String(raw.phone || '').trim() || null,
        organization: String(raw.organization || '').trim(),
        sport: String(raw.sport || '').trim(),
        officials_needed: String(raw.officials_needed || '').trim(),
        event_date: String(raw.event_date || '').trim(),
        zip_code: String(raw.zip_code || '').trim(),
        certification_required: String(raw.certification_required || 'any').trim(),
        notes: String(raw.notes || '').trim() || null
      });

      if (error) throw new Error(error.message || 'Could not save event request.');
    }

    showSuccess(type);
    form.reset();
    resetAvailabilityCheckboxes();
    resetRefUploadUi();
  } catch (err) {
    console.error('[GoTRefs] Submission error:', err);
    const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    showInlineError(type, msg);
    showSubmitError(submitBtn, type);
  } finally {
    btnText.classList.remove('hidden');
    btnLoad.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

function showSuccess(type) {
  const refForm = document.getElementById('refForm');
  const orgForm = document.getElementById('orgForm');
  const success = document.getElementById('successState');
  const title = document.getElementById('successTitle');
  const msg = document.getElementById('successMsg');
  const header = document.getElementById('modalHeader');

  hideInlineBanners();
  refForm.classList.add('hidden');
  orgForm.classList.add('hidden');
  header.classList.add('hidden');

  if (type === 'referee') {
    title.textContent = "You're on the list!";
    msg.textContent =
      "Thanks for signing up! We'll review your profile and reach out within 24 hours to complete verification.";
  } else {
    title.textContent = 'Request Received!';
    msg.textContent =
      "We're matching you with available refs now. Expect a response within 2 hours. Check your email for next steps.";
  }

  success.classList.remove('hidden');
  document.getElementById('modalBox').scrollTop = 0;
}

function showSubmitError(btn, type) {
  const original = type === 'referee' ? 'Create My Referee Profile →' : 'Find Refs for My Event →';
  btn.textContent = '⚠ Something went wrong — Try again';
  btn.style.background = '#DC2626';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
  }, 3500);
}

/* ═══════════════════════════════════════
   AVAILABILITY CHECKBOXES
═══════════════════════════════════════ */
function resetAvailabilityCheckboxes() {
  document.querySelectorAll('.avail-check input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });
}

/* ═══════════════════════════════════════
   SMOOTH SCROLLING
═══════════════════════════════════════ */
function scrollTo(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', function (e) {
    const target = document.getElementById(this.getAttribute('href').slice(1));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

/* ═══════════════════════════════════════
   SCROLL ANIMATIONS
═══════════════════════════════════════ */
(function initScrollAnimations() {
  const style = document.createElement('style');
  style.textContent = `
    .fade-in-section { opacity:0; transform:translateY(24px); transition:opacity .55s ease,transform .55s ease; }
    .fade-in-section.visible { opacity:1; transform:translateY(0); }
  `;
  document.head.appendChild(style);

  const sections = document.querySelectorAll('section:not(#hero), .how-column, .trust-strip');
  sections.forEach((el) => el.classList.add('fade-in-section'));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  sections.forEach((el) => observer.observe(el));
})();

/* ═══════════════════════════════════════
   NAV SCROLL EFFECT
═══════════════════════════════════════ */
(function initNavScroll() {
  const nav = document.querySelector('nav');
  window.addEventListener(
    'scroll',
    () => {
      nav.style.boxShadow = window.scrollY > 20 ? '0 4px 20px rgba(0,0,0,0.3)' : 'none';
    },
    { passive: true }
  );
})();

/* ═══════════════════════════════════════
   UTILITIES
═══════════════════════════════════════ */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function collectFormData(form) {
  const data = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (value instanceof File) continue;
    data[key] = data[key] ? [].concat(data[key], value) : value;
  }
  return data;
}
