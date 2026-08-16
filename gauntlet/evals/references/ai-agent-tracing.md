# Agent tracing mapping

This project can later map runtime traces to OpenTelemetry GenAI semantic conventions. Keep the local contract small until that integration is useful.

Recommended correlation metadata:

- `run_id`
- `horizon_id`
- `objective_id`
- `attempt_id`
- stable agent name
- requested/actual model when available
- stable tool name
- bounded verdict/failure class
- duration and token counts when available

Do not capture prompt content, hidden reasoning or arbitrary tool payloads by default. If OpenTelemetry is added later, map stable agent/model/tool information to current GenAI semantic conventions rather than inventing duplicate vendor-specific names.
