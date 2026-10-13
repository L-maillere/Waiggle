#!/usr/bin/env bash
# Remet le serveur dans l'état d'une sauvegarde : la base de données ET les avatars.
# Tout ce qui a changé depuis cette sauvegarde est perdu : c'est fait pour réparer une erreur ou
# revenir en arrière après une mise à jour ratée (voir docs/ops/serveur.md).
#
# Usage : infra/restore.sh <sauvegarde> --effacer-les-donnees-actuelles
#   <sauvegarde> : le début commun des deux fichiers, sans l'extension, par exemple
#   /srv/ruche/backups/2026-10-13_033000-quotidien
# Le second mot est obligatoire : on ne remplace pas les données des membres par erreur.
#
# Par précaution, l'état actuel est d'abord sauvegardé (étiquette « avant-restauration »).
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(dirname "$0")/lib.sh"

main() {
  local base=${1:-}
  base=${base%.db.dump}
  base=${base%.media.tar.gz}
  [ -n "$base" ] || die "usage : infra/restore.sh <sauvegarde> --effacer-les-donnees-actuelles"
  [ "${2:-}" = --effacer-les-donnees-actuelles ] ||
    die "ajouter --effacer-les-donnees-actuelles pour confirmer : les données actuelles seront remplacées"
  [ -f "$base.db.dump" ] || die "introuvable : $base.db.dump"
  [ -f "$base.media.tar.gz" ] || die "introuvable : $base.media.tar.gz"

  step "Vérification des fichiers de la sauvegarde"
  compose exec -T db pg_restore --list <"$base.db.dump" >/dev/null
  gzip -t "$base.media.tar.gz"

  step "Sauvegarde de l'état actuel, au cas où"
  "$(dirname "$0")/backup.sh" avant-restauration

  step "Arrêt de l'API (plus personne n'écrit pendant la restauration)"
  compose stop api

  step "Base de données"
  # On repart d'une base vide (dropdb puis createdb), pour ne garder aucune table plus récente
  # que la sauvegarde. --force : coupe les connexions encore ouvertes.
  # shellcheck disable=SC2016 # les $ sont lus par le shell du conteneur, pas par celui-ci
  compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
  # shellcheck disable=SC2016
  compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' <"$base.db.dump"

  step "Avatars"
  # Un conteneur jetable vide le volume des avatars, puis y déballe l'archive.
  compose run --rm --no-deps -T --entrypoint sh api -c \
    'find /app/media -mindepth 1 -delete && tar -C /app/media -xzf -' <"$base.media.tar.gz"

  step "Redémarrage de l'API"
  compose up -d --wait api

  printf '\nRestauration terminée depuis %s\n' "$base"
}

main "$@"
