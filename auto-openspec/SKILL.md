---
name: auto-openspec
description: Use when the user provides a new requirement, feature request, module design, architecture/refactor request, or asks to build/add/modify/create/change functionality. Normalize the requirement, run the OpenSpec propose/apply/archive flow, and enforce code style plus acceptance criteria.
---

# Auto OpenSpec

Use this skill to run the full OpenSpec lifecycle for a requirement:

`requirement-template.yaml -> propose -> apply -> acceptance check -> archive`

## When Not To Use

- Small bug fixes or one-line changes
- Pure Q&A, debugging, reviews, explanations, or brainstorming
- Requests that explicitly ask to skip OpenSpec

## Language

- Use Chinese for assistant replies, normalized requirements, and generated OpenSpec prose unless the user explicitly asks for another language.
- Keep code, commands, file paths, identifiers, protocol names, and other technical literals unchanged.
- If generated artifacts contain English prose, translate that prose to Chinese while preserving structure and technical literals.

## Workflow

1. Normalize the user's requirement with `/home/naviai/.codex/skills/auto-openspec/references/requirement-template.yaml`.
2. In the target project root, write `requirement-template.yaml`. If it already exists, overwrite it in place; if it does not exist, create it.
3. Check whether `openspec/` exists in the target project root.
   - If it does not exist, initialize OpenSpec for the target project before continuing.
   - If OpenSpec initialization is unavailable or fails, stop and report the setup failure.
   - Derive the change name from `requirement-template.yaml`, preferring `title`, then `id`, then a concise `goal` or `summary`.
4. Prefer running the propose stage from the target project root through the direct `/opsx:propose` command entry. Before any non-command fallback behavior, read both the stage skill file and the matching prompt definition. If the direct command entry is unavailable, execute strictly according to the `/opsx:propose` prompt flow plus the registered `$openspec-propose` stage skill:

```text
/opsx:propose "requirement-template.yaml"
```

   The installed `$openspec-propose` skill and `/opsx:propose` prompt together must read `requirement-template.yaml` as requirement content, not treat it as the change name.

5. Verify `proposal.md`, `design.md`, `tasks.md`, and any required spec files.
6. Before implementation, read `/home/naviai/.codex/skills/auto-openspec/references/code-style.md`.
7. Prefer running the apply stage through the direct `/opsx:apply` command entry. Before any non-command fallback behavior, read both the stage skill file and the matching prompt definition. If the direct command entry is unavailable, execute strictly according to the `/opsx:apply` prompt flow plus the registered `$openspec-apply-change` stage skill:

```text
/opsx:apply <change-name>
```

   Implementation must follow `/home/naviai/.codex/skills/auto-openspec/references/code-style.md`.
   If the target project has no existing implementation source yet, treat it as a new project and create the initial code/modules required by `tasks.md` instead of failing for lack of source files.

8. Check the result against `/home/naviai/.codex/skills/auto-openspec/references/acceptance-criteria.md`.
9. Only if the acceptance criteria pass, prefer running the archive stage through the direct `/opsx:archive` command entry. Before any non-command fallback behavior, read both the stage skill file and the matching prompt definition. If the direct command entry is unavailable, execute strictly according to the `/opsx:archive` prompt flow plus the registered `$openspec-archive-change` stage skill:

```text
/opsx:archive <change-name>
```

10. Report the result, including any failed stage. Do not archive when acceptance fails.

## Hard Rules

- Must prefer the direct `/opsx:propose`, `/opsx:apply`, and `/opsx:archive` command entries for the lifecycle. If a direct command entry is unavailable for a stage, read both the stage `SKILL.md` and the matching `/home/naviai/.codex/prompts/opsx-*.md` completely before any fallback execution. Any fallback behavior must stay within the combined rules of those two files. If neither the direct command path nor the paired skill+prompt fallback path is available for a required stage, stop and report failure.
- Do not use stale `requirement-template.yaml`; overwrite it in place or create it fresh for each run.
- Do not invent missing business requirements. Ask one focused question if required fields are missing.
- Do not treat `requirement-template.yaml` as a change name.
- Do not bypass the OpenSpec skills or `/opsx:*` prompt flows with direct `openspec` CLI commands, ad hoc local fallback, partial interpretation of only one source, or manually generated artifacts from this skill.
- Do not implement before proposal/design/tasks are complete.
- Do not fail apply only because the project has no existing source files; for a new project, create the required initial implementation from `tasks.md`.
- Do not archive unless `/home/naviai/.codex/skills/auto-openspec/references/acceptance-criteria.md` passes.

## Output

Tell the user:

- Requirement source and saved YAML path
- Change name and latest change path
- Propose/apply/archive status
- Whether `proposal.md`, `design.md`, `tasks.md`, and specs were verified
- Whether `/home/naviai/.codex/skills/auto-openspec/references/code-style.md` was applied during implementation
- Whether `/home/naviai/.codex/skills/auto-openspec/references/acceptance-criteria.md` passed
- If archive was skipped, the exact failed criterion or blocker

Use `/home/naviai/.codex/skills/auto-openspec/references/output-template.md` when helpful.
