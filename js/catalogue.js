/*
 * Catalogue de prestations et de prix : les prestations enregistrées une fois
 * pour toutes et réutilisées dans les devis et factures.
 * Chargé avant app.js ; utilise les outils d'app.js au moment de l'appel.
 */

const UNITES = ['u', 'h', 'jour', 'm²', 'm', 'ml', 'forfait', 'kg', 'lot'];

function catalogue() {
  if (!data.catalogue) data.catalogue = [];
  return data.catalogue;
}

// Sans accents ni majuscules, pour une recherche tolérante (« peinture » = « Peinture »).
function normaliser(texte) {
  return String(texte || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Prestations dont la description contient tous les mots tapés.
function chercherCatalogue(texte, limite = 6) {
  const mots = normaliser(texte).split(/\s+/).filter(Boolean);
  if (!mots.length) return catalogue().slice(0, limite);
  return catalogue()
    .filter((p) => {
      const d = normaliser(p.description + ' ' + (p.categorie || ''));
      return mots.every((m) => d.includes(m));
    })
    .slice(0, limite);
}

function libellePrix(p) {
  return `${euro(Number(p.prixUnitaire) || 0)} HT / ${p.unite}` + (data.entreprise.franchiseTva ? '' : ` · TVA ${tauxFr(p.tva)} %`);
}

function ligneDepuisCatalogue(p) {
  return {
    description: p.description,
    quantite: 1,
    unite: p.unite,
    prixUnitaire: Number(p.prixUnitaire) || 0,
    tva: data.entreprise.franchiseTva ? Number(data.entreprise.tvaDefaut) || 0 : Number(p.tva),
  };
}

// ====================================================================
// Dans l'éditeur de devis : suggestions, étoile et ajout depuis le catalogue
// ====================================================================

function brancherCatalogue(linesEl, doc, renderLines) {
  if (!Abonnement.aAcces('pro')) {
    document.getElementById('add-from-catalogue')?.remove();
    return;
  }
  const liste = document.createElement('ul');
  liste.className = 'suggestions cat-suggestions';
  liste.hidden = true;
  document.body.appendChild(liste);
  let resultats = [];
  let ligneActive = -1;
  let choix = -1;

  function fermer() {
    liste.hidden = true;
    choix = -1;
  }

  function ouvrir(input, i) {
    resultats = chercherCatalogue(input.value);
    ligneActive = i;
    if (!resultats.length || !input.value.trim()) return fermer();
    liste.innerHTML = resultats.map((p, k) => `
      <li><button type="button" data-k="${k}">
        <span>${esc(p.description)}</span><small>${esc(libellePrix(p))}</small>
      </button></li>`).join('');
    const r = input.getBoundingClientRect();
    liste.style.left = r.left + window.scrollX + 'px';
    liste.style.top = r.bottom + window.scrollY + 4 + 'px';
    liste.style.width = Math.max(r.width, Math.min(360, window.innerWidth - 32)) + 'px';
    liste.hidden = false;
  }

  function appliquer(p) {
    Object.assign(doc.lignes[ligneActive], ligneDepuisCatalogue(p), { quantite: doc.lignes[ligneActive].quantite || 1 });
    saveData();
    fermer();
    renderLines();
    const qte = linesEl.querySelector(`tr[data-i="${ligneActive}"] [data-field=quantite]`);
    qte?.focus();
    qte?.select();
  }

  linesEl.addEventListener('input', (e) => {
    if (e.target.dataset.field !== 'description') return;
    ouvrir(e.target, Number(e.target.closest('tr').dataset.i));
  });
  linesEl.addEventListener('focusin', (e) => {
    if (e.target.dataset.field === 'description' && e.target.value.trim()) {
      ouvrir(e.target, Number(e.target.closest('tr').dataset.i));
    }
  });
  linesEl.addEventListener('focusout', () => setTimeout(() => {
    // Ne ferme pas si l'on est passé directement à une autre description.
    if (document.activeElement?.dataset?.field !== 'description') fermer();
  }, 150));
  linesEl.addEventListener('keydown', (e) => {
    if (liste.hidden || e.target.dataset.field !== 'description') return;
    const boutons = liste.querySelectorAll('button');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      choix = (choix + (e.key === 'ArrowDown' ? 1 : -1) + boutons.length) % boutons.length;
      boutons.forEach((b, k) => b.classList.toggle('active', k === choix));
    } else if (e.key === 'Enter' && choix >= 0) {
      e.preventDefault();
      appliquer(resultats[choix]);
    } else if (e.key === 'Escape') {
      fermer();
    }
  });
  liste.addEventListener('mousedown', (e) => e.preventDefault()); // garde le focus pendant le clic
  liste.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) appliquer(resultats[Number(b.dataset.k)]);
  });

  // Étoile : enregistre la ligne dans le catalogue.
  linesEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-catalogue]');
    if (!b) return;
    const l = doc.lignes[Number(b.dataset.catalogue)];
    if (!String(l.description || '').trim()) {
      await ask("Écrivez d'abord la description de la prestation.", "D'accord", false);
      return;
    }
    const existe = catalogue().find((p) => normaliser(p.description) === normaliser(l.description));
    if (existe) {
      if (!(await ask(`« ${l.description} » est déjà dans votre catalogue. Mettre à jour son prix (${euro(Number(l.prixUnitaire) || 0)} HT / ${l.unite}) ?`, 'Mettre à jour'))) return;
      Object.assign(existe, { unite: l.unite, prixUnitaire: Number(l.prixUnitaire) || 0, tva: Number(l.tva) });
    } else {
      catalogue().push({ id: newId(), description: l.description.trim(), unite: l.unite, prixUnitaire: Number(l.prixUnitaire) || 0, tva: Number(l.tva), categorie: '' });
    }
    saveData();
    b.textContent = '★';
    b.title = 'Dans votre catalogue';
  });

  // Bouton « + Depuis le catalogue » : choisir une ou plusieurs prestations.
  document.getElementById('add-from-catalogue')?.addEventListener('click', () => choisirDansCatalogue(doc, renderLines));

  // La liste flottante disparaît avec la page.
  window.addEventListener('hashchange', () => liste.remove(), { once: true });
}

function etoileLigne(l, i) {
  if (!Abonnement.aAcces('pro')) return '';
  const dedans = catalogue().some((p) => normaliser(p.description) === normaliser(l.description) && l.description);
  return `<button type="button" class="btn btn-sm star" data-catalogue="${i}" title="${dedans ? 'Dans votre catalogue' : 'Enregistrer dans le catalogue'}">${dedans ? '★' : '☆'}</button>`;
}

function choisirDansCatalogue(doc, renderLines) {
  const dialog = document.createElement('dialog');
  dialog.className = 'ask cat-dialog';
  const ajoutes = [];
  dialog.innerHTML = `
    <h2>Ajouter depuis le catalogue</h2>
    ${catalogue().length ? `
      <input type="search" id="cat-recherche" placeholder="Rechercher : wc, peinture, chauffe-eau…" autocomplete="off">
      <ul class="cat-choix" id="cat-choix"></ul>` : `
      <p>Votre catalogue est vide. Enregistrez vos prestations dans la page « Catalogue », ou touchez l'étoile ☆ d'une ligne de devis.</p>`}
    <div class="actions">
      <a class="btn" href="#/catalogue">Gérer le catalogue</a>
      <button class="btn btn-primary" value="ok">Terminé</button>
    </div>`;
  document.body.appendChild(dialog);
  const afficher = () => {
    const ul = dialog.querySelector('#cat-choix');
    if (!ul) return;
    const res = chercherCatalogue(dialog.querySelector('#cat-recherche').value, 50);
    ul.innerHTML = res.length
      ? res.map((p) => `<li><button type="button" data-id="${esc(p.id)}"><span>${esc(p.description)}</span><small>${esc(libellePrix(p))}</small><b>${ajoutes.includes(p.id) ? '✓ Ajouté' : '+ Ajouter'}</b></button></li>`).join('')
      : '<li class="empty-inline">Aucune prestation ne correspond.</li>';
  };
  dialog.addEventListener('input', afficher);
  dialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) {
      const p = catalogue().find((x) => x.id === b.dataset.id);
      // Remplace la première ligne si elle est encore vide.
      const premiere = doc.lignes[0];
      if (doc.lignes.length === 1 && !premiere.description && !Number(premiere.prixUnitaire)) doc.lignes = [];
      doc.lignes.push(ligneDepuisCatalogue(p));
      ajoutes.push(p.id);
      saveData();
      renderLines();
      afficher();
      return;
    }
    if (e.target.value === 'ok' || e.target.closest('a')) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
  afficher();
  dialog.querySelector('#cat-recherche')?.focus();
}

// ====================================================================
// Page Catalogue
// ====================================================================

function pageCatalogue(params) {
  const enEdition = params?.get('modifier') ? catalogue().find((p) => p.id === params.get('modifier')) : null;
  const ouvert = Boolean(enEdition || params?.get('ajout'));
  const franchise = data.entreprise.franchiseTva;
  const p = enEdition || { description: '', unite: 'u', prixUnitaire: '', tva: Number(data.entreprise.tvaDefaut) || 20, categorie: '' };
  const categories = [...new Set(catalogue().map((x) => x.categorie).filter(Boolean))].sort();
  const recherche = params?.get('q') || '';

  view.innerHTML = `
    <div class="page-head">
      <h1>Catalogue de prestations</h1>
      <button class="btn btn-primary" id="cat-ajout" ${ouvert ? 'hidden' : ''}>+ Ajouter une prestation</button>
    </div>
    <p class="intro">Enregistrez vos prestations et vos prix une fois pour toutes. Dans un devis, tapez quelques lettres
      (« wc », « peinture »…) et choisissez : la description, l'unité, le prix et la TVA se remplissent tout seuls.</p>

    <form id="cat-form" class="card" ${ouvert ? '' : 'hidden'} novalidate>
      <h2>${enEdition ? 'Modifier la prestation' : 'Nouvelle prestation'}</h2>
      <div class="field"><label for="cat-description">Description *</label>
        <input id="cat-description" name="description" value="${esc(p.description)}" placeholder="Ex : Pose d'un WC suspendu (bâti-support, cuvette, raccordements)"></div>
      <div class="grid-2 field">
        <div><label for="cat-unite">Unité</label>
          <select id="cat-unite" name="unite">${UNITES.map((u) => `<option ${u === p.unite ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <div><label for="cat-prix">Prix unitaire HT (€) *</label>
          <input id="cat-prix" name="prixUnitaire" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(p.prixUnitaire)}"></div>
        ${franchise ? '' : `<div><label for="cat-tva">TVA</label>
          <select id="cat-tva" name="tva">${[20, 10, 5.5, 2.1, 0].map((t) => `<option value="${t}" ${Number(p.tva) === t ? 'selected' : ''}>${tauxFr(t)} %</option>`).join('')}</select></div>`}
        <div><label for="cat-categorie">Catégorie (facultatif)</label>
          <input id="cat-categorie" name="categorie" list="cat-categories" value="${esc(p.categorie)}" placeholder="Ex : Sanitaire, Chauffage, Peinture">
          <datalist id="cat-categories">${categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
      </div>
      <div class="actions" style="margin-top:16px">
        <button class="btn btn-primary" type="submit">${enEdition ? 'Enregistrer' : 'Ajouter au catalogue'}</button>
        <a class="btn" href="#/catalogue">Annuler</a>
      </div>
    </form>

    <section class="card">
      ${catalogue().length ? `
        <input type="search" id="cat-filtre" class="cat-filtre" placeholder="Rechercher une prestation…" value="${esc(recherche)}" autocomplete="off">
        <div class="table-wrap"><table>
          <thead><tr><th>Prestation</th><th>Catégorie</th><th class="num">Prix HT</th>${franchise ? '' : '<th class="num">TVA</th>'}<th class="num">Actions</th></tr></thead>
          <tbody id="cat-lignes"></tbody>
        </table></div>`
        : `<p class="empty">Votre catalogue est vide. Ajoutez vos prestations les plus courantes : vos devis iront deux fois plus vite.</p>`}
    </section>
  `;

  const tbody = document.getElementById('cat-lignes');
  const afficher = (texte) => {
    if (!tbody) return;
    const res = chercherCatalogue(texte, 1000)
      .slice().sort((a, b) => (a.categorie || '~').localeCompare(b.categorie || '~') || a.description.localeCompare(b.description));
    tbody.innerHTML = res.length ? res.map((x) => `<tr>
      <td>${esc(x.description)}</td>
      <td>${esc(x.categorie || '—')}</td>
      <td class="num">${euro(Number(x.prixUnitaire) || 0)} <small>/ ${esc(x.unite)}</small></td>
      ${franchise ? '' : `<td class="num">${tauxFr(x.tva)} %</td>`}
      <td><div class="row-actions">
        <a class="btn btn-sm" href="#/catalogue?modifier=${esc(x.id)}">Modifier</a>
        <button class="btn btn-sm btn-danger" data-suppr-cat="${esc(x.id)}">Supprimer</button>
      </div></td></tr>`).join('')
      : `<tr><td colspan="5" class="empty">Aucune prestation ne correspond à « ${esc(texte)} ».</td></tr>`;
  };
  afficher(recherche);
  document.getElementById('cat-filtre')?.addEventListener('input', (e) => afficher(e.target.value));

  document.getElementById('cat-ajout').addEventListener('click', () => go('#/catalogue?ajout=1'));
  const form = document.getElementById('cat-form');
  if (ouvert) setTimeout(() => form.description.focus(), 50);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(form));
    if (!v.description.trim() || v.prixUnitaire === '') {
      await ask('Indiquez au moins la description et le prix HT de la prestation.', "D'accord", false);
      return;
    }
    const valeurs = {
      description: v.description.trim(),
      unite: v.unite,
      prixUnitaire: Number(v.prixUnitaire) || 0,
      tva: franchise ? Number(p.tva) : Number(v.tva),
      categorie: (v.categorie || '').trim(),
    };
    if (enEdition) Object.assign(enEdition, valeurs);
    else catalogue().push({ id: newId(), ...valeurs });
    saveData();
    go('#/catalogue');
  });

  tbody?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-suppr-cat]');
    if (!b) return;
    const x = catalogue().find((y) => y.id === b.dataset.supprCat);
    if (x && (await ask(`Retirer « ${x.description} » du catalogue ? Les devis déjà faits ne changent pas.`, 'Retirer'))) {
      data.catalogue = catalogue().filter((y) => y.id !== x.id);
      saveData();
      afficher(document.getElementById('cat-filtre')?.value || '');
    }
  });
}
