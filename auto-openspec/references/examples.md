# Examples

These examples show when to trigger the skill and how to normalize the user's request into a requirement.

## Example 1: Clear feature request

User input:
`Add SSO login for enterprise customers.`

Requirement to use:
`Add single sign-on support for enterprise customers.`

Expected behavior:
- Trigger the skill
- Regenerate `requirement-template.yaml`
- Run propose, apply, acceptance check, and archive if acceptance passes

## Example 2: Long conversational request

User input:
`Our users keep missing important alerts. I think we need something like a notification settings page where they can choose email or SMS, maybe per event type. Can you help set this up?`

Requirement to use:
`Create a notification preferences center that lets users manage email or SMS delivery by event type.`

Expected behavior:
- Trigger the skill
- Summarize the request into one concise requirement
- Regenerate `requirement-template.yaml`
- Run propose, apply, acceptance check, and archive if acceptance passes

## Example 3: Refactor request

User input:
`We should probably refactor the billing module before adding more payment methods.`

Requirement to use:
`Create an OpenSpec proposal for refactoring the billing module to support future payment method expansion.`

Expected behavior:
- Trigger the skill
- Treat this as spec-first planning work
- Regenerate `requirement-template.yaml`
- Run propose, apply, acceptance check, and archive if acceptance passes

## Example 4: Should not trigger

User input:
`Fix the typo on the login page.`

Expected behavior:
- Do not trigger the skill
- Handle as a normal implementation task or direct edit

## Example 5: Clarification needed

User input:
`Design the new permissions system.`

Expected behavior:
- Ask one focused clarification question if the scope is too ambiguous
- Only start the lifecycle after the requirement is specific enough to avoid a misleading spec
