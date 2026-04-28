# Output Template

Use this template after the `auto-openspec` lifecycle finishes or stops.

## Success

Requirement source:
`<requirement file path or requirement text>`

Result:
- Saved YAML: `<project-root>/requirement-template.yaml`
- Change: `<change-name>`
- Latest change path: `<openspec/changes/...>` or archived path
- Propose: completed
- Apply: completed using `/home/naviai/.codex/skills/auto-openspec/references/code-style.md`
- Acceptance: passed
- Archive: completed

## Failure Or Pause

Requirement source:
`<requirement file path or requirement text>`

Result:
- Saved YAML: `<path if available>`
- Change: `<change-name if available>`
- Failed stage: `<normalize|openspec-setup|propose|apply|acceptance|archive|unknown>`
- Failed criterion or blocker: `<short summary>`
- Archive: skipped unless acceptance passed

## Notes

- Keep the response short and factual.
- Do not claim success if any stage failed.
- If OpenSpec is unavailable, include the install or setup hint from OpenSpec.
- If `/opsx:propose`, `/opsx:apply`, or `/opsx:archive` is unavailable, report that directly and do not claim fallback output.
- If no latest change path is available, say that clearly instead of guessing.
