/*
 * Fusion de deux versions des données (formule Équipe, ou deux appareils).
 *
 * base : dernière version en ligne connue ; local : données d'ici (avec les
 * modifications pas encore envoyées) ; serveur : version en ligne actuelle,
 * enregistrée par quelqu'un d'autre. Chaque fiche (client, document, dépense,
 * prestation) et chaque réglage de l'entreprise est fusionné séparément :
 * ce qui a été modifié ici l'emporte, le reste vient du serveur.
 *
 * Les objets d'ici sont conservés (mis à jour sur place) pour qu'une page
 * ouverte continue de modifier la bonne fiche.
 */
const Fusion = (() => {
  const LISTES = ['clients', 'documents', 'depenses', 'catalogue'];
  const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Donne à « cible » le contenu de « source », sans changer d'objet.
  function remplacerContenu(cible, source) {
    const copie = structuredClone(source);
    Object.keys(cible).forEach((k) => {
      if (!(k in copie)) delete cible[k];
    });
    return Object.assign(cible, copie);
  }

  function fusionnerChamps(b = {}, l = {}, s = {}) {
    const res = {};
    new Set([...Object.keys(s), ...Object.keys(l)]).forEach((k) => {
      const v = egal(l[k], b[k]) ? s[k] : l[k];
      if (v !== undefined) res[k] = v;
    });
    return res;
  }

  function fusionnerListe(b = [], l = [], s = []) {
    const avant = new Map(b.map((x) => [x.id, x]));
    const ici = new Map(l.map((x) => [x.id, x]));
    const serveur = new Set(s.map((x) => x.id));
    const res = [];
    for (const x of s) {
      const a = avant.get(x.id);
      const moi = ici.get(x.id);
      if (!moi) {
        // Supprimé ici : on le laisse supprimé, sauf s'il a été modifié là-bas entre-temps.
        if (a && egal(x, a)) continue;
        res.push(structuredClone(x));
      } else if (a ? !egal(moi, a) : !egal(moi, x)) {
        res.push(moi); // modifié ici
      } else {
        res.push(remplacerContenu(moi, x));
      }
    }
    for (const moi of l) {
      if (serveur.has(moi.id)) continue;
      const a = avant.get(moi.id);
      // Nouveau ici, ou modifié ici alors qu'il a été supprimé là-bas.
      if (!a || !egal(moi, a)) res.push(moi);
    }
    return res;
  }

  // Deux documents créés en même temps peuvent avoir pris le même numéro :
  // celui créé ici prend le numéro suivant libre.
  function renumeroter(documents, nouveaux) {
    const renumerotes = [];
    for (const doc of documents) {
      if (!nouveaux.has(doc.id) || !doc.numero) continue;
      const pris = documents.some((o) => o !== doc && o.type === doc.type && o.numero === doc.numero);
      if (!pris) continue;
      const m = /^(.*?)(\d+)$/.exec(doc.numero);
      if (!m) continue;
      const [, prefixe, chiffres] = m;
      const max = documents
        .filter((o) => o.type === doc.type && o.numero?.startsWith(prefixe))
        .reduce((n, o) => Math.max(n, parseInt(o.numero.slice(prefixe.length), 10) || 0), 0);
      const ancien = doc.numero;
      doc.numero = prefixe + String(max + 1).padStart(chiffres.length, '0');
      renumerotes.push([ancien, doc.numero]);
    }
    return renumerotes;
  }

  function fusionner(base, local, serveur) {
    const res = fusionnerChamps(base, local, serveur);
    const entreprise = fusionnerChamps(base.entreprise, local.entreprise, serveur.entreprise);
    res.entreprise = local.entreprise ? remplacerContenu(local.entreprise, entreprise) : entreprise;
    LISTES.forEach((cle) => {
      res[cle] = fusionnerListe(base[cle], local[cle], serveur[cle]);
    });
    const dejaConnus = new Set([...(base.documents || []), ...(serveur.documents || [])].map((d) => d.id));
    const nouveaux = new Set((local.documents || []).map((d) => d.id).filter((id) => !dejaConnus.has(id)));
    const renumerotes = renumeroter(res.documents, nouveaux);
    return { donnees: res, renumerotes };
  }

  return { fusionner };
})();

if (typeof module !== 'undefined') module.exports = Fusion;
