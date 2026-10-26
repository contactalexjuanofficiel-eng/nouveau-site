// Menu ☰ de l'en-tête du site public (accueil, pages métiers, guides, outils) :
// il s'ouvre sous le bandeau et se ferme en choisissant un lien, en touchant
// ailleurs ou avec Échap.
(() => {
  const entete = document.querySelector('.l-header');
  const bouton = document.querySelector('.l-burger');
  if (!entete || !bouton) return;
  const ouvrir = (oui) => {
    // Le voile commence juste sous le bandeau.
    entete.style.setProperty('--haut-entete', Math.round(entete.getBoundingClientRect().bottom) + 'px');
    entete.classList.toggle('menu-ouvert', oui);
    bouton.setAttribute('aria-expanded', String(oui));
  };
  bouton.addEventListener('click', () => ouvrir(!entete.classList.contains('menu-ouvert')));
  document.getElementById('l-nav')?.addEventListener('click', (e) => { if (e.target.closest('a')) ouvrir(false); });
  document.addEventListener('click', (e) => { if (!entete.contains(e.target) || e.target === entete) ouvrir(false); }); // dehors ou sur le voile
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ouvrir(false); });
  matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) ouvrir(false); });
})();
