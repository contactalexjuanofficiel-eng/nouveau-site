"""Contenu des pages « outils gratuits » (calculateur de TVA, simulateur de
cotisations, vérification de SIRET). Le code des outils est dans js/outils.js."""

OUTILS = [
    {
        'fichier': 'calcul-tva-travaux.html',
        'zone': 'outil-tva',
        'court': 'Calcul de la TVA des travaux',
        'titre': 'Taux de TVA travaux 2026 : 5,5 %, 10 % ou 20 % ? Calculateur gratuit | Devizo',
        'description': "Quel taux de TVA appliquer sur vos travaux ? Répondez à 3 questions : 5,5 %, 10 % ou 20 %, autoliquidation ou franchise, avec le calcul HT et TTC.",
        'eyebrow': 'Outil gratuit · artisans du bâtiment',
        'h1': 'Quel taux de TVA pour vos travaux ?',
        'lead': "Répondez à quelques questions : l'outil vous donne le bon taux (5,5 %, 10 % ou 20 %) et calcule le prix HT et TTC.",
        'sections': [
            ('Les 3 taux de TVA dans le bâtiment', '''
        <ul>
          <li><strong>20 % (taux normal)</strong> : construction neuve, logement de moins de 2 ans, agrandissement, local professionnel, vente de matériel sans pose.</li>
          <li><strong>10 % (taux intermédiaire)</strong> : travaux d'amélioration, de transformation, d'aménagement et d'entretien dans un logement achevé depuis plus de 2 ans.</li>
          <li><strong>5,5 % (taux réduit)</strong> : travaux de rénovation énergétique dans un logement de plus de 2 ans, pour les équipements qui respectent les critères de performance.</li>
        </ul>
        <p>Quand vous fournissez et posez le matériel, le matériel suit le taux des travaux. Sur un même devis, chaque ligne peut avoir son propre taux.</p>'''),
            ('Deux cas sans TVA', '''
        <p><strong>La franchise en base</strong> : en micro-entreprise sous le seuil, vous ne facturez pas de TVA. La mention « TVA non applicable, art. 293 B du CGI » doit figurer sur vos devis et factures.</p>
        <p><strong>L'autoliquidation</strong> : en sous-traitance pour une autre entreprise du bâtiment, vous facturez HT et c'est l'entreprise principale qui déclare la TVA, avec la mention « Autoliquidation ».</p>'''),
        ],
        'faq': [
            ("Quel taux de TVA pour une salle de bain ?",
             "Dans un logement de plus de 2 ans, la rénovation d'une salle de bain est en général à 10 %. Dans le neuf ou dans un logement de moins de 2 ans, c'est 20 %."),
            ("Quel taux de TVA pour une pompe à chaleur ou de l'isolation ?",
             "Dans un logement de plus de 2 ans, les travaux de rénovation énergétique qui respectent les critères de performance sont à 5,5 %. Sinon, c'est 10 % ou 20 % selon le cas."),
            ("Faut-il une attestation du client pour la TVA à 10 % ou 5,5 % ?",
             "Oui : le client doit attester que le logement a plus de 2 ans et que les travaux remplissent les conditions du taux réduit. Conservez cette attestation avec la facture. Les formulaires et règles à jour sont sur impots.gouv.fr."),
            ("Je suis auto-entrepreneur, je dois facturer la TVA ?",
             "Pas si vous êtes en franchise en base, c'est-à-dire sous le seuil de chiffre d'affaires. Vous facturez alors sans TVA, avec la mention « TVA non applicable, art. 293 B du CGI »."),
        ],
    },
    {
        'fichier': 'simulateur-cotisations-auto-entrepreneur.html',
        'zone': 'outil-cotisations',
        'court': 'Simulateur de cotisations',
        'titre': 'Simulateur cotisations auto-entrepreneur 2026 : combien il vous reste | Devizo',
        'description': "Calculez vos cotisations Urssaf de micro-entrepreneur et ce qu'il vous reste vraiment : artisan, vente ou libéral, versement libératoire, plafond et seuil de TVA.",
        'eyebrow': 'Outil gratuit · micro-entreprise',
        'h1': 'Combien il vous reste en auto-entrepreneur ?',
        'lead': "Indiquez ce que vous encaissez et vos dépenses : le simulateur calcule vos cotisations Urssaf et ce qu'il vous reste vraiment.",
        'sections': [
            ("Comment sont calculées les cotisations d'un micro-entrepreneur", '''
        <p>En micro-entreprise, les cotisations sociales sont un <strong>pourcentage du chiffre d'affaires encaissé</strong>, et non du bénéfice : vos dépenses ne les font pas baisser.
          C'est pour cela qu'il faut bien les déduire vous-même pour savoir ce qu'il vous reste.</p>
        <p>À ces cotisations s'ajoute la contribution à la formation professionnelle. Si vous avez choisi le versement libératoire, l'impôt sur le revenu est aussi un pourcentage du chiffre d'affaires, payé en même temps.</p>'''),
            ('Plafond et seuil de TVA', '''
        <p>La micro-entreprise a un <strong>plafond de chiffre d'affaires annuel</strong> au-delà duquel on change de régime, et un <strong>seuil de franchise de TVA</strong> au-delà duquel vous devez facturer la TVA.
          Le simulateur vous montre où vous en êtes sur l'année.</p>'''),
        ],
        'faq': [
            ("Les cotisations se calculent sur le chiffre d'affaires ou sur le bénéfice ?",
             "Sur le chiffre d'affaires encaissé. Vos achats de matériel ne réduisent pas vos cotisations, d'où l'intérêt de suivre vos dépenses à part pour connaître votre vrai revenu."),
            ("Le simulateur compte-t-il l'impôt sur le revenu ?",
             "Seulement si vous avez choisi le versement libératoire, qui est un pourcentage fixe du chiffre d'affaires. Sinon, l'impôt dépend de votre foyer fiscal et n'est pas calculé."),
            ("Et l'ACRE ?",
             "L'ACRE réduit les cotisations pendant les premiers mois d'activité. Elle n'est pas comptée ici : vos cotisations réelles peuvent donc être plus basses au démarrage. Les taux officiels sont sur autoentrepreneur.urssaf.fr."),
        ],
    },
    {
        'fichier': 'verifier-siret.html',
        'zone': 'outil-siret',
        'court': 'Vérifier un SIRET',
        'titre': 'Vérifier un numéro SIRET gratuitement : entreprise active ou fermée | Devizo',
        'description': "Vérifiez un numéro SIRET ou SIREN en 1 seconde : clé de contrôle, nom, adresse et état de l'entreprise (active ou fermée), depuis l'annuaire officiel.",
        'eyebrow': 'Outil gratuit · annuaire officiel',
        'h1': 'Vérifier un numéro SIRET',
        'lead': "Tapez un SIRET (14 chiffres) ou un SIREN (9 chiffres) : vous voyez tout de suite s'il est valide, à quelle entreprise il correspond et si elle est toujours active.",
        'sections': [
            ('Pourquoi vérifier un SIRET ?', '''
        <ul>
          <li><strong>Sur vos propres devis et factures</strong> : une faute de frappe dans votre SIRET rend vos documents incomplets.</li>
          <li><strong>Pour un client professionnel</strong> : son SIRET doit figurer sur vos factures, et une entreprise fermée est un risque d'impayé.</li>
          <li><strong>Pour un sous-traitant</strong> : au-delà d'un certain montant, vous devez vérifier que votre sous-traitant est bien immatriculé et à jour (obligation de vigilance).</li>
        </ul>'''),
            ('SIREN ou SIRET ?', '''
        <p>Le <strong>SIREN</strong> (9 chiffres) identifie l'entreprise. Le <strong>SIRET</strong> (14 chiffres) identifie un établissement : c'est le SIREN suivi de 5 chiffres.
          Sur vos devis et factures, c'est le SIRET qu'il faut indiquer.</p>'''),
        ],
        'faq': [
            ("D'où viennent les informations ?",
             "De l'annuaire des entreprises de l'État (données publiques de l'INSEE), consulté au moment de votre recherche. Devizo ne garde aucune trace du numéro recherché."),
            ("Pourquoi un SIRET valide est-il introuvable ?",
             "L'entreprise peut être très récente, ou avoir demandé que ses informations ne soient pas diffusées. Il peut aussi s'agir d'une erreur qui respecte par hasard la clé de contrôle."),
            ("Comment est vérifiée la clé de contrôle ?",
             "Les 14 chiffres d'un SIRET respectent une formule (l'algorithme de Luhn) qui permet de repérer la plupart des fautes de frappe, sans même interroger l'annuaire."),
        ],
    },
]
