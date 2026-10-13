# 0003 — Un VPS, des images construites par GitHub, un déploiement lancé à la main

- Statut : accepté
- Date : 2026-10-13

## Contexte

L'appli quitte l'ordinateur de développement pour être utilisée par les proches de Louis. Louis
a loué un VPS Hostinger KVM 1, hébergé en France, et acheté le domaine waiggle.io chez Hostinger.
Le serveur est petit (un seul processeur). Louis veut que Claude puisse le gérer pour lui, depuis
Claude Code installé sur son PC.

Le dépôt est public, et le serveur héberge les données des membres : la sécurité passe avant le
confort.

## Décision

1. **Un seul VPS, sous Debian 13, avec Docker Compose** : la base (PostgreSQL), l'API et une porte
   d'entrée « web » (Caddy et l'appli web déjà construite). Seuls les ports 22, 80 et 443 sont
   ouverts.
2. **Deux domaines du même site** : waiggle.io pour l'appli, api.waiggle.io pour l'API. Les cookies
   de connexion (SameSite=Lax) et la règle CORP de l'API exigent un même domaine principal.
3. **GitHub construit les images, le VPS les télécharge.**
   - Après chaque fusion sur main, et seulement si toute la CI est verte, GitHub publie
     `ruche-api` et `ruche-web` sur ghcr.io.
   - Chaque image est étiquetée avec le numéro de son commit et accompagnée d'une attestation de
     provenance.
   - Les domaines vivent dans `infra/site.env`, versionné et sans secret.
4. **Le déploiement est lancé à la main** (`infra/deploy.sh <commit>`) depuis le PC de Louis, par
   SSH. Ce n'est pas GitHub qui s'en charge.
5. **La procédure est versionnée dans le dépôt** :
   - la préparation du serveur (`infra/server/bootstrap.sh`), par étapes ;
   - la sauvegarde quotidienne (`infra/backup.sh`) et la restauration (`infra/restore.sh`) ;
   - le pas-à-pas complet dans `docs/ops/serveur.md`.
6. **Un compte d'administration `louis`** :
   - connexion par clé SSH seulement, root fermé ;
   - `sudo` sans mot de passe.

## Raisons

- **Des images construites ailleurs** :
  - Construire l'appli Expo prendrait de longues minutes sur un seul processeur, et beaucoup de
    mémoire, pendant que le site tourne.
  - Le serveur n'a besoin ni de Node, ni de pnpm, ni du code source pour construire : moins de
    logiciels installés, c'est moins de failles possibles.
  - Revenir en arrière consiste à relancer l'image précédente, déjà prête.
- **Un déploiement manuel** : pour déployer tout seul, GitHub devrait détenir une clé SSH du
  serveur. Une fuite de cette clé, ou une action GitHub piégée, donnerait alors le serveur entier.
  Lancer le déploiement depuis le PC de Louis garde cette clé chez lui. Et puisque Claude Code le
  fait pour lui, cela ne coûte qu'une phrase.
- **`sudo` sans mot de passe** :
  - le compte n'a pas de mot de passe (connexion par clé seulement) ;
  - il fait partie du groupe `docker`, ce qui équivaut déjà à être root : un mot de passe pour
    `sudo` n'ajouterait pas de vraie protection ;
  - en revanche, il empêcherait Claude Code de travailler seul, puisque Claude ne tape jamais de
    mot de passe.
  - La protection réelle est la clé SSH. Elle est protégée par une phrase de passe sur le PC de
    Louis.
- **Caddy** : il obtient et renouvelle seul les certificats HTTPS, et sa configuration tient en
  une page. Il pose aussi les en-têtes de sécurité, dont une CSP stricte. Celle-ci est vérifiée
  à chaque construction (`infra/web/check-web.mjs`) et dans un vrai navigateur
  (`apps/app/scripts/site-check.mjs`).
- **Les sauvegardes** :
  - une sauvegarde chaque nuit sur le serveur, gardée 14 jours, plus une avant chaque déploiement ;
  - les sauvegardes hebdomadaires de Hostinger couvrent le serveur entier.
  - La CI vérifie la boucle « sauvegarder, puis restaurer » à chaque pull request : une
    sauvegarde jamais restaurée ne prouve rien.

## Conséquences

- Il faut deux étapes pour mettre en ligne une version : fusionner (Louis), puis déployer (Claude
  Code local, à la demande de Louis).
- Les paquets ghcr.io doivent être publics. C'est cohérent avec un code public : les images ne
  contiennent aucun secret.
- Le domaine est écrit dans l'image web, au moment de la construction. Changer de domaine
  demande donc une nouvelle publication (`infra/site.env`).
- Les sauvegardes ne quittent pas encore Hostinger. Une copie hors du serveur, automatique et
  chiffrée, viendra quand il y aura plus de données. En attendant, une copie peut être rapatriée
  sur le PC à la demande.
- Le serveur n'a pas de surveillance automatique (disponibilité, disque). C'est à ajouter.
