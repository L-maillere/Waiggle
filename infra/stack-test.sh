#!/usr/bin/env bash
# Essai complet de la pile de production, lancé par la CI à chaque pull request.
# On démarre la base, l'API et la porte d'entrée web avec le vrai docker-compose.yml et les vrais
# scripts du serveur (lib.sh, backup.sh, restore.sh), mais pour localhost et dans un dossier
# temporaire. Puis on vérifie, comme le ferait un visiteur :
#   - chaque adresse de l'appli mène à la bonne page, une adresse inconnue à « introuvable » (404) ;
#   - les en-têtes de sécurité et de cache ;
#   - les redirections (HTTP vers HTTPS, www) ;
#   - l'API derrière Caddy ;
#   - une visite dans un vrai navigateur (apps/app/scripts/site-check.mjs) ;
#   - une sauvegarde suivie d'une restauration rend exactement les données sauvegardées.
#
# Usage (depuis la racine du dépôt) : infra/stack-test.sh
# Demande Docker, les dépendances (pnpm install) et Chromium
# (pnpm --filter @ruche/app exec playwright install chromium).
# Tout est supprimé à la fin.
set -euo pipefail

WORK=$(mktemp -d)
export RUCHE_HOME=$WORK
export RUCHE_REPO=$PWD
export RUCHE_SITE_ENV=$WORK/site.env
# shellcheck source=infra/lib.sh
source infra/lib.sh

cleanup() {
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Échoue avec un message si deux valeurs diffèrent.
expect() {
  [ "$2" = "$3" ] || die "$1 : attendu « $3 », obtenu « $2 »"
}

# curl vers notre serveur local : les noms (localhost, api.localhost, www.localhost) mènent à
# cette machine, et -k accepte le certificat de Caddy, signé par sa propre autorité locale.
web() {
  curl -sS -k --max-time 20 \
    --resolve localhost:443:127.0.0.1 --resolve localhost:80:127.0.0.1 \
    --resolve api.localhost:443:127.0.0.1 --resolve www.localhost:443:127.0.0.1 "$@"
}

# Le nombre de membres dans la base.
members() {
  # shellcheck disable=SC2016 # les $ sont lus par le shell du conteneur
  compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from \"user\""'
}

# Inscrit un membre par l'API, en passant par Caddy, puis clique sur le lien de vérification
# (en développement, les e-mails sont écrits dans les logs de l'API).
sign_up() {
  web -f -o /dev/null -X POST https://api.localhost/api/auth/sign-up/email \
    -H 'Content-Type: application/json' -H 'Origin: https://localhost' \
    -d "{\"name\":\"Essai\",\"email\":\"$1\",\"password\":\"stack-test-password\"}"
  sleep 1
  local link
  link=$(compose logs api 2>&1 | grep -o 'https://api.localhost/api/auth/verify-email[^ ]*' | tail -1)
  [ -n "$link" ] || die "lien de vérification introuvable pour $1"
  web -o /dev/null "$link"
}

step "Préparation : adresses locales, secrets tirés au hasard"
printf 'APP_DOMAIN=localhost\nAPI_DOMAIN=api.localhost\nIMAGE_PREFIX=ruche-stack-test\n' >"$RUCHE_SITE_ENV"
# Le même modèle et les mêmes commandes que infra/server/bootstrap.sh sur le serveur.
sed -e "s/^POSTGRES_PASSWORD=\$/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" \
  -e "s/^BETTER_AUTH_SECRET=\$/BETTER_AUTH_SECRET=$(openssl rand -hex 32)/" \
  infra/.env.example >"$RUCHE_SECRETS"
printf 'RUCHE_VERSION=stack-test\n' >"$RUCHE_DEPLOYED"

step "Construction des images et démarrage"
compose up -d --build --wait --wait-timeout 300
compose ps

step "L'API répond derrière Caddy, avec la version déployée"
# Caddy fabrique ses certificats locaux au démarrage : on lui laisse quelques secondes.
for _ in $(seq 1 30); do web -f -o /dev/null https://api.localhost/health 2>/dev/null && break; sleep 1; done
expect "version de l'API" "$(web -f https://api.localhost/health | node -e 'process.stdin.on("data", (d) => console.log(JSON.parse(d).version))')" stack-test

step "Chaque adresse mène à sa page"
# Le contenu attendu est lu directement dans l'image web, là où Caddy le prend.
page_in_image() {
  docker run --rm --entrypoint cat ruche-stack-test-web:stack-test "/srv/app/$1"
}
while read -r path file; do
  status=$(web -o "$WORK/body" -w '%{http_code}' "https://localhost$path")
  expect "code HTTP de $path" "$status" 200
  page_in_image "$file" | cmp -s - "$WORK/body" || die "$path ne sert pas $file"
  echo "ok : $path → $file"
done <<'EOF'
/ index.html
/sign-in sign-in.html
/sign-up sign-up.html
/account account.html
/account/delete account/delete.html
/projects/new projects/new.html
/projects/0192abcd-ef01-7c2d-9e3f-a1b2c3d4e5f6 projects/[id].html
/projects/0192abcd-ef01-7c2d-9e3f-a1b2c3d4e5f6/edit projects/[id]/edit.html
EOF

step "Une adresse inconnue mène à « introuvable », avec le code 404"
page_in_image +not-found.html >"$WORK/not-found"
for path in /nope /projects /projects/a/b/c /sign-in/extra /_sitemap /catalogue.php; do
  status=$(web -o "$WORK/body" -w '%{http_code}' "https://localhost$path")
  expect "code HTTP de $path" "$status" 404
  cmp -s "$WORK/not-found" "$WORK/body" || die "$path ne sert pas la page introuvable"
  echo "ok : $path → 404"
done

step "En-têtes de sécurité et de cache"
headers_of() {
  web -o /dev/null -D - "$@" | tr -d '\r' | tr '[:upper:]' '[:lower:]'
}
for url in https://localhost/ https://localhost/nope; do
  h=$(headers_of "$url")
  for expected in \
    "strict-transport-security: max-age=31536000; includesubdomains" \
    "x-content-type-options: nosniff" \
    "x-frame-options: deny" \
    "referrer-policy: strict-origin-when-cross-origin" \
    "cache-control: no-cache"; do
    grep -qx "$expected" <<<"$h" || die "$url : en-tête manquant « $expected »"
  done
  grep -q "^content-security-policy: default-src 'self'; script-src 'self' 'sha256-" <<<"$h" ||
    die "$url : CSP manquante"
  grep -q "connect-src 'self' https://api.localhost;" <<<"$h" || die "$url : la CSP n'autorise pas l'API"
  if grep -q '^server:' <<<"$h"; then die "$url : Caddy annonce son nom"; fi
  echo "ok : $url"
done
script=$(web https://localhost/ | grep -o '/_expo/static/js/web/[^"]*\.js' | head -1)
[ -n "$script" ] || die "aucun script trouvé dans la page d'accueil"
grep -qx 'cache-control: public, max-age=31536000, immutable' <<<"$(headers_of "https://localhost$script")" ||
  die "$script : devrait être gardé un an par le navigateur"
echo "ok : $script gardé un an"

step "Redirections"
expect "HTTP → HTTPS" "$(web -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost/sign-in)" \
  "308 https://localhost/sign-in"
expect "www → domaine" "$(web -o /dev/null -w '%{http_code} %{redirect_url}' 'https://www.localhost/sign-in?a=1')" \
  "301 https://localhost/sign-in?a=1"
echo "ok"

step "Les fichiers de la porte d'entrée ne peuvent pas être modifiés"
if compose exec -T web touch /srv/app/probe 2>/dev/null; then die "/srv/app est modifiable"; fi
echo "ok"

step "Dans un vrai navigateur : rien n'est bloqué par la CSP, aucune erreur dans les pages"
# Demande l'installation des dépendances (pnpm install) et de Chromium (voir la CI).
node apps/app/scripts/site-check.mjs https://localhost

step "Sauvegarde, puis restauration"
sign_up avant@example.com
compose exec -T api node -e "require('fs').writeFileSync('/app/media/avant.txt', 'x')"
expect "membres avant la sauvegarde" "$(members)" 1
infra/backup.sh essai
backup=$(find "$RUCHE_BACKUPS" -name '*-essai.db.dump' | head -1)
backup=${backup%.db.dump}
expect "droits de la sauvegarde" "$(stat -c '%a' "$backup.db.dump") $(stat -c '%a' "$backup.media.tar.gz")" "600 600"
# Des changements après la sauvegarde : ils doivent disparaître à la restauration.
sign_up apres@example.com
compose exec -T api node -e "require('fs').rmSync('/app/media/avant.txt'); require('fs').writeFileSync('/app/media/apres.txt', 'x')"
expect "membres après la sauvegarde" "$(members)" 2
if infra/restore.sh "$backup" 2>/dev/null; then die "la restauration doit exiger une confirmation"; fi
infra/restore.sh "$backup" --effacer-les-donnees-actuelles
expect "membres après la restauration" "$(members)" 1
compose exec -T api sh -c 'test -f /app/media/avant.txt' || die "avatar sauvegardé absent après restauration"
if compose exec -T api sh -c 'test -f /app/media/apres.txt'; then die "fichier postérieur toujours là"; fi
[ -n "$(find "$RUCHE_BACKUPS" -name '*-avant-restauration.db.dump')" ] || die "pas de sauvegarde avant restauration"
expect "version après restauration" "$(web -f https://api.localhost/health | node -e 'process.stdin.on("data", (d) => console.log(JSON.parse(d).version))')" stack-test
echo "ok"

printf '\n✅ Pile de production prête : pages, en-têtes, redirections, sauvegarde et restauration.\n'
