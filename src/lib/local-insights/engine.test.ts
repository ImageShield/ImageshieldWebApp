// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizAnswers } from "../quiz";
import { answersFrom, classifyAnswers, describeRecord, localInsights, shapeOf } from "./engine";

const NO_MONITORING = "I don’t have a way to monitor my likeness";
const FRIENDS = "I rely on friends and family to tell me what they've seen";
const SERVICE = "I subscribe to a likeness detection/monitoring service";

/** A v17 score record whose breakdown carries these answers, as `/v1/me/score` would. */
const v17 = (answers: QuizAnswers) => ({
  quiz_version: "likeness-health-v17",
  scoring_version: "likeness-score-v17",
  breakdown: {
    quiz: Object.entries(answers).map(([key, value]) => ({
      key,
      value,
      deduction: 0,
      type: "quiz",
    })),
  },
});

const titles = (answers: QuizAnswers) =>
  localInsights(v17(answers)).riskFactors.map((factor) => factor.title);
const recommendationTitles = (answers: QuizAnswers) =>
  localInsights(v17(answers)).recommendations.map((recommendation) => recommendation.title);

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("risk factors from a visitor's answers", () => {
  it("are the backed answers that cost the most, with the report's own wording", () => {
    const { riskFactors } = localInsights(
      v17({
        age: "18-24",
        gender: "Female",
        platforms: ["X (Twitter)", "Instagram"],
        prior_misuse: "No known incidents",
        posting_volume: "Weekly",
        q_il8uju: SERVICE,
      }),
    );

    expect(riskFactors).toStrictEqual([
      {
        kind: "quiz",
        key: "platforms",
        title: "Platform: X (Twitter)",
        line: "X's Grok tool was widely abused to make sexualized deepfakes from users' photos, and an audit found X removed none reported under its own nudity policy.",
        points: 7,
      },
      {
        kind: "quiz",
        key: "age",
        title: "Age: 18-24",
        line: "Government data show deepfake sexual-abuse victims are overwhelmingly in their teens and 20s, and surveys find young adult women among the most affected.",
        points: 6,
      },
      {
        kind: "quiz",
        key: "gender",
        title: "Gender: Female",
        line: "Women are targeted by deepfakes about 4.5 times more often than men, and nearly all sexual deepfakes and most image-based abuse victims are women.",
        points: 6,
      },
    ]);
  });

  it("change with the answers", () => {
    expect(
      titles({ age: "55+", gender: "Male", platforms: ["Facebook"], posting_volume: "Rarely (less than once a month)" }),
    ).toStrictEqual(["Age: 55+", "Platform: Facebook", "Posting: Rarely"]);
    expect(titles({ age: "18-24", gender: "Non-Binary", posting_volume: "Around once a month" })).toStrictEqual([
      "Age: 18-24",
      "Gender: Non-Binary",
      "Posting: Around once a month",
    ]);
  });

  it("never claim the 55+ bracket is the highest-risk one", () => {
    const [factor] = localInsights(v17({ age: "55+" })).riskFactors;
    expect(factor.line).toMatch(/mostly other people's/);
    expect(factor.line).not.toMatch(/highest risk/i);
  });

  it("name only the platforms the visitor selected", () => {
    expect(titles({ platforms: ["Instagram"] })).toStrictEqual(["Platform: Instagram"]);
    expect(titles({ platforms: ["Facebook", "X (Twitter)"] })).toStrictEqual([
      "Platform: X (Twitter)",
      "Platform: Facebook",
    ]);
  });

  it("stop at three however many answers qualify", () => {
    const riskFactors = localInsights(
      v17({
        age: "Under 18",
        gender: "Female",
        platforms: ["X (Twitter)", "Instagram", "Facebook"],
        posting_volume: "Weekly",
        q_il8uju: SERVICE,
      }),
    ).riskFactors;

    expect(riskFactors.map((factor) => [factor.title, factor.points])).toStrictEqual([
      ["Age: Under 18", 8],
      ["Platform: X (Twitter)", 7],
      ["Gender: Female", 6],
    ]);
  });

  /* Equal points fall back to the report's own order: age, gender, platforms,
     prior_misuse, posting_volume, q_il8uju - then each question's answer order. */
  it("break ties in points the same way every time", () => {
    // 6 and 6, then 3 and 3, then 4 and 4 - across questions each time.
    expect(titles({ gender: "Female", age: "18-24" })).toStrictEqual(["Age: 18-24", "Gender: Female"]);
    expect(titles({ platforms: ["Facebook"], age: "55+" })).toStrictEqual(["Age: 55+", "Platform: Facebook"]);
    expect(titles({ platforms: ["Instagram"], gender: "Non-Binary" })).toStrictEqual([
      "Gender: Non-Binary",
      "Platform: Instagram",
    ]);
  });

  it("don't depend on the order the breakdown lists the answers in", () => {
    const answers = {
      q_il8uju: SERVICE,
      posting_volume: "Weekly",
      platforms: ["Instagram", "X (Twitter)"],
      gender: "Non-Binary",
      age: "55+",
    };
    const reversed = Object.fromEntries(Object.entries(answers).reverse());
    expect(localInsights(v17(answers))).toStrictEqual(localInsights(v17(reversed)));
  });

  /* Points without research: real deductions, and nothing to say about them. */
  it("say nothing for answers set before evidence was recorded", () => {
    expect(
      titles({
        age: "25-34",
        gender: "Male",
        platforms: ["TikTok", "YouTube"],
        prior_misuse: "Repeated pattern",
        posting_volume: "Daily or multiple times a day",
        q_il8uju: NO_MONITORING,
      }),
    ).toStrictEqual([]);
  });

  it("say nothing for answers whose evidence the report couldn't load", () => {
    expect(
      titles({ platforms: ["Snapchat"], prior_misuse: "Once or twice", q_il8uju: FRIENDS }),
    ).toStrictEqual([]);
  });

  it("never tell a visitor they've been misused, whatever they answered", () => {
    for (const prior_misuse of ["No known incidents", "Once or twice", "Repeated pattern"]) {
      expect(localInsights(v17({ prior_misuse })).riskFactors).toStrictEqual([]);
    }
  });

  it("ignore answers the report doesn't list, and name the question in a warning", () => {
    expect(
      titles({ age: "Seventeen", favourite_colour: "Blue", gender: "Female" }),
    ).toStrictEqual(["Gender: Female"]);
    expect(warn).toHaveBeenCalledOnce();
    const message = String(warn.mock.calls[0][0]);
    expect(message).toMatch(/\bage\b/);
    expect(message).toMatch(/\bfavourite_colour\b/);
    // The visitor's answers themselves stay out of the logs.
    expect(message).not.toMatch(/Seventeen|Blue|Female/);
  });

  it("count a platform listed twice once", () => {
    expect(titles({ platforms: ["X (Twitter)", "X (Twitter)"] })).toStrictEqual(["Platform: X (Twitter)"]);
  });

  /* The breakdown's shape for a multi-select answer is unconfirmed. */
  it("read platforms sent as one joined string", () => {
    expect(titles({ platforms: "X (Twitter), Instagram" })).toStrictEqual([
      "Platform: X (Twitter)",
      "Platform: Instagram",
    ]);
    expect(titles({ platforms: "Instagram" })).toStrictEqual(["Platform: Instagram"]);
    // One piece that isn't an option and the whole string is unmatched, not guessed at.
    expect(titles({ platforms: "Instagram, Mastodon" })).toStrictEqual([]);
  });

  it("hand back the published points, separate from the words", () => {
    for (const factor of localInsights(v17({ age: "Under 18", platforms: ["Facebook"] })).riskFactors) {
      expect(factor.line).not.toMatch(/\d+ points?/);
    }
  });
});

describe("recommendations from a visitor's answers", () => {
  it("are the advice their answers call for, most points first", () => {
    const { recommendations } = localInsights(
      v17({
        platforms: ["Instagram", "Facebook"],
        posting_volume: "Weekly",
        q_il8uju: NO_MONITORING,
      }),
    );

    expect(recommendations).toStrictEqual([
      {
        title: "Set up alerts for your name and search for your photos",
        body: "Alerts for your name, and occasional searches for your name and photos on major platforms, can help you spot impostor accounts or misused photos early.",
        link: {
          url: "https://www.blueoceanglobaltech.com/blog/what-to-do-if-someone-is-impersonating-you-online/",
          label: null,
        },
      },
      {
        title: "Review who can see the photos you post",
        body: "Scammers target public social media accounts because taking multiple photos makes an impersonation account more realistic.",
        link: { url: "https://netsafe.org.nz/scams/impersonation-scams", label: null },
      },
      {
        title: "Know how to report intimate images on Instagram and Facebook",
        body: "Meta's apps let you report nude or sexual images of yourself, or threats to share them, to help prevent them from being reshared.",
        link: { url: "https://www.meta.com/en-gb/safety/topics/bullying-harassment/ncii/", label: null },
      },
    ]);
  });

  it("change with the answers", () => {
    expect(
      recommendationTitles({ q_il8uju: SERVICE, posting_volume: "Rarely (less than once a month)" }),
    ).toStrictEqual(["Don't rely on a monitoring service alone"]);
    expect(
      recommendationTitles({
        platforms: ["X (Twitter)"],
        posting_volume: "Daily or multiple times a day",
        q_il8uju: FRIENDS,
      }),
    ).toStrictEqual(["Review who can see the photos you post", "Set up alerts for your name and search for your photos"]);
  });

  it("give one reporting tip for Instagram and Facebook together", () => {
    expect(recommendationTitles({ platforms: ["Instagram", "Facebook"] })).toStrictEqual([
      "Know how to report intimate images on Instagram and Facebook",
    ]);
  });

  it("break ties in weight by catalogue order", () => {
    // Friends-and-family and Weekly are both 5 points.
    expect(recommendationTitles({ posting_volume: "Weekly", q_il8uju: FRIENDS })).toStrictEqual([
      "Set up alerts for your name and search for your photos",
      "Review who can see the photos you post",
    ]);
  });

  it("stop at three", () => {
    const recommendations = localInsights(
      v17({
        age: "Under 18",
        gender: "Female",
        platforms: ["X (Twitter)", "Snapchat", "Instagram", "Facebook", "TikTok", "YouTube"],
        prior_misuse: "Repeated pattern",
        posting_volume: "Daily or multiple times a day",
        q_il8uju: NO_MONITORING,
      }),
    ).recommendations;
    expect(recommendations.length).toBeLessThanOrEqual(3);
  });

  it("are left empty rather than filled when no answer calls for one", () => {
    expect(
      recommendationTitles({
        age: "25-34",
        gender: "Male",
        platforms: ["TikTok"],
        prior_misuse: "No known incidents",
        posting_volume: "Rarely (less than once a month)",
      }),
    ).toStrictEqual([]);
  });

  it("never depend on age or gender", () => {
    const base = { platforms: ["Instagram"], posting_volume: "Weekly" };
    const everyone = [
      { ...base, age: "18-24", gender: "Female" },
      { ...base, age: "55+", gender: "Male" },
      { ...base, age: "35-54", gender: "Non-Binary" },
    ].map((answers) => localInsights(v17(answers)).recommendations);
    expect(everyone[1]).toStrictEqual(everyone[0]);
    expect(everyone[2]).toStrictEqual(everyone[0]);
  });

  it("never bring back the old hardcoded advice", () => {
    const all = localInsights(
      v17({ platforms: ["YouTube", "Instagram"], posting_volume: "Weekly", q_il8uju: NO_MONITORING }),
    ).recommendations.map((r) => `${r.title} ${r.body}`);
    expect(all.join(" ")).not.toMatch(/YouTube's free likeness detection|Keep your social media private/);
  });
});

describe("which records get local cards", () => {
  it("a v17 record only when it was scored on the scoring the report prices", () => {
    const answers = { age: "18-24", platforms: ["Instagram"], q_il8uju: NO_MONITORING };
    const none = { riskFactors: [], recommendations: [] };

    expect(localInsights({ ...v17(answers), scoring_version: "likeness-score-v18" })).toStrictEqual(none);
    expect(localInsights(v17(answers)).riskFactors).not.toStrictEqual([]);
  });

  it("no record on a quiz version the table doesn't list, with a warning naming it", () => {
    const answers = { age: "18-24", platforms: ["Instagram"], q_il8uju: NO_MONITORING };
    const none = { riskFactors: [], recommendations: [] };

    for (const quiz_version of ["likeness-health-v12", "likeness-health-v3", "constructor", "toString"]) {
      expect(localInsights({ ...v17(answers), quiz_version })).toStrictEqual(none);
    }
    expect(String(warn.mock.calls[0][0])).toMatch(/no evidence profile for likeness-health-v12 \/ likeness-score-v17/);
  });

  it("a record with no breakdown gets nothing, without failing", () => {
    const bare = { quiz_version: "likeness-health-v17", scoring_version: "likeness-score-v17" };
    expect(localInsights(bare)).toStrictEqual({ riskFactors: [], recommendations: [] });
    expect(localInsights({ ...bare, breakdown: { quiz: "nope" } })).toStrictEqual({
      riskFactors: [],
      recommendations: [],
    });
  });

  /* The cards are built beside the score, never into it. */
  it("leave the score record untouched", () => {
    const record = v17({ age: "18-24", gender: "Female", platforms: ["X (Twitter)"] });
    const before = structuredClone(record);
    localInsights(Object.freeze(record));
    expect(record).toStrictEqual(before);
  });
});

describe("reading the breakdown", () => {
  it("keeps string and list values and skips anything else", () => {
    expect(
      answersFrom([
        { key: "age", value: "18-24" },
        { key: "platforms", value: ["Instagram"] },
        { key: "gender", value: 3 },
        { key: "posting_volume", value: ["Weekly", 2] },
        { value: "Weekly" },
        null,
      ]),
    ).toStrictEqual({ age: "18-24", platforms: ["Instagram"] });
  });

  it("classifies each answer by what the report has on it", () => {
    const status = (answers: QuizAnswers) =>
      classifyAnswers(answers).map((entry) => entry.evidence?.status ?? "unmatched");
    expect(status({ age: "18-24" })).toStrictEqual(["backed"]);
    expect(status({ age: "25-34" })).toStrictEqual(["unbacked"]);
    expect(status({ platforms: ["Snapchat"] })).toStrictEqual(["unavailable"]);
    expect(status({ age: "Under 17" })).toStrictEqual(["unmatched"]);
    expect(status({ gender: ["Female", "Male"] })).toStrictEqual(["unmatched"]);
  });
});

/* Prod's quiz. The breakdown shape - { key, value, deduction, type } per question -
   is the one the v17 path reads and the one an earlier real response showed the
   old card (commit 3acf825); a live v11 response hasn't been captured to confirm
   it, nor the scoring version string, which is why `scoring_version` here is a
   placeholder and the engine doesn't depend on it. */
const v11 = (entries: Record<string, [string | string[], number]>, scoring_version = "unknown") => ({
  quiz_version: "likeness-health-v11",
  scoring_version,
  breakdown: {
    quiz: Object.entries(entries).map(([key, [value, deduction]]) => ({
      key,
      value,
      deduction,
      type: "quiz",
    })),
  },
});

describe("a v11 record", () => {
  /* Under v17's points this would be X (7), 18-24 (6), Female (6). The record says
     gender cost more than age, and that is what decides. */
  it("is ranked by what its own breakdown says each question cost", () => {
    const { riskFactors } = localInsights(
      v11({
        age: ["18-24", 3],
        gender: ["Female", 7],
        platforms: [["X (Twitter)", "Instagram"], 8],
        discovery_method: [SERVICE, 2],
      }),
    );

    expect(riskFactors.map(({ key, title, points }) => [key, title, points])).toStrictEqual([
      ["platforms", "Platform: X (Twitter)", 8],
      ["gender", "Gender: Female", 7],
      ["age", "Age: 18-24", 3],
    ]);
  });

  it("says what the report says about each answer, word for word", () => {
    const v11Lines = localInsights(v11({ gender: ["Non-Binary", 4] })).riskFactors.map((f) => f.line);
    const v17Lines = localInsights(v17({ gender: "Non-Binary" })).riskFactors.map((f) => f.line);
    expect(v11Lines).toStrictEqual(v17Lines);
  });

  /* The record prices the platforms question, not each platform. */
  it("shows one platform row, the report's strongest pick, at the question's whole cost", () => {
    const all = localInsights(v11({ platforms: [["Facebook", "Instagram", "X (Twitter)"], 8] }));
    expect(all.riskFactors.map(({ title, points }) => [title, points])).toStrictEqual([
      ["Platform: X (Twitter)", 8],
    ]);

    const meta = localInsights(v11({ platforms: [["Facebook", "Instagram"], 6] }));
    expect(meta.riskFactors.map(({ title }) => title)).toStrictEqual(["Platform: Instagram"]);
  });

  it("names the monitoring question as v11 does", () => {
    const [factor] = localInsights(v11({ discovery_method: [SERVICE, 2] })).riskFactors;
    expect(factor).toMatchObject({ key: "discovery_method", title: "Monitoring: a detection service" });
  });

  it("stops at three", () => {
    const { riskFactors } = localInsights(
      v11({
        age: ["Under 18", 9],
        gender: ["Female", 6],
        platforms: [["Instagram"], 4],
        discovery_method: [SERVICE, 2],
      }),
    );
    expect(riskFactors.map(({ title }) => title)).toStrictEqual([
      "Age: Under 18",
      "Gender: Female",
      "Platform: Instagram",
    ]);
  });

  it("breaks equal costs in the report's order", () => {
    const { riskFactors } = localInsights(v11({ gender: ["Female", 6], age: ["18-24", 6] }));
    expect(riskFactors.map(({ title }) => title)).toStrictEqual(["Age: 18-24", "Gender: Female"]);
  });

  /* Never priced at zero, never shown as having determined the score. */
  it("leaves out a question that cost nothing, or whose cost the record doesn't give", () => {
    expect(localInsights(v11({ age: ["18-24", 0], gender: ["Female", 6] })).riskFactors.map((f) => f.title))
      .toStrictEqual(["Gender: Female"]);

    const noCost = {
      ...v11({ gender: ["Female", 6] }),
      breakdown: {
        quiz: [
          { key: "age", value: "18-24", type: "quiz" },
          { key: "gender", value: "Female", deduction: 6, type: "quiz" },
        ],
      },
    };
    expect(localInsights(noCost).riskFactors.map((f) => f.title)).toStrictEqual(["Gender: Female"]);
  });

  /* v11 asks about photos "shared … by you or by others"; v17's posting evidence is
     about the visitor's own posting. And prior misuse has no usable evidence. */
  it("says nothing about posting frequency or prior misuse, and doesn't warn about them", () => {
    const insights = localInsights(
      v11({
        posting_volume: ["Daily or multiple times a day", 8],
        prior_misuse: ["Happens regularly", 10],
      }),
    );
    expect(insights).toStrictEqual({ riskFactors: [], recommendations: [] });
    expect(warn).not.toHaveBeenCalled();
  });

  it("says nothing for answers the report doesn't back", () => {
    expect(
      localInsights(
        v11({
          age: ["25-34", 4],
          gender: ["Male", 1],
          platforms: [["TikTok", "YouTube", "Snapchat"], 6],
          discovery_method: [NO_MONITORING, 8],
        }),
      ).riskFactors,
    ).toStrictEqual([]);
  });

  it("warns, by key only, about a question the table has never seen", () => {
    localInsights(v11({ gender: ["Female", 6], q_il8uju: [SERVICE, 2] }));
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toMatch(/likeness-health-v11 answers to q_il8uju$/);
  });

  it("reads platforms sent as one joined string", () => {
    expect(
      localInsights(v11({ platforms: ["Instagram, X (Twitter)", 8] })).riskFactors.map((f) => f.title),
    ).toStrictEqual(["Platform: X (Twitter)"]);
  });

  it("doesn't depend on which scoring version priced it", () => {
    const entries = { age: ["18-24", 6], platforms: [["Instagram"], 4] } as Record<string, [string | string[], number]>;
    expect(localInsights(v11(entries, "likeness-score-v11"))).toStrictEqual(
      localInsights(v11(entries, "something-else")),
    );
  });

  it("warns, and shows nothing, when its breakdown can't be read", () => {
    const unreadable = { ...v11({}), breakdown: { quiz: [{ question: "age", answer: "18-24" }] } };
    expect(localInsights(unreadable)).toStrictEqual({ riskFactors: [], recommendations: [] });
    expect(String(warn.mock.calls[0][0])).toMatch(/no readable answers/);
  });

  describe("recommendations", () => {
    it("come from the mapped questions, ranked by the record's costs", () => {
      // v17's points would put the friends-and-family tip (5) above Instagram's (4).
      expect(
        localInsights(v11({ platforms: [["Instagram"], 9], discovery_method: [FRIENDS, 5] }))
          .recommendations.map((r) => r.title),
      ).toStrictEqual([
        "Know how to report intimate images on Instagram and Facebook",
        "Set up alerts for your name and search for your photos",
      ]);
    });

    it("never include the photo-visibility tip, whose trigger v11 asks differently", () => {
      const titles = localInsights(
        v11({ posting_volume: ["Weekly", 5], discovery_method: [SERVICE, 2], platforms: [["Facebook"], 3] }),
      ).recommendations.map((r) => r.title);
      expect(titles).toStrictEqual([
        "Know how to report intimate images on Instagram and Facebook",
        "Don't rely on a monitoring service alone",
      ]);
    });

    it("still count a trigger whose cost the record doesn't give, after those that have one", () => {
      const record = {
        ...v11({}),
        breakdown: {
          quiz: [
            { key: "discovery_method", value: NO_MONITORING, type: "quiz" },
            { key: "platforms", value: ["Facebook"], deduction: 3, type: "quiz" },
          ],
        },
      };
      expect(localInsights(record).recommendations.map((r) => r.title)).toStrictEqual([
        "Know how to report intimate images on Instagram and Facebook",
        "Set up alerts for your name and search for your photos",
      ]);
    });
  });
});

/* The development log line that says why a card is empty. It must never carry what
   the visitor answered or what each answer cost. */
describe("describing a record for the log", () => {
  it("tells absent, null and an empty list apart", () => {
    expect([undefined, null, [], ["a", "b"], "x", 3].map(shapeOf)).toStrictEqual([
      "absent",
      "null",
      "list(0)",
      "list(2)",
      "string",
      "number",
    ]);
  });

  it("gives the structure of a v11 record and none of its answers or costs", () => {
    const line = describeRecord(
      v11(
        {
          age: ["18-24", 6],
          gender: ["Female", 6],
          platforms: [["X (Twitter)", "Instagram"], 8],
          posting_volume: ["Weekly", 0],
          discovery_method: ["Seventeen", 3],
        },
        "likeness-score-v11",
      ),
    );

    expect(line).toBe(
      "likeness-health-v11 / likeness-score-v11, profile recorded, breakdown.quiz 5 [" +
        "age:string:known:cost>0 gender:string:known:cost>0 platforms:list(2):known:cost>0 " +
        "posting_volume:string:omitted:cost<=0 discovery_method:string:UNKNOWN:cost>0]",
    );
    for (const secret of ["18-24", "Female", "Twitter", "Instagram", "Weekly", "Seventeen", " 6", " 8"]) {
      expect(line).not.toContain(secret);
    }
  });

  it("says when there is no profile for the record's versions", () => {
    expect(describeRecord({ ...v11({ age: ["18-24", 6] }), quiz_version: "likeness-health-v3" })).toBe(
      "likeness-health-v3 / unknown, profile none, breakdown.quiz 1 [age:string:unmapped:cost>0]",
    );
  });

  it("describes a missing or malformed breakdown without failing", () => {
    const bare = { quiz_version: "likeness-health-v11", scoring_version: "s" };
    expect(describeRecord(bare)).toBe("likeness-health-v11 / s, profile recorded, breakdown.quiz absent");
    expect(
      describeRecord({ ...bare, breakdown: { quiz: [null, { value: "x" }, { key: "age", value: 4 }] } }),
    ).toBe("likeness-health-v11 / s, profile recorded, breakdown.quiz 3 [null key:absent age:number:BAD-VALUE:cost:absent]");
  });
});

/* The gender row comes from the saved gender answer and nothing else: an exact match
   on the option, so one gender's evidence can never be shown for another. */
describe("the gender factor", () => {
  const NON_BINARY_LINE =
    "Queer people reportedly bear a disproportionate share of AI-based sexual abuse content, and AI systems risk stereotyping nonbinary people.";
  const genderRows = (insights: ReturnType<typeof localInsights>) =>
    insights.riskFactors.filter((factor) => factor.key === "gender");

  for (const [version, record] of [
    ["v17", (gender: string | string[] | undefined) => v17(gender === undefined ? {} : { gender })],
    ["v11", (gender: string | string[] | undefined) => v11(gender === undefined ? {} : { gender: [gender, 4] })],
  ] as const) {
    describe(`on a ${version} record`, () => {
      it("is the Non-Binary factor only for a saved Non-Binary answer", () => {
        expect(genderRows(localInsights(record("Non-Binary")))).toStrictEqual([
          expect.objectContaining({ title: "Gender: Non-Binary", line: NON_BINARY_LINE }),
        ]);
      });

      it("is the Female factor for Female, never Non-Binary", () => {
        const rows = genderRows(localInsights(record("Female")));
        expect(rows.map((row) => row.title)).toStrictEqual(["Gender: Female"]);
        expect(rows.map((row) => row.line)).not.toContain(NON_BINARY_LINE);
      });

      /* Neither has evidence in the report, so neither gets a row - least of all the
         Non-Binary one. */
      for (const gender of ["Male", "Prefer not to say"]) {
        it(`is absent for ${gender}`, () => {
          expect(genderRows(localInsights(record(gender)))).toStrictEqual([]);
        });
      }

      it("is absent when the saved answer is missing", () => {
        expect(genderRows(localInsights(record(undefined)))).toStrictEqual([]);
      });

      /* Close to the option is not the option. */
      for (const gender of ["non-binary", "Nonbinary", "Non-Binary ", "", "Other"]) {
        it(`is absent for an unknown answer ${JSON.stringify(gender)}`, () => {
          expect(genderRows(localInsights(record(gender)))).toStrictEqual([]);
        });
      }

      it("is absent for a list where one answer was expected", () => {
        expect(genderRows(localInsights(record(["Female", "Non-Binary"])))).toStrictEqual([]);
      });
    });
  }

  it("leaves the other factors and the recommendations as they were", () => {
    const withMale = localInsights(
      v11({
        age: ["18-24", 6],
        gender: ["Male", 1],
        platforms: [["X (Twitter)"], 8],
        discovery_method: [NO_MONITORING, 8],
      }),
    );
    expect(withMale.riskFactors.map(({ title }) => title)).toStrictEqual([
      "Platform: X (Twitter)",
      "Age: 18-24",
    ]);
    expect(withMale.recommendations.map(({ title }) => title)).toStrictEqual([
      "Set up alerts for your name and search for your photos",
    ]);
  });
});
