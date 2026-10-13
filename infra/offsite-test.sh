#!/usr/bin/env bash
# Essaie la copie des sauvegardes hors du serveur, de bout en bout et comme en vrai :
#   - un serveur Debian 13 jetable (un conteneur Docker), préparé par les vraies étapes de
#     infra/server/bootstrap.sh : user, lock-ssh, puis offsite ;
#   - des copies chiffrées déposées par le vrai infra/offsite/export.sh ;
#   - le vrai script du PC (infra/offsite/copy-to-pc.ps1), lancé avec PowerShell, qui les copie,
#     puis le déchiffrement avec la clé du PC.
# Il vérifie surtout ce que le compte « sauvegarde » ne doit PAS pouvoir faire : se connecter en
# terminal, écrire, ouvrir un tunnel, sortir de son dossier.
#
# Usage : infra/offsite-test.sh
#   Demande Docker, PowerShell (pwsh), age et un client SSH : c'est ce que lance la CI.
#   RUCHE_OFFSITE_TEST_LOCAL=1 : sans Docker, prépare CETTE machine comme serveur (en root). Elle
#   doit être jetable : son serveur SSH est reconfiguré.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=infra/lib.sh
source infra/lib.sh

CONTAINER=ruche-offsite-test
ADMIN=louis

# --- Le serveur jetable (ce script, relancé en root à l'intérieur avec --serveur) ---------------
# Arguments : le dossier du dépôt, puis les clés publiques d'administration, de téléchargement
# et de chiffrement tirées pour l'essai.
serveur() {
  local repo=$1 admin_pub=$2 download_pub=$3 recipient_pub=$4
  export DEBIAN_FRONTEND=noninteractive

  step "Serveur jetable : SSH, et un faux systemctl (pas de systemd dans un conteneur)"
  if ! command -v sshd >/dev/null; then
    apt-get update -q
    apt-get install -y -q openssh-server >/dev/null
  fi
  mkdir -p /run/sshd
  ssh-keygen -A >/dev/null
  # Le vrai systemctl recharge le serveur SSH ; ce faux le lance, ou lui demande de relire ses
  # réglages (signal HUP), ce qui revient au même.
  cat >/usr/local/sbin/systemctl <<'EOF'
#!/bin/sh
case "$1 $2" in
"reload ssh" | "restart ssh")
  if [ -f /run/sshd.pid ] && kill -0 "$(cat /run/sshd.pid)" 2>/dev/null; then
    kill -HUP "$(cat /run/sshd.pid)"
  else
    /usr/sbin/sshd
  fi
  ;;
*) echo "faux systemctl : $*" >&2 && exit 1 ;;
esac
EOF
  chmod 755 /usr/local/sbin/systemctl
  # Comme chez Hostinger : la clé de Louis est d'abord installée pour root.
  install -d -m 700 /root/.ssh
  printf '%s\n' "$admin_pub" >/root/.ssh/authorized_keys

  step "Copie du dépôt, avec les clés de l'essai"
  rm -rf /srv/ruche/repo
  install -d -m 755 /srv/ruche/repo
  cp -a "$repo/infra" /srv/ruche/repo/
  printf '# clé de l essai\n%s\n' "$download_pub" >/srv/ruche/repo/infra/offsite/download.pub
  printf '# clé de l essai\n%s\n' "$recipient_pub" >/srv/ruche/repo/infra/offsite/recipients.txt

  step "Les vraies étapes de bootstrap.sh"
  bash /srv/ruche/repo/infra/server/bootstrap.sh user "$ADMIN"
  bash /srv/ruche/repo/infra/server/bootstrap.sh lock-ssh "$ADMIN"
  bash /srv/ruche/repo/infra/server/bootstrap.sh offsite "$ADMIN"
  # Relancée, l'étape ne change rien et ne casse rien.
  bash /srv/ruche/repo/infra/server/bootstrap.sh offsite "$ADMIN" >/dev/null

  step "Trois sauvegardes (factices), exportées par le vrai export.sh, sous le nom de $ADMIN"
  chown "$ADMIN:$ADMIN" /srv/ruche
  install -d -m 700 -o "$ADMIN" -g "$ADMIN" /srv/ruche/backups
  local day base
  for day in 01 02 03; do
    base=/srv/ruche/backups/2026-10-${day}_033000-quotidien
    runuser -u "$ADMIN" -- sh -c "umask 077 && { printf PGDMP; head -c 20000 /dev/urandom; } >$base.db.dump && head -c 5000 /dev/urandom | gzip >$base.media.tar.gz"
    runuser -u "$ADMIN" -- /srv/ruche/repo/infra/offsite/export.sh "$base" >/dev/null
  done
  ls -l "$RUCHE_OFFSITE"
}

if [ "${1:-}" = --serveur ]; then
  shift
  serveur "$@"
  exit 0
fi

# --- L'essai, vu depuis le PC ---------------------------------------------------------------------
for tool in age pwsh ssh sftp ssh-keygen ssh-keyscan; do
  command -v "$tool" >/dev/null || die "$tool introuvable"
done
WORK=$(mktemp -d)
LOCAL=${RUCHE_OFFSITE_TEST_LOCAL:-}
cleanup() {
  [ -n "$LOCAL" ] || docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Compare une valeur à celle attendue, et s'arrête sinon.
expect() {
  [ "$2" = "$3" ] || die "$1 : obtenu « $2 », attendu « $3 »"
  echo "ok : $1"
}
# Les noms des fichiers d'un dossier qui correspondent à un motif, triés, sur une ligne.
names() {
  find "$1" -maxdepth 1 -type f -name "$2" -printf '%f\n' | sort | tr '\n' ' '
}
# Lance une commande qui doit échouer. Ce qu'elle a affiché reste dans refus.log.
refused() {
  if "$@" >"$WORK/refus.log" 2>&1; then
    cat "$WORK/refus.log"
    die "aurait dû être refusé : $*"
  fi
}

if [ -n "$LOCAL" ]; then
  [ "$(id -u)" -eq 0 ] || die "RUCHE_OFFSITE_TEST_LOCAL=1 : à lancer en root, sur une machine jetable"
  PORT=22
else
  PORT=2222
fi
SSH_DIR=$WORK/ssh
PC=$WORK/pc
mkdir -m 700 "$SSH_DIR"

step "Le PC : sa clé d'administration, sa clé de déchiffrement, son raccourci « waiggle »"
ssh-keygen -q -t ed25519 -N '' -C essai-admin -f "$SSH_DIR/admin"
ssh-keygen -q -t ed25519 -N '' -C essai-dechiffrement -f "$SSH_DIR/waiggle-dechiffrement"
# Les deux réglages du début valent pour tous les raccourcis : l'empreinte du serveur jetable est
# notée à part, et toute empreinte inconnue est refusée (comme sur le PC, après la 1re connexion).
cat >"$SSH_DIR/config" <<EOF
UserKnownHostsFile $WORK/known_hosts
StrictHostKeyChecking yes

Host waiggle
  HostName 127.0.0.1
  Port $PORT
  User $ADMIN
  IdentityFile $SSH_DIR/admin
  IdentitiesOnly yes
  BatchMode yes
EOF

step "L'installateur du PC (sans la tâche planifiée, propre à Windows)"
install_on_pc() {
  pwsh -NoProfile -NonInteractive -File infra/offsite/install-on-pc.ps1 -SshDir "$SSH_DIR" \
    -InstallDir "$WORK/install" -Destination "$PC" -NoScheduledTask
}
install_on_pc >"$WORK/installation.log" || {
  cat "$WORK/installation.log"
  die "installation impossible"
}
grep -qF "$(cat "$SSH_DIR/waiggle-telechargement.pub")" "$WORK/installation.log" ||
  die "l'installateur n'affiche pas la clé de téléchargement"
grep -qF "$(cat "$SSH_DIR/waiggle-dechiffrement.pub")" "$WORK/installation.log" ||
  die "l'installateur n'affiche pas la clé de déchiffrement"
key_before=$(sha256sum <"$SSH_DIR/waiggle-telechargement")
install_on_pc >/dev/null
expect "relancé : la clé ne change pas" "$(sha256sum <"$SSH_DIR/waiggle-telechargement")" "$key_before"
expect "relancé : le raccourci n'est pas dupliqué" "$(grep -c '^Host waiggle-sauvegardes$' "$SSH_DIR/config")" 1
expect "script installé hors du dépôt" "$(cmp -s infra/offsite/copy-to-pc.ps1 "$WORK/install/copy-to-pc.ps1" && echo identique)" identique
expect "adresse reprise du raccourci « waiggle »" \
  "$(ssh -F "$SSH_DIR/config" -G waiggle-sauvegardes | grep -E '^(hostname|port|user) ' | tr '\n' ' ')" \
  "user sauvegarde hostname 127.0.0.1 port $PORT "

step "Le serveur jetable, préparé avec la clé de téléchargement que l'installateur a créée"
server_args=("$(cat "$SSH_DIR/admin.pub")" "$(cat "$SSH_DIR/waiggle-telechargement.pub")"
  "$(cat "$SSH_DIR/waiggle-dechiffrement.pub")")
if [ -n "$LOCAL" ]; then
  on_server() { "$@"; }
  bash infra/offsite-test.sh --serveur "$PWD" "${server_args[@]}"
else
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" -p "127.0.0.1:$PORT:22" -v "$PWD:/mnt/repo:ro" debian:13 sleep infinity >/dev/null
  on_server() { docker exec "$CONTAINER" "$@"; }
  on_server bash /mnt/repo/infra/offsite-test.sh --serveur /mnt/repo "${server_args[@]}"
fi
# L'empreinte du serveur, notée comme sur le PC après la première connexion.
for _ in $(seq 30); do
  ssh-keyscan -p "$PORT" -t ed25519 127.0.0.1 >"$WORK/known_hosts" 2>/dev/null && [ -s "$WORK/known_hosts" ] && break
  sleep 1
done
[ -s "$WORK/known_hosts" ] || die "le serveur SSH de l'essai ne répond pas"

step "Connexions : chaque clé n'ouvre que son compte"
# Une clé et un compte donnés, sans le raccourci : -F /dev/null ignore tout fichier de réglages.
ssh_opts=(-F /dev/null -p "$PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$WORK/known_hosts")
sftp_opts=(-F /dev/null -P "$PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$WORK/known_hosts")
# sftp en tant que « sauvegarde », avec une clé et une liste de commandes (une par ligne).
backup_sftp() {
  local key=$1
  shift
  printf '%s\n' "$@" | sftp "${sftp_opts[@]}" -i "$SSH_DIR/$key" -b - sauvegarde@127.0.0.1
}
ssh "${ssh_opts[@]}" -i "$SSH_DIR/admin" "$ADMIN@127.0.0.1" true
echo "ok : $ADMIN se connecte avec sa clé"
refused ssh "${ssh_opts[@]}" -i "$SSH_DIR/admin" root@127.0.0.1 true
echo "ok : root est refusé"
refused ssh "${ssh_opts[@]}" -i "$SSH_DIR/waiggle-telechargement" "$ADMIN@127.0.0.1" true
echo "ok : la clé de téléchargement n'ouvre pas le compte $ADMIN"
refused backup_sftp admin 'ls'
echo "ok : la clé d'administration n'ouvre pas le compte sauvegarde"

step "Le compte « sauvegarde » : lire, et rien d'autre"
listing=$(backup_sftp waiggle-telechargement 'ls -1')
expect "copies visibles" "$(grep -c '^2026-10-0[123]_033000-quotidien\.tar\.age$' <<<"$listing")" 3
expect "empreintes visibles" "$(grep -c '\.tar\.age\.sha256$' <<<"$listing")" 3
refused ssh "${ssh_opts[@]}" -i "$SSH_DIR/waiggle-telechargement" sauvegarde@127.0.0.1 'cat /etc/passwd'
grep -q 'sftp connections only' "$WORK/refus.log" || die "message inattendu : $(cat "$WORK/refus.log")"
echo "ok : pas de terminal"
refused ssh "${ssh_opts[@]}" -i "$SSH_DIR/waiggle-telechargement" -W 127.0.0.1:22 sauvegarde@127.0.0.1 </dev/null
echo "ok : pas de tunnel"
echo x >"$WORK/intrus.txt"
refused backup_sftp waiggle-telechargement "put $WORK/intrus.txt"
refused backup_sftp waiggle-telechargement 'rm 2026-10-01_033000-quotidien.tar.age'
refused backup_sftp waiggle-telechargement 'mkdir intrus'
echo "ok : ni dépôt, ni suppression, ni dossier"
refused backup_sftp waiggle-telechargement 'ls /etc'
refused backup_sftp waiggle-telechargement 'cd /srv/ruche'
expect "racine vue par le compte" "$(backup_sftp waiggle-telechargement 'ls -1 /' | grep -v '^sftp>')" /copies
echo "ok : enfermé dans son dossier"

step "La copie quotidienne, avec le script installé et le raccourci écrit par l'installateur"
copy_to_pc() {
  pwsh -NoProfile -NonInteractive -File "$WORK/install/copy-to-pc.ps1" -SshConfig "$SSH_DIR/config" \
    -Destination "$PC" -StateFile "$WORK/etat.txt" -Keep 2 -RetryDelaySeconds 1
}
copy_to_pc
expect "copies sur le PC (les 2 plus récentes)" "$(names "$PC" '*.tar.age')" \
  "2026-10-02_033000-quotidien.tar.age 2026-10-03_033000-quotidien.tar.age "
expect "empreintes sur le PC" "$(names "$PC" '*.sha256' | wc -w)" 2
expect "état noté pour deploy-from-pc.sh" "$(sed -n 's/^derniere=//p' "$WORK/etat.txt" | tr -d '\r')" \
  2026-10-03_033000-quotidien
tail -n 1 "$PC/journal.txt" | grep -q 'ok : 2 nouvelle' || die "journal : $(tail -n 1 "$PC/journal.txt")"

step "La copie se déchiffre avec la clé du PC, et contient la sauvegarde exacte"
newest=2026-10-03_033000-quotidien
mkdir "$WORK/ouverte"
age -d -i "$SSH_DIR/waiggle-dechiffrement" "$PC/$newest.tar.age" | tar -C "$WORK/ouverte" -xf -
for ext in db.dump media.tar.gz; do
  expect "$ext identique à celui du serveur" "$(sha256sum <"$WORK/ouverte/$newest.$ext")" \
    "$(on_server cat "/srv/ruche/backups/$newest.$ext" | sha256sum)"
done
refused age -d -i "$SSH_DIR/admin" "$PC/$newest.tar.age"
echo "ok : une autre clé ne l'ouvre pas"

step "L'essai du mois (verify-on-pc.ps1)"
verify_on_pc() {
  pwsh -NoProfile -NonInteractive -File infra/offsite/verify-on-pc.ps1 -Destination "$PC" \
    -KeyFile "$SSH_DIR/$1" -SshConfig "$SSH_DIR/config"
}
verify_on_pc waiggle-dechiffrement >"$WORK/verification.log" || {
  cat "$WORK/verification.log"
  die "l'essai du mois a échoué"
}
expect "comparaison des deux fichiers" "$(grep -c 'identique à celui du serveur' "$WORK/verification.log")" 2
[ -z "$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'waiggle-verification-*' 2>/dev/null)" ] ||
  die "des données déchiffrées sont restées dans le dossier temporaire"
refused verify_on_pc admin
echo "ok : avec une autre clé, l'essai échoue"

step "Relancée : rien de nouveau à copier"
copy_to_pc
expect "copies inchangées" "$(names "$PC" '*.tar.age' | wc -w)" 2
tail -n 1 "$PC/journal.txt" | grep -q 'rien de nouveau' || die "journal : $(tail -n 1 "$PC/journal.txt")"
echo "ok"

step "Une copie abîmée en route est refusée"
# Un octet de plus dans le fichier du serveur : son empreinte ne correspond plus.
on_server sh -c "printf x >>$RUCHE_OFFSITE/$newest.tar.age"
rm "$PC/$newest.tar.age" "$PC/$newest.tar.age.sha256"
refused copy_to_pc
[ ! -e "$PC/$newest.tar.age" ] || die "la copie abîmée a été gardée"
[ -z "$(find "$PC" -name '*.partiel')" ] || die "un fichier .partiel est resté"
tail -n 1 "$PC/journal.txt" | grep -q 'ÉCHEC : copie abîmée' || die "journal : $(tail -n 1 "$PC/journal.txt")"
expect "échec noté pour deploy-from-pc.sh" "$(sed -n 's/^resultat=//p' "$WORK/etat.txt" | tr -d '\r')" echec
echo "ok : refusée, rien de gardé, échec noté"

step "Serveur injoignable : échec noté, après plusieurs essais"
# Un port fermé, placé en tête du raccourci : pour SSH, la première valeur lue l'emporte.
sed -i '/^Host waiggle-sauvegardes$/a\  Port 9' "$SSH_DIR/config"
refused copy_to_pc
tail -n 1 "$PC/journal.txt" | grep -q 'ÉCHEC : serveur injoignable (3 essais)' || die "journal : $(tail -n 1 "$PC/journal.txt")"
echo "ok"

printf '\nCopie hors du serveur : tout est bon.\n'
