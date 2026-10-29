import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import generated from "../../src/lib/contract.generated.json";
import { METHOD_DOCS, METHOD_NAMES } from "../../src/docs/methodDocs";
import { ERROR_HELP } from "../../src/docs/errors";
import { DOC_PAGES } from "../../src/docs/registry";

const root = resolve(__dirname, "../..");
const methods = generated.methods as { name: string; params: [string, string][]; errors: string[] }[];

describe("method documentation", () => {
  it("covers exactly the methods of the contract", () => {
    expect([...METHOD_NAMES].sort()).toEqual(methods.map((m) => m.name).sort());
    expect(Object.keys(METHOD_DOCS).sort()).toEqual([...METHOD_NAMES].sort());
  });
  it("describes every parameter and no extra one", () => {
    for (const m of methods) {
      const doc = METHOD_DOCS[m.name as keyof typeof METHOD_DOCS];
      expect(Object.keys(doc.params).sort(), m.name).toEqual(m.params.map((p) => p[0]).sort());
    }
  });
});

describe("error documentation", () => {
  it("explains every message the contract raises", () => {
    const all = new Set<string>();
    methods.forEach((m) => m.errors.forEach((e) => all.add(e)));
    const missing = [...all].filter((e) => !ERROR_HELP[e]);
    expect(missing).toEqual([]);
  });
  it("has no entry the contract no longer raises", () => {
    const source = readFileSync(resolve(root, "../contracts/leash.py"), "utf8");
    const stale = Object.keys(ERROR_HELP).filter((e) => !source.includes(e));
    expect(stale).toEqual([]);
  });
});

describe("pages", () => {
  const files = readdirSync(resolve(root, "src/docs/pages")).map((f) => f.replace(/\.tsx$/, ""));
  it("has a body for every registered page and no orphan", () => {
    expect(files.sort()).toEqual(DOC_PAGES.map((p) => p.slug).sort());
  });
  it("links only to pages that exist", () => {
    const slugs = new Set(DOC_PAGES.map((p) => p.slug));
    for (const f of files) {
      const text = readFileSync(resolve(root, `src/docs/pages/${f}.tsx`), "utf8");
      for (const m of text.matchAll(/\/docs\/([a-z-]+)/g)) expect(slugs.has(m[1]), `${f} -> ${m[1]}`).toBe(true);
    }
  });
});
