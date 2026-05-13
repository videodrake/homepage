# Claude Code Journal Stage 3 Prompt

Read this file when Codex has pushed a new Journal result. Execute it as the Stage 3 operator for the Cafe24 homepage repo.

## Objective

Codex has pushed a completed Journal result. Take the latest published markdown and image assets from the automation repo, convert them into this Cafe24 homepage repo, then create/merge the PR and confirm GitHub Actions deployment.

## Fixed Repo Context

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

## Workflow

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
   - Exclude unrelated untracked files.
8. Commit and push the feature branch.
9. Create a PR into `main` and merge it.
10. Confirm GitHub Actions workflow `Deploy cafe24 skin to SFTP` succeeds.
11. Report the live URL.

## Hard Rules

- The user should not have to run commands manually.
- Never push directly to `main`.
- Use feature branch -> PR -> main merge.
- If regulation check fails, stop and report the findings.
- Do not add product name, ingredient name, product CTA, footer hints, or product-page links to Journal body.
- Do not automate Naver publishing.
- Do not commit unrelated files.

## Final Report Format

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
