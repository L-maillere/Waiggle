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
#   ssh louis@<IP> 'sudo bash -s -- offsite louis' < infra/server/bootstrap.sh
#       le compte qui laisse le PC copier les sauvegardes chiffrées (après le premier déploiement)
#
# « bash -s » lit le script sur l'entrée standard : rien n'a besoin d'être copié sur le serveur.
# Chaque étape peut être relancée sans dégâts : elle ne refait que ce qui manque.
set -euo pipefail

# L'empreinte de la clé qui signe les paquets Docker (publiée sur docs.docker.com). On vérifie
# que la clé téléchargée est bien celle-là avant de lui faire confiance.
DOCKER_KEY_FINGERPRINT=9DC858229FC7DD38854AE2D88D81803C0EBFCD88
REPO_URL=https://github.com/L-maillere/Waiggle.git
RUCHE_HOME=/srv/ruche
# Les réglages du serveur SSH écrits par ce script (étapes lock-ssh et offsite).
SSH_MAIN_CONF=/etc/ssh/sshd_config.d/00-ruche.conf
SSH_OFFSITE_CONF=/etc/ssh/sshd_config.d/10-ruche-sauvegarde.conf
# Le compte qui ne sert qu'à laisser le PC copier les sauvegardes chiffrées (étape offsite), le
# dossier où il est enfermé, et la liste des clés qui peuvent s'en servir.
OFFSITE_USER=sauvegarde
OFFSITE_ROOT=/srv/sauvegardes-chiffrees
OFFSITE_KEYS=/etc/ssh/ruche-sauvegarde.keys

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

# Les réglages principaux du serveur SSH. Les étapes lock-ssh et offsite l'écrivent toutes les
# deux, à l'identique : relancer l'une ne défait pas l'autre. Les fichiers de sshd_config.d sont
# lus dans l'ordre alphabétique, et pour chaque réglage c'est la PREMIÈRE valeur lue qui compte :
# « 00- » passe avant ceux de l'hébergeur.
write_ssh_main_conf() {
  local name=$1 allowed=$1
  # AllowUsers : les seuls comptes qui peuvent se connecter. « sauvegarde » n'en fait partie que
  # si ses limites existent (10-ruche-sauvegarde.conf, étape offsite) : jamais l'un sans l'autre.
  if [ -f "$SSH_OFFSITE_CONF" ] && id "$OFFSITE_USER" >/dev/null 2>&1; then allowed="$allowed $OFFSITE_USER"; fi
  cat >"$SSH_MAIN_CONF.new" <<EOF
# Écrit par infra/server/bootstrap.sh (étapes lock-ssh et offsite). Ne pas modifier à la main.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers $allowed
X11Forwarding no
EOF
  mv "$SSH_MAIN_CONF.new" "$SSH_MAIN_CONF"
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
  # Les réglages d'avant (s'il y en a), mis de côté pour les remettre tels quels au moindre
  # problème. Les supprimer rendrait la main aux réglages de l'hébergeur (root, mots de passe).
  if [ -f "$SSH_MAIN_CONF" ]; then cp -p "$SSH_MAIN_CONF" "$SSH_MAIN_CONF.avant"; fi
  undo_lock_ssh() {
    if [ -f "$SSH_MAIN_CONF.avant" ]; then mv "$SSH_MAIN_CONF.avant" "$SSH_MAIN_CONF"; else rm -f "$SSH_MAIN_CONF"; fi
    die "$1 ; les réglages SSH d'avant sont remis, rien n'a été appliqué"
  }
  write_ssh_main_conf "$name"
  # sshd -t vérifie toute la configuration avant de l'appliquer.
  sshd -t || undo_lock_ssh "configuration SSH invalide"
  # sshd -T affiche les réglages réellement en vigueur, après lecture de tous les fichiers.
  local effective
  effective=$(sshd -T) || undo_lock_ssh "sshd -T a échoué"
  for expected in 'permitrootlogin no' 'passwordauthentication no' 'kbdinteractiveauthentication no'; do
    grep -qx "$expected" <<<"$effective" || undo_lock_ssh "réglage non appliqué : $expected"
  done
  rm -f "$SSH_MAIN_CONF.avant"
  systemctl reload ssh 2>/dev/null || systemctl restart ssh
  echo "ok : connexion par clé seulement, pour « $name » seulement (et « $OFFSITE_USER » s'il existe)"
  printf '\nVérifie maintenant (une session root déjà ouverte reste ouverte, en cas de problème) :\n'
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
  # Chaque jour, le système installe seul ses correctifs de sécurité (et les mises à jour de
  # Docker), et redémarre à 4 h si l'un d'eux l'exige. Les conteneurs repartent seuls
  # (restart: unless-stopped ; live-restore pendant une mise à jour de Docker).
  cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
  cat >/etc/apt/apt.conf.d/52ruche-unattended-upgrades <<'EOF'
// Écrit par infra/server/bootstrap.sh (étape base).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
// Docker aussi : ses correctifs de sécurité (runc, containerd) n'attendent pas.
Unattended-Upgrade::Origins-Pattern:: "origin=Docker,label=Docker CE";
EOF
  echo "ok"

  step "Pare-feu : SSH, HTTP et HTTPS seulement"
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  # SSH n'accepte que les clés : deviner un mot de passe est impossible. On n'ajoute donc pas de
  # limite de connexions (« ufw limit »), qui bloquerait les séries de commandes de Claude Code.
  ufw allow 22/tcp >/dev/null
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
  # Une seule clé principale (« pub »), et son empreinte (la ligne « fpr » qui la suit) doit être
  # exactement celle attendue. Un fichier qui contiendrait une clé de plus est refusé.
  local fingerprints
  fingerprints=$(gpg --show-keys --with-colons "$key" | awk -F: '/^pub:/ {getline; print $10}')
  [ "$fingerprints" = "$DOCKER_KEY_FINGERPRINT" ] ||
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

  step "IPv6 : garder la route annoncée par l'hébergeur"
  # Docker active le routage IPv6 (le réseau de la porte d'entrée parle IPv6). Un serveur qui
  # route n'écoute plus, par défaut, les « annonces de routeur » qui lui donnent sa route IPv6 :
  # il perdrait l'IPv6 au bout de quelques heures. accept_ra=2 les écoute quand même.
  local iface
  iface=$(ip -6 route show default 2>/dev/null |
    awk '/proto ra/ {for (i = 1; i < NF; i++) if ($i == "dev") {print $(i + 1); exit}}')
  if [ -n "$iface" ]; then
    echo "net.ipv6.conf.$iface.accept_ra=2" >/etc/sysctl.d/91-ruche-ipv6.conf
    sysctl -q -p /etc/sysctl.d/91-ruche-ipv6.conf
    echo "ok : annonces écoutées sur $iface"
  else
    echo "route IPv6 fixe, sans annonces de routeur : rien à faire"
  fi

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

# --- offsite : laisser le PC copier les sauvegardes chiffrées ----------------------------------
# Chaque nuit, backup.sh dépose une copie chiffrée de la sauvegarde dans $OFFSITE_ROOT/copies
# (infra/offsite/export.sh). Le PC de Louis vient la chercher avec le compte « sauvegarde », qui ne
# peut que lire ce dossier. Se lance après un déploiement qui contient la clé de téléchargement
# du PC (infra/offsite/download.pub). Relançable : c'est aussi comme ça qu'on change cette clé.
offsite() {
  require_root
  require_name "${1:-}"
  local name=$1
  id "$name" >/dev/null 2>&1 || die "le compte « $name » n'existe pas : lancer d'abord l'étape « user »"
  require_supported_os
  [ -f "$SSH_MAIN_CONF" ] || die "lancer d'abord l'étape « lock-ssh »"
  local pub=$RUCHE_HOME/repo/infra/offsite/download.pub

  step "Outil de chiffrement : age"
  if ! command -v age >/dev/null; then
    apt-get update -q
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q age
  fi
  age --version

  step "Clé de téléchargement du PC"
  [ -f "$pub" ] || die "introuvable : $pub (déployer d'abord une version qui la contient)"
  # Les lignes utiles : ni vides, ni commentaires. tr retire un éventuel retour chariot Windows.
  local keys line
  keys=$(grep -vE '^[[:space:]]*(#|$)' "$pub" | tr -d '\r' || true)
  [ -n "$keys" ] || die "aucune clé dans $pub : y ajouter la clé publique de téléchargement du PC"
  : >"$OFFSITE_KEYS.new"
  while IFS= read -r line; do
    # Une clé ed25519 et son commentaire, rien d'autre : une option glissée en début de ligne
    # (command=…, from=…) changerait ce que la clé a le droit de faire.
    if [[ ! $line =~ ^ssh-ed25519\ [A-Za-z0-9+/]+=*(\ [^[:cntrl:]]*)?$ ]] ||
      ! ssh-keygen -l -f /dev/stdin <<<"$line" >/dev/null 2>&1; then
      rm -f "$OFFSITE_KEYS.new"
      die "ligne inattendue dans $pub (une clé ssh-ed25519 par ligne) : $line"
    fi
    # restrict : ni terminal, ni tunnel, ni redirection, même si un réglage venait à l'oublier.
    printf 'restrict %s\n' "$line" >>"$OFFSITE_KEYS.new"
  done <<<"$keys"
  # Le fichier appartient à root : le compte « sauvegarde » ne peut pas y ajouter de clé.
  install -m 644 -o root -g root "$OFFSITE_KEYS.new" "$OFFSITE_KEYS"
  rm -f "$OFFSITE_KEYS.new"
  ssh-keygen -l -f "$OFFSITE_KEYS"

  step "Compte « $OFFSITE_USER »"
  if id "$OFFSITE_USER" >/dev/null 2>&1; then
    echo "existe déjà"
  else
    # --system : un compte de service, sans mot de passe ni dossier personnel. nologin : même
    # si une connexion lui donnait un terminal, il n'aurait aucun programme à lancer.
    useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$OFFSITE_USER"
    echo "créé"
  fi

  step "Dossier des copies chiffrées : $OFFSITE_ROOT/copies"
  # Le compte y est enfermé (« chroot ») : pour lui, $OFFSITE_ROOT devient la racine, et le
  # reste du serveur n'existe pas. SSH l'exige : ce dossier appartient à root, et personne
  # d'autre ne peut y écrire. Le sous-dossier « copies » appartient à « $name », qui y dépose
  # les copies (backup.sh tourne sous son nom) ; les autres peuvent seulement le lire.
  install -d -m 755 -o root -g root "$OFFSITE_ROOT"
  install -d -m 755 -o "$name" -g "$name" "$OFFSITE_ROOT/copies"
  echo "ok"

  step "Réglages du serveur SSH"
  # Les réglages d'avant, mis de côté pour pouvoir les remettre tels quels au moindre problème.
  cp -p "$SSH_MAIN_CONF" "$SSH_MAIN_CONF.avant"
  if [ -f "$SSH_OFFSITE_CONF" ]; then cp -p "$SSH_OFFSITE_CONF" "$SSH_OFFSITE_CONF.avant"; fi
  undo_offsite_ssh() {
    mv "$SSH_MAIN_CONF.avant" "$SSH_MAIN_CONF"
    if [ -f "$SSH_OFFSITE_CONF.avant" ]; then
      mv "$SSH_OFFSITE_CONF.avant" "$SSH_OFFSITE_CONF"
    else
      rm -f "$SSH_OFFSITE_CONF"
    fi
    die "$1 ; les réglages SSH d'avant sont remis, rien n'a été appliqué"
  }
  # Match User : ces réglages-là ne valent que pour le compte « sauvegarde ».
  # - ForceCommand internal-sftp : quoi qu'il demande, il n'obtient que le transfert de fichiers
  #   (SFTP) intégré à SSH ; -R : en lecture seule ; -d : il arrive directement dans « copies ».
  # - ChrootDirectory : enfermé dans $OFFSITE_ROOT.
  # - AuthorizedKeysFile : ses clés sont dans un fichier de root, qu'il ne peut pas modifier ; et
  #   aucun autre moyen de trouver des clés (AuthorizedKeysCommand none).
  # - DisableForwarding : aucun tunnel d'aucune sorte ; PermitTTY no : aucun terminal.
  # Les limites d'abord, l'accès ensuite : AllowUsers ne l'admet que si ce fichier existe.
  cat >"$SSH_OFFSITE_CONF" <<EOF
# Écrit par infra/server/bootstrap.sh (étape offsite). Ne pas modifier à la main.
# Le compte « $OFFSITE_USER » ne sert qu'au PC de Louis, pour copier les sauvegardes chiffrées.
Match User $OFFSITE_USER
  AuthorizedKeysFile $OFFSITE_KEYS
  AuthorizedKeysCommand none
  ChrootDirectory $OFFSITE_ROOT
  ForceCommand internal-sftp -R -d /copies
  DisableForwarding yes
  AllowTcpForwarding no
  AllowAgentForwarding no
  AllowStreamLocalForwarding no
  PermitTunnel no
  PermitTTY no
  X11Forwarding no
EOF
  write_ssh_main_conf "$name"
  sshd -t || undo_offsite_ssh "configuration SSH invalide"
  # sshd -T -C : les réglages en vigueur pour une connexion donnée. On vérifie les deux comptes :
  # « sauvegarde » est bien bridé, et « $name » ne l'est pas (sinon, plus d'administration).
  local for_backup for_admin expected
  for_backup=$(sshd -T -C "user=$OFFSITE_USER,host=pc,addr=192.0.2.1") || undo_offsite_ssh "sshd -T a échoué"
  for_admin=$(sshd -T -C "user=$name,host=pc,addr=192.0.2.1") || undo_offsite_ssh "sshd -T a échoué"
  for expected in "chrootdirectory $OFFSITE_ROOT" 'forcecommand internal-sftp -R -d /copies' \
    "authorizedkeysfile $OFFSITE_KEYS" 'authorizedkeyscommand none' 'disableforwarding yes' \
    'allowtcpforwarding no' 'allowagentforwarding no' 'allowstreamlocalforwarding no' \
    'permittunnel no' 'permittty no' 'x11forwarding no' 'passwordauthentication no'; do
    grep -qxF "$expected" <<<"$for_backup" || undo_offsite_ssh "réglage non appliqué pour « $OFFSITE_USER » : $expected"
  done
  for expected in 'chrootdirectory none' 'forcecommand none' 'permitrootlogin no' 'passwordauthentication no'; do
    grep -qxF "$expected" <<<"$for_admin" || undo_offsite_ssh "réglage inattendu pour « $name » : il faudrait $expected"
  done
  grep -qxF "allowusers $OFFSITE_USER" <<<"$for_backup" || undo_offsite_ssh "« $OFFSITE_USER » n'est pas admis par AllowUsers"
  rm -f "$SSH_MAIN_CONF.avant" "$SSH_OFFSITE_CONF.avant"
  systemctl reload ssh 2>/dev/null || systemctl restart ssh
  echo "ok : « $OFFSITE_USER » peut lire $OFFSITE_ROOT/copies, et rien d'autre"
  printf '\nSur le PC : installer la copie quotidienne (docs/ops/serveur.md, « Copie hors du serveur »).\n'
}

case "${1:-}" in
check) check ;;
user) user "${2:-}" ;;
lock-ssh) lock_ssh "${2:-}" ;;
base) base "${2:-}" ;;
offsite) offsite "${2:-}" ;;
*) die "étape inconnue : « ${1:-} ». Étapes : check, user <nom>, lock-ssh <nom>, base <nom>, offsite <nom>" ;;
esac
