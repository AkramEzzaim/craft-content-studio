import { GithubError } from "./github";
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = error instanceof GithubError && error.status === 409 ? 409 : message.includes("not configured") ? 503 : 400;
  return Response.json({ error: message }, { status });
}
