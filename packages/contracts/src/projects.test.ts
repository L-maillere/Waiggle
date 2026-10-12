// Tests des règles d'un projet : ce qu'un membre peut publier, et quels liens de démo sont acceptés.
import { describe, expect, it } from 'vitest'
import { DemoUrl, ProjectInput, ProjectUpdate } from './projects'

const valid = {
  title: 'Mon agent de recettes',
  pitch: 'Il propose un menu avec ce qu’il y a au frigo.',
}

describe('ProjectInput', () => {
  it('only needs a title and a pitch', () => {
    expect(ProjectInput.parse(valid)).toEqual(valid)
  })

  it('refuses a title longer than 80 characters or a pitch longer than 140', () => {
    expect(ProjectInput.safeParse({ ...valid, title: 'a'.repeat(81) }).success).toBe(false)
    expect(ProjectInput.safeParse({ ...valid, pitch: 'a'.repeat(141) }).success).toBe(false)
  })

  it('keeps the pitch on a single line', () => {
    expect(ProjectInput.safeParse({ ...valid, pitch: 'Ligne 1\nLigne 2' }).success).toBe(false)
  })

  it('accepts a Markdown description of up to 10 000 characters', () => {
    expect(
      ProjectInput.safeParse({ ...valid, description: '# Titre\n\n- un\n- deux' }).success,
    ).toBe(true)
    expect(ProjectInput.safeParse({ ...valid, description: 'a'.repeat(10_001) }).success).toBe(
      false,
    )
  })

  it('only accepts the known statuses, visibilities and time spans', () => {
    expect(ProjectInput.safeParse({ ...valid, status: 'testable' }).success).toBe(true)
    expect(ProjectInput.safeParse({ ...valid, status: 'abandonné' }).success).toBe(false)
    expect(ProjectInput.safeParse({ ...valid, visibility: 'friends' }).success).toBe(false)
    expect(ProjectInput.safeParse({ ...valid, timeSpent: 'weekend' }).success).toBe(true)
    expect(ProjectInput.safeParse({ ...valid, timeSpent: '3h' }).success).toBe(false)
  })

  it('removes duplicate tools and empty prompts, within their limits', () => {
    expect(
      ProjectInput.parse({
        ...valid,
        tools: ['Claude', 'claude', 'Cursor'],
        prompts: ['Fais…', '  '],
      }),
    ).toMatchObject({ tools: ['Claude', 'Cursor'], prompts: ['Fais…'] })
    const tools = Array.from({ length: 16 }, (_, i) => `Outil ${i}`)
    expect(ProjectInput.safeParse({ ...valid, tools }).success).toBe(false)
    expect(
      ProjectInput.safeParse({ ...valid, prompts: ['a', 'b', 'c', 'd', 'e', 'f'] }).success,
    ).toBe(false)
  })

  it('refuses any field it does not know, such as the author', () => {
    expect(ProjectInput.safeParse({ ...valid, authorId: 'someone-else' }).success).toBe(false)
  })
})

describe('ProjectUpdate', () => {
  it('accepts a change of a single field, and removing the demo link', () => {
    expect(ProjectUpdate.parse({ status: 'done' })).toEqual({ status: 'done' })
    expect(ProjectUpdate.parse({ demoUrl: null })).toEqual({ demoUrl: null })
  })
})

describe('DemoUrl', () => {
  const accepted = (url: string) => DemoUrl.safeParse(url).success

  it('accepts a public https address', () => {
    expect(accepted('https://mon-agent.vercel.app')).toBe(true)
    expect(accepted('https://huggingface.co/spaces/lea/recettes?lang=fr')).toBe(true)
  })

  it('refuses anything but https', () => {
    expect(accepted('http://mon-agent.vercel.app')).toBe(false)
    expect(accepted('javascript:alert(1)')).toBe(false)
    expect(accepted('ftp://example.com/demo')).toBe(false)
    expect(accepted('pas une adresse')).toBe(false)
  })

  it('refuses local and private machines', () => {
    for (const url of [
      'https://localhost:3000',
      'https://localhost.',
      'https://api.localhost',
      'https://imprimante.local',
      'https://nas.home.arpa',
      'https://wiki.internal',
      'https://intranet', // un nom sans point ne désigne qu'une machine du réseau local
    ]) {
      expect(accepted(url), url).toBe(false)
    }
  })

  it('refuses IP addresses, however they are written', () => {
    for (const url of [
      'https://192.168.1.1',
      'https://127.0.0.1',
      'https://0x7f.1', // 127.0.0.1 écrit en hexadécimal
      'https://2130706433', // 127.0.0.1 écrit comme un seul nombre
      'https://[::1]',
      'https://[::ffff:10.0.0.1]',
      'https://[fe80::1]',
      'https://8.8.8.8', // même publique : un nom de domaine est demandé
    ]) {
      expect(accepted(url), url).toBe(false)
    }
  })

  it('refuses an address that hides a login, often used to disguise the real site', () => {
    // « https://ruche.app@pirate.example » mène en réalité à pirate.example.
    expect(accepted('https://ruche.app@pirate.example')).toBe(false)
  })
})
