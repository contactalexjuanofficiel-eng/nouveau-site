# Guides de référencement : règles générales, rédigées prudemment.

GUIDES = [
  {
    'fichier': 'guide-mentions-obligatoires-devis.html',
    'court': 'Mentions obligatoires d\'un devis',
    'objet': 'devis',
    'cta': 'Faire mon premier devis',
    'pluriel': 'Des devis conformes, sans y penser.',
    'date': '2026-10-12',
    'titre': "Mentions obligatoires d'un devis d'artisan (2026)",
    'description': "Quelles mentions doit contenir un devis d'artisan du bâtiment ? Identité, SIRET, détail des travaux, TVA, validité, assurance décennale : la liste complète et un exemple.",
    'intro': "Un devis bien rédigé protège l'artisan comme le client : une fois signé, il engage les deux parties sur le prix et le contenu des travaux. Voici les mentions à faire figurer sur un devis de travaux, et les cas où il est obligatoire.",
    'sections': [
      {'id': 'quand', 'titre': 'Quand un devis est-il obligatoire ?', 'html': """
        <p>Le devis n'est pas toujours imposé par la loi, mais il est fortement recommandé dès qu'un chantier dépasse quelques centaines d'euros. Il devient obligatoire notamment :</p>
        <ul>
          <li>pour les <strong>dépannages, réparations et entretiens dans le bâtiment</strong> chez un particulier, lorsque le montant dépasse <strong>150 € TTC</strong>, ou dès que le client en demande un ;</li>
          <li>lorsque le client le demande avant des travaux ;</li>
          <li>dans certains secteurs réglementés et pour certaines aides (rénovation énergétique, par exemple), qui exigent un devis détaillé.</li>
        </ul>
        <p>Une fois signé par le client avec la mention « bon pour accord », le devis vaut contrat : le prix et les prestations ne peuvent plus être modifiés sans son accord.</p>"""},
      {'id': 'artisan', 'titre': "Les informations sur l'entreprise", 'html': """
        <ul>
          <li>Le nom ou la dénomination de l'entreprise, avec la mention <strong>« EI »</strong> pour un entrepreneur individuel ;</li>
          <li>l'adresse du siège ;</li>
          <li>le numéro <strong>SIRET</strong> et, le cas échéant, le numéro d'immatriculation au registre (RCS ou répertoire des métiers) ;</li>
          <li>pour une société : la forme juridique (SARL, SAS…) et le montant du capital ;</li>
          <li>le numéro de <strong>TVA intracommunautaire</strong> si l'entreprise est assujettie à la TVA ;</li>
          <li>les coordonnées : téléphone et e-mail.</li>
        </ul>"""},
      {'id': 'client', 'titre': 'Les informations sur le client et le chantier', 'html': """
        <ul>
          <li>Le nom et l'adresse du client ;</li>
          <li>l'adresse du chantier si elle est différente ;</li>
          <li>la date du devis ;</li>
          <li>la date de début et la durée estimée des travaux.</li>
        </ul>"""},
      {'id': 'detail', 'titre': 'Le détail des travaux et des prix', 'html': """
        <ul>
          <li>Le <strong>décompte détaillé</strong> de chaque prestation : désignation, quantité, unité (m², ml, heure, forfait…) et prix unitaire hors taxe ;</li>
          <li>la distinction entre la fourniture et la main-d'œuvre, lorsque c'est pertinent ;</li>
          <li>les frais de déplacement, s'ils sont facturés ;</li>
          <li>le <strong>total hors taxe</strong>, le taux et le montant de TVA pour chaque taux, et le <strong>total TTC</strong>.</li>
        </ul>
        <p>Dans le bâtiment, plusieurs taux de TVA coexistent : <strong>20 %</strong> (taux normal, construction neuve), <strong>10 %</strong> (travaux d'amélioration et d'entretien dans un logement de plus de 2 ans) et <strong>5,5 %</strong> (certains travaux de rénovation énergétique, sous conditions). Un micro-entrepreneur en franchise de TVA indique des montants sans TVA et la mention <strong>« TVA non applicable, art. 293 B du CGI »</strong>.</p>"""},
      {'id': 'conditions', 'titre': 'Les conditions du devis', 'html': """
        <ul>
          <li>La <strong>durée de validité</strong> de l'offre (par exemple 30 jours) ;</li>
          <li>le caractère <strong>gratuit ou payant</strong> du devis ;</li>
          <li>les conditions de paiement : acompte à la commande, échéances, solde ;</li>
          <li>l'<strong>assurance professionnelle</strong> : pour les activités soumises à la garantie décennale, le nom et les coordonnées de l'assureur et la zone géographique couverte ;</li>
          <li>pour un client particulier, les coordonnées du <strong>médiateur de la consommation</strong> auquel il peut recourir en cas de litige ;</li>
          <li>un espace pour la signature du client, précédée de la mention « bon pour accord ».</li>
        </ul>"""},
      {'id': 'exemple', 'titre': 'Exemple de devis conforme', 'html': """
        <p>Un devis de remplacement de chauffe-eau contiendra par exemple : l'en-tête de l'entreprise (nom, SIRET, TVA), le client et l'adresse du chantier, une ligne pour la dépose, une pour l'appareil, une pour les raccords et une pour la main-d'œuvre, les totaux HT, TVA 10 % et TTC, la validité de 30 jours, l'acompte demandé, l'assurance décennale et la zone de signature.</p>
        <p>Voir des exemples complets par métier : <a href="devis-facture-plombier.html">plombier</a>, <a href="devis-facture-electricien.html">électricien</a>, <a href="devis-facture-peintre.html">peintre</a>, <a href="devis-facture-macon.html">maçon</a>, <a href="devis-facture-carreleur.html">carreleur</a>.</p>"""},
      {'id': 'devizo', 'titre': 'Faire un devis conforme avec Devizo', 'html': """
        <p>Dans Devizo, vous renseignez une seule fois votre entreprise (SIRET, TVA ou franchise, assurance, médiateur). Ensuite, chaque devis reprend automatiquement les mentions obligatoires : numéro, date, validité, détail des lignes, totaux par taux de TVA, conditions de paiement et assurance. Le client peut même <strong>signer le devis en ligne</strong>, depuis son téléphone.</p>"""},
    ],
    'faq': [
      ("Un devis signé est-il un contrat ?", "Oui. Une fois accepté et signé par le client, le devis engage les deux parties : l'artisan sur le prix et les prestations, le client sur la commande."),
      ("Combien de temps un devis est-il valable ?", "C'est l'artisan qui fixe la durée de validité, indiquée sur le devis (souvent 1 à 3 mois). Passé ce délai, il peut proposer un nouveau prix."),
      ("Un devis peut-il être payant ?", "Oui, à condition que le client en soit informé avant son établissement. Le devis doit alors préciser son prix ; il est souvent déduit de la facture si les travaux sont commandés."),
      ("Faut-il faire signer le devis ?", "C'est fortement conseillé : la signature du client, précédée de « bon pour accord », prouve son accord sur le prix et les travaux."),
    ],
  },
  {
    'fichier': 'guide-mentions-obligatoires-facture.html',
    'court': 'Mentions obligatoires d\'une facture',
    'objet': 'facture',
    'cta': 'Faire ma première facture',
    'pluriel': 'Des factures conformes, sans y penser.',
    'date': '2026-10-12',
    'titre': "Mentions obligatoires d'une facture d'artisan (2026)",
    'description': "Numéro, SIRET, TVA, échéance, pénalités, indemnité de 40 €, « TVA non applicable, art. 293 B du CGI » : toutes les mentions obligatoires d'une facture d'artisan en 2026.",
    'intro': "Une facture incomplète peut être sanctionnée par une amende et compliquer le recouvrement. Voici les mentions qu'une facture d'artisan doit comporter, les mentions particulières selon votre situation, et ce que change la facturation électronique.",
    'sections': [
      {'id': 'numero', 'titre': 'Numéro et date', 'html': """
        <ul>
          <li>Un <strong>numéro unique</strong>, attribué selon une suite chronologique et continue, <strong>sans trou</strong> (par exemple F-2026-001, F-2026-002…) ;</li>
          <li>la <strong>date d'émission</strong> de la facture ;</li>
          <li>la date de la prestation ou de la fin des travaux, si elle est différente.</li>
        </ul>"""},
      {'id': 'parties', 'titre': "L'entreprise et le client", 'html': """
        <ul>
          <li>Le nom ou la dénomination de l'entreprise, avec la mention <strong>« EI »</strong> pour un entrepreneur individuel ;</li>
          <li>l'adresse, le numéro <strong>SIREN ou SIRET</strong> et, le cas échéant, l'immatriculation au RCS ou au répertoire des métiers ;</li>
          <li>pour une société : la forme juridique et le capital ;</li>
          <li>le numéro de <strong>TVA intracommunautaire</strong> si l'entreprise est assujettie ;</li>
          <li>le nom et l'adresse du client, et son numéro de TVA intracommunautaire s'il s'agit d'un professionnel assujetti.</li>
        </ul>"""},
      {'id': 'detail', 'titre': 'Le détail et les montants', 'html': """
        <ul>
          <li>La désignation précise de chaque prestation ou produit, la quantité et le <strong>prix unitaire hors taxe</strong> ;</li>
          <li>les éventuelles réductions ;</li>
          <li>le <strong>taux de TVA</strong> de chaque ligne, le montant de TVA par taux ;</li>
          <li>le <strong>total HT</strong> et le <strong>total TTC</strong> à payer.</li>
        </ul>"""},
      {'id': 'paiement', 'titre': 'Les conditions de paiement', 'html': """
        <ul>
          <li>La <strong>date d'échéance</strong> du paiement ;</li>
          <li>les conditions d'escompte en cas de paiement anticipé (ou l'absence d'escompte) ;</li>
          <li>le taux des <strong>pénalités de retard</strong> ;</li>
          <li>pour un client professionnel, l'<strong>indemnité forfaitaire de 40 €</strong> pour frais de recouvrement en cas de retard.</li>
        </ul>
        <p>Entre professionnels, le délai de paiement est en principe limité à 60 jours après la date d'émission de la facture (ou 45 jours fin de mois, si le contrat le prévoit).</p>"""},
      {'id': 'particulieres', 'titre': 'Les mentions particulières selon votre situation', 'html': """
        <ul>
          <li><strong>Micro-entrepreneur en franchise de TVA</strong> : « TVA non applicable, art. 293 B du CGI », et des montants sans TVA ;</li>
          <li><strong>Sous-traitance dans le BTP</strong> : facture hors taxe avec la mention « Autoliquidation », la TVA étant due par l'entreprise principale (article 283-2 nonies du CGI) ;</li>
          <li><strong>Option pour le paiement de la TVA d'après les débits</strong> : la mention doit figurer sur la facture si vous l'avez choisie ;</li>
          <li><strong>Assurance décennale</strong> : pour les activités qui y sont soumises, le nom et les coordonnées de l'assureur et la zone géographique couverte.</li>
        </ul>"""},
      {'id': 'electronique', 'titre': 'Ce que change la facturation électronique', 'html': """
        <p>La France généralise progressivement la facture électronique entre entreprises. Depuis le <strong>1er septembre 2026</strong>, toutes les entreprises doivent être en mesure de <strong>recevoir</strong> des factures électroniques. L'obligation d'<strong>émettre</strong> des factures électroniques s'applique d'abord aux grandes et moyennes entreprises, puis aux PME, TPE et micro-entreprises à partir du <strong>1er septembre 2027</strong>, via une plateforme agréée.</p>
        <p>La réforme ajoute aussi de nouvelles mentions, comme le numéro SIREN du client, la nature de l'opération (livraison de biens, prestation de services ou les deux) et l'adresse de livraison si elle diffère de celle du client. Les factures à des particuliers ne sont pas concernées par l'obligation d'émission électronique.</p>"""},
      {'id': 'conservation', 'titre': 'Conserver ses factures', 'html': """
        <p>Les factures doivent être conservées <strong>10 ans</strong> (obligation comptable), et le client professionnel doit recevoir l'original. Une facture ne se supprime pas : en cas d'erreur, on établit une facture d'avoir.</p>"""},
      {'id': 'devizo', 'titre': 'Des factures conformes avec Devizo', 'html': """
        <p>Devizo numérote vos factures sans trou, reprend toutes les lignes du devis accepté en un clic et ajoute automatiquement les mentions adaptées à votre situation : TVA ou franchise, pénalités, indemnité de 40 € pour les clients professionnels, autoliquidation, assurance et médiateur. Vous envoyez la facture par e-mail avec le PDF et relancez les retards en un geste.</p>"""},
    ],
    'faq': [
      ("Peut-on modifier ou supprimer une facture ?", "Non, une facture émise ne se modifie pas et ne se supprime pas. En cas d'erreur, on émet une facture d'avoir qui l'annule en tout ou partie, puis une nouvelle facture."),
      ("Quelle mention pour une facture sans TVA d'auto-entrepreneur ?", "« TVA non applicable, art. 293 B du CGI », tant que vous bénéficiez de la franchise en base de TVA."),
      ("L'indemnité de 40 € s'applique-t-elle aux particuliers ?", "Non. L'indemnité forfaitaire de 40 € pour frais de recouvrement ne concerne que les clients professionnels."),
      ("Combien de temps garder ses factures ?", "10 ans à compter de la clôture de l'exercice, au titre des obligations comptables."),
    ],
  },
]
