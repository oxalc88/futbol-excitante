import { createContextPacket, validateContextPacket, type ContextDecision, type ObjectiveContextPacket } from "./context-packet.js";
import { approximateTokens } from "./digest.js";
import { RUNTIME_POLICY } from "./policy.js";

export interface ReadOnlyRepositoryView {
  search(query: string, limit: number): Promise<string[]>;
  read(relativePath: string): Promise<string>;
}

export interface ContextMappingRequest {
  objectiveId: string;
  executiveSummary: string;
  obviousFiles: Array<{ path: string; purpose: string }>;
  searches: string[];
  selectedMemoryTopics: ContextDecision[];
  tests: string[];
  dependencies: string[];
  risks: string[];
  conflicts: string[];
  skillsToLoad: string[];
}

export interface ContextMappingResult {
  packet: ObjectiveContextPacket;
  metrics: {
    searches: number;
    filesRead: number;
    mapperInputTokens: number;
    mapperOutputTokens: number;
    topicsRetrieved: number;
    canonicalFilesSelected: number;
    bypassed: boolean;
  };
}

export function shouldBypassContextMapper(request: ContextMappingRequest): boolean {
  return request.searches.length === 0 && request.obviousFiles.length <= RUNTIME_POLICY.objective_context.small_task_file_limit;
}

export async function mapObjectiveContext(
  repoRoot: string,
  view: ReadOnlyRepositoryView,
  request: ContextMappingRequest,
): Promise<ContextMappingResult> {
  if (request.searches.length > RUNTIME_POLICY.objective_context.mapper_search_limit) throw new Error("context mapper search limit exceeded; re-plan first");
  if (request.selectedMemoryTopics.length > RUNTIME_POLICY.memory.initial_topic_limit) throw new Error("initial memory topic limit exceeded");
  const bypassed = shouldBypassContextMapper(request);
  const selected = new Map(request.obviousFiles.map((file) => [file.path, file.purpose]));
  let inputCharacters = 0;
  if (!bypassed) {
    for (const query of request.searches) {
      for (const result of await view.search(query, RUNTIME_POLICY.memory.search_preview_limit)) {
        if (selected.size >= RUNTIME_POLICY.objective_context.mapper_file_limit) break;
        if (!selected.has(result)) selected.set(result, `Selected by bounded search: ${query}`);
      }
    }
  }
  if (selected.size > RUNTIME_POLICY.objective_context.mapper_file_limit) throw new Error("context mapper file limit exceeded; re-plan first");
  for (const relativePath of selected.keys()) inputCharacters += (await view.read(relativePath)).length;
  const packet = await createContextPacket(repoRoot, {
    objectiveId: request.objectiveId,
    executiveSummary: request.executiveSummary,
    files: [...selected].map(([filePath, purpose]) => ({ path: filePath, purpose })),
    decisions: request.selectedMemoryTopics,
    tests: request.tests,
    dependencies: request.dependencies,
    risks: request.risks,
    conflicts: request.conflicts,
    skillsToLoad: request.skillsToLoad,
  });
  const validation = await validateContextPacket(repoRoot, packet);
  if (!validation.valid) throw new Error(`context mapper produced an invalid packet: ${validation.issues.join("; ")}`);
  return {
    packet,
    metrics: {
      searches: bypassed ? 0 : request.searches.length,
      filesRead: selected.size,
      mapperInputTokens: approximateTokens(inputCharacters),
      mapperOutputTokens: approximateTokens(packet),
      topicsRetrieved: request.selectedMemoryTopics.length,
      canonicalFilesSelected: selected.size,
      bypassed,
    },
  };
}
