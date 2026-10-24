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

GUIDES += [
  {
    'fichier': 'guide-relancer-facture-impayee.html',
    'court': 'Relancer une facture impayée',
    'cta': 'Relancer mes factures en 1 clic',
    'pluriel': 'Vos relances prêtes en 1 clic.',
    'date': '2026-10-24',
    'titre': 'Facture impayée : comment relancer un client (modèles)',
    'description': "Client qui ne paie pas ? Les étapes pour relancer une facture impayée : relance aimable, mise en demeure, pénalités, indemnité de 40 €, et des modèles de messages.",
    'intro': "Un retard de paiement peut mettre une petite entreprise en difficulté. Bonne nouvelle : la plupart des impayés se règlent avec une relance au bon moment et sur le bon ton. Voici les étapes, des modèles de messages et vos droits.",
    'encart': "<strong>Avec Devizo, les factures en retard sont signalées toutes seules</strong> : un clic et la relance part, avec le message déjà rédigé et la facture en PDF.",
    'sections': [
      {'id': 'prevenir', 'titre': 'Avant tout : éviter les impayés', 'html': """
        <ul>
          <li>Indiquez une <strong>date d'échéance claire</strong> sur chaque facture, ainsi que le taux des pénalités de retard.</li>
          <li>Demandez un <strong>acompte</strong> à la signature du devis pour les chantiers importants.</li>
          <li>Facturez <strong>dès la fin des travaux</strong> : plus la facture part tard, plus le paiement arrive tard.</li>
          <li>Pour un client professionnel, vérifiez que son entreprise est bien active avec le <a href="verifier-siret.html">vérificateur de SIRET</a>.</li>
        </ul>"""},
      {'id': 'etapes', 'titre': 'Les étapes de la relance', 'html': """
        <ol>
          <li><strong>Le jour de l'échéance ou juste après</strong> : un petit rappel aimable. Souvent, il s'agit d'un simple oubli.</li>
          <li><strong>Environ une semaine plus tard</strong> : une deuxième relance, plus ferme, avec la facture jointe.</li>
          <li><strong>Deux à trois semaines après l'échéance</strong> : un appel téléphonique, puis une relance écrite qui rappelle les pénalités prévues.</li>
          <li><strong>Si rien ne bouge</strong> : une <strong>mise en demeure</strong> par lettre recommandée avec accusé de réception, qui fixe un dernier délai.</li>
          <li><strong>En dernier recours</strong> : la procédure d'injonction de payer auprès du tribunal, ou le recours à un commissaire de justice.</li>
        </ol>"""},
      {'id': 'modeles', 'titre': 'Modèles de messages de relance', 'html': """
        <p><strong>Première relance (aimable) :</strong></p>
        <blockquote>Bonjour, sauf erreur de notre part, la facture n° F-2026-031 du 13/09/2026, d'un montant de 517,00 € TTC, arrivée à échéance le 13/10/2026, reste à régler. Vous la trouverez en pièce jointe. Si le paiement a été fait entre-temps, merci de ne pas tenir compte de ce message. Bonne journée.</blockquote>
        <p><strong>Deuxième relance (plus ferme) :</strong></p>
        <blockquote>Bonjour, malgré notre précédent message, la facture n° F-2026-031 de 517,00 € TTC n'est toujours pas réglée. Merci de procéder au paiement sous 8 jours. Nous vous rappelons que des pénalités de retard sont prévues dans nos conditions de paiement.</blockquote>
        <p><strong>Mise en demeure</strong> (par lettre recommandée) : rappelez la facture, le montant, la date d'échéance, les relances déjà faites, et fixez un dernier délai (par exemple 8 ou 15 jours), en précisant qu'à défaut vous engagerez une procédure de recouvrement.</p>"""},
      {'id': 'droits', 'titre': 'Pénalités et indemnité : vos droits', 'html': """
        <ul>
          <li><strong>Pénalités de retard</strong> : elles s'appliquent si elles figurent dans vos conditions de paiement. Entre professionnels, elles sont dues sans qu'un rappel soit nécessaire.</li>
          <li><strong>Indemnité forfaitaire de 40 €</strong> pour frais de recouvrement : due par un client <strong>professionnel</strong> en retard, en plus des pénalités. Elle ne s'applique pas aux particuliers.</li>
          <li><strong>Délais de paiement entre professionnels</strong> : en principe 30 jours après la réalisation de la prestation si rien n'est prévu, et au maximum 60 jours après la date de la facture (ou 45 jours fin de mois si le contrat le prévoit).</li>
        </ul>"""},
    ],
    'faq': [
      ("Au bout de combien de temps relancer une facture impayée ?", "Dès le lendemain de la date d'échéance, avec un message aimable. La plupart des retards sont des oublis : plus la relance est rapide, plus le paiement arrive vite."),
      ("Peut-on facturer des pénalités de retard à un particulier ?", "Oui, si les pénalités figurent dans vos conditions de paiement acceptées par le client. En revanche, l'indemnité forfaitaire de 40 € ne concerne que les clients professionnels."),
      ("Qu'est-ce qu'une mise en demeure ?", "C'est une lettre, de préférence recommandée avec accusé de réception, qui demande officiellement le paiement dans un dernier délai. Elle est souvent nécessaire avant d'engager une procédure en justice."),
    ],
  },
  {
    'fichier': 'guide-acompte-devis.html',
    'court': 'Acompte sur devis',
    'cta': "Ajouter un acompte à mon devis",
    'pluriel': "Vos devis avec acompte, en 2 minutes.",
    'date': '2026-10-24',
    'titre': 'Acompte sur devis : combien demander, comment facturer',
    'description': "Acompte ou arrhes, quel pourcentage demander sur un devis de travaux, comment l'indiquer et le facturer : les règles à connaître pour un artisan.",
    'intro': "Demander un acompte à la signature d'un devis permet d'acheter le matériel sans avancer l'argent et de s'assurer de l'engagement du client. Encore faut-il bien le présenter et le facturer.",
    'encart': "<strong>Dans Devizo, indiquez le pourcentage d'acompte sur le devis</strong> : le montant à payer à la commande s'affiche tout seul sur le PDF.",
    'sections': [
      {'id': 'difference', 'titre': 'Acompte ou arrhes : ce n\'est pas pareil', 'html': """
        <ul>
          <li><strong>Acompte</strong> : c'est un premier paiement d'une commande ferme. Le client s'engage à payer la totalité ; l'artisan s'engage à réaliser les travaux. Aucun des deux ne peut se désister librement.</li>
          <li><strong>Arrhes</strong> : elles permettent à chacun de se dédire. Le client qui renonce perd les arrhes ; l'artisan qui renonce doit rembourser le double.</li>
        </ul>
        <p>Écrivez clairement le mot <strong>« acompte »</strong> sur le devis. En cas de doute sur une somme versée d'avance par un particulier, elle peut être considérée comme des arrhes.</p>"""},
      {'id': 'combien', 'titre': "Quel pourcentage demander ?", 'html': """
        <p>Pour des travaux courants, aucune règle générale ne fixe le montant : c'est une question d'accord avec le client. En pratique, beaucoup d'artisans demandent entre <strong>20 % et 40 %</strong> à la commande, souvent 30 %, surtout quand il faut acheter du matériel.
          Certains contrats particuliers, comme la construction d'une maison individuelle, ont des règles d'échéancier spécifiques.</p>
        <p>Pour un gros chantier, vous pouvez prévoir un échéancier : un acompte à la signature, un paiement intermédiaire à une étape précise, et le solde à la fin des travaux.</p>"""},
      {'id': 'devis', 'titre': "L'indiquer sur le devis", 'html': """
        <p>Précisez le pourcentage ou le montant de l'acompte, le moment où il est dû (à la signature, au démarrage…) et les moyens de paiement acceptés. Le client sait ainsi exactement ce qu'il doit payer et quand.</p>"""},
      {'id': 'facturer', 'titre': "Facturer l'acompte", 'html': """
        <p>Un acompte encaissé donne lieu à une <strong>facture d'acompte</strong>, avec les mêmes mentions qu'une facture classique. À la fin des travaux, la facture finale reprend le montant total et <strong>déduit les acomptes déjà payés</strong>.</p>
        <p>Si vous êtes assujetti à la TVA, la TVA sur les prestations de services est en général due au moment de l'encaissement : l'acompte inclut donc sa part de TVA. Votre comptable peut vous préciser les règles qui s'appliquent à votre situation.</p>"""},
    ],
    'faq': [
      ("Un acompte est-il remboursable ?", "En principe non : l'acompte correspond à une commande ferme. Si le client renonce, il reste redevable du prix. Les situations particulières (par exemple un droit de rétractation) peuvent toutefois s'appliquer."),
      ("Combien demander d'acompte sur un devis de travaux ?", "Il n'y a pas de pourcentage imposé pour des travaux courants. Beaucoup d'artisans demandent entre 20 et 40 %, souvent 30 %, pour couvrir l'achat du matériel."),
      ("Faut-il faire une facture pour un acompte ?", "Oui, un acompte encaissé doit faire l'objet d'une facture d'acompte. La facture finale déduit ensuite les acomptes déjà versés."),
    ],
  },
  {
    'fichier': 'guide-devis-signe-bon-pour-accord.html',
    'court': 'Devis signé et bon pour accord',
    'cta': 'Faire signer mes devis en ligne',
    'pluriel': 'Vos devis signés en ligne, en quelques secondes.',
    'date': '2026-10-24',
    'titre': 'Devis signé « bon pour accord » : quelle valeur ?',
    'description': "Que vaut un devis signé ? Bon pour accord, signature en ligne, travaux en plus, délai de rétractation : ce qu'un artisan doit savoir avant le chantier.",
    'intro': "Le devis signé est le document le plus important d'un chantier : il fixe le prix, le contenu des travaux et engage les deux parties. Voici ce qu'il vaut, comment le faire signer, et les pièges à éviter.",
    'encart': "<strong>Avec Devizo, votre client signe le devis sur son téléphone</strong>, avec la mention « bon pour accord » : le devis passe tout seul en « Accepté ».",
    'sections': [
      {'id': 'valeur', 'titre': 'Un devis signé vaut contrat', 'html': """
        <p>Une fois accepté et signé par le client, le devis engage les deux parties : l'artisan doit réaliser les travaux décrits au prix indiqué, et le client doit payer ce prix. Ni l'un ni l'autre ne peut le modifier seul.</p>
        <p>La mention manuscrite ou cochée <strong>« Devis reçu avant l'exécution des travaux, bon pour accord »</strong>, avec la date et la signature, montre clairement que le client a accepté l'offre.</p>"""},
      {'id': 'electronique', 'titre': 'La signature électronique est-elle valable ?', 'html': """
        <p>Oui. En France, l'écrit électronique a la même valeur que l'écrit sur papier, à condition que l'on puisse identifier la personne qui signe et garantir que le document n'a pas été modifié. Garder une trace de la signature (nom, date, document signé) est donc essentiel.</p>
        <p>Pour un devis de travaux courant, une signature en ligne simple, avec le nom du client, sa signature et la date, est une pratique répandue et pratique pour les deux parties.</p>"""},
      {'id': 'modifier', 'titre': 'Et si les travaux changent ?', 'html': """
        <p>Si le client demande des travaux en plus, ou si vous découvrez un imprévu, faites un <strong>devis complémentaire (ou avenant)</strong> et faites-le signer avant de le réaliser. Sans accord écrit, il sera difficile de faire payer les travaux supplémentaires.</p>"""},
      {'id': 'retractation', 'titre': 'Attention au délai de rétractation', 'html': """
        <p>Quand un devis est signé par un <strong>particulier chez lui</strong> (ou ailleurs que dans vos locaux), il s'agit en général d'un contrat « hors établissement » : le client dispose alors en principe d'un <strong>délai de rétractation de 14 jours</strong>, qui doit lui être indiqué avec un formulaire de rétractation.</p>
        <p>Les travaux ne peuvent en principe pas commencer avant la fin de ce délai, sauf si le client le demande expressément par écrit. Des exceptions existent, notamment pour les travaux d'entretien ou de réparation urgents demandés par le client. Les règles détaillées sont sur economie.gouv.fr.</p>"""},
    ],
    'faq': [
      ("Un devis signé peut-il être annulé ?", "Pas librement : il vaut contrat. Seules des situations particulières le permettent, comme le délai de rétractation de 14 jours pour un contrat signé hors établissement avec un particulier, ou un accord entre les deux parties."),
      ("La mention « bon pour accord » est-elle obligatoire ?", "Elle n'est pas imposée par un texte général, mais elle est très recommandée : avec la date et la signature, elle prouve que le client a accepté le devis tel quel."),
      ("Un devis signé sur téléphone a-t-il de la valeur ?", "Oui, une signature électronique a la même valeur qu'une signature sur papier si l'on peut identifier le signataire et garantir que le devis n'a pas été modifié."),
    ],
  },
  {
    'fichier': 'guide-facturation-electronique-2026.html',
    'court': 'Facturation électronique 2026',
    'cta': 'Essayer Devizo gratuitement',
    'pluriel': 'Vos devis et factures, simplement.',
    'date': '2026-10-24',
    'titre': 'Facture électronique : le calendrier pour les artisans',
    'description': "Facture électronique obligatoire : recevoir dès septembre 2026, émettre en 2027, plateforme agréée, nouvelles mentions. Le point pour les artisans.",
    'intro': "La facture électronique devient obligatoire entre entreprises en France. Pour un artisan ou un micro-entrepreneur, la réforme se fait en deux temps : recevoir d'abord, émettre ensuite. Voici le calendrier et ce qu'il faut préparer.",
    'encart': "<strong>Bien préparé, c'est d'abord des factures propres et numérotées sans trou</strong> : c'est ce que fait Devizo dès aujourd'hui, avec les mentions obligatoires ajoutées automatiquement.",
    'sections': [
      {'id': 'quoi', 'titre': "De quoi s'agit-il ?", 'html': """
        <p>Une facture électronique n'est pas un simple PDF envoyé par e-mail : c'est une facture dans un format structuré, transmise par une <strong>plateforme agréée</strong> par l'administration. Les données de facturation sont aussi transmises au fisc.</p>
        <p>L'obligation concerne les factures <strong>entre entreprises assujetties à la TVA en France</strong>. Pour les ventes aux particuliers et certaines opérations, il s'agit d'une transmission de données (« e-reporting ») plutôt que d'une facture électronique.</p>"""},
      {'id': 'dates', 'titre': 'Le calendrier', 'html': """
        <ul>
          <li><strong>1er septembre 2026</strong> : toutes les entreprises, y compris les micro-entreprises, doivent pouvoir <strong>recevoir</strong> des factures électroniques. Les grandes entreprises et les entreprises de taille intermédiaire doivent aussi les <strong>émettre</strong>.</li>
          <li><strong>1er septembre 2027</strong> : les PME, TPE et micro-entreprises doivent à leur tour <strong>émettre</strong> leurs factures électroniques.</li>
        </ul>
        <p>Ce calendrier peut évoluer : vérifiez les informations à jour sur impots.gouv.fr.</p>"""},
      {'id': 'faire', 'titre': 'Ce que vous devez faire', 'html': """
        <ol>
          <li><strong>Choisir une plateforme agréée</strong> pour recevoir vos factures fournisseurs (et plus tard émettre les vôtres). La liste officielle est publiée par l'administration.</li>
          <li><strong>Vérifier vos informations</strong> : SIREN, adresse, numéro de TVA, sur vos devis et factures.</li>
          <li><strong>Préparer les nouvelles mentions</strong> : SIREN du client, nature de l'opération (biens, services ou les deux), adresse de livraison si elle diffère.</li>
          <li><strong>Garder une numérotation sans trou</strong> et des factures complètes : c'est la base, avec ou sans réforme.</li>
        </ol>"""},
      {'id': 'particuliers', 'titre': 'Et vos clients particuliers ?', 'html': """
        <p>Les factures à des particuliers ne passent pas en facture électronique obligatoire : vous continuez à leur remettre une facture classique. En revanche, certaines données de ces ventes devront être transmises à l'administration (e-reporting), selon le même calendrier.</p>"""},
    ],
    'faq': [
      ("Les micro-entrepreneurs sont-ils concernés par la facture électronique ?", "Oui. Ils doivent pouvoir recevoir des factures électroniques dès le 1er septembre 2026, et les émettre à partir du 1er septembre 2027 pour leurs clients professionnels."),
      ("Un PDF envoyé par e-mail est-il une facture électronique ?", "Non. Dans le cadre de la réforme, la facture électronique est un format structuré transmis via une plateforme agréée par l'administration."),
      ("Les factures aux particuliers deviennent-elles électroniques ?", "Non, mais certaines données sur ces ventes devront être transmises à l'administration (e-reporting) selon le même calendrier."),
    ],
  },
]
