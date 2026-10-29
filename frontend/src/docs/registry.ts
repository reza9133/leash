// The list of documentation pages, their order and their groups. The page bodies live in ./pages/<slug>.tsx
// and are found at build time, so a missing page shows a placeholder instead of breaking the build.
import type { ComponentType } from "react";

export interface DocPage {
  slug: string;
  title: string;
  group: DocGroup;
  summary: string;
}

export const DOC_GROUPS = ["Start here", "Concepts", "Reference", "Guides", "More"] as const;
export type DocGroup = (typeof DOC_GROUPS)[number];

export const DOC_PAGES: DocPage[] = [
  { slug: "overview", title: "What is Leash", group: "Start here", summary: "The idea in five minutes: a budget with limits that an AI reviewer can only tighten." },
  { slug: "quickstart", title: "Quick start", group: "Start here", summary: "Create a mandate, give an agent a seat and watch a request go through, in about ten minutes." },
  { slug: "wallet-network", title: "Wallet and network", group: "Start here", summary: "How wallets are found, how to connect and disconnect, and how to switch to GenLayer Studionet." },

  { slug: "mandates-roles", title: "Mandates and roles", group: "Concepts", summary: "What a mandate holds, and what the owner, guardian, agent and watcher may each do." },
  { slug: "request-lifecycle", title: "The life of a request", group: "Concepts", summary: "Every state a payment request can be in and the method that moves it." },
  { slug: "money-flow", title: "Where the money is", group: "Concepts", summary: "Balance, reserved funds, bonds and rewards, and the books that must always balance." },
  { slug: "hard-limits", title: "Hard limits", group: "Concepts", summary: "The caps, budgets and delays the contract enforces with plain arithmetic." },
  { slug: "ai-review", title: "The AI review", group: "Concepts", summary: "What the validators read, how risk is scored and why the review cannot widen a limit." },
  { slug: "challenges", title: "Challenges and audits", group: "Concepts", summary: "How a watcher stops a bad approval, what the bond is and when a reward is paid." },

  { slug: "contract-interface", title: "Contract interface", group: "Reference", summary: "All 29 public methods: parameters, who may call them and the errors they raise." },
  { slug: "views-and-data", title: "Views and data", group: "Reference", summary: "The JSON that each read method returns, and how to read it with genlayer-js." },
  { slug: "errors", title: "Errors", group: "Reference", summary: "Every message the contract can raise, what causes it and how to fix it." },
  { slug: "deployment", title: "Deployment", group: "Reference", summary: "The deployed address, deploying your own copy and hosting this frontend." },

  { slug: "guide-owner", title: "Guide for owners", group: "Guides", summary: "Set up, fund, tune and supervise a mandate." },
  { slug: "guide-agent", title: "Guide for agents", group: "Guides", summary: "Hold a seat, file good requests and get paid." },
  { slug: "guide-watcher", title: "Guide for watchers", group: "Guides", summary: "Find approvals that look wrong and challenge them." },
  { slug: "web-app", title: "Using the web app", group: "Guides", summary: "A tour of every screen, the transaction panel and the themes." },

  { slug: "security", title: "Security model", group: "More", summary: "What is guaranteed by code, what is left to the AI, and what is not covered." },
  { slug: "testing", title: "Testing", group: "More", summary: "How the contract and the frontend are tested and how to run the tests." },
  { slug: "faq", title: "FAQ", group: "More", summary: "Short answers to the questions people ask first." },
  { slug: "glossary", title: "Glossary", group: "More", summary: "The words this project uses, in alphabetical order." },
  { slug: "about", title: "About", group: "More", summary: "Who built Leash, where the code lives and how to reach the author." },
];

export const pageBySlug = (slug: string | undefined): DocPage | undefined => DOC_PAGES.find((p) => p.slug === slug);

const loaders = import.meta.glob<{ default: ComponentType }>("./pages/*.tsx");

/** The loader for a page body, or undefined when that page has not been written. */
export function loaderFor(slug: string): (() => Promise<{ default: ComponentType }>) | undefined {
  return loaders[`./pages/${slug}.tsx`];
}
