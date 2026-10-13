#!/usr/bin/env bash
# Déploie une version de l'appli, depuis le PC de Louis (c'est Claude Code, sur ce PC, qui le
# lance d'habitude).
#   1. Il vérifie, avec GitHub CLI, que les deux images de ce commit ont bien été construites par la
#      CI de main : chaque image porte une « attestation de provenance », une preuve signée de
#      l'endroit où elle a été construite. Une image fabriquée ailleurs (sur une autre branche, ou
#      par quelqu'un d'autre) est refusée.
#   2. Il lance infra/deploy.sh sur le serveur, avec l'empreinte exacte des images vérifiées.
#
# Usage, depuis le dossier du dépôt : infra/deploy-from-pc.sh [<commit>]
#   Sans commit : le dernier commit de main.
# Demande : GitHub CLI connecté (gh auth login), et l'accès SSH « waiggle » (docs/ops/serveur.md).
# RUCHE_SSH : le programme ssh à utiliser (sous Windows, celui qui connaît l'agent de clés).
set -euo pipefail

RUCHE_REPO=$(cd "$(dirname "$0")/.." && pwd)
export RUCHE_REPO
# shellcheck source=infra/lib.sh
source "$RUCHE_REPO/infra/lib.sh"

# Le dépôt dont la CI doit avoir signé les images. Il s'appelait « ruche » avant octobre 2026 : les
# images publiées sous l'ancien nom portent une signature à l'ancien nom, et sont donc refusées.
GITHUB_REPO=L-maillere/Waiggle
SSH=${RUCHE_SSH:-ssh}
HOST=${RUCHE_SSH_HOST:-waiggle}

# La copie des sauvegardes sur ce PC (infra/offsite/) : une copie trop ancienne veut dire qu'elle
# ne se fait plus, sans que personne l'ait remarqué. On prévient, sans bloquer le déploiement.
# Le script de copie note son état dans AppData\Local\Waiggle\etat-copie.txt.
check_offsite_copy() {
  # Seulement sous Windows (Git Bash) : cygpath convertit un chemin Windows en chemin Git Bash.
  [ -n "${LOCALAPPDATA:-}" ] && command -v cygpath >/dev/null || return 0
  step "Copie des sauvegardes sur ce PC"
  local state latest outcome limit tomorrow
  state="$(cygpath -u "$LOCALAPPDATA")/Waiggle/etat-copie.txt"
  if [ ! -f "$state" ]; then
    echo "ATTENTION : pas encore installée (docs/ops/serveur.md, « Copie hors du serveur »)"
    return 0
  fi
  # tr -d '\r' : le fichier est écrit sous Windows, avec ses fins de ligne.
  latest=$(sed -n 's/^derniere=//p' "$state" | tr -d '\r')
  outcome=$(sed -n 's/^resultat=//p' "$state" | tr -d '\r')
  limit=$(date -d '3 days ago' +%Y-%m-%d)
  tomorrow=$(date -d tomorrow +%Y-%m-%d)
  # Le nom commence par la date de la sauvegarde (2026-10-13_…) : deux dates écrites ainsi se
  # comparent comme des mots, dans l'ordre alphabétique.
  if [[ ! ${latest:0:10} =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || [[ ${latest:0:10} < $limit ]]; then
    echo "ATTENTION : dernière copie « ${latest:-aucune} », plus de 3 jours. Lire journal.txt, dans le dossier des copies."
  elif [[ ${latest:0:10} > $tomorrow ]]; then
    echo "ATTENTION : dernière copie datée du futur (« $latest ») : anomalie, prévenir Louis."
  elif [ "$outcome" != ok ]; then
    echo "ATTENTION : le dernier passage a échoué (dernière copie : $latest). Lire journal.txt."
  else
    echo "ok : dernière copie $latest"
  fi
}

main() {
  command -v gh >/dev/null || die "GitHub CLI (gh) introuvable : l'installer, puis « gh auth login »"
  check_offsite_copy
  local sha=${1:-}
  if [ -z "$sha" ]; then
    sha=$(git ls-remote "https://github.com/$GITHUB_REPO" refs/heads/main | cut -f1)
  fi
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || die "commit invalide : « $sha » (40 caractères attendus)"

  step "Le dépôt d'images de la version ${sha:0:7}"
  git -C "$RUCHE_REPO" fetch --quiet origin main
  git -C "$RUCHE_REPO" merge-base --is-ancestor "$sha" origin/main ||
    die "ce commit n'est pas sur main : on ne déploie que ce qui a été relu et fusionné"
  # Celui de cette version précise (infra/site.env à ce commit), lu comme du texte, sans
  # l'exécuter, et vérifié comme le fait la CI.
  IMAGE_PREFIX=$(git -C "$RUCHE_REPO" show "$sha:infra/site.env" | sed -n 's/^IMAGE_PREFIX=//p')
  [[ $IMAGE_PREFIX =~ ^ghcr\.io/[a-z0-9._/-]+$ ]] || die "IMAGE_PREFIX invalide dans infra/site.env : « $IMAGE_PREFIX »"
  echo "$IMAGE_PREFIX"

  step "Vérification de la provenance des images"
  local part digest
  local -a images=()
  for part in api web; do
    # --source-ref et --source-digest : construite depuis main, à partir de ce commit précis ;
    # --signer-workflow : par notre CI ; --deny-self-hosted-runners : sur une machine de GitHub.
    digest=$(gh attestation verify "oci://$IMAGE_PREFIX-$part:$sha" \
      --repo "$GITHUB_REPO" \
      --signer-workflow "$GITHUB_REPO/.github/workflows/ci.yml" \
      --source-ref refs/heads/main \
      --source-digest "$sha" \
      --deny-self-hosted-runners \
      --format json --jq '.[0].verificationResult.statement.subject[0].digest.sha256') ||
      die "image $part de ${sha:0:7} non vérifiée : la CI de main a-t-elle publié les images ?"
    [[ $digest =~ ^[0-9a-f]{64}$ ]] || die "empreinte illisible pour l'image $part : « $digest »"
    images+=("$IMAGE_PREFIX-$part@sha256:$digest")
    echo "ok : ${images[-1]}"
  done

  step "Déploiement sur le serveur ($HOST)"
  # MSYS_NO_PATHCONV : sous Windows, Git Bash transformerait /srv/… en chemin Windows.
  MSYS_NO_PATHCONV=1 "$SSH" "$HOST" /srv/ruche/repo/infra/deploy.sh "$sha" "${images[0]}" "${images[1]}"
}

main "$@"
