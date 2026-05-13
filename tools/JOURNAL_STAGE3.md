# Journal Stage 3 Adapter

This repo is the Cafe24 skin repo. This adapter is intended to be run by Claude Code, not by the user.

Canonical prompt file in this git repo: `docs/CLAUDE_CODE_JOURNAL_STAGE3_PROMPT.md`.

User workflow:

1. User reviews the Claude Project markdown draft.
2. User gives the reviewed markdown to Codex.
3. Codex generates images, creates `content/published/<slug>.md`, commits, and pushes.
4. Claude Code runs this adapter, opens/merges the PR, and confirms GitHub Actions deployment.

## Claude Code Commands

Stage the latest published markdown into Cafe24 files:

```powershell
npm run journal:stage
```

This automatically:

- finds the latest markdown in `A_repo/content/published/`
- derives the slug from the filename
- runs `regulation_check.py`
- writes `cafe24/journal/<slug>.html`
- copies images to `cafe24/SkinImg/img/journal/<slug>/`

Preview without touching `cafe24/`:

```powershell
npm run journal:preview
```

## Output

`journal:stage` writes:

- `cafe24/journal/<slug>.html`
- `cafe24/SkinImg/img/journal/<slug>/img-N.png`

The slug is taken from the markdown filename. For example, `journal-01-a.md` becomes `journal-01-a`.

## Specific File

Use this only when the latest file is not the intended target:

```powershell
node tools/build-journal-cafe24.mjs <full-md-path> --write-cafe24
```

Do not bypass `regulation_check.py`. If it fails, the page is not written or published.
