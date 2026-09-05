import process from "node:process";
import { searchMemory, validateMemory } from "../gauntlet/runtime/memory.js";

const [command, ...args] = process.argv.slice(2);
const repoRoot = process.cwd();

if (command === "check") {
  const result = await validateMemory(repoRoot);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
} else if (command === "search") {
  const query = args.join(" ").trim();
  if (!query) throw new Error("usage: gauntlet-memory search <keywords>");
  const previews = await searchMemory(repoRoot, query);
  process.stdout.write(`${JSON.stringify({ query, count: previews.length, previews }, null, 2)}\n`);
} else {
  throw new Error("usage: gauntlet-memory <check|search> [keywords]");
}
