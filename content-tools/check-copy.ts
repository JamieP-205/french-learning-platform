// Copy gate: no em dashes in interface copy, English feedback, or docs.
// Learner-visible French keeps its own punctuation (the tiret is correct
// French), so lib/content is deliberately outside this scan.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "components", "docs", "lib/learning", "lib/schedule", "lib/speech", "lib/theme"];
const EXTENSIONS = new Set([".ts", ".tsx", ".md", ".css", ".html"]);
const EM_DASH = "—";

function filesUnder(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...filesUnder(path));
    } else if (EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) {
      files.push(path);
    }
  }
  return files;
}

const offenders: string[] = [];
for (const root of ROOTS) {
  for (const file of filesUnder(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (line.includes(EM_DASH)) {
        offenders.push(`${relative(".", file)}:${index + 1}  ${line.trim().slice(0, 90)}`);
      }
    });
  }
}

if (offenders.length > 0) {
  console.error("Em dashes found in interface copy. Rewrite these lines:");
  for (const offender of offenders) console.error(`  ${offender}`);
  process.exit(1);
}

console.log("check:copy passed. No em dashes in interface copy or docs.");
