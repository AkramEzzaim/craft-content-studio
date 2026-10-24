import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { parsePastedPattern } from "@/lib/pattern-parser";

const choices = new Set(["intro", "materials", "instructions", "notes", "mistakes", "variations", "faq", "other"]);
export async function POST(request: Request) {
  const denied = await apiAuth(request);
  if (denied) return denied;
  try {
    const input = await request.json() as { rawSource?: unknown; assignments?: unknown };
    if (typeof input.rawSource !== "string" || input.rawSource.length > 150000) return Response.json({ error: "Paste an article under 150,000 characters." }, { status: 400 });
    const rawAssignments = input.assignments && typeof input.assignments === "object" ? input.assignments as Record<string, unknown> : {};
    const assignments = Object.fromEntries(Object.entries(rawAssignments).slice(0, 40).filter(([key, value]) => key.length <= 180 && choices.has(String(value)))) as Parameters<typeof parsePastedPattern>[1];
    return Response.json(parsePastedPattern(input.rawSource, assignments));
  } catch (error) { return errorResponse(error); }
}
