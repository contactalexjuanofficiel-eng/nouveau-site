// Animations de la page d'accueil. Tout reste lisible sans JavaScript.
// Chaque animation se rejoue quand sa partie revient à l'écran.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

  function countUp(el, to, format, duration) {
    if (reduceMotion) return;
    const id = (el._countId || 0) + 1; // une nouvelle animation remplace la précédente
    el._countId = id;
    const start = performance.now();
    function frame(now) {
      if (el._countId !== id) return;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(to * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Relance une animation CSS déjà jouée.
  function rejouer(el) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  // Devis de l'accroche : les lignes apparaissent puis le total grimpe.
  const total = document.querySelector('.mock-count');
  function animerDevis() {
    document.querySelectorAll('.mock-lines li, .mock-total').forEach(rejouer);
    if (total) setTimeout(() => countUp(total, Number(total.dataset.to), (v) => euro.format(v), 1200), 2400);
  }
  animerDevis();

  // Visite guidée : une souris parcourt le devis et explique chaque partie, en boucle.
  const mock = document.querySelector('.mock');
  if (mock && !reduceMotion) startTour(mock);

  if (!('IntersectionObserver' in window) || reduceMotion) return;

  // Appelle onEnter à chaque retour à l'écran, onLeave quand la partie sort.
  function surveiller(elements, onEnter, onLeave, threshold) {
    const vu = new WeakMap();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !vu.get(entry.target)) {
          vu.set(entry.target, true);
          onEnter(entry.target);
        } else if (!entry.isIntersecting && vu.get(entry.target)) {
          vu.set(entry.target, false);
          onLeave?.(entry.target);
        }
      });
    }, { threshold });
    elements.forEach((el) => observer.observe(el));
  }

  // Le devis de l'accroche se rejoue quand on remonte en haut de la page.
  const papier = document.querySelector('.mock-paper');
  if (papier) {
    let premierPassage = true;
    surveiller([papier], () => {
      if (!premierPassage) animerDevis();
      premierPassage = false;
    }, null, 0.3);
  }

  // Chiffres clés : ils remontent à chaque passage.
  surveiller(document.querySelectorAll('[data-count]'), (el) => {
    countUp(el, Number(el.dataset.count), (v) => String(Math.round(v)), 900);
  }, null, 0.6);

  // Blocs qui apparaissent en glissant, à chaque passage.
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 3) * 80 + 'ms';
    if (el.getBoundingClientRect().top > window.innerHeight) el.classList.add('pre');
  });
  surveiller(document.querySelectorAll('.reveal'), (el) => {
    requestAnimationFrame(() => el.classList.remove('pre'));
  }, (el) => el.classList.add('pre'), 0.12);

  // Exemple de tableau de bord : les barres poussent et le montant grimpe,
  // puis l'animation recommence toutes les 5 secondes tant qu'il est visible.
  const dash = document.querySelector('.dash-mock');
  if (dash) {
    let boucle;
    const animerDash = () => {
      dash.classList.add('regrow');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        dash.classList.remove('regrow');
        dash.querySelectorAll('[data-euro]').forEach((el) => {
          countUp(el, Number(el.dataset.euro), (v) => Math.round(v).toLocaleString('fr-FR'), 1100);
        });
      }));
    };
    surveiller([dash], () => {
      animerDash();
      clearInterval(boucle);
      boucle = setInterval(animerDash, 5000);
    }, () => clearInterval(boucle), 0.2);
  }
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
