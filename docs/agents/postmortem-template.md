# Postmortem Template

Use this for a failed deploy, broken test batch, session handoff, or a pattern
the next agent must not repeat.

## Context

- Date:
- Repo/branch:
- Trigger:
- User-visible impact:

## What Happened

Summarize the sequence in chronological order. Include exact commands or
workflow names when they matter.

## Root Cause

Name the smallest cause that explains the failure. If unknown, say what was
ruled out and what remains to inspect.

## What Fixed It

List the change or operational action that restored the system. Link to the
backlog id if more work remains.

## Follow-On Work

| ID | Status | Item | Closure test |
| --- | --- | --- | --- |
|  |  |  |  |

## Prevention Rules

Add only durable rules. If a rule belongs in `discipline.md`, move it there
instead of leaving it only in the postmortem.
