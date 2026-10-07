# Workshop issue format

This format applies only to collaboration issues opened in the Workshop tracker
and reports within those issues. Internal project issues and work follow the
project's own rules.

Use the tracker, recipient labels and responsibility rules from the
[agent contract](https://github.com/dveyarangi/xuanxue-workshop/blob/HEAD/docs/agent-contract.md).
Search for an existing issue covering the same action and continue it when found.
Separate independently owned actions and link their dependencies.

## New issue

Title: `<recipient>: <required outcome>`; name the affected boundary when relevant.
Apply the recipient label defined by the agent contract.

- **Recipient and outcome:** who must act and the observable result.
- **Expected / observed:** governing contract, source revisions and evidence;
  distinguish confirmed facts from missing evidence.
- **Shared contract and conformance, for implementation:** one accessible immutable
  contract reference shared by the provider and every affected consumer; exact
  operations, parameters, formats, meanings and applicable data guarantees;
  common examples and expected conformance outcomes. Recipient-specific action
  is separate from this shared definition. Applicable dimensions are listed in
  [the contract-shape reference](https://github.com/dveyarangi/xuanxue-workshop/blob/e209d27239391be3af2be71b898c79f453851c01/.agents/skills/reconcile/CONTRACT-SHAPE.md).
- **Impact and required changes:** affected providers and consumers, requested
  action, scope and dependencies.
- **BOUNDARY_SUMMARY**, when supplying or updating project instructions: use the
  block below. Describe what changed outside that block.
- **Acceptance evidence:** checks and results required to establish the outcome,
  instruction revision and affected consumers' confirmation where relevant.

For migration coordination, include old and new contract definitions, compatibility
evidence, known consumers and readiness. For an evidence request, identify the
missing proof and the question it must resolve; do not present uncertainty as a defect.

## Boundary summary block

Installation and reconciliation assignments supplying a summary use the exact
heading `## BOUNDARY_SUMMARY` followed by one fenced Markdown block:

````markdown
## BOUNDARY_SUMMARY
```markdown
<Complete short boundary summary for the recipient, including contract links.>
```
````

Only the fenced content is the text to copy into the recipient's agent instructions.
It replaces the previous boundary summary, not the surrounding collaboration rules.
Supply the complete summary, not a patch; keep rationale, tasks and evidence outside
the fence. Preserve the distinction between existing boundaries and planned targets.

## Reports in the original issue

For a blocker, state the obstacle, evidence and the decision or assistance needed.
For completion, report what changed, commit or PR references, checks and results,
affected boundaries and instruction changes, relevant deployment status and limits.
Installation evidence includes installed paths, source revision and observed
invocation and discovery results. Follow-up and acceptance use the agent contract.
