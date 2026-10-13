#!/usr/bin/env bash
# Chiffre une sauvegarde et la dépose dans le dossier que le PC de Louis vient copier chaque jour
# (la « copie hors du serveur », docs/ops/serveur.md). backup.sh le lance après chaque sauvegarde
# quotidienne.
#
# Usage : infra/offsite/export.sh /srv/ruche/backups/2026-10-13_033000-quotidien
#
# Pourquoi chiffrer : la sauvegarde contient les données des membres (adresses e-mail…), et sa
# copie quitte le serveur. On la chiffre avec age, un outil de chiffrement simple, pour les clés
# publiques listées dans infra/offsite/recipients.txt. Une clé publique sert seulement à fermer :
# seule la clé privée qui lui correspond, gardée sur le PC de Louis avec une phrase de passe, peut
# rouvrir le fichier. Le serveur ne sait donc pas relire ses propres copies, et un fichier volé
# (sur le PC, ou dans un cloud qui le synchronise) reste illisible.
#
# Ce qui est déposé, pour chaque sauvegarde (même nom, date_heure-étiquette) :
#   2026-10-13_033000-quotidien.tar.age         la base et les avatars, réunis puis chiffrés
#   2026-10-13_033000-quotidien.tar.age.sha256  son empreinte, pour vérifier la copie sur le PC
# L'empreinte est écrite en dernier : tant qu'elle n'existe pas, le PC ignore le fichier.
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(dirname "$0")/../lib.sh"

main() {
  local base=${1:-}
  [ -n "$base" ] || die "usage : infra/offsite/export.sh <sauvegarde> (sans extension)"
  [ -f "$base.db.dump" ] || die "introuvable : $base.db.dump"
  [ -f "$base.media.tar.gz" ] || die "introuvable : $base.media.tar.gz"

  step "Copie chiffrée, pour le PC"
  # Une ligne de clé commence par « ssh-ed25519 » (une clé SSH) ou « age1 » (une clé age).
  # Aucune clé : la copie hors du serveur n'est pas encore installée, ce n'est pas une erreur.
  if ! grep -qE '^(ssh-ed25519|age1)' "$RUCHE_OFFSITE_RECIPIENTS" 2>/dev/null; then
    echo "aucune clé dans $RUCHE_OFFSITE_RECIPIENTS : copie ignorée"
    return 0
  fi
  [ -d "$RUCHE_OFFSITE" ] ||
    die "dossier $RUCHE_OFFSITE introuvable : lancer l'étape « offsite » de infra/server/bootstrap.sh"
  command -v age >/dev/null || die "age introuvable : lancer l'étape « offsite » de infra/server/bootstrap.sh"

  local name out
  name=$(basename "$base")
  out=$RUCHE_OFFSITE/$name.tar.age
  # umask 022 : la copie est lisible par le compte « sauvegarde », qui la transmet au PC. Elle
  # est chiffrée : la lire ne révèle rien.
  umask 022
  # tar réunit les deux fichiers en un seul, que age chiffre au passage (« | » : la sortie de tar
  # devient l'entrée de age, rien n'est écrit en clair sur le disque). pipefail (en haut) fait
  # échouer le script si tar OU age échoue. -R : la liste des clés publiques.
  tar -C "$(dirname "$base")" -cf - "$name.db.dump" "$name.media.tar.gz" |
    age -R "$RUCHE_OFFSITE_RECIPIENTS" -o "$out.partiel"
  # L'empreinte SHA-256 : un résumé de 64 caractères qui change si un seul octet change. On la
  # calcule sur le fichier « .partiel », puis on retire « .partiel » du nom qu'elle cite.
  (cd "$RUCHE_OFFSITE" && sha256sum "$name.tar.age.partiel") | sed 's/\.partiel$//' >"$out.sha256.partiel"
  mv "$out.partiel" "$out"
  mv "$out.sha256.partiel" "$out.sha256"
  echo "$out ($(du -h "$out" | cut -f1))"

  step "Rotation des copies chiffrées"
  # Comme les sauvegardes elles-mêmes : 14 jours. Le PC garde les siennes plus longtemps.
  find "$RUCHE_OFFSITE" -maxdepth 1 -type f -name '????-??-??_??????-*.tar.age*' -mtime +13 -print -delete
  find "$RUCHE_OFFSITE" -maxdepth 1 -type f -name '*.partiel' -mmin +60 -print -delete
}

main "$@"
