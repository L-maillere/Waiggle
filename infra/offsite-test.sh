#!/usr/bin/env bash
# Essaie la copie des sauvegardes hors du serveur, de bout en bout et comme en vrai :
#   - un serveur Debian 13 jetable (un conteneur Docker), préparé par les vraies étapes de
#     infra/server/bootstrap.sh : user, lock-ssh, puis offsite ;
#   - des copies chiffrées déposées par le vrai infra/offsite/export.sh ;
#   - les vrais scripts du PC (infra/offsite/*.ps1), lancés avec PowerShell : l'installateur, la
#     copie, l'essai du mois ; puis le déchiffrement avec la clé du PC.
# Il vérifie surtout ce qui ne doit PAS arriver :
#   - le compte « sauvegarde » ne peut ni ouvrir un terminal, ni écrire, ni ouvrir un tunnel, ni
#     sortir de son dossier ;
#   - un serveur piraté ne peut pas faire effacer les copies déjà sur le PC, ni remplir son disque.
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
# Les sauvegardes factices de l'essai : il y a 3, 2 et 1 jours. Le PC refuse les dates anciennes
# ou futures : l'essai suit donc le calendrier.
day_name() { echo "$(date -d "$1 days ago" +%Y-%m-%d)_033000-quotidien"; }
D3=$(day_name 3)
D2=$(day_name 2)
D1=$(day_name 1)
TODAY=$(date +%Y-%m-%d)

# --- Le serveur jetable (ce script, relancé en root à l'intérieur avec --serveur) ---------------
# Arguments : le dossier du dépôt, puis les clés publiques d'administration, de téléchargement
# et de chiffrement de l'essai.
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
  local pub=/srv/ruche/repo/infra/offsite/download.pub
  printf '# clé de l essai\n%s\n' "$download_pub" >"$pub"
  printf '# clé de l essai\n%s\n' "$recipient_pub" >/srv/ruche/repo/infra/offsite/recipients.txt

  step "Les vraies étapes de bootstrap.sh"
  bash /srv/ruche/repo/infra/server/bootstrap.sh user "$ADMIN"
  bash /srv/ruche/repo/infra/server/bootstrap.sh lock-ssh "$ADMIN"
  bash /srv/ruche/repo/infra/server/bootstrap.sh offsite "$ADMIN"
  # Relancées, les étapes ne changent rien et ne cassent rien.
  bash /srv/ruche/repo/infra/server/bootstrap.sh offsite "$ADMIN" >/dev/null
  bash /srv/ruche/repo/infra/server/bootstrap.sh lock-ssh "$ADMIN" >/dev/null
  grep -qx "AllowUsers $ADMIN sauvegarde" /etc/ssh/sshd_config.d/00-ruche.conf ||
    die "lock-ssh relancé a retiré le compte sauvegarde"

  step "Une option glissée devant la clé de téléchargement est refusée"
  local keys_before
  keys_before=$(sha256sum </etc/ssh/ruche-sauvegarde.keys)
  printf 'command="/bin/sh" %s\n' "$download_pub" >"$pub"
  if bash /srv/ruche/repo/infra/server/bootstrap.sh offsite "$ADMIN" >/dev/null 2>&1; then
    die "une clé précédée d'une option a été acceptée"
  fi
  [ "$(sha256sum </etc/ssh/ruche-sauvegarde.keys)" = "$keys_before" ] || die "le fichier des clés a changé"
  printf '# clé de l essai\n%s\n' "$download_pub" >"$pub"
  echo "ok : refusée, rien n'a changé"

  step "Trois sauvegardes (factices), exportées par le vrai export.sh, sous le nom de $ADMIN"
  # (Vidés d'abord, si l'essai est relancé sur la même machine.)
  rm -rf /srv/ruche/backups
  find "$RUCHE_OFFSITE" -mindepth 1 -delete
  chown "$ADMIN:$ADMIN" /srv/ruche
  install -d -m 700 -o "$ADMIN" -g "$ADMIN" /srv/ruche/backups
  local name base
  for name in "$D3" "$D2" "$D1"; do
    base=/srv/ruche/backups/$name
    # « PGDMP » : le début de tout fichier de pg_dump, que l'essai du mois reconnaît.
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
# La dernière ligne du journal d'un dossier de copies, qui doit contenir un texte donné.
journal_says() {
  tail -n 1 "$1/journal.txt" | grep -qF -- "$2" || die "journal : $(tail -n 1 "$1/journal.txt")"
}

if [ -n "$LOCAL" ]; then
  [ "$(id -u)" -eq 0 ] || die "RUCHE_OFFSITE_TEST_LOCAL=1 : à lancer en root, sur une machine jetable"
  PORT=22
else
  PORT=2222
fi
SSH_DIR=$WORK/ssh
PC=$WORK/pc
INSTALL=$WORK/install
mkdir -m 700 "$SSH_DIR"

step "Le PC : sa clé d'administration, sa clé de déchiffrement, son raccourci « waiggle »"
ssh-keygen -q -t ed25519 -N '' -C essai-admin -f "$SSH_DIR/admin"
ssh-keygen -q -t ed25519 -N '' -C essai-dechiffrement -f "$SSH_DIR/waiggle-dechiffrement"
# Comme sur le PC : l'empreinte du serveur est notée dans le known_hosts du dossier des clés, et
# toute empreinte inconnue est refusée. Le « Host * » vérifie qu'il ne déteint pas sur la copie.
cat >"$SSH_DIR/config" <<EOF
Host waiggle
  HostName 127.0.0.1
  Port $PORT
  User $ADMIN
  IdentityFile $SSH_DIR/admin
  IdentitiesOnly yes
  BatchMode yes
  UserKnownHostsFile $SSH_DIR/known_hosts
  StrictHostKeyChecking yes

Host *
  User quelquun
  StrictHostKeyChecking no
EOF

step "L'installateur du PC (sans la tâche planifiée, propre à Windows)"
install_on_pc() {
  pwsh -NoProfile -NonInteractive -File infra/offsite/install-on-pc.ps1 -SshDir "$SSH_DIR" \
    -InstallDir "$INSTALL" -Destination "$PC" -NoScheduledTask
}
config_before=$(sha256sum <"$SSH_DIR/config")
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
expect "la configuration SSH de l'utilisateur n'est pas modifiée" "$(sha256sum <"$SSH_DIR/config")" "$config_before"
expect "script installé hors du dépôt" "$(cmp -s infra/offsite/copy-to-pc.ps1 "$INSTALL/copy-to-pc.ps1" && echo identique)" identique
expect "raccourci dédié, à l'adresse de « waiggle »" \
  "$(ssh -F "$INSTALL/ssh_config" -G waiggle-sauvegardes | grep -E '^(hostname|port|user|stricthostkeychecking) ' | tr '\n' ' ')" \
  "user sauvegarde hostname 127.0.0.1 port $PORT stricthostkeychecking true "

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
  ssh-keyscan -p "$PORT" -t ed25519 127.0.0.1 >"$SSH_DIR/known_hosts" 2>/dev/null && [ -s "$SSH_DIR/known_hosts" ] && break
  sleep 1
done
[ -s "$SSH_DIR/known_hosts" ] || die "le serveur SSH de l'essai ne répond pas"

step "Connexions : chaque clé n'ouvre que son compte"
# Une clé et un compte donnés, sans raccourci : -F /dev/null ignore tout fichier de réglages.
ssh_opts=(-F /dev/null -p "$PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$SSH_DIR/known_hosts")
sftp_opts=(-F /dev/null -P "$PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$SSH_DIR/known_hosts")
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
expect "copies visibles" "$(grep -cE '^[0-9-]+_033000-quotidien\.tar\.age$' <<<"$listing")" 3
expect "empreintes visibles" "$(grep -c '\.tar\.age\.sha256$' <<<"$listing")" 3
refused ssh "${ssh_opts[@]}" -i "$SSH_DIR/waiggle-telechargement" sauvegarde@127.0.0.1 'cat /etc/passwd'
grep -q 'sftp connections only' "$WORK/refus.log" || die "message inattendu : $(cat "$WORK/refus.log")"
echo "ok : pas de terminal"
refused ssh "${ssh_opts[@]}" -i "$SSH_DIR/waiggle-telechargement" -W 127.0.0.1:22 sauvegarde@127.0.0.1 </dev/null
echo "ok : pas de tunnel"
echo x >"$WORK/intrus.txt"
refused backup_sftp waiggle-telechargement "put $WORK/intrus.txt"
refused backup_sftp waiggle-telechargement "rm $D3.tar.age"
refused backup_sftp waiggle-telechargement 'mkdir intrus'
echo "ok : ni dépôt, ni suppression, ni dossier"
refused backup_sftp waiggle-telechargement 'ls /etc'
refused backup_sftp waiggle-telechargement 'cd /srv/ruche'
expect "racine vue par le compte" "$(backup_sftp waiggle-telechargement 'ls -1 /' | grep -v '^sftp>')" /copies
echo "ok : enfermé dans son dossier"

step "La copie quotidienne, avec le script et le raccourci installés"
# MIN_FREE : la machine de l'essai n'a pas forcément 5 Go libres (et l'essai « disque plein »).
copy_to() {
  local destination=$1
  shift
  pwsh -NoProfile -NonInteractive -File "$INSTALL/copy-to-pc.ps1" -SshConfig "$INSTALL/ssh_config" \
    -Destination "$destination" -StateFile "$WORK/etat.txt" -RetryDelaySeconds 1 \
    -MinFreeBytes "${MIN_FREE:-1048576}" "$@"
}
state() { sed -n "s/^$1=//p" "$WORK/etat.txt" | tr -d '\r'; }
copy_to "$PC"
expect "copies sur le PC" "$(names "$PC" '*.tar.age')" "$D3.tar.age $D2.tar.age $D1.tar.age "
expect "empreintes sur le PC" "$(names "$PC" '*.sha256' | wc -w)" 3
expect "état noté pour deploy-from-pc.sh" "$(state derniere) $(state resultat)" "$D1 ok"
journal_says "$PC" "ok : 3 nouvelle(s) copie(s)"

step "La copie se déchiffre avec la clé du PC, et contient la sauvegarde exacte"
mkdir "$WORK/ouverte"
age -d -i "$SSH_DIR/waiggle-dechiffrement" "$PC/$D1.tar.age" | tar -C "$WORK/ouverte" -xf -
for ext in db.dump media.tar.gz; do
  expect "$ext identique à celui du serveur" "$(sha256sum <"$WORK/ouverte/$D1.$ext")" \
    "$(on_server cat "/srv/ruche/backups/$D1.$ext" | sha256sum)"
done
refused age -d -i "$SSH_DIR/admin" "$PC/$D1.tar.age"
echo "ok : une autre clé ne l'ouvre pas"

step "L'essai du mois (verify-on-pc.ps1)"
verify_on_pc() {
  pwsh -NoProfile -NonInteractive -File infra/offsite/verify-on-pc.ps1 -Destination "$PC" \
    -KeyFile "$SSH_DIR/$1" -SshConfig "$SSH_DIR/config"
}
leftovers() { find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'waiggle-verification-*' 2>/dev/null; }
verify_on_pc waiggle-dechiffrement >"$WORK/verification.log" || {
  cat "$WORK/verification.log"
  die "l'essai du mois a échoué"
}
expect "comparaison des deux fichiers" "$(grep -c 'identique à celui du serveur' "$WORK/verification.log")" 2
[ -z "$(leftovers)" ] || die "des données déchiffrées sont restées dans le dossier temporaire"
refused verify_on_pc admin
[ -z "$(leftovers)" ] || die "après un échec, des données sont restées dans le dossier temporaire"
echo "ok : avec une autre clé, l'essai échoue, et rien ne reste"

step "Relancée : rien de nouveau à copier"
copy_to "$PC"
expect "copies inchangées" "$(names "$PC" '*.tar.age' | wc -w)" 3
journal_says "$PC" "ok : rien de nouveau"

step "Serveur piraté : des noms datés du futur, une avalanche de copies, une copie énorme"
# Le serveur piraté calcule lui-même des empreintes valables : seules les règles du PC protègent.
on_server sh -c "cd $RUCHE_OFFSITE && for i in \$(seq -w 1 30); do
  for name in 2099-12-31_0000\$i ${TODAY}_0000\$i; do
    printf faux >\$name-quotidien.tar.age && sha256sum \$name-quotidien.tar.age >\$name-quotidien.tar.age.sha256
  done
done
head -c 3000000 /dev/zero >${TODAY}_000031-quotidien.tar.age
sha256sum ${TODAY}_000031-quotidien.tar.age >${TODAY}_000031-quotidien.tar.age.sha256"
refused copy_to "$PC" -MaxBytes 1048576
for name in "$D3" "$D2" "$D1"; do
  [ -f "$PC/$name.tar.age" ] || die "la vraie copie $name a été effacée"
done
echo "ok : les vraies copies sont toutes là"
expect "aucun nom daté du futur sur le PC" "$(names "$PC" '2099-*' | wc -w)" 0
expect "5 téléchargements au plus, la copie énorme arrêtée" "$(names "$PC" "${TODAY}_0000*.tar.age" | wc -w)" 4
expect "pas de reste de téléchargement" "$(names "$PC" '*.partiel' | wc -w)" 0
journal_says "$PC" "ÉCHEC : 30 nom(s) de copie refusé(s)"
journal_says "$PC" "copie trop grosse"
expect "échec noté pour deploy-from-pc.sh" "$(state resultat)" echec
# Le serveur redevient sain : on retire les faux, là-bas et ici.
on_server sh -c "rm -f $RUCHE_OFFSITE/2099-* $RUCHE_OFFSITE/${TODAY}_0000*"
rm -f "$PC/${TODAY}"_0000*

step "Les copies sont effacées selon leur date d'arrivée sur le PC, jamais selon leur nom"
# Un dossier à part, avec des copies (factices) arrivées il y a 400 jours (A, E), et deux le
# même mois, il y a plus de 30 jours (B puis C). La date d'arrivée, c'est la date du fichier.
old=$WORK/anciennes
mkdir "$old"
month=$(date -d "$(date +%Y-%m-01) -2 months" +%Y-%m)
make_old() {
  local file=$old/2020-01-$1_000000-quotidien.tar.age
  echo "$2" >"$file"
  echo "$2" >"$file.sha256"
  touch -d "$3" "$file"
}
make_old 01 A '400 days ago'
make_old 02 E '400 days ago'
make_old 03 B "$month-02 12:00"
make_old 04 C "$month-03 12:00"
present() { for copy in "$@"; do grep -lx "$copy" "$old"/*.tar.age 2>/dev/null | wc -l; done | tr '\n' ' '; }
copy_to "$old" >/dev/null
expect "1er passage : A et E effacées (plus d'un an), pas plus de 2" "$(present A E B C)" "0 0 1 1 "
copy_to "$old" >/dev/null
expect "2e passage : C effacée, B gardée (la première arrivée de son mois)" "$(present B C)" "1 0 "
expect "les copies du serveur, elles, sont arrivées" "$(names "$old" '*_033000-quotidien.tar.age' | wc -w)" 3

step "Une copie abîmée en route est refusée"
# Un octet de plus dans le fichier du serveur : son empreinte ne correspond plus.
on_server sh -c "printf x >>$RUCHE_OFFSITE/$D1.tar.age"
rm "$PC/$D1.tar.age" "$PC/$D1.tar.age.sha256"
refused copy_to "$PC"
[ ! -e "$PC/$D1.tar.age" ] || die "la copie abîmée a été gardée"
expect "pas de reste de téléchargement" "$(names "$PC" '*.partiel' | wc -w)" 0
journal_says "$PC" "ÉCHEC : copie abîmée"

step "Disque presque plein : rien n'est téléchargé"
MIN_FREE=999999999999999999 refused copy_to "$PC"
journal_says "$PC" "espace disque insuffisant"

step "Serveur injoignable : échec noté, après plusieurs essais"
# Un port fermé, placé en tête du raccourci : pour SSH, la première valeur lue l'emporte.
sed -i '/^Host waiggle-sauvegardes$/a\  Port 9' "$INSTALL/ssh_config"
refused copy_to "$PC"
journal_says "$PC" "ÉCHEC : serveur injoignable (3 essais)"

printf '\nCopie hors du serveur : tout est bon.\n'
