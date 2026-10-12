# Phase 1 — MVP en cercle restreint : scénarios

Statut : **validé par Louis** le 12/10/2026. Tranche 1 réalisée (voir ses notes de réalisation).

Chaque scénario devient un ou plusieurs tests. Les tranches sont listées dans l'ordre où on les
développera ; chacune est livrable seule.

---

## Tranche 1 — Compte

**Créer un compte par e-mail**
- Étant donné un visiteur sans compte
- Quand il s'inscrit avec un nom, une adresse e-mail et un mot de passe d'au moins 12 caractères
- Alors il reçoit un e-mail de vérification dans sa langue
- Et il ne peut publier qu'après avoir cliqué sur le lien de vérification

**Refuser une adresse déjà utilisée**
- Quand quelqu'un s'inscrit avec une adresse déjà enregistrée
- Alors l'inscription est refusée sans révéler si l'adresse existe (même message que pour un succès)

**Se connecter**
- Étant donné un membre vérifié
- Quand il se connecte avec son e-mail et son mot de passe, ou une passkey
- Alors il arrive sur son fil
- Et après 5 échecs en 15 minutes, les tentatives sont temporairement bloquées

**Supprimer son compte**
- Quand un membre supprime son compte depuis l'appli
- Alors son profil, ses projets, réactions et commentaires disparaissent
- Et il peut d'abord télécharger l'export de ses données

### Notes de réalisation (tranche 1)

- **Plus strict que prévu** : on ne peut pas du tout se connecter avant d'avoir vérifié son
  adresse (le scénario disait seulement « ne peut pas publier »). Cliquer sur le lien connecte
  directement, donc rien n'est perdu pour le membre.
- **Passkeys reportées** : elles exigent un vrai nom de domaine et une configuration iOS / Android.
  Elles viendront après la mise en ligne sur le VPS.
- **Limitation** : 5 tentatives de connexion par quart d'heure et par adresse IP (pas par compte).
- **Suppression** immédiate après confirmation du mot de passe, sans e-mail de confirmation.
- **Langue** : enregistrée à l'inscription (choix de l'appli, sinon langue du navigateur).
  Changer de langue dans les réglages viendra avec la tranche 2.

## Tranche 2 — Profil et langue

**Compléter son profil**
- Un membre renseigne un nom affiché, une courte bio, un avatar et ses outils favoris
- L'avatar est ré-encodé et ses métadonnées (dont la position GPS) sont supprimées

**Choisir sa langue**
- Au premier lancement, l'appli suit la langue de l'appareil si c'est le français ou l'anglais,
  sinon le français
- Un membre peut changer de langue dans ses réglages ; son choix est mémorisé sur tous ses appareils
- Les e-mails et notifications lui sont envoyés dans cette langue

### Précisions (tranche 2)

- **Limites** : nom de 1 à 80 caractères, bio de 280 caractères au plus, 10 outils favoris au plus
  (40 caractères chacun, doublons retirés).
- **Avatar** : JPEG, PNG ou WebP de 5 Mo au plus. Il est redressé selon l'orientation de la photo,
  recadré en carré de 512 px, réenregistré en WebP, sans aucune métadonnée. Un nouvel avatar
  remplace et efface l'ancien ; la suppression du compte efface aussi l'avatar.
- **Anti-abus** : 30 modifications de profil et 10 envois d'avatar par heure et par membre.
- **Langue** : changer de langue dans l'appli connectée l'enregistre sur le compte ; à la
  connexion sur un autre appareil, l'appli reprend la langue du compte.
- **Ce qui n'est pas modifiable ici** : l'adresse e-mail et le mot de passe (tranche ultérieure).

### Notes de réalisation (tranche 2) — à valider

Règles ajoutées pendant la réalisation, surtout après la relecture de sécurité :

- **Photo préparée sur l'appareil** : l'appli recadre la photo en carré au centre et la réduit à
  1 024 px avant l'envoi (sur mobile, le membre choisit lui-même le cadrage).
- **Images refusées par le serveur** (même si un autre programme que l'appli les envoie) : plus de
  4 096 × 4 096 pixels, plus de 4 fois plus larges que hautes (ou l'inverse), ou en 16 bits par
  couleur. Une photo de téléphone ordinaire (12 mégapixels) passe.
- **Serveur très sollicité** : au-delà de 2 images en traitement et 8 en attente, l'envoi est refusé
  avec « Réessaie dans un instant ».
- **Caractères invisibles refusés** dans le nom, la bio et les outils : caractères de contrôle,
  caractères qui inversent le sens d'écriture, lettres « vides ». Un nom doit contenir au moins un
  caractère visible. Effet de bord : les drapeaux d'Écosse et du pays de Galles (faits de
  caractères invisibles) ne sont pas acceptés. Les mêmes règles s'appliquent au nom choisi à
  l'inscription.
- **Image envoyée à l'inscription** : ignorée ; un avatar ne vient que de « Changer la photo ».
- **Autres sites** : toute modification envoyée depuis un autre site que l'appli est refusée.

## Tranche 3 — Publier un projet

**Publier un projet**
- Étant donné un membre vérifié
- Quand il publie un projet avec un titre, un pitch d'une phrase, au moins un visuel et un lien de
  démo
- Alors le projet apparaît sur son profil et dans le fil de ses abonnés

**Lien de démo valide**
- Le lien de démo doit être en `https://`
- Un lien vers une adresse locale ou privée (localhost, 192.168.x.x…) est refusé

**Recette du projet**
- L'auteur peut indiquer les outils et modèles utilisés, le temps passé et, s'il le souhaite, ses
  prompts clés
- Les outils deviennent des étiquettes cliquables (« fait avec Claude »)

**Statut et visibilité**
- Un projet a un statut : idée, en construction, testable, terminé, en pause
- Un projet a une visibilité : public ou privé
- Un projet privé n'apparaît nulle part pour les autres membres : ni fil, ni profil, ni recherche,
  ni lien direct (réponse « introuvable »)

**Modifier ou supprimer**
- Seul l'auteur peut modifier ou supprimer son projet ; toute tentative d'un autre membre est refusée

## Tranche 4 — Suivre et le fil

**Suivre**
- Un membre peut suivre une personne ou un seul projet, et arrêter de suivre

**Le fil « Abonnements »**
- Le fil montre, du plus récent au plus ancien, les nouveaux projets des personnes suivies et les
  mises à jour des projets suivis
- Arrivé au bout, le membre voit « tu es à jour » au lieu d'un défilement infini
- Les nouvelles cartes apparaissent sans recharger quand l'appli est ouverte

**Le fil « Découvrir »**
- Il montre les projets publics récents de tous les membres, et ceux qui cherchent des testeurs

**Ouvrir une démo**
- Quand un membre ouvre un lien de démo, une page lui indique qu'il quitte Ruche et vers quel domaine

## Tranche 5 — Réagir et commenter

**Réagir**
- Un membre peut poser une réaction par type sur un projet : Bluffant, Inspirant, Utile, Drôle, Bravo
- Il peut retirer sa réaction ; les compteurs se mettent à jour

**Commenter**
- Un membre peut commenter un projet et répondre à un commentaire, avec des mentions `@nom`
- L'auteur d'un commentaire peut le modifier ou le supprimer ; l'auteur du projet peut le masquer

## Tranche 6 — Notifications

- Un membre est notifié quand on réagit à son projet, le commente, le suit ou le mentionne
- Les notifications similaires sont regroupées (« 3 personnes ont réagi à ton projet »)
- Il choisit, par type, push, e-mail ou rien ; un récap par e-mail est possible

## Tranche 7 — Sécurité et modération

**Signaler**
- Tout membre peut signaler un projet, un commentaire ou un profil, avec un motif
- Le signalement arrive dans la file de l'administration

**Bloquer**
- Un membre peut en bloquer un autre : ils ne voient plus leurs contenus respectifs et ne peuvent
  plus interagir

**Administrer**
- Un administrateur voit la file des signalements, peut masquer un contenu, suspendre un compte et
  consulter l'historique de ces actions
