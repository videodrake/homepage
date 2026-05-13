# Journal Automation Files

This folder contains the Git-readable reference files for the 지구력코어 Journal automation workflow.

## Claude Project Setup

Use this file as the Claude Project Custom Instructions:

- `docs/journal-automation/CLAUDE_PROJECT_CUSTOM_INSTRUCTIONS.md`

Upload these files to Claude Project Knowledge when Git-connected reading is not enough:

- `docs/journal-automation/project_knowledge/자리1_운영흐름_가이드.md`
- `docs/journal-automation/project_knowledge/자리1_출력사양.md`
- `docs/journal-automation/project_knowledge/자리1_자가검증.md`
- `docs/journal-automation/project_knowledge/자리1_활성시리즈.md`
- `docs/journal-automation/project_knowledge/자리1_콘텐츠품질_가이드.md`
- `docs/journal-automation/project_knowledge/운영_룰북/*.md`

Do not use the log backup as the primary state source. The Git ledger is the source of truth:

- `content/CONTENT_STATE.md`
- `content/CONTENT_LOG.md`

## First Prompt

For autonomous Journal selection, paste:

- `docs/journal-automation/harness_prompts/AUTO_JOURNAL_START_PROMPT.md`

For a forced first draft of Journal 01-A, paste:

- `docs/journal-automation/harness_prompts/FIRST_JOURNAL_01A_COPY_PROMPT.md`

## Stage 3 Prompt

Claude Code should read:

- `docs/CLAUDE_CODE_JOURNAL_STAGE3_PROMPT.md`

## Runtime Content Paths

Codex and Claude Code use these repo paths:

- `content/draft/`
- `content/processing/`
- `content/published/`
- `content/rejected/`
- `content/CONTENT_STATE.md`
- `content/CONTENT_LOG.md`

## Codex Stage 2 Checks

Before Codex creates images, normalize the Claude draft:

- The saved draft must start at YAML frontmatter (`---`).
- Remove handoff notes, selection reasons, and Project Knowledge commentary before frontmatter.
- Remove validation report sections from the saved draft, or keep the report outside the file passed to the parser.
- Do not leave literal `[IMG-N...]` references anywhere except standalone marker lines.

After generating the published markdown and assets, run:

```bash
npm run journal:validate -- content/draft/<slug>.md --type draft --slug <slug>
npm run journal:validate -- content/published/<slug>.md --type published --slug <slug>
```

Then run the Cafe24 preview/build checks. Published markdown must contain rendered image markdown paths like `/assets/<slug>/img-N.png`, and those image files must be committed with the PR.
