#!/usr/bin/env bash
# Prépare un serveur neuf (Debian 13 ou Ubuntu 24.04) pour faire tourner l'appli. Il se lance
# depuis son ordinateur, par SSH, une étape à la fois. On vérifie chaque étape avant la suivante
# (voir docs/ops/serveur.md) :
#
#   ssh root@<IP> 'bash -s -- check'          < infra/server/bootstrap.sh   lire, sans rien changer
#   ssh root@<IP> 'bash -s -- user louis'     < infra/server/bootstrap.sh   créer le compte « louis »
#   (vérifier que « ssh louis@<IP> » fonctionne, dans un autre terminal)
#   ssh root@<IP> 'bash -s -- lock-ssh louis' < infra/server/bootstrap.sh   fermer root et les mots de passe
#   ssh louis@<IP> 'sudo bash -s -- base louis' < infra/server/bootstrap.sh  pare-feu, Docker, sauvegardes…
#
# « bash -s » lit le script sur l'entrée standard : rien n'a besoin d'être copié sur le serveur.
# Chaque étape peut être relancée sans dégâts : elle ne refait que ce qui manque.
set -euo pipefail

# L'empreinte de la clé qui signe les paquets Docker (publiée sur docs.docker.com). On vérifie
# que la clé téléchargée est bien celle-là avant de lui faire confiance.
DOCKER_KEY_FINGERPRINT=9DC858229FC7DD38854AE2D88D81803C0EBFCD88
REPO_URL=https://github.com/L-maillere/ruche.git
RUCHE_HOME=/srv/ruche

die() {
  printf 'ÉCHEC : %s\n' "$*" >&2
  exit 1
}
step() {
  printf '\n▶ %s\n' "$*"
}
require_root() {
  [ "$(id -u)" -eq 0 ] || die "cette étape se lance en root (ou avec sudo)"
}
# Le nom du compte d'administration : lettres minuscules, chiffres et tirets.
require_name() {
  [[ ${1:-} =~ ^[a-z][a-z0-9-]{0,31}$ ]] || die "nom de compte manquant ou invalide : « ${1:-} »"
}
# Le système doit être l'un de ceux pour lesquels ce script a été écrit.
require_supported_os() {
  # /etc/os-release décrit le système : ID=debian, VERSION_ID="13"…
  # shellcheck source=/dev/null
  . /etc/os-release
  case "$ID:$VERSION_ID" in
  debian:13 | ubuntu:24.04) ;;
  *) die "système non prévu : $PRETTY_NAME (attendu : Debian 13 ou Ubuntu 24.04)" ;;
  esac
}

# --- check : un état des lieux, sans rien modifier --------------------------------------------
check() {
  # shellcheck source=/dev/null
  . /etc/os-release
  step "Système"
  echo "$PRETTY_NAME, noyau $(uname -r), $(nproc) processeur(s)"
  case "$ID:$VERSION_ID" in
  debian:13 | ubuntu:24.04) echo "ok : système prévu" ;;
  *) echo "ATTENTION : système non prévu (attendu : Debian 13 ou Ubuntu 24.04)" ;;
  esac
  step "Mémoire et disque"
  free -h
  df -h /
  # « || true » : un outil absent ne doit pas interrompre l'état des lieux.
  step "Adresses IP"
  ip -brief address 2>/dev/null | grep -v '^lo' || hostname -I || true
  step "Ports ouverts"
  ss -tulpn 2>/dev/null | sed 1d | awk '{print $1, $5, $7}' || true
  step "Clés SSH autorisées pour root"
  if [ -s /root/.ssh/authorized_keys ]; then
    # On affiche la fin de chaque clé (son commentaire), jamais la clé entière.
    awk '{print $1, $NF}' /root/.ssh/authorized_keys
  else
    echo "aucune : ajouter ta clé SSH (hPanel, « Clés SSH ») avant l'étape « user »"
  fi
  step "Pare-feu et Docker"
  command -v ufw >/dev/null && ufw status || echo "ufw : pas encore installé"
  command -v docker >/dev/null && docker --version || echo "Docker : pas encore installé"
}

# --- user : le compte d'administration ---------------------------------------------------------
user() {
  require_root
  require_name "${1:-}"
  local name=$1
  require_supported_os

  step "Compte « $name »"
  if id "$name" >/dev/null 2>&1; then
    echo "existe déjà"
  else
    # -m : crée son dossier personnel. Aucun mot de passe : on ne se connecte que par clé SSH.
    useradd -m -s /bin/bash "$name"
    echo "créé"
  fi

  step "Clé SSH : la même que celle de root"
  [ -s /root/.ssh/authorized_keys ] || die "root n'a aucune clé SSH : ajoute la tienne d'abord (hPanel, « Clés SSH »)"
  install -d -m 700 -o "$name" -g "$name" "/home/$name/.ssh"
  local keys=/home/$name/.ssh/authorized_keys
  # sort -u : fusionne sans doublon avec les clés que le compte aurait déjà.
  {
    cat /root/.ssh/authorized_keys
    if [ -f "$keys" ]; then cat "$keys"; fi
  } | grep -v '^[[:space:]]*$' | sort -u >"$keys.new"
  install -m 600 -o "$name" -g "$name" "$keys.new" "$keys"
  rm -f "$keys.new"
  echo "$(wc -l <"$keys") clé(s)"

  step "Droits d'administration (sudo)"
  # Sans mot de passe : ce compte n'en a pas, et sa clé SSH donne de toute façon accès à Docker,
  # qui équivaut à root. Voir docs/adr/0003-hebergement.md.
  command -v sudo >/dev/null || { apt-get update -q && apt-get install -y -q sudo; }
  local rule=/etc/sudoers.d/90-$name
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$name" >"$rule.new"
  chmod 440 "$rule.new"
  # visudo -c vérifie la syntaxe : une règle sudo cassée peut bloquer toute administration.
  visudo -cq -f "$rule.new" || { rm -f "$rule.new"; die "règle sudo invalide"; }
  mv "$rule.new" "$rule"
  echo "ok"
  printf '\nÀ vérifier maintenant, dans un autre terminal : ssh %s@<IP> sudo true\n' "$name"
}

# --- lock-ssh : plus de connexion root, plus de mot de passe -----------------------------------
lock_ssh() {
  require_root
  require_name "${1:-}"
  local name=$1
  id "$name" >/dev/null 2>&1 || die "le compte « $name » n'existe pas : lancer d'abord l'étape « user »"
  [ -s "/home/$name/.ssh/authorized_keys" ] || die "« $name » n'a aucune clé SSH : on se fermerait la porte"
  if [ ! -d /etc/ssh/sshd_config.d ] || ! command -v sshd >/dev/null; then
    die "serveur SSH (sshd) introuvable"
  fi
  grep -qi '^Include /etc/ssh/sshd_config.d/' /etc/ssh/sshd_config ||
    die "/etc/ssh/sshd_config ne lit pas sshd_config.d : réglage à faire à la main"

  step "Réglages du serveur SSH"
  # Les fichiers de sshd_config.d sont lus dans l'ordre alphabétique, et pour chaque réglage
  # c'est la PREMIÈRE valeur lue qui compte : « 00- » passe avant ceux de l'hébergeur.
  local conf=/etc/ssh/sshd_config.d/00-ruche.conf
  cat >"$conf.new" <<EOF
# Écrit par infra/server/bootstrap.sh (étape lock-ssh). Ne pas modifier à la main.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers $name
X11Forwarding no
EOF
  mv "$conf.new" "$conf"
  # sshd -t vérifie toute la configuration avant de l'appliquer.
  sshd -t || { rm -f "$conf"; die "configuration SSH invalide, rien n'a été appliqué"; }
  # sshd -T affiche les réglages réellement en vigueur, après lecture de tous les fichiers.
  local effective
  effective=$(sshd -T)
  for expected in 'permitrootlogin no' 'passwordauthentication no' 'kbdinteractiveauthentication no'; do
    grep -qx "$expected" <<<"$effective" || { rm -f "$conf"; die "réglage non appliqué : $expected"; }
  done
  systemctl reload ssh 2>/dev/null || systemctl restart ssh
  echo "ok : connexion par clé seulement, pour « $name » seulement"
  printf '\nGarde cette session ouverte et vérifie dans un autre terminal :\n'
  printf '  ssh %s@<IP> true        doit marcher\n  ssh root@<IP> true       doit être refusé\n' "$name"
}

# --- base : pare-feu, mises à jour, Docker, dossier de l'appli, sauvegardes ------------------
base() {
  require_root
  require_name "${1:-}"
  local name=$1
  id "$name" >/dev/null 2>&1 || die "le compte « $name » n'existe pas : lancer d'abord l'étape « user »"
  require_supported_os
  # shellcheck source=/dev/null
  . /etc/os-release
  # Aucune question pendant les installations.
  export DEBIAN_FRONTEND=noninteractive

  step "Mises à jour et outils"
  apt-get update -q
  apt-get upgrade -y -q
  apt-get install -y -q ca-certificates curl gnupg git openssl ufw unattended-upgrades

  step "Fuseau horaire : Europe/Paris"
  timedatectl set-timezone Europe/Paris

  step "Mémoire d'appoint (swap) de 2 Go"
  # Le swap est un fichier sur le disque qui sert de mémoire de secours : si un programme a
  # besoin d'un peu plus de mémoire, le serveur ralentit au lieu d'arrêter un programme.
  if swapon --show | grep -q .; then
    echo "déjà présente"
  else
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    echo "créée"
  fi
  # N'utiliser le swap qu'en dernier recours.
  echo 'vm.swappiness=10' >/etc/sysctl.d/90-ruche.conf
  sysctl -q -p /etc/sysctl.d/90-ruche.conf

  step "Mises à jour de sécurité automatiques"
  # Chaque jour, le système installe seul ses correctifs de sécurité, et redémarre à 4 h si
  # l'un d'eux l'exige. Les conteneurs repartent seuls (restart: unless-stopped).
  cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
  cat >/etc/apt/apt.conf.d/52ruche-unattended-upgrades <<'EOF'
// Écrit par infra/server/bootstrap.sh (étape base).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
  echo "ok"

  step "Pare-feu : SSH, HTTP et HTTPS seulement"
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  # « limit » : plus de 6 connexions SSH en 30 secondes depuis une même adresse sont refusées.
  ufw limit 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
  ufw status verbose

  step "Docker, depuis son dépôt officiel"
  install -m 0755 -d /etc/apt/keyrings
  local key
  key=$(mktemp)
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o "$key"
  gpg --show-keys --with-colons "$key" | awk -F: '/^fpr:/ {print $10}' | grep -qx "$DOCKER_KEY_FINGERPRINT" ||
    die "la clé de Docker n'a pas l'empreinte attendue : installation arrêtée"
  install -m 0644 "$key" /etc/apt/keyrings/docker.asc
  rm -f "$key"
  cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: $VERSION_CODENAME
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  # Réglages de Docker :
  # - logs : 5 fichiers de 10 Mo au plus par conteneur, pour ne jamais remplir le disque ;
  # - live-restore : les conteneurs continuent de tourner pendant une mise à jour de Docker ;
  # - no-new-privileges : aucun programme d'un conteneur ne peut gagner des droits.
  local daemon=/etc/docker/daemon.json
  local wanted='{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true,
  "no-new-privileges": true
}'
  if [ "$(cat "$daemon" 2>/dev/null)" != "$wanted" ]; then
    printf '%s\n' "$wanted" >"$daemon"
    systemctl restart docker
  fi
  systemctl enable --quiet docker
  # Le groupe « docker » permet de piloter Docker sans sudo.
  usermod -aG docker "$name"
  docker --version
  docker compose version

  step "Dossier de l'appli : $RUCHE_HOME"
  install -d -m 750 -o "$name" -g "$name" "$RUCHE_HOME"
  install -d -m 700 -o "$name" -g "$name" "$RUCHE_HOME/backups"
  if [ -d "$RUCHE_HOME/repo/.git" ]; then
    echo "copie du dépôt : déjà présente"
  else
    sudo -u "$name" git clone --quiet "$REPO_URL" "$RUCHE_HOME/repo"
    echo "copie du dépôt : faite"
  fi

  step "Fichier des secrets : $RUCHE_HOME/secrets.env"
  local secrets=$RUCHE_HOME/secrets.env
  if [ -f "$secrets" ]; then
    echo "existe déjà : on n'y touche pas"
  else
    # Le modèle du dépôt, avec trois valeurs tirées au hasard ici même : le mot de passe de la
    # base, la clé des sessions et le code d'invitation. Les deux premiers ne quittent jamais le
    # serveur et ne sont jamais affichés ; le code, on le lit sur le serveur pour le donner à ses
    # proches. La clé Brevo se remplit à la main ensuite.
    install -m 600 -o "$name" -g "$name" /dev/null "$secrets"
    sed -e "s/^POSTGRES_PASSWORD=\$/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" \
      -e "s/^BETTER_AUTH_SECRET=\$/BETTER_AUTH_SECRET=$(openssl rand -hex 32)/" \
      -e "s/^SIGNUP_INVITE_CODE=\$/SIGNUP_INVITE_CODE=$(openssl rand -hex 8)/" \
      "$RUCHE_HOME/repo/infra/.env.example" >"$secrets"
    echo "créé (secrets générés, à compléter : voir docs/ops/serveur.md)"
  fi

  step "Sauvegarde chaque nuit à 3 h 30"
  # systemd lance des tâches à heure fixe avec un « minuteur » (timer) qui déclenche un
  # « service ». Persistent : si le serveur était éteint à 3 h 30, la sauvegarde se fait au réveil.
  cat >/etc/systemd/system/ruche-backup.service <<EOF
# Écrit par infra/server/bootstrap.sh (étape base).
[Unit]
Description=Sauvegarde de la base de données et des avatars
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=$name
ExecStart=$RUCHE_HOME/repo/infra/backup.sh quotidien
EOF
  cat >/etc/systemd/system/ruche-backup.timer <<'EOF'
# Écrit par infra/server/bootstrap.sh (étape base).
[Unit]
Description=Sauvegarde quotidienne

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=10min
Persistent=true

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now --quiet ruche-backup.timer
  systemctl list-timers ruche-backup.timer --no-pager

  printf '\nServeur prêt. Prochaine étape : compléter %s, puis déployer (docs/ops/serveur.md).\n' "$secrets"
}

case "${1:-}" in
check) check ;;
user) user "${2:-}" ;;
lock-ssh) lock_ssh "${2:-}" ;;
base) base "${2:-}" ;;
*) die "étape inconnue : « ${1:-} ». Étapes : check, user <nom>, lock-ssh <nom>, base <nom>" ;;
esac
