# Phase 1 — MVP en cercle restreint : scénarios

Statut : **brouillon, à valider par Louis** avant d'écrire les tests.

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

## Tranche 2 — Profil et langue

**Compléter son profil**
- Un membre renseigne un nom affiché, une courte bio, un avatar et ses outils favoris
- L'avatar est ré-encodé et ses métadonnées (dont la position GPS) sont supprimées

**Choisir sa langue**
- Au premier lancement, l'appli suit la langue de l'appareil si c'est le français ou l'anglais,
  sinon le français
- Un membre peut changer de langue dans ses réglages ; son choix est mémorisé sur tous ses appareils
- Les e-mails et notifications lui sont envoyés dans cette langue

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
