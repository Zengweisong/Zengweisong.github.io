(() => {
  'use strict';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const live = new Set();
  // Content is visible before JavaScript. Entrance motion never gates access.
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (media.matches || !entry.target.animate) continue;
      const animation = entry.target.animate([{ opacity:.35, translate:'0 18px' }, { opacity:1, translate:'0 0' }], {
        duration:650, easing:'cubic-bezier(.2,.7,.2,1)'
      });
      live.add(animation);
      animation.finished.then(() => live.delete(animation), () => live.delete(animation));
    }
  }, { threshold:.08 }) : null;
  document.querySelectorAll('.projects-page .project-card,.shelf-book,.reading-topic,.article-entry,.about-manifesto,.about-build-grid>div,.chapter-end').forEach(el => observer?.observe(el));
  media.addEventListener('change', () => { if (media.matches) { live.forEach(a => a.cancel()); live.clear(); } });
  const progress = document.querySelector('.reading-progress>span');
  if (progress) {
    let pending = 0;
    const update = () => {
      pending = 0;
      const end = document.querySelector('.post-content')?.getBoundingClientRect().bottom + scrollY || document.documentElement.scrollHeight;
      const range = Math.max(1, end - innerHeight);
      progress.style.transform = `scaleX(${Math.max(0, Math.min(1, scrollY / range))})`;
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
    addEventListener('scroll', schedule, {passive:true});
    addEventListener('resize', schedule, {passive:true});
    addEventListener('pageshow', schedule);
    update();
  }
})();
