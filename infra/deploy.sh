#!/usr/bin/env bash
# Met en ligne une version de l'appli sur le serveur, ou revient à une version précédente.
#
# Usage : infra/deploy.sh <commit>
#   <commit> : le numéro complet (40 caractères) d'un commit de main dont la CI a publié les
#   images. Le dernier : git ls-remote https://github.com/L-maillere/ruche refs/heads/main
#
# Revenir en arrière, c'est déployer le commit précédent (il est affiché à la fin). Attention :
# si la version ratée a modifié la base (une migration), il faut aussi restaurer la sauvegarde
# faite juste avant (infra/restore.sh). Voir docs/ops/serveur.md, « Revenir en arrière ».
#
# Les étapes :
#   1. vérifier que le commit est sur main et que ses images existent ;
#   2. sauvegarder la base et les avatars (les migrations s'appliquent au démarrage de l'API) ;
#   3. placer la copie du dépôt sur ce commit (pour les fichiers d'infra de cette version) ;
#   4. télécharger les images et relancer les conteneurs qui ont changé ;
#   5. vérifier que l'API répond avec ce numéro de version ;
#   6. supprimer les images trop anciennes (on garde celle d'avant, pour revenir en arrière vite).
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(dirname "$0")/lib.sh"

main() {
  local sha=${1:-}
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || die "usage : infra/deploy.sh <numéro de commit complet, 40 caractères>"
  local previous
  previous=$(deployed_version)

  step "1. Le commit ${sha:0:7} est-il sur main ?"
  cd "$RUCHE_REPO"
  # Le serveur ne se modifie jamais à la main : tout changement passe par le dépôt.
  [ -z "$(git status --porcelain)" ] || die "la copie du dépôt a été modifiée sur le serveur ($RUCHE_REPO) : git status"
  git fetch --quiet origin main
  git cat-file -e "$sha^{commit}" 2>/dev/null || die "commit inconnu : $sha"
  git merge-base --is-ancestor "$sha" origin/main || die "ce commit n'est pas sur main : on ne déploie que ce qui a été relu et fusionné"
  git checkout --quiet --detach "$sha"
  load_site

  step "Ses images sont-elles publiées ?"
  local part
  for part in api web; do
    if ! docker manifest inspect "$IMAGE_PREFIX-$part:$sha" >/dev/null 2>&1; then
      [ -n "$previous" ] && git checkout --quiet --detach "$previous"
      die "image introuvable : $IMAGE_PREFIX-$part:$sha. La CI a-t-elle fini sur main ? Les paquets sont-ils publics ?"
    fi
  done
  echo "ok"

  step "2. Sauvegarde avant la mise à jour"
  if [ -n "$(compose ps --status running --quiet db 2>/dev/null)" ]; then
    "$RUCHE_REPO/infra/backup.sh" avant-deploi
  else
    echo "La base ne tourne pas encore (premier déploiement) : rien à sauvegarder."
  fi

  step "3 et 4. Lancement de la version ${sha:0:7}"
  # On écrit la version dans un fichier temporaire, puis on le renomme : le fichier n'est jamais
  # à moitié écrit, même si le script est interrompu.
  printf 'RUCHE_VERSION=%s\n' "$sha" >"$RUCHE_DEPLOYED.tmp"
  mv "$RUCHE_DEPLOYED.tmp" "$RUCHE_DEPLOYED"
  compose pull --quiet
  # --wait : attend que chaque conteneur se déclare en bonne santé. --remove-orphans : arrête les
  # conteneurs d'un service qui n'existe plus dans docker-compose.yml.
  if ! compose up -d --no-build --remove-orphans --wait --wait-timeout 300; then
    compose ps
    die "la version ${sha:0:7} ne démarre pas. Revenir en arrière : infra/deploy.sh ${previous:-<commit précédent>}"
  fi

  step "5. L'API répond-elle avec la bonne version ?"
  local running
  running=$(compose exec -T api node -e \
    "fetch('http://127.0.0.1:3000/health').then((r) => r.json()).then((h) => console.log(h.version))")
  [ "$running" = "$sha" ] || die "l'API annonce la version « $running » au lieu de $sha"
  echo "ok : $running"
  # Depuis Internet, en passant par Caddy et le HTTPS. Avant que le DNS pointe vers le serveur,
  # ou pendant l'obtention des certificats, ceci peut échouer : ce n'est qu'un avertissement.
  if curl -fsS --max-time 15 "https://$API_DOMAIN/health" >/dev/null &&
    curl -fsS --max-time 15 -o /dev/null "https://$APP_DOMAIN/"; then
    echo "ok : https://$APP_DOMAIN et https://$API_DOMAIN répondent"
  else
    echo "AVERTISSEMENT : https://$APP_DOMAIN ou https://$API_DOMAIN ne répond pas encore (DNS, certificats ?)"
  fi

  step "6. Nettoyage des anciennes images"
  for part in api web; do
    docker image ls "$IMAGE_PREFIX-$part" --format '{{.Tag}}' |
      grep -v -x -e "$sha" -e "${previous:-none}" |
      while read -r tag; do docker image rm "$IMAGE_PREFIX-$part:$tag" >/dev/null || true; done
  done
  docker image prune -f >/dev/null

  printf '\nVersion %s en ligne.\n' "$sha"
  [ -z "$previous" ] || [ "$previous" = "$sha" ] ||
    printf 'Pour revenir à la version précédente : infra/deploy.sh %s\n' "$previous"
}

# « exit » juste après : le script change de version pendant qu'il tourne (git checkout), Bash ne
# doit plus rien lire du fichier une fois main terminée.
main "$@"
exit
