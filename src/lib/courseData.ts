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

// Source: published course scorecards (bluegolf.com / golflink.com), Jul 2026.
export const COURSES: Record<string, CourseData> = {
  "Denison Golf Club": {
    tees: ["Black", "Blue", "White", "Red"],
    holes: [
      { hole: 1, par: 4, handicap: null, yards: { Black: 334, Blue: 332, White: 320, Red: 273 } },
      { hole: 2, par: 4, handicap: null, yards: { Black: 444, Blue: 443, White: 407, Red: 319 } },
      { hole: 3, par: 4, handicap: null, yards: { Black: 422, Blue: 424, White: 405, Red: 317 } },
      { hole: 4, par: 3, handicap: null, yards: { Black: 233, Blue: 223, White: 150, Red: 136 } },
      { hole: 5, par: 4, handicap: null, yards: { Black: 396, Blue: 412, White: 400, Red: 356 } },
      { hole: 6, par: 5, handicap: null, yards: { Black: 501, Blue: 502, White: 491, Red: 418 } },
      { hole: 7, par: 3, handicap: null, yards: { Black: 175, Blue: 171, White: 160, Red: 145 } },
      { hole: 8, par: 4, handicap: null, yards: { Black: 434, Blue: 436, White: 427, Red: 397 } },
      { hole: 9, par: 4, handicap: null, yards: { Black: 368, Blue: 372, White: 358, Red: 350 } },
      { hole: 10, par: 5, handicap: null, yards: { Black: 540, Blue: 540, White: 516, Red: 454 } },
      { hole: 11, par: 4, handicap: null, yards: { Black: 390, Blue: 396, White: 382, Red: 322 } },
      { hole: 12, par: 5, handicap: null, yards: { Black: 504, Blue: 497, White: 480, Red: 421 } },
      { hole: 13, par: 4, handicap: null, yards: { Black: 323, Blue: 339, White: 322, Red: 297 } },
      { hole: 14, par: 3, handicap: null, yards: { Black: 187, Blue: 190, White: 164, Red: 141 } },
      { hole: 15, par: 4, handicap: null, yards: { Black: 440, Blue: 453, White: 435, Red: 362 } },
      { hole: 16, par: 4, handicap: null, yards: { Black: 330, Blue: 339, White: 324, Red: 272 } },
      { hole: 17, par: 3, handicap: null, yards: { Black: 169, Blue: 173, White: 136, Red: 114 } },
      { hole: 18, par: 4, handicap: null, yards: { Black: 369, Blue: 370, White: 340, Red: 319 } },
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
