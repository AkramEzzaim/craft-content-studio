import { GithubError } from "./github";
import { PublishError } from "./publishing";
export function errorResponse(error: unknown) {
  if (error instanceof PublishError) return Response.json({ error: error.message, code: error.code, ...(error.existingSha ? { existingSha: error.existingSha } : {}) }, { status: error.status });
  if (error instanceof GithubError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = /not configured|incomplete/i.test(message) ? 503 : /Invalid|must/i.test(message) ? 400 : 502;
  return Response.json({ error: message }, { status });
}
