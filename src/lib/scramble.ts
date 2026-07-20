import { CourseData } from "./courseData";
import { FullData } from "./data";
import { HOLES, Round } from "./types";

export function scrambleStrokesFor(data: FullData, groupId: string, hole: number): number | null {
  const row = data.scrambleScores.find((s) => s.group_id === groupId && s.hole === hole);
  return row?.strokes ?? null;
}

export function scrambleHolesEntered(data: FullData, groupId: string): number {
  return data.scrambleScores.filter((s) => s.group_id === groupId).length;
}

export function scrambleComplete(data: FullData, groupId: string): boolean {
  return scrambleHolesEntered(data, groupId) === 18;
}

export function scrambleTotal(data: FullData, groupId: string, holes: number[] = HOLES): number | null {
  const vals = holes
    .map((h) => scrambleStrokesFor(data, groupId, h))
    .filter((v): v is number => v != null);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
}

// Score relative to par, counting only the holes actually entered so far —
// meaningful as a running total mid-round, and the final result once all 18
// are in. Positive = over par, negative = under.
export function scrambleToPar(
  data: FullData,
  round: Round,
  course: CourseData | undefined,
  groupId: string,
  holes: number[] = HOLES
): number | null {
  if (!course) return null;
  let total = 0;
  let parSum = 0;
  let any = false;
  for (const h of holes) {
    const strokes = scrambleStrokesFor(data, groupId, h);
    if (strokes == null) continue;
    const par = course.holes.find((c) => c.hole === h)?.par;
    if (par == null) continue;
    total += strokes;
    parSum += par;
    any = true;
  }
  return any ? total - parSum : null;
}
