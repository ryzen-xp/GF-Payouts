import type { ParsedIssue } from "./types.ts"

export function parseMilestoneDescription(raw: string): ParsedIssue {
  const parts = raw.split("&").map((part) => part.trim())
  const title = parts[0] ?? ""
  const project = parts[1] ?? ""
  const issueUrl = parts.find((part) => /\/issues\/\d+/i.test(part)) ?? ""
  const prUrl = parts.find((part) => /\/pull\/\d+/i.test(part)) ?? ""
  return { title, project, issueUrl, prUrl }
}
