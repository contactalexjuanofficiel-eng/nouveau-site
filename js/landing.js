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

  // Visite guidée : une souris parcourt le devis et explique chaque partie.
  const mock = document.querySelector('.mock');
  if (mock && !reduceMotion) startTour(mock);

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
      // Montant en euros qui grimpe (exemple de tableau de bord).
      entry.target.querySelectorAll('[data-euro]').forEach((el) => {
        countUp(el, Number(el.dataset.euro), (v) => Math.round(v).toLocaleString('fr-FR'), 1100);
      });
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

function startTour(mock) {
  const cursor = mock.querySelector('.tour-cursor');
  const bubble = mock.querySelector('.tour-bubble');
  const badge = mock.querySelector('.mock-badge');
  const steps = [
    { t: 'client', title: 'Client', text: "Choisissez un client : son nom et son adresse s'ajoutent tout seuls." },
    { t: 'lignes', title: 'Prestations', text: 'Ajoutez vos lignes en heures, m², ml ou forfait. Les totaux se calculent pendant que vous tapez.' },
    { t: 'tva', title: 'TVA', text: 'La bonne TVA : 10 % pour l\u2019amélioration, 5,5 % pour la rénovation énergétique, 20 % pour le neuf.' },
    { t: 'acompte', title: 'Acompte', text: "L'acompte à la commande est calculé automatiquement." },
    { t: 'mentions', title: 'Mentions légales', text: 'Assurance décennale, durée de validité, médiateur : tout est ajouté pour vous.' },
    { t: 'pdf', title: 'PDF', text: 'Un PDF propre, prêt à envoyer au client.', click: true },
    { t: 'facture', title: 'Facture', text: 'Devis accepté ? Un clic, et la facture est créée avec le bon numéro.', click: true, done: true },
  ];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function moveCursor(x, y) {
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  function placeBubble(rect, x) {
    const box = mock.getBoundingClientRect();
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const left = Math.max(0, Math.min(x - bw / 2, box.width - bw));
    let top = rect.bottom - box.top + 14;
    if (top + bh > box.height + 30) top = rect.top - box.top - bh - 12;
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  async function run() {
    await wait(2800); // le temps que les lignes du devis apparaissent
    cursor.hidden = false;
    bubble.hidden = false;
    bubble.classList.add('off');
    const start = mock.getBoundingClientRect();
    moveCursor(start.width - 40, start.height - 30);
    for (;;) {
      badge.classList.add('off');
      for (const step of steps) {
        const target = mock.querySelector(`[data-tour="${step.t}"]`);
        const box = mock.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        const x = rect.left - box.left + Math.min(rect.width * 0.55, rect.width - 16);
        const y = rect.top - box.top + rect.height / 2;
        moveCursor(x, y);
        await wait(950);
        target.classList.add('tour-on');
        bubble.innerHTML = `<strong>${step.title}</strong>${step.text}`;
        placeBubble(rect, x);
        bubble.classList.remove('off');
        if (step.click) {
          await wait(700);
          cursor.classList.remove('click');
          void cursor.offsetWidth; // relance l'animation du clic
          cursor.classList.add('click');
          target.classList.add('pressed');
          await wait(160);
          target.classList.remove('pressed');
          if (step.done) badge.classList.remove('off');
        }
        await wait(step.click ? 1900 : 2400);
        bubble.classList.add('off');
        target.classList.remove('tour-on');
        await wait(300);
      }
      const box = mock.getBoundingClientRect();
      moveCursor(box.width - 40, box.height - 30);
      await wait(3000);
    }
  }
  run();
}
