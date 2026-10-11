/*
 * Page publique de signature d'un devis : le client de l'artisan, sans compte,
 * ouvre le lien reçu par e-mail, lit le devis et le signe du doigt ou à la souris.
 * Il ne voit que la copie du devis envoyée (fonctions voir_partage / signer_partage).
 */
(() => {
  const cfg = window.DEVIZO_CONFIG || {};
  const zone = document.getElementById('signer');
  const jeton = new URLSearchParams(location.search).get('j') || '';
  const client = cfg.supabaseUrl && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false } })
    : null;

  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const dateFr = (iso) => (iso ? new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-FR') : '');
  const tauxFr = (t) => String(t).replace('.', ',');

  function erreur(titre, texte) {
    zone.innerHTML = `<div class="card"><h1>${esc(titre)}</h1><p>${esc(texte)}</p></div>`;
  }

  function devisHtml(c) {
    const e = c.entreprise || {};
    const cl = c.client || {};
    const t = c.totaux || { ht: 0, tvaParTaux: {}, ttc: 0 };
    const acompte = Number(c.acompte) || 0;
    const totaux = c.franchise
      ? `<div class="grand"><span>Total</span><span>${euro(t.ht)}</span></div>`
      : `<div><span>Total HT</span><span>${euro(t.ht)}</span></div>
         ${Object.entries(t.tvaParTaux || {}).filter(([, v]) => v).map(([taux, v]) => `<div><span>TVA ${tauxFr(taux)} %</span><span>${euro(v)}</span></div>`).join('')}
         <div class="grand"><span>Total TTC</span><span>${euro(t.ttc)}</span></div>`;
    return `
      <div class="doc">
        <div class="doc-head">
          <div>
            ${e.logo ? `<img class="doc-logo" src="${esc(e.logo)}" alt="">` : ''}
            <strong>${esc(e.nom)}</strong><br>
            ${e.forme ? `<small>${esc(e.forme)}</small><br>` : ''}
            ${esc(e.adresse).replace(/\n/g, '<br>')}<br>
            ${e.telephone ? 'Tél. ' + esc(e.telephone) + '<br>' : ''}
            ${e.email ? esc(e.email) + '<br>' : ''}
            ${e.siret ? '<small>SIRET : ' + esc(e.siret) + '</small><br>' : ''}
            ${e.tva ? '<small>N° TVA : ' + esc(e.tva) + '</small>' : ''}
          </div>
          <div style="text-align:right">
            <p class="doc-title">DEVIS</p>
            <div>N° ${esc(c.numero)}</div>
            <div>Date : ${dateFr(c.date)}</div>
          </div>
        </div>
        <div class="doc-head">
          <div>${c.objet ? `<strong>Objet :</strong> ${esc(c.objet)}` : ''}</div>
          <div class="doc-client"><small>Client</small><br><strong>${esc(cl.nom || '—')}</strong><br>${esc(cl.adresse).replace(/\n/g, '<br>')}</div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Description</th><th class="num">Qté</th><th class="num">Prix unit. HT</th>${c.franchise ? '' : '<th class="num">TVA</th>'}<th class="num">Total HT</th></tr></thead>
          <tbody>${(c.lignes || []).map((l) => `
            <tr><td>${esc(l.description)}</td><td class="num">${esc(tauxFr(l.quantite))} ${esc(l.unite)}</td>
              <td class="num">${euro(l.prixUnitaire)}</td>${c.franchise ? '' : `<td class="num">${esc(tauxFr(l.tva))} %</td>`}
              <td class="num">${euro(l.quantite * l.prixUnitaire)}</td></tr>`).join('')}</tbody>
        </table></div>
        <div class="totals" style="margin-top:16px">${totaux}
          ${acompte > 0 ? `<div class="acompte"><span>Acompte à la commande (${tauxFr(acompte)} %)</span><span>${euro(((c.franchise ? t.ht : t.ttc) * acompte) / 100)}</span></div>` : ''}</div>
        ${c.notes ? `<p style="margin-top:24px;white-space:pre-line">${esc(c.notes)}</p>` : ''}
        <div class="doc-mentions">${(c.mentions || []).map(esc).join('\n')}</div>
      </div>`;
  }

  // Zone de signature au doigt ou à la souris.
  function brancherPad(canvas, onChange) {
    const ctx = canvas.getContext('2d');
    let dessine = false;
    let vide = true;
    const ajuster = () => {
      const r = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = r.width * ratio;
      canvas.height = r.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f1b3d';
      vide = true;
      onChange(true);
    };
    ajuster();
    const point = (ev) => {
      const r = canvas.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    };
    canvas.addEventListener('pointerdown', (ev) => {
      dessine = true;
      canvas.setPointerCapture(ev.pointerId);
      const [x, y] = point(ev);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
      if (vide) {
        vide = false;
        onChange(false);
      }
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!dessine) return;
      const [x, y] = point(ev);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    const fin = () => {
      dessine = false;
    };
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    return {
      effacer: () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        vide = true;
        onChange(true);
      },
      vide: () => vide,
      // Signature recadrée, sur fond blanc, en PNG léger.
      image: () => {
        const sortie = document.createElement('canvas');
        const largeur = 600;
        sortie.width = largeur;
        sortie.height = Math.round((canvas.height / canvas.width) * largeur);
        const c2 = sortie.getContext('2d');
        c2.fillStyle = '#ffffff';
        c2.fillRect(0, 0, sortie.width, sortie.height);
        c2.drawImage(canvas, 0, 0, sortie.width, sortie.height);
        return sortie.toDataURL('image/png');
      },
    };
  }

  function pageSigne(p, nom, quand, image) {
    zone.innerHTML = `
      <div class="card signer-ok">
        <p class="grand">✅</p>
        <h1>Devis signé</h1>
        <p>Le devis n° ${esc(p.numero)} a été signé par <strong>${esc(nom)}</strong> le ${esc(new Date(quand).toLocaleString('fr-FR'))}.</p>
        ${image ? `<img src="${esc(image)}" alt="Votre signature">` : ''}
        <p class="hint">${esc(p.contenu.entreprise?.nom || 'Votre artisan')} est prévenu automatiquement. Vous pouvez fermer cette page.</p>
      </div>
      ${devisHtml({ ...p.contenu, numero: p.numero })}`;
  }

  async function demarrer() {
    if (!client || !/^[0-9a-f-]{36}$/i.test(jeton)) {
      erreur('Lien invalide', 'Ce lien de signature est incomplet. Utilisez le bouton reçu par e-mail.');
      return;
    }
    const { data: p, error } = await client.rpc('voir_partage', { j: jeton });
    if (error) {
      erreur('Devis indisponible', 'Le devis ne peut pas être chargé pour le moment. Vérifiez votre connexion et réessayez.');
      return;
    }
    if (!p) {
      erreur('Lien expiré', "Ce lien de signature n'est plus valable. Demandez à votre artisan de vous renvoyer le devis.");
      return;
    }
    document.title = `Devis ${p.numero} · ${p.contenu.entreprise?.nom || 'Devizo'}`;
    if (p.signe_le) {
      pageSigne(p, p.signature_nom, p.signe_le, null);
      return;
    }
    zone.innerHTML = `
      <div class="card signer-statut">
        <h1>Devis n° ${esc(p.numero)}</h1>
        <p>${esc(p.contenu.entreprise?.nom || 'Votre artisan')} vous a envoyé ce devis. Lisez-le, puis signez en bas de la page pour l'accepter.</p>
      </div>
      ${devisHtml({ ...p.contenu, numero: p.numero })}
      <form class="card signer-bloc" id="signer-form" novalidate>
        <h2>Bon pour accord</h2>
        <div class="field"><label for="signer-nom">Vos nom et prénom</label>
          <input id="signer-nom" type="text" autocomplete="name" maxlength="120" required></div>
        <label>Votre signature</label>
        <div class="pad-cadre"><canvas id="pad" aria-label="Zone de signature"></canvas><div class="pad-indice" id="pad-indice">Signez ici avec le doigt ou la souris</div></div>
        <div class="pad-actions"><button type="button" class="btn btn-sm" id="pad-effacer">Effacer</button></div>
        <label class="checkbox"><input type="checkbox" id="signer-accord"> J'ai lu le devis n° ${esc(p.numero)} et je l'accepte (« bon pour accord »).</label>
        <p class="auth-erreur" id="signer-erreur" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg" type="submit" style="margin-top:12px">Signer le devis</button>
      </form>`;

    const indice = document.getElementById('pad-indice');
    const pad = brancherPad(document.getElementById('pad'), (vide) => {
      indice.hidden = !vide;
    });
    document.getElementById('pad-effacer').addEventListener('click', () => pad.effacer());
    const form = document.getElementById('signer-form');
    const zoneErreur = document.getElementById('signer-erreur');
    const montrer = (t) => {
      zoneErreur.textContent = t;
      zoneErreur.hidden = !t;
    };
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const nom = document.getElementById('signer-nom').value.trim();
      if (nom.length < 2) return montrer('Indiquez vos nom et prénom.');
      if (pad.vide()) return montrer('Signez dans le cadre blanc.');
      if (!document.getElementById('signer-accord').checked) return montrer('Cochez la case « bon pour accord ».');
      montrer('');
      const bouton = form.querySelector('[type=submit]');
      bouton.disabled = true;
      bouton.textContent = 'Signature en cours…';
      const image = pad.image();
      const { data: quand, error } = await client.rpc('signer_partage', { j: jeton, nom, image });
      if (error) {
        bouton.disabled = false;
        bouton.textContent = 'Signer le devis';
        montrer(error.message || 'La signature a échoué. Réessayez.');
        return;
      }
      pageSigne(p, nom, quand || new Date().toISOString(), image);
      window.scrollTo(0, 0);
    });
  }

  demarrer();
})();
