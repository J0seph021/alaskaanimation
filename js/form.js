/* ===========================================
   Alaska Animation — Form Validation
   =========================================== */

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('contactForm');
  if (!form) return;

  // Set min date to today
  const dateInput = form.querySelector('#date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }

  // Validation on submit
  form.addEventListener('submit', (e) => {
    let valid = true;

    // Clear previous errors
    form.querySelectorAll('.form-error').forEach(err => err.remove());
    form.querySelectorAll('.form-group--error').forEach(g => g.classList.remove('form-group--error'));

    // Required fields check
    const required = form.querySelectorAll('[required]');
    required.forEach(field => {
      if (!field.value.trim()) {
        valid = false;
        showError(field, 'Ce champ est requis.');
      }
    });

    // Email format
    const email = form.querySelector('#email');
    if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      valid = false;
      showError(email, 'Veuillez entrer un courriel valide.');
    }

    // Phone format (basic)
    const phone = form.querySelector('#phone');
    if (phone && phone.value && phone.value.replace(/[\s\-().]/g, '').length < 10) {
      valid = false;
      showError(phone, 'Veuillez entrer un numero de telephone valide.');
    }

    if (!valid) {
      e.preventDefault();
      // Scroll to first error
      const firstError = form.querySelector('.form-group--error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  function showError(field, message) {
    const group = field.closest('.form-group');
    if (!group) return;
    group.classList.add('form-group--error');
    const err = document.createElement('span');
    err.className = 'form-error';
    err.textContent = message;
    err.style.cssText = 'color:#FF1493;font-size:0.85rem;margin-top:4px;display:block;';
    group.appendChild(err);
  }

  // Clear error on input
  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('input', () => {
      const group = field.closest('.form-group');
      if (group) {
        group.classList.remove('form-group--error');
        const err = group.querySelector('.form-error');
        if (err) err.remove();
      }
    });
  });

});
