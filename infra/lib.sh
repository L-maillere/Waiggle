# Réglages et petites fonctions communs aux scripts du serveur (deploy.sh, backup.sh, restore.sh).
# Ce fichier n'est pas lancé seul : les scripts le chargent avec « source ».
#
# Sur le serveur, tout vit dans /srv/ruche :
#   repo/          une copie du dépôt, placée sur la version déployée
#   secrets.env    les secrets (mots de passe, clés), lisibles par leur seul propriétaire
#   deployed.env   la version déployée (RUCHE_VERSION=<numéro de commit>)
#   backups/       les sauvegardes
# Chaque chemin peut être changé par une variable d'environnement : la CI s'en sert pour tout
# essayer dans un dossier temporaire (infra/stack-test.sh).
# shellcheck shell=bash

RUCHE_HOME=${RUCHE_HOME:-/srv/ruche}
RUCHE_REPO=${RUCHE_REPO:-$RUCHE_HOME/repo}
RUCHE_SITE_ENV=${RUCHE_SITE_ENV:-$RUCHE_REPO/infra/site.env}
RUCHE_SECRETS=${RUCHE_SECRETS:-$RUCHE_HOME/secrets.env}
RUCHE_DEPLOYED=${RUCHE_DEPLOYED:-$RUCHE_HOME/deployed.env}
RUCHE_BACKUPS=${RUCHE_BACKUPS:-$RUCHE_HOME/backups}

# Arrête le script avec un message clair.
die() {
  printf 'ÉCHEC : %s\n' "$*" >&2
  exit 1
}

# Annonce une étape, pour suivre ce qui se passe dans le terminal.
step() {
  printf '\n▶ %s\n' "$*"
}

# Les adresses publiques et le préfixe des images (APP_DOMAIN, API_DOMAIN, IMAGE_PREFIX).
# « set -a » exporte automatiquement les variables lues. Ce fichier ne contient aucun secret ;
# le fichier des secrets, lui, n'est jamais chargé dans le shell : seul Docker Compose le lit.
load_site() {
  [ -f "$RUCHE_SITE_ENV" ] || die "fichier introuvable : $RUCHE_SITE_ENV"
  set -a
  # shellcheck source=/dev/null
  . "$RUCHE_SITE_ENV"
  set +a
}

# La version déployée, ou rien avant le tout premier déploiement.
deployed_version() {
  if [ -f "$RUCHE_DEPLOYED" ]; then
    sed -n 's/^RUCHE_VERSION=//p' "$RUCHE_DEPLOYED"
  fi
}

# Docker Compose, avec tous les bons fichiers. Toujours passer par là, jamais par
# « docker compose » seul : il manquerait les adresses, les secrets ou la version.
compose() {
  [ -f "$RUCHE_SECRETS" ] || die "fichier des secrets introuvable : $RUCHE_SECRETS"
  [ -f "$RUCHE_DEPLOYED" ] || : >"$RUCHE_DEPLOYED"
  docker compose \
    --project-directory "$RUCHE_REPO/infra" \
    -f "$RUCHE_REPO/infra/docker-compose.yml" \
    --env-file "$RUCHE_SITE_ENV" \
    --env-file "$RUCHE_SECRETS" \
    --env-file "$RUCHE_DEPLOYED" \
    "$@"
}
