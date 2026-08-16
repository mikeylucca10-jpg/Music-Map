# Vendored design skills

Third-party design skills, installed 2026-08-16. **Gitignored** — ~10MB of
tooling, not app code. This file documents how to reinstall them.

| Skill | Source | License |
|---|---|---|
| `taste-skill`, `redesign-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache 2.0 |
| `design-md-library` | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | MIT |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT |

Reinstall by cloning each repo and copying the skill directory out of it —
`skills/<name>` for taste-skill, `.claude/skills/<name>` for the other two.
`design-md-library/SKILL.md` is hand-written for this project and is the one
file here not copied from upstream — recreate it from git history if lost.

## Deliberate omissions

**Impeccable's hooks are NOT installed.** Upstream writes a `PostToolUse` +
`Stop` hook into `.claude/settings.local.json` that runs its detector on every
single `Edit`/`Write`. The script itself is fine — local-only, no network, always
exits 0 — but it fires on *every* edit including backend, config, and test files,
which is latency on every turn for a check that only matters on UI work. The
skill is fully usable when invoked directly. To opt in, copy the `hooks` block
from upstream's `.claude/settings.json`. Requires Node ≥22 (v24 is installed).

**`ui-ux-pro-max`'s search engine needs Python, which is not installed** on this
machine. `scripts/search.py` provides BM25 ranking over `data/*.csv`. Without
Python those CSVs are still readable directly, so the skill degrades to manual
lookup rather than breaking. Install Python 3 to get real search.

**`npxskillui` is not here, because it is not a skill.** It is an on-demand CLI
that reverse-engineers a design system from a URL and *generates* a skill.
Nothing to install; run it when wanted:

```
npx skillui --url https://example.com
```

## Scope caveat

These are all written for **web/CSS**. This app is **React Native** — hover
states, `box-shadow`, CSS custom properties, and `rem` units do not transfer.
`taste-skill` further scopes itself to "landing pages, portfolios, and
redesigns... not multi-step product UI," which is exactly what this app is.

Treat all of them as *advisory*. `CLAUDE.md` and `src/constants/theme.ts` remain
the source of truth for this project's design decisions, and those decisions
(dark-only palette, the two non-interchangeable accent tokens, the retained
`Radius` scale) were made deliberately and are documented with their reasoning.
