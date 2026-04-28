# Acceptance Criteria

Use these checks before archiving an `auto-openspec` change.

## Requirement Normalization

- The target project root contains a freshly generated `requirement-template.yaml` with the current normalized requirement content; stale previous content is not reused.
- The YAML follows `/home/naviai/.codex/skills/auto-openspec/references/requirement-template.yaml`.
- Required fields are meaningfully filled: `title`, `goal`, `protocol`, and either `context.product` or `context.module`.
- The normalized requirement does not invent business facts not provided by the user.

## OpenSpec Setup And Propose

- The target project root has an `openspec/` directory before proposing.
- If `openspec/` was missing, OpenSpec setup was initialized successfully before proposing.
- The change name was derived from `requirement-template.yaml` content, not from the filename.
- `/opsx:propose "requirement-template.yaml"` ran from the target project root.
- `requirement-template.yaml` was read as requirement content.
- No local fallback from `auto-openspec` was used to replace `/opsx:propose`.

## Planning Artifacts

- A change directory exists under `openspec/changes/`.
- `proposal.md` exists and explains what changes and why.
- `design.md` exists and is substantive.
- `tasks.md` exists and contains an implementation checklist.
- Required spec files exist when the proposal declares new or modified capabilities.

## Design Quality

`design.md` must cover:

- System or component structure
- Data flow, control flow, or interaction flow
- External interfaces, dependencies, or integration points
- Risks, tradeoffs, or open questions

Placeholder-only design content is not acceptable.

## Implementation

- Code changes follow the repository style in `/home/naviai/.codex/skills/auto-openspec/references/code-style.md`.
- If the target project had no existing implementation source, the required initial code/modules were created from `tasks.md` instead of treating the missing source as a failure.
- Existing code was modified only as required by the current task; no opportunistic refactor, rename, move, split, merge, or reorganization was performed.
- Each touched or created module remains independently buildable.
- Every completed task is marked in `tasks.md`.
- Tasks that only require tests, runtime execution, hardware execution, or validation commands may remain incomplete if they cannot be run in the current environment; record the reason and do not block acceptance on those tasks.
- No pending task remains unless the user explicitly accepts archiving with incomplete work.

## Archive Gate

- Run `/opsx:archive <change-name>` only after all applicable checks above pass.
- If any check fails, do not archive. Report the failed criterion and the next action needed.
