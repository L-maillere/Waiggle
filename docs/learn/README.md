# Leçons

Une leçon par fonctionnalité, pour apprendre le code de Ruche pas à pas. Chaque leçon existe en
Markdown (lisible sur GitHub) et en PDF.

| Leçon | Sujet |
| --- | --- |
| [00 — Le socle](00-le-socle.md) | Monorepo, TypeScript, tests, traductions, API, appli, CI |
| [01 — Les comptes](01-les-comptes.md) | Inscription, vérification de l'e-mail, connexion, suppression |
| [02 — Le profil](02-le-profil.md) | Profil, photo nettoyée, images piégées, langue sur tous les appareils |
| [03 — Publier un projet](03-publier-un-projet.md) | Qui voit quoi, liens sûrs, Markdown sans danger, textes piégés |

## Générer un PDF

```bash
pip install -r docs/learn/requirements.txt
python3 docs/learn/build.py docs/learn/00-le-socle.md
```

Il faut aussi les polices Inter et DejaVu Sans Mono installées sur la machine (sinon, des polices
de remplacement sont utilisées).
