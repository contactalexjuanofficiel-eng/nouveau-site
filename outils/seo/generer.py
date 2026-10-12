"""Génère les pages de référencement de Devizo (métiers + guides), le sitemap
et robots.txt à la racine du site. Le contenu est dans metiers.py et guides.py."""
import html, json, sys, datetime, os
# Usage : python3 outils/seo/generer.py 67   (67 = numéro de version des fichiers ?v=)
ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from metiers import METIERS
from guides import GUIDES

SITE = 'https://devizo-app.fr'
RACINE = os.path.normpath(os.path.join(ICI, '..', '..')) + '/'
VERSION = sys.argv[1] if len(sys.argv) > 1 else '66'
AUJOURDHUI = datetime.date.today().isoformat()
OG = f'{SITE}/img/og-devizo.jpg'


def e(t):
    return html.escape(str(t), quote=True)


def euro(n):
    s = f'{n:,.2f}'.replace(',', ' ').replace('.', ',')
    return s + ' €'


def taux(t):
    return (f'{t:g}').replace('.', ',')


def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'


ORGANISATION = {
    '@type': 'Organization', '@id': f'{SITE}/#organisation', 'name': 'Devizo', 'url': f'{SITE}/',
    'logo': f'{SITE}/img/logo-512.png', 'email': 'devizocontact@gmail.com',
}


def tete(titre, description, chemin, ld, type_og='website'):
    url = f'{SITE}/{chemin}'
    return f'''<!doctype html>
<html lang="fr" data-page="accueil">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(titre)}</title>
  <meta name="description" content="{e(description)}">
  <link rel="canonical" href="{url}">
  <meta name="theme-color" content="#1f5eff">
  <meta property="og:type" content="{type_og}">
  <meta property="og:site_name" content="Devizo">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="{e(titre)}">
  <meta property="og:description" content="{e(description)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{OG}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="img/logo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="img/logo-180.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&display=swap">
  <link rel="stylesheet" href="css/style.css?v={VERSION}">
  <link rel="stylesheet" href="css/landing.css?v={VERSION}">
  <link rel="stylesheet" href="css/seo.css?v={VERSION}">
  {jsonld({'@context': 'https://schema.org', '@graph': ld})}
</head>
<body class="landing seo">
  <header class="l-header">
    <div class="l-wrap l-header-inner">
      <a class="logo" href="index.html" aria-label="Devizo, accueil"><img class="logo-icone" src="img/logo.svg" alt="" width="32" height="32"><span class="logo-texte">Devizo</span></a>
      <nav class="l-nav" aria-label="Navigation principale">
        <a href="index.html#fonctionnalites">Fonctionnalités</a>
        <a href="index.html#tarifs">Tarifs</a>
        <a href="guide-mentions-obligatoires-devis.html">Guides</a>
      </nav>
      <div class="l-actions">
        <a class="l-login" href="app.html#connexion">Connexion</a>
        <a class="l-pill l-pill-plein l-pill-long" href="app.html#inscription">Essai gratuit 14 jours</a>
        <a class="l-pill l-pill-plein l-pill-court" href="app.html#inscription">Essai gratuit</a>
      </div>
    </div>
  </header>
'''


def fil(items):
    """Fil d'Ariane visible + données structurées."""
    liens = ' <span aria-hidden="true">›</span> '.join(
        f'<a href="{e(h)}">{e(t)}</a>' if h else f'<span aria-current="page">{e(t)}</span>' for t, h in items)
    ld = {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': t, **({'item': f'{SITE}/{h}'.replace('/index.html', '/') if h else {}})}
        for i, (t, h) in enumerate(items)]}
    return f'<nav class="seo-fil" aria-label="Fil d\'Ariane">{liens}</nav>', ld


def pied():
    metiers = ''.join(f'<li><a href="devis-facture-{m["slug"]}.html">Devis {e(m["nom"])}</a></li>' for m in METIERS)
    guides = ''.join(f'<li><a href="{g["fichier"]}">{e(g["court"])}</a></li>' for g in GUIDES)
    return f'''
  <footer class="l-footer seo-pied">
    <div class="l-wrap">
      <div class="seo-pied-grille">
        <div>
          <a class="logo" href="index.html" aria-label="Devizo"><img class="logo-icone" src="img/logo.svg" alt="" width="32" height="32"><span class="logo-texte">Devizo</span></a>
          <p>Devis, factures et gestion pour les artisans. Sur téléphone, tablette et ordinateur.</p>
          <a class="btn btn-primary" href="app.html#inscription">Essai gratuit 14 jours</a>
        </div>
        <div><h2>Par métier</h2><ul>{metiers}</ul></div>
        <div><h2>Guides</h2><ul>{guides}</ul>
          <h2>Devizo</h2><ul><li><a href="index.html#tarifs">Tarifs</a></li><li><a href="index.html#faq">Questions fréquentes</a></li>
          <li><a href="mentions-legales.html">Mentions légales</a></li><li><a href="cgv.html">Conditions générales</a></li>
          <li><a href="confidentialite.html">Confidentialité</a></li></ul></div>
      </div>
      <p class="seo-copy">© 2026 Devizo</p>
    </div>
  </footer>
  <script src="js/config.js?v={VERSION}"></script>
  <script src="js/stats.js?v={VERSION}" defer></script>
  <script src="js/cookies.js?v={VERSION}" defer></script>
</body>
</html>
'''


def faq_html(faq):
    return ''.join(f'''
          <details>
            <summary>{e(q)}</summary>
            <p>{e(r)}</p>
          </details>''' for q, r in faq)


def faq_ld(faq):
    return {'@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': r}} for q, r in faq]}


LOGICIEL = {
    '@type': 'SoftwareApplication', '@id': f'{SITE}/#logiciel', 'name': 'Devizo',
    'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Web, iOS, Android, Windows, macOS',
    'url': f'{SITE}/', 'inLanguage': 'fr',
    'description': "Logiciel en ligne de devis, factures et gestion pour les artisans du bâtiment.",
    'offers': {'@type': 'AggregateOffer', 'priceCurrency': 'EUR', 'lowPrice': '9', 'highPrice': '39', 'offerCount': '3'},
    'publisher': {'@id': f'{SITE}/#organisation'},
}


def page_metier(m):
    chemin = f'devis-facture-{m["slug"]}.html'
    franchise = m.get('franchise', False)
    ht = sum(q * p for _, q, _, p, _ in m['lignes'])
    tva = {} if franchise else {}
    for _, q, _, p, t in m['lignes']:
        if not franchise and t:
            tva[t] = tva.get(t, 0) + q * p * t / 100
    ttc = ht + sum(tva.values())
    lignes = ''.join(f'''
              <tr><td>{e(d)}</td><td class="num">{taux(q)} {e(u)}</td><td class="num">{euro(p)}</td>{'' if franchise else f'<td class="num">{taux(t)} %</td>'}<td class="num">{euro(q * p)}</td></tr>'''
                     for d, q, u, p, t in m['lignes'])
    totaux = (f'<div class="seo-total"><span>Total</span><strong>{euro(ht)}</strong></div><p class="seo-mention">TVA non applicable, art. 293 B du CGI.</p>'
              if franchise else
              f'<div><span>Total HT</span><span>{euro(ht)}</span></div>'
              + ''.join(f'<div><span>TVA {taux(t)} %</span><span>{euro(v)}</span></div>' for t, v in sorted(tva.items(), reverse=True))
              + f'<div class="seo-total"><span>Total TTC</span><strong>{euro(ttc)}</strong></div>')
    titre = f'{m["titre"]} | Devizo'
    fil_html, fil_ld = fil([('Accueil', 'index.html'), (f'Devis {m["nom"]}', None)])
    ld = [ORGANISATION, LOGICIEL, fil_ld, faq_ld(m['faq']),
          {'@type': 'WebPage', 'name': m['titre'], 'url': f'{SITE}/{chemin}', 'description': m['description'], 'inLanguage': 'fr',
           'about': {'@id': f'{SITE}/#logiciel'}, 'isPartOf': {'@type': 'WebSite', 'name': 'Devizo', 'url': f'{SITE}/'}}]
    autres = [x for x in METIERS if x['slug'] != m['slug']]
    return tete(titre, m['description'], chemin, ld) + f'''
  <main id="top">
    <section class="hero seo-hero">
      <div class="l-wrap">
        {fil_html}
        <div class="hero-grid">
          <div class="hero-text">
            <p class="eyebrow">Logiciel de devis et factures pour {e(m["pluriel"])}</p>
            <h1>{m["h1"]}</h1>
            <p class="lead">{e(m["lead"])}</p>
            <div class="hero-cta">
              <a class="btn btn-primary btn-lg" href="app.html#inscription">Essayer gratuitement</a>
              <a class="btn btn-lg" href="index.html#comment">Voir comment ça marche</a>
            </div>
            <ul class="trust"><li>14 jours gratuits</li><li>Sans carte bancaire</li><li>Sans engagement</li></ul>
          </div>
          <figure class="seo-devis" aria-label="Exemple de devis de {e(m["nom"])}">
            <div class="seo-devis-tete">
              <div><strong>{e(m["entreprise"])}</strong><small>SIRET 123 456 789 00012</small></div>
              <div class="seo-devis-titre"><span>DEVIS</span><small>N° D-2026-027</small></div>
            </div>
            <p class="seo-devis-objet"><b>Client :</b> {e(m["client"])} · <b>Objet :</b> {e(m["objet"])}</p>
            <div class="table-wrap"><table>
              <thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">P.U. HT</th>{'' if franchise else '<th class="num">TVA</th>'}<th class="num">Total HT</th></tr></thead>
              <tbody>{lignes}
              </tbody>
            </table></div>
            <div class="seo-totaux">{totaux}</div>
            <figcaption>Exemple de devis réalisé avec Devizo (prix indicatifs).</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="l-wrap">
        <p class="eyebrow">Pensé pour les {e(m["pluriel"])}</p>
        <h2 class="section-title">Ce que Devizo change pour un {e(m["nom"])}</h2>
        <div class="seo-atouts">{''.join(f"""
          <article class="card"><h3>{e(t)}</h3><p>{e(d)}</p></article>""" for t, d in m['atouts'])}
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="l-wrap l-narrow">
        <p class="eyebrow">Les bonnes pratiques</p>
        <h2 class="section-title">Ce qu'il ne faut pas oublier sur un devis de {e(m["nom"])}</h2>
        <ul class="seo-liste">{''.join(f"<li>{e(p)}</li>" for p in m['points'])}
        </ul>
        <p>Devizo ajoute pour vous les mentions obligatoires : numérotation, SIRET, TVA ou franchise, validité du devis, conditions de paiement, assurance.
          Pour la liste complète, lisez notre guide <a href="guide-mentions-obligatoires-devis.html">les mentions obligatoires d'un devis</a>
          et <a href="guide-mentions-obligatoires-facture.html">celles d'une facture</a>.</p>
      </div>
    </section>

    <section class="section" id="faq">
      <div class="l-wrap l-narrow">
        <p class="eyebrow">Questions fréquentes</p>
        <h2 class="section-title">Vos questions de {e(m["nom"])}</h2>
        <div class="faq">{faq_html(m['faq'])}
        </div>
      </div>
    </section>

    <section class="final-cta">
      <div class="l-wrap">
        <h2>Votre prochain devis de {e(m["nom"])} en 2 minutes.</h2>
        <p>14 jours gratuits, sans carte bancaire. Formules à partir de 9 € HT par mois.</p>
        <a class="btn btn-lg btn-light" href="app.html#inscription">Commencer l'essai gratuit</a>
      </div>
    </section>

    <section class="section seo-autres">
      <div class="l-wrap">
        <h2>Devizo pour les autres métiers du bâtiment</h2>
        <ul>{''.join(f'<li><a href="devis-facture-{x["slug"]}.html">Devis et factures {e(x["nom"])}</a></li>' for x in autres)}</ul>
      </div>
    </section>
  </main>
''' + pied()


def page_guide(g):
    titre = f'{g["titre"]} | Devizo'
    fil_html, fil_ld = fil([('Accueil', 'index.html'), ('Guides', None if g['fichier'] == GUIDES[0]['fichier'] else GUIDES[0]['fichier']), (g['court'], None)])
    if g['fichier'] == GUIDES[0]['fichier']:
        fil_html, fil_ld = fil([('Accueil', 'index.html'), (g['court'], None)])
    article = {'@type': 'Article', 'headline': g['titre'], 'description': g['description'], 'inLanguage': 'fr',
               'datePublished': g['date'], 'dateModified': AUJOURDHUI, 'image': OG,
               'author': {'@id': f'{SITE}/#organisation'}, 'publisher': {'@id': f'{SITE}/#organisation'},
               'mainEntityOfPage': f'{SITE}/{g["fichier"]}'}
    ld = [ORGANISATION, fil_ld, article] + ([faq_ld(g['faq'])] if g.get('faq') else [])
    sommaire = ''.join(f'<li><a href="#{s["id"]}">{e(s["titre"])}</a></li>' for s in g['sections'])
    corps = ''.join(f'''
      <section id="{s['id']}">
        <h2>{e(s['titre'])}</h2>
        {s['html']}
      </section>''' for s in g['sections'])
    faq = (f'''
      <section id="faq">
        <h2>Questions fréquentes</h2>
        <div class="faq">{faq_html(g['faq'])}
        </div>
      </section>''' if g.get('faq') else '')
    return tete(titre, g['description'], g['fichier'], ld, 'article') + f'''
  <main id="top" class="seo-guide">
    <div class="l-wrap l-narrow">
      {fil_html}
      <p class="eyebrow">Guide · mis à jour en octobre 2026</p>
      <h1>{e(g['titre'])}</h1>
      <p class="lead">{e(g['intro'])}</p>
      <aside class="seo-encart">
        <p><strong>Avec Devizo, ces mentions sont ajoutées automatiquement</strong> à partir des informations de votre entreprise.
          Essai gratuit 14 jours, sans carte bancaire.</p>
        <a class="btn btn-primary" href="app.html#inscription">{e(g['cta'])}</a>
      </aside>
      <nav class="seo-sommaire" aria-label="Sommaire"><p>Sommaire</p><ol>{sommaire}</ol></nav>
      {corps}
      {faq}
      <p class="seo-avertissement">Ce guide présente les règles générales applicables en France. Il ne remplace pas l'avis d'un expert-comptable
        ou d'un juriste pour votre situation. Sources officielles : <a href="https://entreprendre.service-public.fr/" rel="noopener">entreprendre.service-public.fr</a>
        et <a href="https://www.economie.gouv.fr/" rel="noopener">economie.gouv.fr</a>.</p>
    </div>
    <section class="final-cta">
      <div class="l-wrap">
        <h2>{e(g['pluriel'])}</h2>
        <p>14 jours gratuits, sans carte bancaire. Formules à partir de 9 € HT par mois.</p>
        <a class="btn btn-lg btn-light" href="app.html#inscription">Commencer l'essai gratuit</a>
      </div>
    </section>
  </main>
''' + pied()


def ecrire(nom, contenu):
    with open(RACINE + nom, 'w') as f:
        f.write(contenu)


pages = []
for m in METIERS:
    ecrire(f'devis-facture-{m["slug"]}.html', page_metier(m))
    pages.append((f'devis-facture-{m["slug"]}.html', '0.8'))
for g in GUIDES:
    ecrire(g['fichier'], page_guide(g))
    pages.append((g['fichier'], '0.8'))

urls = [('', '1.0')] + pages + [('mentions-legales.html', '0.2'), ('cgv.html', '0.2'), ('confidentialite.html', '0.2')]
ecrire('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
       + ''.join(f'  <url><loc>{SITE}/{u}</loc><lastmod>{AUJOURDHUI}</lastmod><priority>{p}</priority></url>\n' for u, p in urls)
       + '</urlset>\n')
ecrire('robots.txt', f'User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /signer.html\nDisallow: /supabase/\n\nSitemap: {SITE}/sitemap.xml\n')
print(len(pages), 'pages générées')
