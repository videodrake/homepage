# Claude Code Journal Stage 3 Harness Prompt

Read this file when a Codex Journal pull request has been merged into main. Execute it as the Stage 3 operator for the Cafe24 homepage repo.

## 1. Objective

A Codex Journal PR has been merged into main. Take the latest published markdown and image assets from the automation repo, convert them into this Cafe24 homepage repo, then create/merge the homepage PR and confirm GitHub Actions deployment.

The user should not run any command manually after the Codex PR is merged.

## 2. Trigger Contract

Run this prompt only when all conditions are true:

```text
Event: Pull request closed
Is merged: true
Base branch: main
Head branch starts with: codex/journal-
Labels contains: journal-ready
Is draft: false
```

Do not run this prompt for homepage PR merges. The homepage PR created by this workflow must not use the `journal-ready` label and should not use a `codex/journal-` branch name.

Codex naming contract:

```text
markdown filename: journal-XX-X.md
slug: journal-XX-X
branch: codex/journal-XX-X
label: journal-ready
```

## 3. Fixed Repo Context

```yaml
homepage_repo: "C:\\Users\\user\\homepage\\videodrake-homepage"
stage_command: "npm run journal:stage"
automation_source: "Use the defaults embedded in tools/build-journal-cafe24.mjs"
source_md_dir: "A_repo/content/published"
source_asset_dir: "A_repo/assets/<slug>"
target_html_dir: "cafe24/journal"
target_asset_dir: "cafe24/SkinImg/img/journal/<slug>"
deploy_workflow: "Deploy cafe24 skin to SFTP"
```

Do not ask the user for paths unless the adapter cannot find the source files.

## 4. Input Discovery

1. Read the triggering PR metadata if available.
2. Derive `slug` from the Codex branch name by removing `codex/`.
   - `codex/journal-02-a` -> `journal-02-a`
3. If triggering metadata is unavailable, use the latest markdown selected by `npm run journal:stage`.
4. Confirm generated output path after staging:
   - `cafe24/journal/<slug>.html`
   - `cafe24/SkinImg/img/journal/<slug>/img-N.png`

## 5. Workflow

1. Work in `homepage_repo`.
2. Update local `main` from origin.
3. Create a feature branch, for example `feat/journal-<slug>-publish`.
4. Run `npm run journal:stage`.
5. Stop if the command fails.
   - Do not bypass `regulation_check.py`.
   - Do not publish if image assets are missing.
   - Do not write a manual workaround around the adapter.
6. Run `regulation_check.py` again on `cafe24/journal/<slug>.html`.
7. Review changed files.
   - Include `cafe24/journal/<slug>.html`.
   - Include `cafe24/SkinImg/img/journal/<slug>/img-N.png`.
   - Include `cafe24/journal/index.html` when updated by the adapter.
   - Include automation repo `content/CONTENT_STATE.md` status update.
   - Include automation repo `content/CONTENT_LOG.md` publication log update.
   - Exclude unrelated untracked files.
8. Update the automation repo Git ledger.
   - `content/CONTENT_STATE.md`: set this slug to `deployed`.
   - `content/CONTENT_LOG.md`: add the Cafe24 Journal publication row or mark the planned row complete.
   - Record the live URL or generated Journal path in the log.
9. Commit and push the feature branch.
10. Create a PR into `main` and merge it.
11. Confirm GitHub Actions workflow `Deploy cafe24 skin to SFTP` succeeds.
12. Report the live URL.

## 6. Hard Rules

- The user should not have to run commands manually.
- Never push directly to `main`.
- Use feature branch -> PR -> main merge.
- If regulation check fails, stop and report the findings.
- Do not add product name, ingredient name, product CTA, footer hints, or product-page links to Journal body.
- Do not automate Naver publishing.
- Do not commit unrelated files.
- Do not run from homepage PR merges; this is only for Codex Journal PR merges.
- Do not omit Git ledger updates after successful deployment: `content/CONTENT_STATE.md` and `content/CONTENT_LOG.md`.

## 7. Stop Conditions

Stop and report without PR/merge if any condition occurs:

- `npm run journal:stage` fails.
- Source markdown is missing.
- Source image assets are missing.
- `regulation_check.py` fails before or after conversion.
- Generated HTML is missing.
- Required image files are not copied.
- GitHub PR creation or merge fails.
- GitHub Actions deploy fails.
- Git ledger update fails.

## 8. Final Report Format

```markdown
## Journal Deployment Result

- slug:
- source md:
- generated html:
- copied images:
- PR:
- Actions:
- live URL:

## Regulation Gates

- source md: PASS/FAIL
- generated html: PASS/FAIL

## Changed Files

- ...

## Excluded Files

- ...
```
