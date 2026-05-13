# Claude Code Journal Stage 3 Prompt

Read this file when a Codex Journal pull request has been merged into main. Execute it as the Stage 3 operator for the Cafe24 homepage repo.

## Objective

A Codex Journal PR has been merged into main. Take the latest published markdown and image assets from the automation repo, convert them into this Cafe24 homepage repo, then create/merge the homepage PR and confirm GitHub Actions deployment.

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
trigger_event: "Pull request closed"
trigger_is_merged: true
trigger_base_branch: "main"
trigger_head_branch_prefix: "codex/journal-"
trigger_label: "journal-ready"
trigger_is_draft: false
```

Do not ask the user for paths unless the adapter cannot find the source files.

## Trigger Contract

This prompt must be run only for Codex Journal PR merges with all of these conditions:

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
- Do not run from homepage PR merges; this is only for Codex Journal PR merges.

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
