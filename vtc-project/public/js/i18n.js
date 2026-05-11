(function () {
  var LANG_KEY = 'id_lang';

  var T = {
    fr: {
      /* ── Navigation ── */
      'nav.home': 'Accueil',
      'nav.about': 'À propos',
      'nav.faq': 'FAQ',
      'nav.book': 'Réserver',
      'nav.back': '← Retour à l\'accueil',
      'nav.menu_open': 'Ouvrir le menu',
      'nav.book_now': 'Réserver maintenant',
      'nav.drawer.01': '01',
      'nav.drawer.02': '02',
      'nav.drawer.03': '03',
      'nav.wa_num': '0623 88 97 17',

      /* ── Hero ── */
      'hero.tag': 'Chauffeur Privé · Paris & Île-de-France · 24h/24',
      'hero.title_html': 'Chauffeur Privé Paris & Île-de-France<br><em>Votre VTC de Luxe 24/7</em>',
      'hero.sub': 'Touristes, familles et professionnels — transferts aéroport CDG & Orly, visites monuments, excursions Versailles. Réhausseur & siège bébé inclus, Van 7 places, prix fixe 24h/24.',
      'hero.cta': 'ESTIMER MON PRIX EN 30 SECONDES',

      /* ── Onglets ── */
      'tab.airport': '✈  Forfaits Aéroports',
      'tab.transfer': '🚗  Transfert (hors Paris)',
      'tab.mad': '⏱  Mise à disposition',
      'tab.fleet': '🚘  Notre flotte',
      'tab.services': '✦  Services',
      'tab.guarantees': '✓  Garanties',
      'tabsel.airport': '✈ Forfaits Aéroports',
      'tabsel.transfer': '🚗 Transfert (hors Paris)',
      'tabsel.mad': '⏱ Mise à disposition',
      'tabsel.fleet': '🚘 Notre flotte',
      'tabsel.services': '✦ Services',
      'tabsel.guarantees': '✓ Garanties',

      /* ── Forfaits Aéroports ── */
      'airport.tag': 'Forfaits fixes · Prix garantis · Famille bienvenue',
      'airport.intro_html': 'Sélectionnez votre trajet aéroport. Tarif fixe garanti, toutes charges incluses. <strong style="color:var(--text)">Réhausseur enfant et siège bébé disponibles sans supplément.</strong>',
      'airport.route_label': 'Votre trajet',
      'airport.cdg_name': 'Aéroport CDG',
      'airport.orly_name': 'Aéroport Orly',
      'airport.oneway': 'Aller ou retour',
      'airport.van_name': 'Van Premium',
      'airport.van_model': 'Van Premium · 7 places',
      'airport.business_name': 'Business',
      'airport.business_model': 'Berline',
      'airport.family_label': 'Équipement famille',
      'airport.booster': 'Réhausseur enfant (3–12 ans)',
      'airport.seat': 'Siège bébé (0–3 ans)',
      'airport.included': 'Inclus · sans supplément',
      'airport.date': '📅 Date',
      'airport.time': '🕐 Heure',
      'airport.price_label': 'Forfait fixe garanti',
      'airport.price_note': 'Tarif fixe · Aucun supplément · Réhausseur & siège bébé inclus sur demande',
      'airport.pay': 'Réserver',
      'airport.secure': 'Paiement sécurisé par carte bancaire via Stripe',
      'airport.or_sep': 'ou écrivez-nous directement',
      'airport.wa': 'Nous contacter via WhatsApp',
      'airport.qr_notice_html': 'Un <strong>QR code obligatoire</strong> vous sera envoyé par email après le paiement — à présenter au conducteur sans exception.',
      'airport.table_tag': 'Tableau des forfaits aéroport',
      'airport.th_route': 'Trajet',
      'airport.th_van': 'Van Premium',
      'airport.th_business': 'Business',
      'airport.cdg_sub': 'Aller ou retour',
      'airport.cdg_dest': 'Aéroport CDG ↔ Paris',
      'airport.orly_sub': 'Aller ou retour',
      'airport.orly_dest': 'Aéroport Orly ↔ Paris',

      /* ── Transfert ── */
      'transfer.dep_label': '📍 Adresse de départ',
      'transfer.dep_ph': 'Ex : 1 rue de Rivoli, Paris',
      'transfer.arr_label': '🏁 Adresse d\'arrivée',
      'transfer.arr_ph': 'Ex : Aéroport CDG Terminal 2E',
      'transfer.date': '📅 Date',
      'transfer.time': '🕐 Heure',
      'transfer.pax': 'Passagers',
      'transfer.bags': 'Bagages',
      'transfer.pax_opts': '1 passager,2 passagers,3 passagers,4 passagers,5 passagers,6 passagers,7 passagers',
      'transfer.bag_opts': '0 bagage,1 bagage,2 bagages,3 bagages,4 bagages,5 bagages,6 bagages,7 bagages,8 bagages',
      'transfer.van_family': '👶 Famille ✓',
      'transfer.van_rate': '2,50 €/km (hors Paris)',
      'transfer.bus_rate': '2,50 €/km (hors Paris)',
      'transfer.price_label': 'Prix estimé — tarif fixe garanti',
      'transfer.price_note': 'Tarif fixe · Aucun supplément · Toutes charges incluses',
      'transfer.calc': 'Calculer le prix',
      'transfer.pay': 'Réserver',
      'transfer.secure': 'Paiement sécurisé par carte bancaire via Stripe',
      'transfer.or_sep': 'ou écrivez-nous directement',
      'transfer.wa': 'Nous contacter via WhatsApp',
      'transfer.qr_notice_html': 'Un <strong>QR code obligatoire</strong> vous sera envoyé par email après le paiement — à présenter au conducteur sans exception.',
      'transfer.incl_tag': 'Inclus dans chaque transfert',
      'transfer.g1_title': 'Pancarte nominative',
      'transfer.g1_desc': 'Votre chauffeur vous attend dans le hall d\'arrivée avec votre nom affiché.',
      'transfer.g2_title': 'Suivi de vol en direct',
      'transfer.g2_desc': 'Retard ou avance : votre chauffeur ajuste automatiquement son heure d\'arrivée.',
      'transfer.g3_title': 'Attente offerte',
      'transfer.g3_desc': '60 minutes pour les aéroports · 20 minutes pour les gares — sans supplément.',
      'transfer.th_dest': 'Destination',
      'transfer.th_service': 'Service inclus',
      'transfer.th_wait': 'Attente offerte',
      'transfer.cdg_sub': 'Aéroport',
      'transfer.cdg_dest': 'Roissy CDG — Terminal 1, 2 & 3',
      'transfer.cdg_service': 'Pancarte nominative · Aide aux bagages · Suivi du vol',
      'transfer.orly_sub': 'Aéroport',
      'transfer.orly_dest': 'Orly — Sud, Ouest & Terminal 4',
      'transfer.orly_service': 'Suivi du vol · Accueil hall d\'arrivée · Aide aux bagages',
      'transfer.gares_sub': 'Gares parisiennes',
      'transfer.gares_dest': 'Gare du Nord · Gare de Lyon · Gare Montparnasse',
      'transfer.gares_service': 'Dépose ou accueil au plus proche des voies · Suivi du train',

      /* ── Mise à disposition ── */
      'mad.dep_label': '📍 Adresse de prise en charge',
      'mad.dep_ph': 'Adresse de départ',
      'mad.date': '📅 Date',
      'mad.time': '🕐 Heure',
      'mad.duration_label': 'Durée souhaitée',
      'd.min': 'Min.',
      'd.day': 'Jour',
      'mad.van_rate': '95 € / heure · min. 2h',
      'mad.bus_rate': '75 € / heure · min. 2h',
      'mad.price_label': 'Forfait mise à disposition',
      'mad.price_note': 'Kilométrage illimité · Carburant inclus · Chauffeur dédié',
      'mad.pay': 'Réserver',
      'mad.secure': 'Paiement sécurisé par carte bancaire via Stripe',
      'mad.or_sep': 'ou écrivez-nous directement',
      'mad.wa': 'Nous contacter via WhatsApp',
      'mad.qr_notice_html': 'Un <strong>QR code obligatoire</strong> vous sera envoyé par email après le paiement — à présenter au conducteur sans exception.',
      'mad.usage_tag': 'Pour quels besoins ?',
      'mad.s1_title': 'Shopping & Tourisme de luxe',
      'mad.s1_desc': 'Avenue Montaigne, La Vallée Village, Boulevard Haussmann — votre chauffeur patiente le temps de vos emplettes.',
      'mad.s2_title': 'Séminaires & Congrès',
      'mad.s2_desc': 'Porte de Versailles, Paris Le Bourget, Palais des Congrès, Villepinte — navettes et accueil pour vos délégations.',
      'mad.s3_title': 'Mariages & Cérémonies',
      'mad.s3_desc': 'Cortège multi-véhicules, accueil des invités, transferts jusqu\'au lieu de réception — service coordinateur sur demande.',

      /* ── Flotte ── */
      'fleet.tag': 'Notre flotte',
      'fleet.title': 'Deux véhicules, un niveau d\'exigence',
      'fleet.van_gamme': 'Véhicule principal · Van Premium',
      'fleet.van_family_html': '👶 Famille — Réhausseur & siège bébé disponibles',
      'fleet.van_desc': 'Notre référence pour les familles et les groupes. Espace généreux, 7 places, 8 bagages — idéal pour les transferts aéroport avec enfants. Réhausseur (3–12 ans) et siège bébé (0–3 ans) disponibles sans supplément, sur demande à la réservation.',
      'fleet.bus_gamme': 'Option Business',
      'fleet.bus_desc': 'La berline executive pour les déplacements seul ou en duo. Discrétion absolue, performance et confort à chaque trajet professionnel.',
      'fleet.tarif_cdg': 'Forfait CDG → Paris',
      'fleet.tarif_orly': 'Forfait Orly → Paris',
      'fleet.tarif_km': 'Hors Paris (au km)',
      'fleet.tarif_mad': 'Mise à disposition',
      'fleet.tarif_contact': 'Contact',
      'fleet.tarif_devis': 'Sur devis',

      /* ── Services / Zones ── */
      'services.tag': 'Zones desservies',
      'services.title': 'Partout en Île-de-France',
      'services.intro': 'Nos chauffeurs connaissent chaque raccourci pour vous garantir une ponctualité absolue, même aux heures de pointe.',

      /* ── Garanties ── */
      'guar.tag': 'Nos engagements',
      'guar.title': 'Pourquoi choisir IsmaDrive ?',
      'guar.g1_title': 'Tarif fixe garanti',
      'guar.g1_desc': 'Le prix annoncé à la réservation est celui que vous payez. Aucune mauvaise surprise, aucun supplément — même en cas de trafic dense.',
      'guar.g2_title': 'Ponctualité absolue',
      'guar.g2_desc': 'Votre chauffeur est présent avant vous. Suivi GPS en temps réel, trajet optimisé, zéro retard toléré.',
      'guar.g3_title': 'Discrétion & Sécurité',
      'guar.g3_desc': 'Chauffeurs formés pour une clientèle exigeante : VIP, délégations, mariages. Confidentialité absolue garantie.',
      'guar.g4_title': 'Chauffeurs professionnels',
      'guar.g4_desc': 'Carte VTC, tenue soignée, connaissance terrain de l\'Île-de-France. Disponibles 7j/7, 24h/24.',
      'guar.g5_title': 'Familles & enfants',
      'guar.g5_desc': 'Réhausseur (3–12 ans) et siège bébé (0–3 ans) disponibles sans supplément. Indiquez-le à la réservation.',
      'guar.g6_title': 'QR code obligatoire',
      'guar.g6_desc': 'Après paiement, un QR code unique vous est envoyé par email. Votre conducteur doit impérativement le scanner avant le départ — sans lui, aucune course ne peut démarrer.',
      'guar.reviews_tag': 'Avis clients',
      'guar.r1_text': '"Ponctuel à la minute près pour mon vol CDG. Véhicule impeccable, chauffeur très professionnel et discret. Je recommande sans hésitation."',
      'guar.r1_author': 'Thomas D.',
      'guar.r1_date': 'Client régulier · Paris 8e',
      'guar.r2_text': '"Mise à disposition pour une journée de réunions à La Défense. Chauffeur patient, disponible, parfaitement présenté. Un vrai luxe."',
      'guar.r2_author': 'Sophie M.',
      'guar.r2_date': 'Directrice commerciale · Neuilly-sur-Seine',
      'guar.r3_text': '"Van Premium pour 6 personnes depuis Versailles jusqu\'à Orly. Confort, espace, Wi-Fi : exactement ce qu\'il faut. Prix fixe, aucune surprise."',
      'guar.r3_author': 'Laurent & famille',
      'guar.r3_date': 'Transfert Versailles → Orly',
      'guar.reviews_link': 'Voir tous nos avis Google →',

      /* ── Modal ── */
      'modal.title': 'Finaliser la réservation',
      ‘modal.sub’: ‘Renseignez vos coordonnées. Paiement sécurisé par carte bancaire via Stripe.’,
      'modal.total': 'Montant estimé',
      'modal.name': 'Prénom & Nom *',
      'modal.name_ph': 'Jean Dupont',
      'modal.phone': 'Téléphone *',
      'modal.phone_ph': '+33 6 …',
      'modal.email': 'Email *',
      'modal.email_ph': 'jean@exemple.fr',
      'modal.comments': 'Commentaires',
      'modal.comments_ph': 'N° de vol, instructions…',
      'modal.confirm': 'Confirmer et payer',

      /* ── Modale avant formulaire (WhatsApp) ── */
      'wa_res_modal.title': 'Réservation sur WhatsApp',
      'wa_res_modal.body_html': 'Pour le moment, <strong>aucun paiement par carte bancaire n’est accepté sur ce site</strong>. Après avoir envoyé votre demande, nous vous confirmons et finalisons ensemble la réservation et le mode de paiement <strong>sur WhatsApp</strong>.',
      'wa_res_modal.cancel': 'Annuler',
      'wa_res_modal.continue': 'Continuer',
      'modal.suc_title': 'Réservation confirmée !',
      'modal.qr_warning_html': 'Ce QR code est <strong>indispensable</strong> : votre chauffeur ne peut démarrer la course sans l\'avoir scanné. Sans présentation du QR code, la prise en charge ne pourra pas avoir lieu.',
      'modal.qr_label': 'QR Code conducteur — à présenter obligatoirement',
      'modal.qr_download': 'Télécharger et sauvegarder le QR code',
      'modal.qr_save_html': 'Conservez ce QR code sur votre téléphone ou imprimez-le.<br>Il sera demandé par votre conducteur au moment du départ.',
      'modal.email_sent_html': 'Un <strong>email de confirmation</strong> avec votre QR code vient d\'être envoyé à l\'adresse indiquée.',
      'modal.email_fail_html': '<strong>Attention :</strong> la réservation est enregistrée mais l\'email de confirmation n\'a pas pu être envoyé. Faites une capture d\'écran de ce QR code pour le conserver.',
      'modal.close': 'Fermer',

      /* ── Footer ── */
      'footer.pages_title': 'Pages locales',
      'footer.services_title': 'Nos services',
      'footer.zones_title': 'Zones desservies',
      'footer.available': 'Disponible 7j/7 · 24h/24',
      'footer.airport_packages': 'Forfaits Aéroports',
      'footer.transfer': 'Transfert hors Paris',
      'footer.mad_label': 'Mise à disposition',
      'footer.fleet_label': 'Notre flotte',
      'footer.rights': '© 2025 IsmaDrive — Tous droits réservés · Carte professionnelle VTC · ',
      'footer.driver': 'Espace conducteur',
      'footer.cgv': 'CGV',
      'footer.legal': 'Mentions légales',
      'footer.contact': 'Contact',
      'footer.privacy': 'Politique de confidentialité',
      'footer.copy_simple': '© 2025 IsmaDrive',
      'footer.home': 'Accueil',
      'footer.faq': 'FAQ',
      'footer.about': 'À propos',
      'footer.cdg': 'Transfert CDG',
      'footer.orly': 'Transfert Orly',

      /* ── À propos ── */
      'ap.page_tag': 'IsmaDrive · Île-de-France',
      'ap.title_html': 'Votre chauffeur,<br><em>une histoire de confiance</em>',
      'ap.sub': 'Plus de 10 ans à transporter des femmes et des hommes exigeants dans Paris et l\'Île-de-France. La ponctualité n\'est pas un argument de vente — c\'est un engagement personnel.',
      'ap.badge': 'Carte VTC Professionnelle',
      'ap.stat1_lbl': 'ans d\'expérience',
      'ap.stat2_lbl': 'trajets effectués',
      'ap.stat3_lbl': 'disponible 24h/24',
      'ap.story_title_html': 'Mon histoire,<br><em>voici qui je suis.</em>',
      'ap.p1': 'J\'exerce le métier de chauffeur privé VTC depuis plus de dix ans. Ce n\'est pas un emploi que j\'ai choisi par hasard — c\'est une vocation que j\'ai construite trajet après trajet, client après client.',
      'ap.p2': 'Tout a commencé en région parisienne, avec une simple conviction : que le transport privé peut — et doit — être synonyme de sérénité. Pas de stress pour trouver un taxi de nuit, pas de compteur qui s\'emballe, pas d\'incertitude sur l\'heure d\'arrivée. Juste quelqu\'un qui est là, à l\'heure, avec le sourire.',
      'ap.p3': 'Au fil des années, j\'ai accompagné des cadres dirigeants vers des rendez-vous décisifs, des familles à l\'aéroport à 4h du matin, des mariés le jour de leur vie. Chaque course est différente, et c\'est ce qui me passionne depuis le premier jour.',
      'ap.p4': 'Je suis titulaire de ma carte professionnelle VTC, je conduis en Mercedes et je m\'engage sur une chose que je ne négocie jamais : la ponctualité. Si je vous dis 7h15, je suis devant chez vous à 7h10.',
      'ap.p5': 'Mon téléphone reste allumé 7j/7. Je réponds toujours — même le dimanche, même à minuit. Parce qu\'un chauffeur privé fiable, c\'est d\'abord quelqu\'un sur qui on peut compter.',
      'ap.sign': '— Votre chauffeur IsmaDrive',
      'ap.wa_btn': 'Me contacter sur WhatsApp',
      'ap.values_title': 'Ce en quoi je crois',
      'ap.v1_title': 'Ponctualité sans compromis',
      'ap.v1_desc': 'Je suis là avant vous. Toujours. Aucune excuse ne justifie un retard quand quelqu\'un a un avion à prendre.',
      'ap.v2_title': 'Discrétion absolue',
      'ap.v2_desc': 'Ce qui se dit dans la voiture reste dans la voiture. Je n\'ai jamais commenté une conversation d\'affaires ou une confidence personnelle.',
      'ap.v3_title': 'Prix fixe, parole tenue',
      'ap.v3_desc': 'Le montant annoncé à la réservation est celui que vous payez. Même en cas de bouchons, même à 3h du matin.',
      'ap.v4_title': 'Le service avant tout',
      'ap.v4_desc': 'Aide aux bagages, eau minérale, musique ou silence selon votre préférence — c\'est votre trajet, à votre façon.',

      /* ── FAQ ── */
      'faq.page_tag': 'Chauffeur Privé VTC · Paris & IDF',
      'faq.title_html': 'Questions fréquentes<br><em>sur notre service VTC</em>',
      'faq.sub': 'Tarifs, réservation, disponibilité, aéroports — toutes les réponses pour réserver votre chauffeur privé en toute confiance.',
      'faq.q1': 'Comment réserver un chauffeur privé avec IsmaDrive ?',
      'faq.a1_html': 'La réservation d\'un chauffeur privé se fait directement sur <a href="/" style="color:var(--gold)">ismadrive.fr</a> : saisissez votre adresse de départ et d\'arrivée, calculez votre prix en quelques secondes, puis payez en ligne en toute sécurité. Vous pouvez également réserver votre chauffeur VTC par WhatsApp au 06 23 88 97 17 pour toute demande spécifique ou devis sur mesure.',
      'faq.q2': 'Quels sont les tarifs d\'un chauffeur privé ?',
      'faq.a2_html': 'Le tarif chauffeur privé IsmaDrive est fixé dès la réservation et ne change pas, quelle que soit la circulation. Nous proposons <strong>deux types de véhicules</strong> : <strong>Van Premium</strong> (jusqu\'à 7 passagers) et <strong>Berline Business</strong> (Mercedes Classe E, jusqu\'à 3 passagers). Pour les courses au kilomètre hors Paris, le tarif de référence affiché sur le simulateur est de <strong>2,50 €/km</strong> pour chaque catégorie, avec un minimum de course selon le véhicule. Aucun supplément caché : le prix affiché est le prix payé.',
      'faq.q3': 'Le chauffeur VTC est-il disponible la nuit et le week-end ?',
      'faq.a3_html': 'Oui, le chauffeur VTC IsmaDrive est disponible <strong>7j/7 et 24h/24</strong>, dimanches et jours fériés inclus. Les transferts aéroport à 4h du matin, les retours tardifs après une soirée ou les prises en charge le jour de Noël sont traités exactement comme n\'importe quelle autre course — aux mêmes tarifs, sans majoration de nuit.',
      'faq.q4': 'Quelle est la différence entre un VTC et un taxi ?',
      'faq.a4_html': 'Un chauffeur privé VTC (Véhicule de Transport avec Chauffeur) se distingue du taxi par la réservation obligatoire et le <strong>prix fixe convenu à l\'avance</strong>. Contrairement au taxi dont le tarif s\'affiche au compteur, le tarif VTC est transparent dès la réservation. Le service est également supérieur : véhicule haut de gamme, chauffeur en tenue soignée, accueil personnalisé.',
      'faq.q5': 'Comment fonctionne l\'accueil à l\'aéroport par votre chauffeur privé ?',
      'faq.a5_html': 'À CDG ou Orly, votre chauffeur privé suit votre vol en temps réel et s\'ajuste automatiquement en cas de retard. Il vous attend dans le hall des arrivées, pancarte nominative à la main, avec <strong>60 minutes d\'attente offertes</strong>. Pas besoin de courir : il est là quand vous êtes prêt.',
      'faq.q6': 'Puis-je réserver un chauffeur privé fiable pour un mariage ou un événement ?',
      'faq.a6_html': 'Absolument. IsmaDrive propose des formules de mise à disposition pour les mariages, séminaires et événements d\'entreprise. Votre chauffeur privé fiable reste à votre disposition toute la durée de l\'événement, gère les allers-retours et accueille vos invités avec discrétion. Contactez-nous par WhatsApp pour un devis personnalisé.',
      'faq.q7': 'Quelles zones sont couvertes par votre service VTC ?',
      'faq.a7_html': 'Notre chauffeur VTC intervient dans tout Paris (75) et l\'Île-de-France : Hauts-de-Seine (92), Val-de-Marne (94), Yvelines (78), Seine-Saint-Denis (93). Les aéroports CDG, Orly, les gares parisiennes et les grandes villes comme Neuilly, Versailles, La Défense ou Boulogne-Billancourt sont desservis quotidiennement.',
      'faq.q8': 'Le paiement en ligne de la réservation chauffeur privé est-il sécurisé ?',
      'faq.a8_html': 'Oui. La réservation chauffeur privé en ligne est sécurisée par <strong>Stripe</strong>, le standard mondial du paiement sur Internet. Vos coordonnées bancaires ne transitent jamais par nos serveurs. Vous recevez un email de confirmation immédiatement après le paiement.',
      'faq.q9': 'Que se passe-t-il si mon vol a du retard ?',
      'faq.a9_html': 'Aucun problème. En indiquant votre numéro de vol lors de la réservation, votre chauffeur VTC suit l\'heure d\'atterrissage réelle en temps réel. Le retard est automatiquement pris en compte, sans supplément. L\'attente gratuite de <strong>60 minutes</strong> commence à l\'heure d\'atterrissage effective, pas à l\'heure prévue.',
      'faq.cta_title': 'Vous n\'avez pas trouvé votre réponse ?',
      'faq.cta_sub': 'Contactez directement votre chauffeur privé — réponse garantie en moins d\'une heure.',
      'faq.cta_btn': 'Réserver maintenant',

      /* ── Pages SEO communes ── */
      'seo.book_cta': 'Réserver maintenant',
      'seo.book_transfer': 'Réserver mon transfert CDG',
      'seo.book_orly': 'Réserver mon transfert Orly',

      /* ── SEO — Transfert CDG ── */
      'seo_cdg.page_tag': 'Aéroport Paris-Charles de Gaulle · Terminal 1, 2A–2G & 3',
      'seo_cdg.title_html': 'Transfert Aéroport Roissy CDG → Paris<br><em>Votre Chauffeur Privé à l\'Arrivée</em>',
      'seo_cdg.sub': 'CDG est le plus grand aéroport d\'Europe — naviguer entre ses terminaux peut être un défi. Votre chauffeur IsmaDrive connaît chaque point de rendez-vous, attend dans le hall des arrivées pancarte à la main, et surveille votre vol en temps réel.',

      /* ── SEO — Transfert Orly ── */
      'seo_orly.page_tag': 'Aéroport d\'Orly · Terminal 1, 2, 3 & 4',
      'seo_orly.title_html': 'Transfert Aéroport Orly → Paris<br><em>Votre Chauffeur Privé à l\'Arrivée</em>',
      'seo_orly.sub': 'Votre vol atterrit à Orly — votre chauffeur IsmaDrive vous attend dans le hall d\'arrivée, pancarte nominative en main. Suivi du vol en temps réel, 60 minutes d\'attente offertes, tarif fixe garanti quelle que soit la circulation.',

      /* ── SEO — Versailles ── */
      'seo_versailles.page_tag': 'Yvelines · 78000 · Château de Versailles',
      'seo_versailles.title_html': 'Chauffeur Privé à Versailles<br><em>VTC Luxe 24/7</em>',
      'seo_versailles.sub': 'Résidents de Versailles, visiteurs du Château ou professionnels du Pôle de Compétitivité — IsmaDrive assure vos déplacements depuis Versailles vers Paris, CDG, Orly et toute l\'Île-de-France. Discrétion, ponctualité, Mercedes.',
      'seo_versailles.cta': 'Réserver depuis Versailles',

      /* ── SEO — Neuilly ── */
      'seo_neuilly.page_tag': 'Hauts-de-Seine · 92200',
      'seo_neuilly.title_html': 'Chauffeur Privé à Neuilly-sur-Seine<br><em>VTC Luxe 24/7</em>',
      'seo_neuilly.sub': 'Résidents de Neuilly-sur-Seine et professionnels de la finance et du droit : IsmaDrive est votre partenaire mobilité de confiance. Transferts vers CDG, Orly, La Défense et Paris intramuros — prix fixes, Mercedes, disponible à toute heure.',
      'seo_neuilly.cta': 'Réserver depuis Neuilly-sur-Seine',

      /* ── SEO — Boulogne ── */
      'seo_boulogne.page_tag': 'Hauts-de-Seine · 92100',
      'seo_boulogne.title_html': 'Chauffeur Privé à Boulogne-Billancourt<br><em>VTC Luxe 24/7</em>',
      'seo_boulogne.sub': 'Boulogne-Billancourt concentre sièges sociaux, studios de production et cabinets d\'avocats. IsmaDrive répond aux exigences de cette clientèle d\'affaires : ponctualité absolue, discrétion, transferts vers CDG et Orly ou déplacements inter-sièges en Île-de-France.',
      'seo_boulogne.cta': 'Réserver depuis Boulogne-Billancourt',

      /* ── SEO — La Défense ── */
      'seo_defense.page_tag': 'Hauts-de-Seine · 92800 · 1er Quartier d\'Affaires Européen',
      'seo_defense.title_html': 'Chauffeur Privé à La Défense<br><em>VTC Business 24/7</em>',
      'seo_defense.sub': 'Tour First, Tour Total, CNIT, Grande Arche — IsmaDrive est le partenaire mobilité des professionnels de La Défense. Transferts aéroport matin et soir, navettes inter-tours, accueil de délégations : nous gérons votre mobilité d\'entreprise avec rigueur.',
      'seo_defense.cta': 'Réserver mon VTC La Défense',

      /* ── SEO — Vincennes ── */
      'seo_vincennes.page_tag': 'Val-de-Marne · 94300',
      'seo_vincennes.title_html': 'Chauffeur Privé à Vincennes<br><em>VTC Luxe 24/7</em>',
      'seo_vincennes.sub': 'Aux portes du Bois de Vincennes, IsmaDrive vous propose un service de chauffeur privé haut de gamme depuis votre domicile ou votre bureau. Transferts CDG, Orly, Paris et grande couronne — réservez en ligne en 2 minutes.',
      'seo_vincennes.cta': 'Réserver depuis Vincennes',

      /* ── Trust Bar ── */
      'trust.b1': 'Chauffeurs francophones & anglophones',
      'trust.b2': 'Suivi de vol en temps réel',
      'trust.b3': 'Accueil avec pancarte nominative',
      'trust.b4': 'Support WhatsApp 24h/24',
      'trust.b5': 'Prix fixe, sans surprise',
      'trust.b6': 'Aucun frais cachés',
      'trust.b7': 'Paiement par carte accepté',
      'trust.b8': 'Annulation gratuite',

      /* ── Paris Experience ── */
      'paris.sub': 'Bien plus qu\'un trajet — une expérience à la hauteur de Paris',
      'paris.c1_title': 'Accueil CDG & Orly',
      'paris.c1_desc': 'Prise en charge dès votre atterrissage',
      'paris.c2_title': 'Meet & Greet',
      'paris.c2_desc': 'Votre chauffeur vous attend, pancarte à votre nom',
      'paris.c3_title': 'Visites de Paris',
      'paris.c3_desc': 'Découvrez les monuments à votre rythme',
      'paris.c4_title': 'Van Familial 7 places',
      'paris.c4_desc': 'Mercedes Classe V, siège bébé inclus',
      'paris.c5_title': 'Escapade en couple',
      'paris.c5_desc': 'Élégance et confort pour deux',
      'paris.c6_title': 'Excursion Versailles',
      'paris.c6_desc': 'Château, jardins, retour — tout géré',
      'paris.c7_title': 'Navette Disneyland',
      'paris.c7_desc': 'Transfert direct, enfants à bord, zéro stress',

      /* ── Storytelling ── */
      'story.title': 'Une expérience, pas juste un trajet',
      'story.sub': 'Ce qui nous distingue des autres VTC parisiens',
      'story.c1_title': 'Sérénité totale',
      'story.c1_text': 'Vous arrivez à Paris ? Votre chauffeur est déjà là, pancarte à votre nom, suivi de vol activé. Vous n\'avez rien à gérer — absolument rien.',
      'story.c2_title': 'Standing discret',
      'story.c2_text': 'Nos Mercedes sont entretenues à la perfection. Pas d\'odeur, pas de bruit parasite, eau minérale à bord. Le détail qui change tout.',
      'story.c3_title': 'Faits pour les exigeants',
      'story.c3_text': 'Cadres en déplacement, familles en vacances, couples en week-end. Nous adaptons chaque trajet à votre rythme, pas au nôtre.',
    },

    en: {
      /* ── Navigation ── */
      'nav.home': 'Home',
      'nav.about': 'About',
      'nav.faq': 'FAQ',
      'nav.book': 'Book',
      'nav.back': '← Back to home',
      'nav.menu_open': 'Open menu',
      'nav.book_now': 'Book now',
      'nav.drawer.01': '01',
      'nav.drawer.02': '02',
      'nav.drawer.03': '03',
      'nav.wa_num': '+33 6 23 88 97 17',

      /* ── Hero ── */
      'hero.tag': 'Private Chauffeur · Paris & Île-de-France · 24/7',
      'hero.title_html': 'Private Chauffeur Paris & Île-de-France<br><em>Your Luxury Car Service 24/7</em>',
      'hero.sub': 'Tourists, families and professionals — CDG & Orly airport transfers, monument tours, Versailles excursions. Child booster & baby seat included, 7-seat Van, fixed price 24/7.',
      'hero.cta': 'GET MY PRICE IN 30 SECONDS',

      /* ── Onglets ── */
      'tab.airport': '✈  Airport Packages',
      'tab.transfer': '🚗  Transfer (outside Paris)',
      'tab.mad': '⏱  Hourly Hire',
      'tab.fleet': '🚘  Our fleet',
      'tab.services': '✦  Services',
      'tab.guarantees': '✓  Guarantees',
      'tabsel.airport': '✈ Airport Packages',
      'tabsel.transfer': '🚗 Transfer (outside Paris)',
      'tabsel.mad': '⏱ Hourly Hire',
      'tabsel.fleet': '🚘 Our fleet',
      'tabsel.services': '✦ Services',
      'tabsel.guarantees': '✓ Guarantees',

      /* ── Forfaits Aéroports ── */
      'airport.tag': 'Fixed packages · Guaranteed rates · Families welcome',
      'airport.intro_html': 'Select your airport route. Fixed rate guaranteed, all charges included. <strong style="color:var(--text)">Child booster seat and baby seat available at no extra charge.</strong>',
      'airport.route_label': 'Your route',
      'airport.cdg_name': 'CDG Airport',
      'airport.orly_name': 'Orly Airport',
      'airport.oneway': 'One way or return',
      'airport.van_name': 'Premium Van',
      'airport.van_model': 'Premium Van · 7 seats',
      'airport.business_name': 'Business',
      'airport.business_model': 'Berline',
      'airport.family_label': 'Family equipment',
      'airport.booster': 'Child booster (3–12 yrs)',
      'airport.seat': 'Baby seat (0–3 yrs)',
      'airport.included': 'Included · no extra charge',
      'airport.date': '📅 Date',
      'airport.time': '🕐 Time',
      'airport.price_label': 'Guaranteed fixed package',
      'airport.price_note': 'Fixed rate · No surcharges · Booster & baby seat on request',
      'airport.pay': 'Book',
      'airport.secure': 'Secure card payment via Stripe',
      'airport.or_sep': 'or message us directly',
      'airport.wa': 'Contact us via WhatsApp',
      'airport.qr_notice_html': 'A <strong>mandatory QR code</strong> will be sent by email after payment — must be shown to the driver without exception.',
      'airport.table_tag': 'Airport package rates',
      'airport.th_route': 'Route',
      'airport.th_van': 'Premium Van',
      'airport.th_business': 'Business',
      'airport.cdg_sub': 'One way or return',
      'airport.cdg_dest': 'CDG Airport ↔ Paris',
      'airport.orly_sub': 'One way or return',
      'airport.orly_dest': 'Orly Airport ↔ Paris',

      /* ── Transfert ── */
      'transfer.dep_label': '📍 Pick-up address',
      'transfer.dep_ph': 'e.g. 1 rue de Rivoli, Paris',
      'transfer.arr_label': '🏁 Drop-off address',
      'transfer.arr_ph': 'e.g. CDG Airport Terminal 2E',
      'transfer.date': '📅 Date',
      'transfer.time': '🕐 Time',
      'transfer.pax': 'Passengers',
      'transfer.bags': 'Luggage',
      'transfer.pax_opts': '1 passenger,2 passengers,3 passengers,4 passengers,5 passengers,6 passengers,7 passengers',
      'transfer.bag_opts': '0 luggage,1 luggage,2 luggage,3 luggage,4 luggage,5 luggage,6 luggage,7 luggage,8 luggage',
      'transfer.van_family': '👶 Family ✓',
      'transfer.van_rate': '€2.50/km (outside Paris)',
      'transfer.bus_rate': '€2.50/km (outside Paris)',
      'transfer.price_label': 'Estimated price — fixed rate guaranteed',
      'transfer.price_note': 'Fixed rate · No surcharges · All charges included',
      'transfer.calc': 'Calculate price',
      'transfer.pay': 'Book',
      'transfer.secure': 'Secure card payment via Stripe',
      'transfer.or_sep': 'or message us directly',
      'transfer.wa': 'Contact us via WhatsApp',
      'transfer.qr_notice_html': 'A <strong>mandatory QR code</strong> will be sent by email after payment — must be shown to the driver without exception.',
      'transfer.incl_tag': 'Included with every transfer',
      'transfer.g1_title': 'Name sign',
      'transfer.g1_desc': 'Your driver waits in the arrival hall with your name displayed.',
      'transfer.g2_title': 'Live flight tracking',
      'transfer.g2_desc': 'Delay or early arrival: your driver automatically adjusts their pick-up time.',
      'transfer.g3_title': 'Free waiting time',
      'transfer.g3_desc': '60 minutes at airports · 20 minutes at train stations — at no extra charge.',
      'transfer.th_dest': 'Destination',
      'transfer.th_service': 'Service included',
      'transfer.th_wait': 'Free waiting',
      'transfer.cdg_sub': 'Airport',
      'transfer.cdg_dest': 'Roissy CDG — Terminal 1, 2 & 3',
      'transfer.cdg_service': 'Name sign · Luggage assistance · Flight tracking',
      'transfer.orly_sub': 'Airport',
      'transfer.orly_dest': 'Orly — South, West & Terminal 4',
      'transfer.orly_service': 'Flight tracking · Arrivals hall meet & greet · Luggage assistance',
      'transfer.gares_sub': 'Paris train stations',
      'transfer.gares_dest': 'Gare du Nord · Gare de Lyon · Gare Montparnasse',
      'transfer.gares_service': 'Drop-off or meet & greet near the platforms · Train tracking',

      /* ── Mise à disposition ── */
      'mad.dep_label': '📍 Pick-up address',
      'mad.dep_ph': 'Pick-up address',
      'mad.date': '📅 Date',
      'mad.time': '🕐 Time',
      'mad.duration_label': 'Desired duration',
      'd.min': 'Min.',
      'd.day': 'Day',
      'mad.van_rate': '€95 / hour · min. 2h',
      'mad.bus_rate': '€75 / hour · min. 2h',
      'mad.price_label': 'Hourly hire package',
      'mad.price_note': 'Unlimited mileage · Fuel included · Dedicated driver',
      'mad.pay': 'Book',
      'mad.secure': 'Secure card payment via Stripe',
      'mad.or_sep': 'or message us directly',
      'mad.wa': 'Contact us via WhatsApp',
      'mad.qr_notice_html': 'A <strong>mandatory QR code</strong> will be sent by email after payment — must be shown to the driver without exception.',
      'mad.usage_tag': 'What for?',
      'mad.s1_title': 'Shopping & Luxury Tourism',
      'mad.s1_desc': 'Avenue Montaigne, La Vallée Village, Boulevard Haussmann — your driver waits while you shop.',
      'mad.s2_title': 'Seminars & Conventions',
      'mad.s2_desc': 'Porte de Versailles, Paris Le Bourget, Palais des Congrès, Villepinte — shuttles and meet & greet for your delegations.',
      'mad.s3_title': 'Weddings & Ceremonies',
      'mad.s3_desc': 'Multi-vehicle convoys, guest reception, transfers to the venue — coordinator service on request.',

      /* ── Flotte ── */
      'fleet.tag': 'Our fleet',
      'fleet.title': 'Two vehicles, one standard of excellence',
      'fleet.van_gamme': 'Main vehicle · Premium Van',
      'fleet.van_family_html': '👶 Family — Booster & baby seat available',
      'fleet.van_desc': 'Our flagship for families and groups. Generous space, 7 seats, 8 bags — ideal for airport transfers with children. Booster (3–12 yrs) and baby seat (0–3 yrs) available at no extra charge, upon request at booking.',
      'fleet.bus_gamme': 'Business option',
      'fleet.bus_desc': 'The executive saloon for solo or duo travel. Absolute discretion, performance and comfort on every professional journey.',
      'fleet.tarif_cdg': 'CDG → Paris package',
      'fleet.tarif_orly': 'Orly → Paris package',
      'fleet.tarif_km': 'Outside Paris (per km)',
      'fleet.tarif_mad': 'Hourly hire',
      'fleet.tarif_contact': 'Contact',
      'fleet.tarif_devis': 'On request',

      /* ── Services / Zones ── */
      'services.tag': 'Service areas',
      'services.title': 'Everywhere in Île-de-France',
      'services.intro': 'Our drivers know every shortcut to guarantee absolute punctuality, even during rush hour.',

      /* ── Garanties ── */
      'guar.tag': 'Our commitments',
      'guar.title': 'Why choose IsmaDrive?',
      'guar.g1_title': 'Guaranteed fixed rate',
      'guar.g1_desc': 'The price quoted at booking is the price you pay. No nasty surprises, no surcharges — even in heavy traffic.',
      'guar.g2_title': 'Absolute punctuality',
      'guar.g2_desc': 'Your driver arrives before you. Real-time GPS tracking, optimised route, zero delay tolerated.',
      'guar.g3_title': 'Discretion & Safety',
      'guar.g3_desc': 'Drivers trained for discerning clients: VIPs, delegations, weddings. Absolute confidentiality guaranteed.',
      'guar.g4_title': 'Professional drivers',
      'guar.g4_desc': 'VTC licence, smart attire, local knowledge of Île-de-France. Available 7 days a week, 24/7.',
      'guar.g5_title': 'Families & children',
      'guar.g5_desc': 'Booster (3–12 yrs) and baby seat (0–3 yrs) available at no extra charge. Mention it at booking.',
      'guar.g6_title': 'Mandatory QR code',
      'guar.g6_desc': 'After payment, a unique QR code is sent to you by email. Your driver must scan it before departure — without it, no ride can begin.',
      'guar.reviews_tag': 'Client reviews',
      'guar.r1_text': '"Perfectly on time for my CDG flight. Impeccable vehicle, very professional and discreet driver. I recommend without hesitation."',
      'guar.r1_author': 'Thomas D.',
      'guar.r1_date': 'Regular client · Paris 8th',
      'guar.r2_text': '"Hired for a full day of meetings at La Défense. Patient, available, perfectly presented driver. A true luxury."',
      'guar.r2_author': 'Sophie M.',
      'guar.r2_date': 'Sales Director · Neuilly-sur-Seine',
      'guar.r3_text': '"Premium Van for 6 people from Versailles to Orly. Comfort, space, Wi-Fi: exactly what was needed. Fixed price, no surprises."',
      'guar.r3_author': 'Laurent & family',
      'guar.r3_date': 'Transfer Versailles → Orly',
      'guar.reviews_link': 'See all our Google reviews →',

      /* ── Modal ── */
      'modal.title': 'Complete your booking',
      'modal.sub': 'Enter your details. Secure card payment via Stripe.',
      'modal.total': 'Estimated amount',
      'modal.name': 'First & Last Name *',
      'modal.name_ph': 'John Smith',
      'modal.phone': 'Phone *',
      'modal.phone_ph': '+33 6 …',
      'modal.email': 'Email *',
      'modal.email_ph': 'john@example.com',
      'modal.comments': 'Comments',
      'modal.comments_ph': 'Flight number, instructions…',
      'modal.confirm': 'Confirm and pay',

      'wa_res_modal.title': 'Booking via WhatsApp',
      'wa_res_modal.body_html': 'For now, <strong>we do not accept card payments on this website</strong>. After you submit your request, we confirm and finalize your booking and payment method together <strong>on WhatsApp</strong>.',
      'wa_res_modal.cancel': 'Cancel',
      'wa_res_modal.continue': 'Continue',
      'modal.suc_title': 'Booking confirmed!',
      'modal.qr_warning_html': 'This QR code is <strong>essential</strong>: your driver cannot start the ride without scanning it. The ride cannot begin without presenting this QR code.',
      'modal.qr_label': 'Driver QR Code — must be shown',
      'modal.qr_download': 'Download and save QR code',
      'modal.qr_save_html': 'Keep this QR code on your phone or print it.<br>Your driver will ask for it at departure.',
      'modal.email_sent_html': 'A <strong>confirmation email</strong> with your QR code has just been sent to the address you provided.',
      'modal.email_fail_html': '<strong>Note:</strong> your booking was saved but the confirmation email could not be sent. Please save this QR code as a screenshot.',
      'modal.close': 'Close',

      /* ── Footer ── */
      'footer.pages_title': 'Local pages',
      'footer.services_title': 'Our services',
      'footer.zones_title': 'Service areas',
      'footer.available': 'Available 7 days/week · 24/7',
      'footer.airport_packages': 'Airport Packages',
      'footer.transfer': 'Transfer outside Paris',
      'footer.mad_label': 'Hourly hire',
      'footer.fleet_label': 'Our fleet',
      'footer.rights': '© 2025 IsmaDrive — All rights reserved · VTC Professional licence · ',
      'footer.driver': 'Driver portal',
      'footer.cgv': 'T&Cs',
      'footer.legal': 'Legal notice',
      'footer.contact': 'Contact',
      'footer.privacy': 'Privacy policy',
      'footer.copy_simple': '© 2025 IsmaDrive',
      'footer.home': 'Home',
      'footer.faq': 'FAQ',
      'footer.about': 'About',
      'footer.cdg': 'CDG Transfer',
      'footer.orly': 'Orly Transfer',

      /* ── À propos ── */
      'ap.page_tag': 'IsmaDrive · Île-de-France',
      'ap.title_html': 'Your driver,<br><em>a story built on trust</em>',
      'ap.sub': 'More than 10 years transporting discerning men and women across Paris and Île-de-France. Punctuality is not a selling point — it is a personal commitment.',
      'ap.badge': 'Professional VTC Licence',
      'ap.stat1_lbl': 'years of experience',
      'ap.stat2_lbl': 'trips completed',
      'ap.stat3_lbl': 'available 24/7',
      'ap.story_title_html': 'My story,<br><em>who I am.</em>',
      'ap.p1': 'I have been a private VTC chauffeur for over ten years. This is not a job I stumbled into — it is a vocation I built ride by ride, client by client.',
      'ap.p2': 'It all started in the Paris region, with one simple conviction: that private transport can — and should — mean serenity. No stress finding a late-night taxi, no meter running, no uncertainty about arrival time. Just someone who is there, on time, with a smile.',
      'ap.p3': 'Over the years I have accompanied senior executives to decisive meetings, families to the airport at 4 in the morning, newlyweds on the most important day of their lives. Every ride is different, and that is what has kept me passionate since day one.',
      'ap.p4': 'I hold my professional VTC licence, I drive a Mercedes, and I commit to one thing I never negotiate: punctuality. If I say 7:15, I am outside your door at 7:10.',
      'ap.p5': 'My phone stays on 7 days a week. I always answer — even on Sunday, even at midnight. Because a reliable private chauffeur is, above all, someone you can count on.',
      'ap.sign': '— Your IsmaDrive chauffeur',
      'ap.wa_btn': 'Contact me on WhatsApp',
      'ap.values_title': 'What I believe in',
      'ap.v1_title': 'Punctuality, no compromise',
      'ap.v1_desc': 'I am there before you. Always. No excuse justifies a delay when someone has a plane to catch.',
      'ap.v2_title': 'Absolute discretion',
      'ap.v2_desc': 'What is said in the car stays in the car. I have never commented on a business conversation or a personal confidence.',
      'ap.v3_title': 'Fixed price, word kept',
      'ap.v3_desc': 'The amount quoted at booking is what you pay. Even in traffic, even at 3 in the morning.',
      'ap.v4_title': 'Service first',
      'ap.v4_desc': 'Luggage assistance, mineral water, music or silence as you prefer — it is your ride, your way.',

      /* ── FAQ ── */
      'faq.page_tag': 'Private Chauffeur VTC · Paris & IDF',
      'faq.title_html': 'Frequently asked questions<br><em>about our chauffeur service</em>',
      'faq.sub': 'Rates, booking, availability, airports — all the answers to book your private chauffeur with confidence.',
      'faq.q1': 'How do I book a private chauffeur with IsmaDrive?',
      'faq.a1_html': 'Booking a private chauffeur is done directly on <a href="/" style="color:var(--gold)">ismadrive.fr</a>: enter your pick-up and drop-off address, get your price in seconds, then pay securely online. You can also book via WhatsApp on +33 6 23 88 97 17 for any specific request or tailored quote.',
      'faq.q2': 'What are the private chauffeur rates?',
      'faq.a2_html': 'IsmaDrive rates are fixed at booking and never change regardless of traffic. We offer <strong>two vehicle types</strong>: <strong>Premium Van</strong> (up to 7 passengers) and <strong>Business saloon</strong> (Mercedes E-Class, up to 3 passengers). For per-km journeys outside Paris, the reference rate shown on the calculator is <strong>€2.50/km</strong> for each category, with a minimum fare depending on the vehicle. No hidden surcharges: the displayed price is the price paid.',
      'faq.q3': 'Is the VTC driver available at night and on weekends?',
      'faq.a3_html': 'Yes, the IsmaDrive VTC driver is available <strong>7 days a week, 24/7</strong>, including Sundays and public holidays. 4 am airport transfers, late returns after an evening out, or Christmas day pick-ups are treated exactly like any other ride — at the same rates, with no night surcharge.',
      'faq.q4': 'What is the difference between a VTC and a taxi?',
      'faq.a4_html': 'A private VTC chauffeur differs from a taxi by its mandatory pre-booking and <strong>fixed price agreed in advance</strong>. Unlike taxis where the meter runs, VTC rates are transparent from booking. The service is also superior: premium vehicle, smartly dressed driver, personalised welcome.',
      'faq.q5': 'How does airport meet & greet work?',
      'faq.a5_html': 'At CDG or Orly, your private chauffeur tracks your flight in real time and adjusts automatically in case of delay. He waits in the arrivals hall, name sign in hand, with <strong>60 minutes of free waiting included</strong>. No need to rush: he is there when you are ready.',
      'faq.q6': 'Can I book a reliable private chauffeur for a wedding or event?',
      'faq.a6_html': 'Absolutely. IsmaDrive offers hourly hire packages for weddings, seminars and corporate events. Your reliable private chauffeur stays at your disposal for the entire duration of the event, manages transfers and welcomes your guests discreetly. Contact us via WhatsApp for a personalised quote.',
      'faq.q7': 'Which areas does your VTC service cover?',
      'faq.a7_html': 'Our VTC driver operates throughout Paris (75) and Île-de-France: Hauts-de-Seine (92), Val-de-Marne (94), Yvelines (78), Seine-Saint-Denis (93). CDG and Orly airports, Paris train stations and major cities such as Neuilly, Versailles, La Défense and Boulogne-Billancourt are served daily.',
      'faq.q8': 'Is online payment for booking secure?',
      'faq.a8_html': 'Yes. Online booking is secured by <strong>Stripe</strong>, the global standard for internet payments. Your card details never pass through our servers. You receive a confirmation email immediately after payment.',
      'faq.q9': 'What happens if my flight is delayed?',
      'faq.a9_html': 'No problem. By entering your flight number at booking, your VTC driver tracks the actual landing time in real time. The delay is automatically accounted for, at no extra charge. The free <strong>60-minute</strong> wait starts at the actual landing time, not the scheduled time.',
      'faq.cta_title': "Didn't find your answer?",
      'faq.cta_sub': 'Contact your private chauffeur directly — reply guaranteed within one hour.',
      'faq.cta_btn': 'Book now',

      /* ── Pages SEO communes ── */
      'seo.book_cta': 'Book now',
      'seo.book_transfer': 'Book my CDG transfer',
      'seo.book_orly': 'Book my Orly transfer',

      /* ── SEO — Transfert CDG ── */
      'seo_cdg.page_tag': 'Paris Charles de Gaulle Airport · Terminal 1, 2A–2G & 3',
      'seo_cdg.title_html': 'CDG Airport Transfer → Paris<br><em>Your Private Chauffeur on Arrival</em>',
      'seo_cdg.sub': 'CDG is Europe\'s largest airport — navigating between terminals can be a challenge. Your IsmaDrive driver knows every meeting point, waits in the arrivals hall with your name sign, and tracks your flight in real time.',

      /* ── SEO — Transfert Orly ── */
      'seo_orly.page_tag': 'Paris Orly Airport · Terminal 1, 2, 3 & 4',
      'seo_orly.title_html': 'Orly Airport Transfer → Paris<br><em>Your Private Chauffeur on Arrival</em>',
      'seo_orly.sub': 'Your flight lands at Orly — your IsmaDrive driver waits in the arrivals hall with your name sign. Real-time flight tracking, 60 minutes free waiting, fixed rate guaranteed whatever the traffic.',

      /* ── SEO — Versailles ── */
      'seo_versailles.page_tag': 'Yvelines · 78000 · Palace of Versailles',
      'seo_versailles.title_html': 'Private Chauffeur in Versailles<br><em>Luxury VTC 24/7</em>',
      'seo_versailles.sub': 'Versailles residents, Palace visitors or professionals — IsmaDrive handles your journeys from Versailles to Paris, CDG, Orly and all of Île-de-France. Discretion, punctuality, Mercedes.',
      'seo_versailles.cta': 'Book from Versailles',

      /* ── SEO — Neuilly ── */
      'seo_neuilly.page_tag': 'Hauts-de-Seine · 92200',
      'seo_neuilly.title_html': 'Private Chauffeur in Neuilly-sur-Seine<br><em>Luxury VTC 24/7</em>',
      'seo_neuilly.sub': 'Neuilly-sur-Seine residents and finance or legal professionals: IsmaDrive is your trusted mobility partner. Transfers to CDG, Orly, La Défense and central Paris — fixed prices, Mercedes, available around the clock.',
      'seo_neuilly.cta': 'Book from Neuilly-sur-Seine',

      /* ── SEO — Boulogne ── */
      'seo_boulogne.page_tag': 'Hauts-de-Seine · 92100',
      'seo_boulogne.title_html': 'Private Chauffeur in Boulogne-Billancourt<br><em>Luxury VTC 24/7</em>',
      'seo_boulogne.sub': 'Boulogne-Billancourt is home to corporate HQs, production studios and law firms. IsmaDrive meets the demands of this business clientele: absolute punctuality, discretion, CDG and Orly transfers or inter-office journeys across Île-de-France.',
      'seo_boulogne.cta': 'Book from Boulogne-Billancourt',

      /* ── SEO — La Défense ── */
      'seo_defense.page_tag': 'Hauts-de-Seine · 92800 · Europe\'s No.1 Business District',
      'seo_defense.title_html': 'Private Chauffeur at La Défense<br><em>Business VTC 24/7</em>',
      'seo_defense.sub': 'Tour First, Tour Total, CNIT, Grande Arche — IsmaDrive is the mobility partner for La Défense professionals. Airport transfers morning and evening, inter-tower shuttles, delegation reception: we manage your corporate mobility with precision.',
      'seo_defense.cta': 'Book my La Défense VTC',

      /* ── SEO — Vincennes ── */
      'seo_vincennes.page_tag': 'Val-de-Marne · 94300',
      'seo_vincennes.title_html': 'Private Chauffeur in Vincennes<br><em>Luxury VTC 24/7</em>',
      'seo_vincennes.sub': 'At the gates of the Bois de Vincennes, IsmaDrive offers a premium private chauffeur service from your home or office. CDG, Orly, Paris and greater Île-de-France transfers — book online in 2 minutes.',
      'seo_vincennes.cta': 'Book from Vincennes',

      /* ── Trust Bar ── */
      'trust.b1': 'English Speaking Drivers',
      'trust.b2': 'Real-Time Flight Tracking',
      'trust.b3': 'Meet & Greet Service',
      'trust.b4': 'WhatsApp Support 24/7',
      'trust.b5': 'Fixed Price – No Surprises',
      'trust.b6': 'No Hidden Fees',
      'trust.b7': 'Card Payment Accepted',
      'trust.b8': 'Free Cancellation',

      /* ── Paris Experience ── */
      'paris.sub': 'More than a ride — an experience worthy of Paris',
      'paris.c1_title': 'CDG & Orly Airport Pickup',
      'paris.c1_desc': 'Met from the moment you land',
      'paris.c2_title': 'Meet & Greet Service',
      'paris.c2_desc': 'Your driver waits with your name displayed',
      'paris.c3_title': 'Paris City Tours',
      'paris.c3_desc': 'Explore monuments at your own pace',
      'paris.c4_title': 'Family Van – 7 Seats',
      'paris.c4_desc': 'Mercedes V-Class, baby seat included',
      'paris.c5_title': 'Couple Premium Experience',
      'paris.c5_desc': 'Elegance and comfort for two',
      'paris.c6_title': 'Versailles Day Transfer',
      'paris.c6_desc': 'Palace, gardens, return — all handled',
      'paris.c7_title': 'Disneyland Paris Shuttle',
      'paris.c7_desc': 'Direct transfer, kids on board, zero stress',

      /* ── Storytelling ── */
      'story.title': 'An experience, not just a ride',
      'story.sub': 'What sets us apart from other Paris chauffeur services',
      'story.c1_title': 'Total Peace of Mind',
      'story.c1_text': 'Landing in Paris? Your driver is already there, sign with your name, flight tracked. You have nothing to manage — absolutely nothing.',
      'story.c2_title': 'Understated Luxury',
      'story.c2_text': 'Our Mercedes are immaculately maintained. No odors, no noise, mineral water on board. The detail that makes all the difference.',
      'story.c3_title': 'Built for Demanding Clients',
      'story.c3_text': 'Business travellers, families on holiday, couples on a weekend away. We adapt every journey to your pace — not ours.',
    }
  };

  /* ─────────────────────────────────── */

  function getLang() {
    return sessionStorage.getItem(LANG_KEY) || 'fr';
  }

  function t(key, lang) {
    var l = lang || getLang();
    return (T[l] && T[l][key] !== undefined) ? T[l][key] : (T.fr[key] !== undefined ? T.fr[key] : key);
  }

  function applyTranslations(lang) {
    /* Text content */
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n'), lang);
      el.textContent = val;
    });
    /* HTML content (elements with nested tags) */
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n-html'), lang);
      el.innerHTML = val;
    });
    /* Placeholder */
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n-ph'), lang);
      el.placeholder = val;
    });
    /* aria-label */
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n-aria'), lang);
      el.setAttribute('aria-label', val);
    });
    /* Select options — comma-separated key(s) */
    document.querySelectorAll('[data-i18n-opts]').forEach(function (sel) {
      var keysAttr = sel.getAttribute('data-i18n-opts');
      var keys = keysAttr.split(',');
      var vals;
      
      // Check if it's multiple translation keys (like tabsel.airport,tabsel.transfer,...)
      if (keys.length > 1 && keys.every(function(k) { return T[lang] && T[lang][k.trim()]; })) {
        // Multiple keys: get translation for each key
        vals = keys.map(function(k) { return t(k.trim(), lang); });
      } else {
        // Single key containing comma-separated values (like transfer.pax_opts)
        vals = t(keysAttr, lang).split(',');
      }
      
      Array.from(sel.options).forEach(function (opt, i) {
        if (vals[i] !== undefined) opt.textContent = vals[i].trim();
      });
    });
    /* html[lang] attribute */
    document.documentElement.lang = lang;
  }

  function updateToggle(lang) {
    var btn = document.getElementById('lang-toggle');
    if (!btn) return;
    btn.querySelector('.lt-fr').style.opacity = lang === 'fr' ? '1' : '0.38';
    btn.querySelector('.lt-fr').style.fontWeight = lang === 'fr' ? '500' : '300';
    btn.querySelector('.lt-en').style.opacity = lang === 'en' ? '1' : '0.38';
    btn.querySelector('.lt-en').style.fontWeight = lang === 'en' ? '500' : '300';
  }

  window.toggleLang = function () {
    var next = getLang() === 'fr' ? 'en' : 'fr';
    sessionStorage.setItem(LANG_KEY, next);
    applyTranslations(next);
    updateToggle(next);
  };

  /* Global accessor for JS-generated strings */
  window.i18n = function (key) { return t(key); };

  /* ── Inject toggle CSS ── */
  var css = document.createElement('style');
  css.textContent = [
    '.lang-toggle{background:none;border:1px solid var(--gold-border,rgba(201,169,110,.25));color:var(--gold,#c9a96e);',
    'padding:.26rem .65rem;font-family:"DM Sans",sans-serif;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;',
    'cursor:pointer;display:inline-flex;align-items:center;gap:.28rem;transition:border-color .2s;flex-shrink:0;line-height:1;margin-left:1rem}',
    '.lang-toggle:hover{border-color:var(--gold,#c9a96e)}',
    '.lt-sep{color:var(--faint,#4a4640);font-weight:300}',
    '.lt-fr,.lt-en{transition:opacity .2s,font-weight .2s}'
  ].join('');
  document.head.appendChild(css);

  /* ── Init ── */
  function init() {
    var lang = getLang();
    applyTranslations(lang);
    updateToggle(lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
