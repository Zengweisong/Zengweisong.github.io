(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const springState = new WeakMap();

  function spring(element, channel, target, update, options = {}) {
    let channels = springState.get(element);
    if (!channels) {
      channels = new Map();
      springState.set(element, channels);
    }

    const previous = channels.get(channel);
    if (previous && previous.frame) cancelAnimationFrame(previous.frame);

    const response = options.response || 0.34;
    const dampingRatio = options.damping || 1;
    const omega = (Math.PI * 2) / response;
    const state = {
      value: previous ? previous.value : (options.from ?? target),
      velocity: previous ? previous.velocity : (options.velocity || 0),
      frame: 0,
      time: performance.now()
    };
    channels.set(channel, state);

    if (reducedMotion.matches) {
      state.value = target;
      state.velocity = 0;
      update(target);
      if (options.complete) options.complete();
      return;
    }

    const tick = (now) => {
      const dt = Math.min((now - state.time) / 1000, 1 / 30);
      state.time = now;
      const acceleration = -omega * omega * (state.value - target) - 2 * dampingRatio * omega * state.velocity;
      state.velocity += acceleration * dt;
      state.value += state.velocity * dt;
      update(state.value);

      if (Math.abs(state.velocity) < 0.002 && Math.abs(state.value - target) < 0.001) {
        state.value = target;
        state.velocity = 0;
        update(target);
        state.frame = 0;
        if (options.complete) options.complete();
        return;
      }
      state.frame = requestAnimationFrame(tick);
    };

    state.frame = requestAnimationFrame(tick);
  }

  function setSpringValue(element, channel, value, update) {
    let channels = springState.get(element);
    if (!channels) {
      channels = new Map();
      springState.set(element, channels);
    }
    const previous = channels.get(channel);
    if (previous && previous.frame) cancelAnimationFrame(previous.frame);
    channels.set(channel, { value, velocity: 0, frame: 0, time: performance.now() });
    update(value);
  }

  function initPressFeedback() {
    document.querySelectorAll('[data-pressable]').forEach((element) => {
      const paint = (value) => element.style.setProperty('--press-scale', value.toFixed(4));
      let pointerId = null;

      element.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        pointerId = event.pointerId;
        element.setPointerCapture?.(pointerId);
        setSpringValue(element, 'press', 0.965, paint);
      });

      element.addEventListener('pointermove', (event) => {
        if (pointerId !== event.pointerId) return;
        const rect = element.getBoundingClientRect();
        const inside = event.clientX >= rect.left - 10 && event.clientX <= rect.right + 10 && event.clientY >= rect.top - 10 && event.clientY <= rect.bottom + 10;
        setSpringValue(element, 'press', inside ? 0.965 : 1, paint);
      });

      const release = (event) => {
        if (pointerId !== null && event.pointerId !== pointerId) return;
        pointerId = null;
        spring(element, 'press', 1, paint, { response: 0.28, damping: 0.82 });
      };
      element.addEventListener('pointerup', release);
      element.addEventListener('pointercancel', release);
      element.addEventListener('lostpointercapture', release);
    });
  }

  function initFloatCards() {
    if (reducedMotion.matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    document.querySelectorAll('[data-float-card]').forEach((card) => {
      const paintX = (value) => card.style.setProperty('--float-x', `${value.toFixed(2)}px`);
      const paintY = (value) => card.style.setProperty('--float-y', `${value.toFixed(2)}px`);

      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 5;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 5;
        setSpringValue(card, 'float-x', x, paintX);
        setSpringValue(card, 'float-y', y, paintY);
      });

      card.addEventListener('pointerleave', () => {
        spring(card, 'float-x', 0, paintX, { response: 0.42, damping: 1 });
        spring(card, 'float-y', 0, paintY, { response: 0.42, damping: 1 });
      });
    });
  }

  function initActiveNavigation() {
    const current = `${window.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '')}/`;
    document.querySelectorAll('[data-nav-path]').forEach((link) => {
      const destination = new URL(link.href, window.location.origin);
      if (destination.origin !== window.location.origin) return;
      const path = destination.pathname.replace(/\/$/, '') + '/';
      if (current === path || (path !== '/' && current.startsWith(path))) {
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function revealCard(card) {
    card.hidden = false;
    card.style.opacity = reducedMotion.matches ? '1' : '.45';
    card.style.setProperty('--reveal-scale', reducedMotion.matches ? '1' : '.965');
    setSpringValue(card, 'filter-reveal', reducedMotion.matches ? 1 : 0.965, (value) => {
      card.style.setProperty('--reveal-scale', value.toFixed(4));
    });
    spring(card, 'filter-reveal', 1, (value) => {
      card.style.setProperty('--reveal-scale', value.toFixed(4));
      card.style.opacity = String(Math.max(0, Math.min(1, (value - 0.94) / 0.06)));
    }, { response: 0.34, damping: 1 });
  }

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
          if (show) {
            visible += 1;
            revealCard(card);
          } else {
            card.hidden = true;
          }
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

  function initCaseStudyNavigation() {
    const links = [...document.querySelectorAll('[data-case-nav]')];
    if (!links.length || !('IntersectionObserver' in window)) return;

    const sections = links
      .map((link) => document.querySelector(link.hash))
      .filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;

      links.forEach((link) => {
        const active = link.hash === `#${visible.target.id}`;
        link.classList.toggle('is-current', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-18% 0px -68% 0px', threshold: 0 });

    sections.forEach((section) => observer.observe(section));
  }

  function initVesselExhibition() {
    const elements = [...document.querySelectorAll('[data-vessel-reveal]')];
    if (!elements.length) return;

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    document.body.classList.add('vessel-motion-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

    elements.forEach((element) => observer.observe(element));
  }

  function initLightbox() {
    const lightbox = document.querySelector('[data-lightbox]');
    if (!lightbox) return;
    const surface = lightbox.querySelector('[data-lightbox-surface]');
    const image = lightbox.querySelector('img');
    const closeButton = lightbox.querySelector('[data-lightbox-close]');
    let lastTrigger = null;
    let closeToken = 0;

    const paint = (value) => {
      lightbox.style.setProperty('--backdrop-alpha', Math.max(0, Math.min(1, (value - 0.9) / 0.1)).toFixed(4));
      surface.style.setProperty('--lightbox-scale', value.toFixed(4));
    };

    const close = () => {
      const token = ++closeToken;
      spring(surface, 'lightbox', 0.9, paint, {
        response: 0.28,
        damping: 1,
        complete: () => {
          if (token !== closeToken) return;
          lightbox.hidden = true;
          image.src = '';
          document.body.classList.remove('portfolio-lightbox-open');
          lastTrigger?.focus();
        }
      });
    };

    document.querySelectorAll('[data-lightbox-image]').forEach((button) => {
      button.addEventListener('click', () => {
        closeToken += 1;
        lastTrigger = button;
        image.src = button.dataset.lightboxImage;
        image.alt = button.dataset.lightboxAlt || '';
        lightbox.hidden = false;
        document.body.classList.add('portfolio-lightbox-open');

        const rect = button.getBoundingClientRect();
        surface.style.transformOrigin = `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`;
        setSpringValue(surface, 'lightbox', 0.9, paint);
        spring(surface, 'lightbox', 1, paint, { response: 0.34, damping: 1 });
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
    initActiveNavigation();
    initPressFeedback();
    initFloatCards();
    initProjectFilters();
    initImageFallbacks();
    initCaseStudyNavigation();
    initVesselExhibition();
    initLightbox();
  });
})();
