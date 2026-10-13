# 0004 — Une copie chiffrée des sauvegardes, que le PC de Louis vient chercher

- Statut : accepté
- Date : 2026-10-13

## Contexte

Le serveur se sauvegarde chaque nuit (ADR 0003), mais sur lui-même : si le VPS est perdu (panne,
erreur, compte Hostinger compromis), ses sauvegardes disparaissent avec lui. Les sauvegardes
hebdomadaires de Hostinger sont payantes, et restent chez le même hébergeur. Louis préfère une
copie sur son PC.

Ces sauvegardes contiennent les données des membres (adresses e-mail, empreintes des mots de
passe, projets). Le dossier Documents d'un PC Windows est souvent synchronisé avec OneDrive, et un
PC peut être volé.

## Décision

1. **Le serveur chiffre, et ne sait pas déchiffrer.** Chaque nuit, la sauvegarde quotidienne est
   chiffrée avec age (`infra/offsite/export.sh`), pour une clé publique versionnée dans
   `infra/offsite/recipients.txt`. La clé privée qui la rouvre est sur le PC, protégée par une
   phrase de passe, avec une copie hors du PC. Une copie volée, sur le serveur, sur le PC ou dans
   un cloud, ne révèle rien.
   - age plutôt que GPG : un seul format, aucune configuration, et il accepte une clé SSH
     ed25519 comme clé de chiffrement. Louis la crée avec `ssh-keygen`, un outil qu'il connaît
     déjà sous Windows.
   - L'empreinte SHA-256 de chaque copie est publiée à côté, et écrite en dernier : le PC ne
     prend que des copies complètes, et vérifie qu'elles sont arrivées intactes.
2. **Le PC vient chercher (« pull »), le serveur n'envoie rien (« push »).** Le serveur ne détient
   aucun accès au PC ni à un stockage externe. Un serveur compromis ne peut donc ni effacer ni
   modifier les copies déjà sur le PC.
3. **Un compte en lecture seule pour le PC.** Le compte `sauvegarde` du serveur
   (`infra/server/bootstrap.sh`, étape offsite) :
   - n'a que le transfert de fichiers de SSH, en lecture seule (`ForceCommand internal-sftp -R`) ;
   - est enfermé dans le dossier des copies chiffrées (`ChrootDirectory`) ;
   - n'a ni terminal ni tunnel, ses clés sont dans un fichier de root (`restrict` en plus) ;
   - n'accepte que la clé de téléchargement du PC, versionnée dans `infra/offsite/download.pub`.

   Cette clé n'a pas de phrase de passe, pour que la copie se fasse seule. Volée, elle ne donne
   que des fichiers chiffrés.
4. **Une tâche planifiée Windows** lance `copy-to-pc.ps1` deux fois par jour. Elle rattrape un
   passage manqué quand le PC était éteint, et réessaie si le réseau n'est pas encore là. Le
   script est recopié hors du dépôt à l'installation : la tâche ne lance jamais une version du
   dépôt en cours de relecture. Le PC garde 30 copies, le serveur 14.
5. **On vérifie que ça marche, et que ça continue de marcher.**
   - **En CI**, à chaque pull request :
     - un serveur Debian 13 jetable, préparé par les vraies étapes de `bootstrap.sh`, et tout ce
       que le compte `sauvegarde` ne doit pas pouvoir faire (`infra/offsite-test.sh`) ;
     - les scripts du PC sous Windows PowerShell 5.1 (`infra/offsite/windows-test.ps1`) ;
     - la copie de la vraie sauvegarde de la pile complète (`infra/stack-test.sh`).
   - **À chaque déploiement**, `deploy-from-pc.sh` prévient si la dernière copie a plus de 3 jours.
   - **Une fois par mois**, Louis rouvre la dernière copie et la compare au serveur
     (`verify-on-pc.ps1`).

## Conséquences

- La copie dépend du PC de Louis : s'il reste éteint longtemps, les copies prennent du retard
  (alerte au déploiement).
- Perdre la clé de déchiffrement, ou sa phrase de passe, rend toutes les copies illisibles. D'où
  une copie de la clé hors du PC (clé USB), et la phrase de passe dans un gestionnaire de mots de
  passe.
- Restaurer depuis le PC demande de déchiffrer sur le PC, puis d'envoyer la sauvegarde au
  serveur : la clé de déchiffrement ne va jamais sur un serveur (docs/ops/serveur.md).
- Changer une clé passe par une pull request (les fichiers de `infra/offsite/`), un déploiement,
  puis l'étape offsite de `bootstrap.sh`.
