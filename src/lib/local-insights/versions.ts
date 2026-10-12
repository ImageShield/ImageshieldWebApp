/**
 * Which quiz versions the v17 evidence report can speak for, and how far.
 *
 * TEMPORARY, with the rest of this folder.
 *
 * The report is about answers, not about a quiz version: "women are targeted by
 * deepfakes about 4.5 times more often than men" is as true of a v11 answer of
 * "Female" as of a v17 one — provided the v11 question asked the same thing and
 * offered the same answer. So a version is listed here question by question, and a
 * question is listed only when its prompt, options and flags are word for word the
 * v17 question's. Checked against both live definitions on 2026-10-13, and pinned by
 * ./versions.test.ts.
 *
 * What a version's answers can NOT borrow from v17 is its points. The report prices
 * answers under likeness-score-v17; v11 was scored by rules nobody has published, so a
 * v11 record is ranked by what its own breakdown says each question cost instead.
 */

import { REPORT } from "./evidence-v17";

export type VersionProfile = {
  /**
   * The scoring version a record must carry, or null when the ranking never uses the
   * report's points (see `rank`) and so doesn't depend on which scoring priced it.
   */
  scoringVersion: string | null;
  /** This version's question key → the report's, for the questions asked identically. */
  questions: Readonly<Record<string, string>>;
  /** This version's questions left out on purpose. Any key in neither list is drift
   *  between the record and this table, and is logged. */
  omitted: readonly string[];
  /**
   *   published  rank by the report's points — only right for the scoring it prices.
   *   recorded   rank by the deduction the record itself carries per question.
   */
  rank: "published" | "recorded";
};

export const VERSIONS: Readonly<Record<string, VersionProfile>> = {
  [REPORT.quizVersion]: {
    scoringVersion: REPORT.scoringVersion,
    questions: {
      age: "age",
      gender: "gender",
      platforms: "platforms",
      prior_misuse: "prior_misuse",
      posting_volume: "posting_volume",
      q_il8uju: "q_il8uju",
    },
    omitted: [],
    rank: "published",
  },
  /* What prod serves. `omitted`, and why:
       posting_volume  same options, but v11 asks how often photos of you are "shared
                       online, either by you or by others"; the report's reasoning is
                       about the visitor's own posting.
       prior_misuse    v11 offers "Happens regularly" where v17 has "Repeated pattern" —
                       and no v17 answer to it has usable evidence anyway. */
  "likeness-health-v11": {
    scoringVersion: null,
    questions: {
      age: "age",
      gender: "gender",
      platforms: "platforms",
      discovery_method: "q_il8uju",
    },
    omitted: ["posting_volume", "prior_misuse"],
    rank: "recorded",
  },
};
