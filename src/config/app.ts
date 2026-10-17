/** Single place to rename the product and tune plan limits. */
export const APP = {
  name: "Blindspot",
  tagline: "Risk tools track what you've already identified. Blindspot finds what you haven't.",
  shortPitch: "Find the assumptions, constraints and contradictions your documents never mention.",
  supportEmail: "hello@blindspot.example",
  privacyStatement: "Your documents are never used to train models.",
} as const;

export type PlanKey = "FREE" | "PRO" | "TEAM";

export const PLANS: Record<
  PlanKey,
  { label: string; price: string; maxProjects: number; maxDocsPerMonth: number; blurb: string }
> = {
  FREE: { label: "Free", price: "$0", maxProjects: 3, maxDocsPerMonth: 10, blurb: "Try it on a real project." },
  PRO: { label: "Pro", price: "$29/mo", maxProjects: 25, maxDocsPerMonth: 300, blurb: "For people who run several projects." },
  TEAM: { label: "Team", price: "$79/mo", maxProjects: 200, maxDocsPerMonth: 3000, blurb: "Shared workspace for a delivery team." },
};

export const UPLOAD = {
  maxBytes: 25 * 1024 * 1024,
  allowedExt: ["pdf", "docx", "xlsx", "csv", "txt", "md"] as const,
};

export const DOMAINS = [
  { value: "SOFTWARE", label: "Software" },
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "FINANCE", label: "Finance" },
  { value: "DATA_ML", label: "Data / ML" },
  { value: "OTHER", label: "Other" },
] as const;

export const STAGES = [
  { value: "PROPOSAL", label: "Proposal" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "PRE_LAUNCH", label: "Pre-launch" },
] as const;

export const DOC_TYPES = ["PRD", "Plan", "Budget", "Contract", "Data", "Notes", "Other"] as const;
