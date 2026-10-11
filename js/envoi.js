/*
 * Envoi des devis et factures par e-mail, signature en ligne et relances.
 *
 * - « Envoyer par e-mail » : message déjà rédigé, PDF joint, et pour un devis
 *   un lien « Voir et signer le devis » (page publique signer.html).
 * - « Relancer » : rappel poli pour une facture dont l'échéance est passée.
 * - Les devis signés en ligne passent tout seuls en « Accepté ».
 *
 * L'e-mail part de la fonction Supabase « envoyer-email » (Brevo).
 * Utilise data, saveData, render, ask, toast, infosDocument, Pdf, Compte...
 */
const Envoi = (() => {
  let derniereSynchro = 0;

  function disponible() {
    return typeof Compte !== 'undefined' && Compte.actif && Compte.connecte();
  }

  // Copie du devis pour la page publique de signature : uniquement ce qui
  // figure sur le document, jamais le reste des données de l'artisan.
  function contenuPublic(doc) {
    const { e, client, t, mentions, nomAffiche, formeAffichee } = infosDocument(doc);
    return {
      type: doc.type,
      numero: doc.numero,
      date: doc.date,
      echeance: doc.echeance,
      objet: doc.objet || '',
      notes: doc.notes || '',
      franchise: Boolean(e.franchiseTva),
      acompte: doc.type === 'devis' ? Number(doc.acompte) || 0 : 0,
      entreprise: {
        nom: nomAffiche,
        forme: formeAffichee,
        adresse: e.adresse || '',
        telephone: e.telephone || '',
        email: e.email || '',
        siret: e.siret || '',
        tva: e.franchiseTva ? '' : e.numeroTva || '',
        logo: e.logo && Abonnement.aAcces('pro') && e.logo.length < 200000 ? e.logo : '',
      },
      client: { nom: client.nom || '', adresse: client.adresse || '' },
      lignes: doc.lignes.map((l) => ({
        description: l.description, quantite: Number(l.quantite) || 0, unite: l.unite || '',
        prixUnitaire: Number(l.prixUnitaire) || 0, tva: Number(l.tva) || 0,
      })),
      totaux: { ht: t.ht, tvaParTaux: t.tvaParTaux, ttc: t.ttc },
      mentions,
    };
  }

  function messageType(doc, mode) {
    const { e, client, t } = infosDocument(doc);
    const signature = [e.nom, e.telephone].filter(Boolean).join('\n');
    const bonjour = client.nom ? `Bonjour ${client.nom},` : 'Bonjour,';
    const montant = euro(e.franchiseTva ? t.ht : t.ttc) + (e.franchiseTva ? '' : ' TTC');
    if (mode === 'relance') {
      const retard = joursDeRetard(doc);
      return {
        objet: `Relance : facture ${doc.numero} à régler`,
        message: `${bonjour}\n\nSauf erreur de notre part, la facture n° ${doc.numero} du ${dateFr(doc.date)}, d'un montant de ${montant}, `
          + `arrivée à échéance le ${dateFr(doc.echeance)}${retard ? ` (il y a ${retard} jour${retard > 1 ? 's' : ''})` : ''}, reste impayée à ce jour.\n\n`
          + `Merci de bien vouloir procéder à son règlement dans les meilleurs délais. Vous la trouverez en pièce jointe.`
          + `${e.iban ? `\n\nIBAN : ${e.iban}` : ''}\n\nSi le paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message.\n\nCordialement,\n${signature}`,
      };
    }
    if (doc.type === 'facture') {
      return {
        objet: `Facture ${doc.numero} – ${e.nom}`,
        message: `${bonjour}\n\nVeuillez trouver ci-joint la facture n° ${doc.numero}${doc.objet ? ` (${doc.objet})` : ''}, d'un montant de ${montant}`
          + `${doc.echeance && doc.echeance !== doc.date ? `, à régler avant le ${dateFr(doc.echeance)}` : ''}.`
          + `${e.iban ? `\n\nRèglement par virement : IBAN ${e.iban}` : ''}\n\nMerci pour votre confiance.\n\nCordialement,\n${signature}`,
      };
    }
    return {
      objet: `Devis ${doc.numero} – ${e.nom}`,
      message: `${bonjour}\n\nVeuillez trouver ci-joint notre devis n° ${doc.numero}${doc.objet ? ` pour : ${doc.objet}` : ''}, d'un montant de ${montant}.\n\n`
        + `Vous pouvez le consulter et le signer en ligne grâce au bouton ci-dessous, en quelques secondes.\n\n`
        + `Je reste à votre disposition pour toute question.\n\nCordialement,\n${signature}`,
    };
  }

  async function ouvrir(doc, mode = 'envoi') {
    if (!doc) return;
    if (!disponible()) {
      await ask("L'envoi par e-mail est disponible avec un compte Devizo. En attendant, téléchargez le PDF et envoyez-le depuis votre messagerie.", "D'accord", false);
      return;
    }
    if (!Abonnement.aAcces('pro')) {
      if (await ask("L'envoi par e-mail, la signature en ligne et les relances sont inclus dans les formules Pro et Entreprise.", 'Voir les formules', 'Plus tard')) go('#/abonnement');
      return;
    }
    if (!(await profilPret())) return;
    const client = docClient(doc) || {};
    const { objet, message } = messageType(doc, mode);
    const devis = doc.type === 'devis' && mode === 'envoi';

    const dialog = document.createElement('dialog');
    dialog.className = 'ask envoi';
    dialog.innerHTML = `
      <form method="dialog" id="envoi-form" novalidate>
        <h2>${mode === 'relance' ? 'Relancer le client' : `Envoyer ${doc.type === 'facture' ? 'la facture' : 'le devis'} ${esc(doc.numero)}`}</h2>
        <label for="envoi-a">À</label>
        <input id="envoi-a" name="a" type="email" inputmode="email" value="${esc(client.email || '')}" placeholder="adresse e-mail du client" required>
        ${!client.email && client.nom ? `<p class="hint">Astuce : ajoutez l'e-mail de ${esc(client.nom)} dans sa fiche client pour qu'il soit rempli tout seul la prochaine fois.</p>` : ''}
        <label for="envoi-objet">Objet</label>
        <input id="envoi-objet" name="objet" value="${esc(objet)}" maxlength="200">
        <label for="envoi-message">Message</label>
        <textarea id="envoi-message" name="message" rows="9">${esc(message)}</textarea>
        <label class="checkbox"><input type="checkbox" name="pdf" checked> Joindre le PDF</label>
        ${devis ? '<label class="checkbox"><input type="checkbox" name="signature" checked> Ajouter un bouton pour signer le devis en ligne</label>' : ''}
        <p class="hint">L'e-mail part de contact@devizo-app.fr à votre nom. Si le client répond, sa réponse arrive sur votre adresse${data.entreprise.email ? ` (${esc(data.entreprise.email)})` : ''}.</p>
        <p class="auth-erreur" id="envoi-erreur" role="alert" hidden></p>
        <div class="actions">
          <button type="button" class="btn" value="non" id="envoi-annuler">Annuler</button>
          <button type="submit" class="btn btn-primary" id="envoi-ok">${mode === 'relance' ? 'Envoyer la relance' : 'Envoyer'}</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.showModal();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('#envoi-annuler').addEventListener('click', () => dialog.close());
    const form = dialog.querySelector('#envoi-form');
    const erreur = dialog.querySelector('#envoi-erreur');
    const bouton = dialog.querySelector('#envoi-ok');
    const montrer = (t) => {
      erreur.textContent = t;
      erreur.hidden = !t;
    };

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = Object.fromEntries(new FormData(form));
      const a = String(v.a || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(a)) return montrer("Indiquez l'adresse e-mail du client.");
      montrer('');
      bouton.disabled = true;
      bouton.textContent = 'Envoi en cours…';
      try {
        const piece = v.pdf ? await Pdf.document(doc, { sortie: 'base64' }) : null;
        if (v.pdf && !piece) throw new Error('Le PDF ne peut pas être créé sans connexion internet.');
        let jetonPartage = null;
        if (devis && v.signature) {
          const { data: p, error } = await Compte.client().from('partages')
            .insert({ proprietaire: Compte.espace(), document_id: doc.id, numero: doc.numero, contenu: contenuPublic(doc) })
            .select('jeton').single();
          if (error) throw new Error('Le lien de signature ne peut pas être créé. ' + error.message);
          jetonPartage = p.jeton;
        }
        const { data: res, error } = await Compte.client().functions.invoke('envoyer-email', {
          body: {
            a, objet: v.objet, message: v.message, jetonPartage,
            entreprise: data.entreprise.nom,
            repondreA: data.entreprise.email || Compte.utilisateur()?.email,
            pieceJointe: piece ? { nom: piece.nom, base64: piece.base64 } : null,
          },
        });
        if (error) {
          // Message clair de la fonction, sinon la cause technique (pour le dépannage).
          let detail = '';
          let technique = error.message || '';
          try {
            const r = error.context;
            if (r && typeof r.text === 'function') {
              const texte = await r.text();
              let j = null;
              try {
                j = JSON.parse(texte);
              } catch (e) {
                // pas du JSON
              }
              detail = j?.erreur || '';
              technique = `${r.status} ${j?.message || j?.msg || texte}`.slice(0, 160);
            }
          } catch (e) {
            // réponse illisible
          }
          throw new Error(detail || `L'e-mail n'a pas pu partir. Réessayez dans un instant. (Détail : ${technique})`);
        }
        // Historique sur le document, et statut mis à jour.
        doc.envois = [...(doc.envois || []), { le: new Date().toISOString(), a, type: mode, lien: Boolean(res?.lien) }];
        if (doc.type === 'devis' && doc.statut === 'brouillon') doc.statut = 'envoye';
        if (client.id && !client.email && getClient(client.id)) getClient(client.id).email = a;
        saveData();
        dialog.close();
        render();
        toast(mode === 'relance' ? `Relance envoyée à ${a}` : (doc.type === 'facture' ? `Facture ${doc.numero} envoyée à ${a}` : `Devis ${doc.numero} envoyé à ${a}`));
      } catch (err) {
        montrer(err.message);
        bouton.disabled = false;
        bouton.textContent = mode === 'relance' ? 'Envoyer la relance' : 'Envoyer';
      }
    });
  }

  // Devis signés en ligne depuis la dernière fois : on les passe en « Accepté ».
  async function synchroniserSignatures(force = false) {
    if (!disponible() || (!force && Date.now() - derniereSynchro < 20000)) return;
    derniereSynchro = Date.now();
    try {
      const { data: signes, error } = await Compte.client().from('partages')
        .select('jeton, document_id, signe_le, signature_nom, signature_image')
        .eq('proprietaire', Compte.espace()).not('signe_le', 'is', null);
      if (error || !signes?.length) return;
      const nouveaux = [];
      for (const s of signes) {
        const doc = getDocument(s.document_id);
        if (!doc || doc.signature?.jeton === s.jeton) continue;
        doc.signature = { jeton: s.jeton, nom: s.signature_nom, le: s.signe_le, image: s.signature_image };
        if (doc.statut === 'brouillon' || doc.statut === 'envoye') doc.statut = 'accepte';
        nouveaux.push(doc);
      }
      if (!nouveaux.length) return;
      saveData();
      render();
      toast(nouveaux.length === 1
        ? `✍ Devis ${nouveaux[0].numero} signé en ligne par ${nouveaux[0].signature.nom}`
        : `✍ ${nouveaux.length} devis signés en ligne`);
    } catch (e) {
      // pas de réseau : on réessaiera plus tard
    }
  }

  // Relance : facture non payée dont l'échéance est passée.
  const aRelancer = (doc) => doc.type === 'facture' && doc.statut !== 'payee' && joursDeRetard(doc) > 0;

  function dernierEnvoi(doc) {
    const envois = doc.envois || [];
    return envois[envois.length - 1] || null;
  }

  return { ouvrir, synchroniserSignatures, aRelancer, dernierEnvoi, contenuPublic };
})();
