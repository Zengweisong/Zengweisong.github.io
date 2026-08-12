(() => {
  'use strict';

  function initProjectFilters() {
    const buttons = [...document.querySelectorAll('[data-project-filter]')];
    const cards = [...document.querySelectorAll('[data-project-card]')];
    const empty = document.querySelector('[data-project-empty]');
    if (!buttons.length || !cards.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.projectFilter;
        let visible = 0;

        buttons.forEach((item) => {
          const active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });

        cards.forEach((card) => {
          const groups = (card.dataset.groups || '').split(/\s+/);
          const show = filter === 'all' || groups.includes(filter);
          card.hidden = !show;
          if (show) visible += 1;
        });

        if (empty) empty.hidden = visible !== 0;
      });
    });
  }

  function initImageFallbacks() {
    document.querySelectorAll('[data-project-image]').forEach((image) => {
      image.addEventListener('error', () => image.remove(), { once: true });
      if (image.complete && image.naturalWidth === 0) image.remove();
    });
  }

  function initLightbox() {
    const lightbox = document.querySelector('[data-lightbox]');
    if (!lightbox) return;
    const image = lightbox.querySelector('img');
    const closeButton = lightbox.querySelector('[data-lightbox-close]');
    let lastTrigger = null;

    const close = () => {
      lightbox.hidden = true;
      image.src = '';
      document.body.classList.remove('portfolio-lightbox-open');
      if (lastTrigger) lastTrigger.focus();
    };

    document.querySelectorAll('[data-lightbox-image]').forEach((button) => {
      button.addEventListener('click', () => {
        lastTrigger = button;
        image.src = button.dataset.lightboxImage;
        image.alt = button.dataset.lightboxAlt || '';
        lightbox.hidden = false;
        document.body.classList.add('portfolio-lightbox-open');
        closeButton.focus();
      });
    });

    closeButton.addEventListener('click', close);
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !lightbox.hidden) close();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initProjectFilters();
    initImageFallbacks();
    initLightbox();
  });
})();
