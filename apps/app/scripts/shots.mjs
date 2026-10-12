// Captures d'écran automatiques de l'appli web : le catalogue des composants et chaque écran, sur
// téléphone et sur ordinateur, de jour et de nuit. Elles servent à relire un changement d'interface
// sans lancer l'appli : la CI les joint à chaque pull request (onglet « Artifacts »).
//
// Usage : pnpm --filter @ruche/app shots            (construit l'appli puis photographie)
//         pnpm --filter @ruche/app shots --no-build (réutilise la dernière construction)
// Les images arrivent dans apps/app/shots/ (non enregistré dans Git).
//
// Pas besoin de serveur d'API : les réponses de l'API sont simulées avec les mêmes données
// d'exemple que les tests (src/testing/). Node lit ces fichiers TypeScript directement.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { leaMe } from '../src/testing/fixtures.ts'
import { recipesProject } from '../src/testing/projects.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const build = join(root, 'dist-shots')
const out = join(root, 'shots')
const apiUrl = 'http://localhost:3000' // adresse par défaut de l'API (src/config.ts)

// 1. Construire l'appli web, catalogue compris.
if (!process.argv.includes('--no-build')) {
  rmSync(build, { recursive: true, force: true })
  const result = spawnSync(
    'pnpm',
    ['exec', 'expo', 'export', '--platform', 'web', '--output-dir', build],
    { cwd: root, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_CATALOGUE: '1' } },
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// 2. La servir comme le ferait un hébergeur : /sign-in renvoie sign-in.html.
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}
// Trouve le fichier d'une adresse. Les pages à paramètre (/projects/123) sont construites une seule
// fois, sous le nom du paramètre (projects/[id].html) : un dossier ou fichier entre crochets
// correspond à n'importe quel segment.
const isFile = (path) => existsSync(path) && statSync(path).isFile()
const isDir = (path) => existsSync(path) && statSync(path).isDirectory()
const pageFor = (dir, segments) => {
  if (segments.length === 0) return isFile(join(dir, 'index.html')) ? join(dir, 'index.html') : null
  const [segment, ...rest] = segments
  // Le segment correspond à son nom exact, ou à n'importe quel nom entre crochets ([id]).
  const dynamic = readdirSync(dir)
    .filter((name) => name.startsWith('['))
    .map((name) => name.replace(/\.html$/, ''))
  for (const name of new Set([segment, ...dynamic])) {
    const path = join(dir, name)
    if (rest.length === 0 && isFile(`${path}.html`)) return `${path}.html`
    if (rest.length === 0 && isFile(path)) return path
    if (isDir(path)) {
      const found = pageFor(path, rest)
      if (found) return found
    }
  }
  return null
}
const fileFor = (url) => {
  const segments = decodeURIComponent(new URL(url, 'http://x').pathname)
    .split('/')
    .filter((s) => s !== '' && s !== '.' && s !== '..') // jamais en dehors du dossier construit
  return pageFor(build, segments) ?? join(build, '+not-found.html')
}
const server = createServer((req, res) => {
  const file = fileFor(req.url ?? '/')
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

// 3. Les réponses simulées de l'API, pour un visiteur ou pour Léa connectée.
const session = {
  session: { id: 's1', userId: leaMe.id, expiresAt: '2099-01-01T00:00:00.000Z' },
  user: { ...leaMe, image: null, updatedAt: leaMe.createdAt },
}
const fakeApi = (signedIn) => async (route) => {
  const { pathname } = new URL(route.request().url())
  const json = (status, body) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  if (pathname === '/api/auth/get-session') return json(200, signedIn ? session : null)
  if (!signedIn) return json(401, { error: { code: 'unauthorized', message: '' } })
  if (pathname === '/v1/me') return json(200, leaMe)
  if (pathname === `/v1/projects/${recipesProject.id}`) return json(200, recipesProject)
  return json(404, { error: { code: 'not_found', message: '' } })
}

// 4. Ce qu'on photographie.
const project = `/projects/${recipesProject.id}`
const pages = [
  { name: 'catalogue', path: '/catalogue', signedIn: false, fullPage: true },
  { name: 'accueil', path: '/', signedIn: false },
  { name: 'connexion', path: '/sign-in', signedIn: false },
  { name: 'inscription', path: '/sign-up', signedIn: false },
  { name: 'verifier-email', path: '/check-email?email=lea%40example.com', signedIn: false },
  { name: 'quitter', path: '/out?url=https%3A%2F%2Frecettes.vercel.app', signedIn: false },
  { name: 'accueil-connecte', path: '/', signedIn: true },
  { name: 'compte', path: '/account', signedIn: true, fullPage: true },
  { name: 'profil', path: '/profile', signedIn: true, fullPage: true },
  { name: 'publier', path: '/projects/new', signedIn: true, fullPage: true },
  { name: 'projet', path: project, signedIn: true, fullPage: true },
  { name: 'modifier', path: `${project}/edit`, signedIn: true, fullPage: true },
]
const devices = [
  { name: 'telephone', viewport: { width: 390, height: 844 } },
  { name: 'ordinateur', viewport: { width: 1440, height: 900 } },
]
const schemes = [
  { name: 'jour', colorScheme: 'light' },
  { name: 'nuit', colorScheme: 'dark' },
]

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const problems = []
for (const device of devices) {
  for (const scheme of schemes) {
    for (const signedIn of [false, true]) {
      const context = await browser.newContext({
        viewport: device.viewport,
        colorScheme: scheme.colorScheme,
        locale: 'fr-FR',
        deviceScaleFactor: 2,
      })
      await context.route(`${apiUrl}/**`, fakeApi(signedIn))
      const page = await context.newPage()
      // Une erreur dans la page (ou une page qui ne s'hydrate pas) est signalée à la fin.
      page.on('pageerror', (error) => problems.push(`${page.url()}: ${error.message}`))
      for (const shot of pages.filter((p) => p.signedIn === signedIn)) {
        await page.setViewportSize(device.viewport)
        await page.goto(base + shot.path, { waitUntil: 'networkidle' })
        await page.waitForTimeout(600) // le temps des ressorts et des fondus
        if (shot.fullPage) {
          // L'écran défile à l'intérieur de la page (ScrollView) : pour tout photographier, on
          // agrandit la fenêtre à la hauteur de son contenu.
          const height = await page.evaluate(() =>
            Math.max(...[...document.querySelectorAll('div')].map((el) => el.scrollHeight)),
          )
          await page.setViewportSize({ ...device.viewport, height: Math.min(height, 8000) })
          await page.waitForTimeout(300)
        }
        await page.screenshot({ path: join(out, `${shot.name}-${device.name}-${scheme.name}.png`) })
      }
      await context.close()
    }
  }
}
await browser.close()
server.close()

console.log(`Captures dans ${out}`)
if (problems.length > 0) {
  console.error(`Erreurs dans les pages :\n${problems.join('\n')}`)
  process.exit(1)
}
