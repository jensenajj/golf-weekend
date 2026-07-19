export type TeeName = "Black" | "Gold" | "Blue" | "White" | "Green" | "Red";

export type CourseHole = {
  hole: number;
  par: number;
  yards: Partial<Record<TeeName, number>>;
  // Stroke index (1-18 difficulty ranking used to allocate handicap strokes).
  // Not yet verified against an official scorecard for this course — leave
  // null until confirmed. See handicap.ts for how this is used.
  handicap: number | null;
};

export type CourseData = {
  tees: TeeName[];
  holes: CourseHole[];
};

export function hasHandicapData(course: CourseData): boolean {
  return course.holes.every((h) => h.handicap != null);
}

// Denison Golf Club: transcribed directly from a photo of the club's own
// scorecard (Jul 2026) — supersedes earlier web-sourced numbers, which
// turned out to be wrong for the Blue/White/Red tees. The card prints two
// handicap (stroke index) rows: one shared by Black/Blue/White/Gold, and a
// separate one for Red — `handicap` below uses the Black/Blue/White/Gold row
// since that's what this group plays from.
export const COURSES: Record<string, CourseData> = {
  "Denison Golf Club": {
    tees: ["Black", "Blue", "White", "Gold", "Red"],
    holes: [
      { hole: 1, par: 4, handicap: 17, yards: { Black: 334, Blue: 326, White: 312, Gold: 277, Red: 272 } },
      { hole: 2, par: 4, handicap: 1, yards: { Black: 444, Blue: 416, White: 352, Gold: 319, Red: 314 } },
      { hole: 3, par: 4, handicap: 5, yards: { Black: 422, Blue: 408, White: 318, Gold: 318, Red: 304 } },
      { hole: 4, par: 3, handicap: 13, yards: { Black: 233, Blue: 160, White: 130, Gold: 130, Red: 128 } },
      { hole: 5, par: 4, handicap: 7, yards: { Black: 396, Blue: 365, White: 347, Gold: 312, Red: 307 } },
      { hole: 6, par: 5, handicap: 9, yards: { Black: 501, Blue: 482, White: 420, Gold: 420, Red: 406 } },
      { hole: 7, par: 3, handicap: 15, yards: { Black: 175, Blue: 158, White: 146, Gold: 146, Red: 138 } },
      { hole: 8, par: 4, handicap: 3, yards: { Black: 434, Blue: 423, White: 402, Gold: 353, Red: 348 } },
      { hole: 9, par: 4, handicap: 11, yards: { Black: 368, Blue: 347, White: 328, Gold: 320, Red: 315 } },
      { hole: 10, par: 5, handicap: 4, yards: { Black: 540, Blue: 523, White: 455, Gold: 455, Red: 442 } },
      { hole: 11, par: 4, handicap: 8, yards: { Black: 390, Blue: 389, White: 327, Gold: 327, Red: 315 } },
      { hole: 12, par: 5, handicap: 6, yards: { Black: 504, Blue: 484, White: 423, Gold: 423, Red: 411 } },
      { hole: 13, par: 4, handicap: 10, yards: { Black: 323, Blue: 308, White: 293, Gold: 293, Red: 281 } },
      { hole: 14, par: 3, handicap: 12, yards: { Black: 187, Blue: 169, White: 151, Gold: 151, Red: 142 } },
      { hole: 15, par: 4, handicap: 2, yards: { Black: 440, Blue: 426, White: 352, Gold: 352, Red: 340 } },
      { hole: 16, par: 4, handicap: 14, yards: { Black: 330, Blue: 324, White: 305, Gold: 270, Red: 265 } },
      { hole: 17, par: 3, handicap: 18, yards: { Black: 169, Blue: 147, White: 129, Gold: 129, Red: 107 } },
      { hole: 18, par: 4, handicap: 16, yards: { Black: 369, Blue: 355, White: 340, Gold: 340, Red: 322 } },
    ],
  },
  "Virtues Golf Club": {
    tees: ["Black", "Gold", "Blue", "White", "Green"],
    holes: [
      { hole: 1, par: 4, handicap: null, yards: { Black: 411, Gold: 389, Blue: 377, White: 349, Green: 302 } },
      { hole: 2, par: 4, handicap: null, yards: { Black: 474, Gold: 446, Blue: 435, White: 393, Green: 316 } },
      { hole: 3, par: 4, handicap: null, yards: { Black: 388, Gold: 362, Blue: 353, White: 325, Green: 276 } },
      { hole: 4, par: 5, handicap: null, yards: { Black: 563, Gold: 530, Blue: 504, White: 452, Green: 395 } },
      { hole: 5, par: 3, handicap: null, yards: { Black: 206, Gold: 188, Blue: 180, White: 146, Green: 92 } },
      { hole: 6, par: 4, handicap: null, yards: { Black: 338, Gold: 329, Blue: 287, White: 275, Green: 219 } },
      { hole: 7, par: 5, handicap: null, yards: { Black: 557, Gold: 546, Blue: 505, White: 494, Green: 417 } },
      { hole: 8, par: 4, handicap: null, yards: { Black: 444, Gold: 429, Blue: 420, White: 406, Green: 331 } },
      { hole: 9, par: 3, handicap: null, yards: { Black: 187, Gold: 169, Blue: 150, White: 150, Green: 109 } },
      { hole: 10, par: 5, handicap: null, yards: { Black: 537, Gold: 510, Blue: 474, White: 469, Green: 423 } },
      { hole: 11, par: 4, handicap: null, yards: { Black: 364, Gold: 343, Blue: 335, White: 300, Green: 263 } },
      { hole: 12, par: 3, handicap: null, yards: { Black: 211, Gold: 181, Blue: 158, White: 146, Green: 102 } },
      { hole: 13, par: 4, handicap: null, yards: { Black: 480, Gold: 461, Blue: 454, White: 434, Green: 335 } },
      { hole: 14, par: 3, handicap: null, yards: { Black: 198, Gold: 187, Blue: 162, White: 136, Green: 107 } },
      { hole: 15, par: 4, handicap: null, yards: { Black: 457, Gold: 428, Blue: 404, White: 372, Green: 282 } },
      { hole: 16, par: 5, handicap: null, yards: { Black: 527, Gold: 484, Blue: 476, White: 446, Green: 399 } },
      { hole: 17, par: 4, handicap: null, yards: { Black: 435, Gold: 420, Blue: 390, White: 378, Green: 313 } },
      { hole: 18, par: 4, handicap: null, yards: { Black: 466, Gold: 454, Blue: 434, White: 404, Green: 304 } },
    ],
  },
};

export const DEFAULT_TEE: TeeName = "Blue";
