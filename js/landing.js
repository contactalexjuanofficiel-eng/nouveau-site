// Animations de la page d'accueil. Tout reste lisible sans JavaScript.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

  function countUp(el, to, format, duration) {
    if (reduceMotion) return;
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(to * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Total du devis qui grimpe une fois les lignes affichées.
  const total = document.querySelector('.mock-count');
  if (total) {
    setTimeout(() => countUp(total, Number(total.dataset.to), (v) => euro.format(v), 1200), 2400);
  }

  // Compteurs des chiffres clés et apparition des blocs au défilement.
  if (!('IntersectionObserver' in window) || reduceMotion) return;

  const counters = document.querySelectorAll('[data-count]');
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      countUp(el, Number(el.dataset.count), (v) => String(Math.round(v)), 900);
      countObserver.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => countObserver.observe(el));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('pre');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    // Seuls les blocs encore hors de l'écran sont masqués puis révélés.
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.classList.add('pre');
      el.style.transitionDelay = (i % 3) * 80 + 'ms';
      revealObserver.observe(el);
    }
  });
})();

// Choix mensuel / annuel dans les tarifs.
document.querySelectorAll('.billing-toggle button').forEach((button) => {
  button.addEventListener('click', () => {
    const period = button.dataset.period;
    document.querySelectorAll('.billing-toggle button').forEach((b) => b.classList.toggle('active', b === button));
    document.querySelectorAll('.price .amount').forEach((el) => {
      el.textContent = el.dataset[period];
    });
    document.querySelectorAll('.price .per').forEach((el) => {
      el.textContent = period === 'an' ? 'HT / an' : 'HT / mois';
    });
  });
});
