# Grok Build session efficiency — PES Simulator Gauntlet

Forensic, read-only analysis of the real Grok Build sessions that executed the
PES Simulator Gauntlet on this VPS. The fixed evidence window is
`2026-08-14T01:19:17Z` through `2026-08-18T04:52:46Z`; later activity is
deliberately excluded so a running production session cannot move the result.

## Headline result

The dataset contains 552 sessions and 15,731 model-visible generation loops.
It measures 1.224B processed prompt tokens and 18.63M estimated completion
tokens. Parent/orchestrator loops account for 592.29M prompt tokens (48.38%).
The dominant mechanism is repeated long context: the bounded adjacent-request
estimate identifies 587.50M repeated parent-context tokens, or 99.22% of
measured parent prompt processing after the first request of each sequence.
That is repeated provider input, not necessarily billed input and not proof
that every repeated token could be removed.

The Grok 4.6 parent averaged 206,758 prompt tokens/request. The DeepSeek
orchestrator routes averaged 145,987 (29.4% lower) and had a lower peak, but
performed more than twice as many requests per touched objective. Consequently
the measured parent prompt total per touched objective did not fall. Moving
commits to Gemma removed strong-model bookkeeping, but did not reduce tokens
per committer session in this sample.

See [ANALYSIS.md](ANALYSIS.md) for findings, [METHODOLOGY.md](METHODOLOGY.md)
for reconstruction and sanitization, and [schema.json](schema.json) for field
semantics.

## Published datasets

- `requests.csv` / `requests.jsonl`: one row per reconstructed model-visible
  generation loop; JSONL retains arrays and nulls without CSV encoding loss.
- `sessions.csv`: one row per parent or child session/agent.
- `objectives.csv`: objective-level attribution and role accounting.
- `context-breakdown.csv`: structural parent-context categories where an
  uncompacted prefix can be reconstructed.
- `errors.csv`: provider, retry, subagent, and tool/harness failure evidence;
  expected non-zero tool exits are not assumed to be provider failures.
- `dataset-manifest.json`: fixed cutoff, counts, and a hash of source session
  IDs.
- `extract.py`: reproducible read-only extractor. It writes only this analysis
  directory and never writes the source session store.

No prompts, conversations, tool payloads, credentials, endpoint URLs, cookies,
authorization headers, signed URLs, or environment dumps are published. Hashes,
counts, categories, and sizes substitute for raw context.
