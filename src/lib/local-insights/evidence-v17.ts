/**
 * The published quiz evidence report for likeness-health-v17, transcribed.
 *
 * Source: "Published quiz evidence report — likeness-health-v17 — 2026-10-13.pdf",
 * from the ImageShield control room (release 14, published 9 Oct 2026). TEMPORARY:
 * this folder exists only until the API serves `score.risk_factors` and
 * `general_recommendations`, and is deleted with it — see `localInsights`.
 *
 * Three kinds of answer, and the difference is the point of the file:
 *
 *   backed       the report shows answer-specific reasoning and the evidence behind
 *                it. The only kind that can become a risk factor.
 *   unbacked     "Set before evidence was recorded". The points are real — they are
 *                what the score deducted — but no research stands behind them, so
 *                there is nothing to say about them.
 *   unavailable  counted as backed on the report's summary page, but every part of
 *                its reasoning and evidence reads "Couldn't load this part". Backed
 *                somewhere, and unreadable here, which says no more than unbacked.
 *
 * `reasoning` is the report's own text, verbatim, so every `line` can be checked
 * against what it summarises. A `line` keeps the reasoning's claim and drops what is
 * about the scoring rather than the person ("This supports a high deduction"). It
 * states a pattern the research found, never that it has happened to this visitor.
 *
 * Answers are the option strings `GET /v1/quiz` serves for v17, which are what the
 * API validates and stores — checked character for character against the dev API's
 * definition on 2026-10-13, curly apostrophe included.
 */

export const REPORT = {
  quizVersion: "likeness-health-v17",
  scoringVersion: "likeness-score-v17",
  release: 14,
  generatedAt: "2026-10-13",
} as const;

export type EvidenceStatus = "backed" | "unbacked" | "unavailable";

export type AnswerEvidence = {
  /** The option string, exactly as the quiz serves it. */
  answer: string;
  /** What the published scoring deducts for it. */
  points: number;
} & (
  | {
      status: "backed";
      /** When the suggestion these points came from was made. */
      suggestedOn: string;
      /** The report's reasoning for this answer, verbatim. */
      reasoning: string;
      /** The card's title. At most 40 characters. */
      title: string;
      /** The card's sentence: `reasoning`, kept to its claim. At most 160. */
      line: string;
      /** Every page the report cites for this answer. */
      sources: readonly string[];
      /** Anything about this entry the report itself doesn't square. */
      note?: string;
    }
  | { status: "unbacked" | "unavailable" }
);

export type EvidenceQuestion = {
  key: string;
  /** Multi-select: an answer is several options, each with its own evidence. */
  multi: boolean;
  /** In the report's order, which is the quiz's. */
  answers: readonly AnswerEvidence[];
};

/* Pages cited for more than one answer. */
const NBC_DEFIANCE =
  "https://www.nbcnews.com/tech/tech-news/defiance-act-passes-senate-allow-deepfake-victims-sue-rcna163464";
const MEDIAPOST_TIKTOK =
  "https://www.mediapost.com/publications/article/410534/judge-signals-tiktok-will-have-to-face-suit-over-c.html";
const HCSK_SENIORS = "https://seniors.hcsk.org/ai-powered-scams-targeting-seniors/";
const ULTRAVIOLET = "https://weareultraviolet.org/ai-demands-fight-sexism/";
const NY_OPDV = "https://opdv.ny.gov/tfgbv-deepfakes-and-image-based-abuse";
const GIZMODO_GROK =
  "https://gizmodo.com/elon-musks-x-says-it-will-sort-of-crack-down-on-groks-sexual-deepfake-problem-2000710658";
const ARXIV_X_AUDIT = "https://arxiv.org/html/2409.12138v1";
const AWKO_X = "https://www.awkolaw.com/litigation-areas/x-formerly-twitter-lawsuit/";
const AIR_LIKENESS =
  "https://air.io/en/youtube-hacks/youtube-ai-policy-2026-likeness-detection-and-the-no-fakes-act-what-creators-need-to-know";
const IMH_LABELS = "https://influencermarketinghub.com/ai-disclosure-rules/";
const META_NCII = "https://www.meta.com/en-gb/safety/topics/bullying-harassment/ncii/";
const EPIC_SOCIAL = "https://epic.org/issues/consumer-privacy/social-media-privacy/";
const SECURITYHERO = "https://www.securityhero.io/dangers-posting-picture-information-online/";
const NETSAFE = "https://netsafe.org.nz/scams/impersonation-scams";
const BLUEOCEAN =
  "https://www.blueoceanglobaltech.com/blog/what-to-do-if-someone-is-impersonating-you-online/";
const CSIRO_DETECTORS =
  "https://www.csiro.au/en/news/all/news/2025/march/research-reveals-major-vulnerabilities-in-deepfake-detectors";

export const QUESTIONS: readonly EvidenceQuestion[] = [
  {
    key: "age",
    multi: false,
    answers: [
      {
        answer: "Under 18",
        points: 8,
        status: "backed",
        suggestedOn: "2026-10-08",
        reasoning:
          "Minors face documented sexual deepfakes made by classmates, and platforms are accused of collecting children's data, including profile images, without parental consent and of failing to enforce age limits. This supports a high deduction.",
        title: "Age: Under 18",
        line: "Minors face documented sexual deepfakes made by classmates, and platforms are accused of collecting children's profile images without parental consent.",
        sources: [
          NBC_DEFIANCE,
          MEDIAPOST_TIKTOK,
          "https://www.kellerrohrback.com/news/tiktok-child-privacy-litigation",
          "https://www.lieffcabraser.com/injury/social-media-addictions/",
          "https://19thnews.org/2026/01/senate-defiance-act-nonconsensual-images-deepfakes/",
        ],
      },
      {
        answer: "18-24",
        points: 6,
        status: "backed",
        suggestedOn: "2026-10-09",
        reasoning:
          "Government data show deepfake sexual-abuse victims are overwhelmingly in their teens and 20s, and youth surveys identify young adult women as among the most affected.",
        title: "Age: 18-24",
        line: "Government data show deepfake sexual-abuse victims are overwhelmingly in their teens and 20s, and surveys find young adult women among the most affected.",
        sources: [
          "https://www.koreajoongangdaily.com/korea/vast-majority-of-deepfake-crimes-target-women-in-teens-and-twenties-data/12515001",
          "https://www.thorn.org/research/library/deepfake-nudes-and-young-people/",
        ],
      },
      { answer: "25-34", points: 4, status: "unbacked" },
      { answer: "35-54", points: 3, status: "unbacked" },
      {
        answer: "55+",
        points: 3,
        status: "backed",
        suggestedOn: "2026-10-08",
        reasoning:
          "Older adults are the main targets of AI impersonation scams, such as voice-cloned grandparent calls and deepfake ads on Facebook and Instagram. However, the likenesses being misused are mostly other people's, so a moderate deduction fits.",
        title: "Age: 55+",
        line: "Older adults are the main targets of AI impersonation scams like voice-cloned grandparent calls, though the likenesses misused are mostly other people's.",
        sources: [
          "https://www.ussfcu.org/media-center/security-corner/blog-detail-security-corner.html?cId=96070&title=is-that-really-your-grandchild-the-dangers-of-ai-impersonation-scams",
          HCSK_SENIORS,
          "https://www.journalofaccountancy.com/issues/2026/apr/elder-fraud-rises-as-scammers-use-ai/",
        ],
      },
    ],
  },
  {
    key: "gender",
    multi: false,
    answers: [
      {
        answer: "Female",
        points: 6,
        status: "backed",
        suggestedOn: "2026-10-09",
        reasoning:
          "Women are targeted by deepfakes about 4.5 times more often than men, and nearly all sexual deepfakes and most image-based abuse victims are women. This supports a higher deduction than today's live value.",
        title: "Gender: Female",
        line: "Women are targeted by deepfakes about 4.5 times more often than men, and nearly all sexual deepfakes and most image-based abuse victims are women.",
        sources: [
          "https://programs.com/resources/deepfake-stats/",
          NY_OPDV,
          ULTRAVIOLET,
          "https://www.eset.com/uk/about/newsroom/press-releases/nearly-two-thirds-of-women-worry-about-being-a-victim-of-deepfake-pornography-eset-uk-research-reveals/",
          NBC_DEFIANCE,
        ],
      },
      { answer: "Male", points: 1, status: "unbacked" },
      {
        answer: "Non-Binary",
        points: 4,
        status: "backed",
        suggestedOn: "2026-10-09",
        reasoning:
          "Queer people reportedly bear a disproportionate share of AI-based sexual abuse content, and AI systems risk stereotyping nonbinary people. The evidence is less quantified than it is for women.",
        title: "Gender: Non-Binary",
        /* "reportedly" is the report's own hedge, and it stays: this evidence is the
           thinnest of any backed answer. */
        line: "Queer people reportedly bear a disproportionate share of AI-based sexual abuse content, and AI systems risk stereotyping nonbinary people.",
        sources: [ULTRAVIOLET],
        note: "The answer table says 'Backed by more than one publisher', but both excerpts and the only source read come from weareultraviolet.org.",
      },
      { answer: "Prefer not to say", points: 2, status: "unbacked" },
    ],
  },
  {
    /* Mutable, capped at 8 across every selection. Each platform is ranked on its own
       points; the cap is the score's business, not the card's. */
    key: "platforms",
    multi: true,
    answers: [
      {
        answer: "X (Twitter)",
        points: 7,
        status: "backed",
        suggestedOn: "2026-10-08",
        reasoning:
          "Evidence shows X's Grok tool was widely abused to make sexualized deepfakes from users' photos, and a reporting audit found 0% removal under X's own nudity policy. Regulator investigations and effective DMCA takedowns only partly offset this.",
        title: "Platform: X (Twitter)",
        line: "X's Grok tool was widely abused to make sexualized deepfakes from users' photos, and an audit found X removed none reported under its own nudity policy.",
        sources: [GIZMODO_GROK, ARXIV_X_AUDIT, AWKO_X, AIR_LIKENESS],
      },
      { answer: "Snapchat", points: 4, status: "unavailable" },
      {
        answer: "Instagram",
        points: 4,
        status: "backed",
        suggestedOn: "2026-10-08",
        reasoning:
          "Instagram has C2PA-based AI labeling, NCII reporting and prohibition, and teen-account protections. However, it is not covered by face-likeness scanning like YouTube's.",
        title: "Platform: Instagram",
        /* "C2PA-based": it labels content carrying provenance metadata, not all AI
           content — see the influencermarketinghub.com excerpt in the report. */
        line: "Instagram has intimate-image reporting and labels AI content carrying C2PA provenance data, but isn't covered by face-likeness scanning like YouTube's.",
        sources: [IMH_LABELS, META_NCII, AIR_LIKENESS],
      },
      {
        answer: "Facebook",
        points: 3,
        status: "backed",
        suggestedOn: "2026-10-08",
        reasoning:
          "Facebook shares Meta's AI labeling, NCII prohibition and reporting pathways. The Oversight Board flagged that appeals of image-based abuse reports are auto-closed within 48 hours.",
        title: "Platform: Facebook",
        /* The Board's concern was appeals of IMAGE-BASED abuse reports specifically. */
        line: "Facebook shares Meta's AI labels and reporting, but the Oversight Board flagged that appeals of image-based abuse reports are auto-closed within 48 hours.",
        sources: [
          "https://www.medianama.com/2024/07/223-meta-oversight-board-non-consensual-image-removal-process/",
          IMH_LABELS,
          META_NCII,
        ],
      },
      { answer: "TikTok", points: 3, status: "unbacked" },
      { answer: "YouTube", points: 2, status: "unbacked" },
    ],
  },
  {
    /* The answer worth the most points in the whole quiz has no evidence behind it,
       and the only backed one couldn't be loaded. Nothing here becomes a factor. */
    key: "prior_misuse",
    multi: false,
    answers: [
      { answer: "No known incidents", points: 0, status: "unbacked" },
      { answer: "Once or twice", points: 7, status: "unavailable" },
      { answer: "Repeated pattern", points: 10, status: "unbacked" },
    ],
  },
  {
    key: "posting_volume",
    multi: false,
    answers: [
      {
        answer: "Rarely (less than once a month)",
        points: 1,
        status: "backed",
        suggestedOn: "2026-10-09",
        reasoning:
          "Even a few public photos can be scraped or used to make deepfakes, so infrequent posting still carries a small exposure.",
        title: "Posting: Rarely",
        line: "Even a few public photos can be scraped or used to make deepfakes, so posting rarely still carries a small exposure.",
        sources: ["https://sumsub.com/blog/ai-deepfakes-and-creator-economy-fraud/", EPIC_SOCIAL],
      },
      {
        answer: "Around once a month",
        points: 3,
        status: "backed",
        suggestedOn: "2026-10-09",
        reasoning:
          "A steady trickle of new images builds a larger pool that can be scraped, used in deepfakes, or stolen for fake profiles.",
        title: "Posting: Around once a month",
        line: "A steady trickle of new images builds a larger pool that can be scraped, used in deepfakes, or stolen for fake profiles.",
        sources: [EPIC_SOCIAL, SECURITYHERO],
      },
      {
        answer: "Weekly",
        points: 5,
        status: "backed",
        suggestedOn: "2026-10-09",
        reasoning:
          "Weekly posting gives scammers many varied photos for convincing impersonation profiles. It also reveals routines that can be exploited.",
        title: "Posting: Weekly",
        line: "Weekly posting gives scammers many varied photos for convincing impersonation profiles, and reveals routines that can be exploited.",
        sources: [
          SECURITYHERO,
          NETSAFE,
          "https://www.bitdefender.com/en-us/blog/hotforsecurity/oversharing-online-scams-deepfakes-privacy",
        ],
      },
      { answer: "Daily or multiple times a day", points: 8, status: "unbacked" },
    ],
  },
  {
    /* "How do you monitor how your face, your likeness is used online?" — the key is
       the server's generated id for it on v17, and the v11 quiz calls the same
       question `discovery_method`. */
    key: "q_il8uju",
    multi: false,
    answers: [
      { answer: "I don’t have a way to monitor my likeness", points: 8, status: "unbacked" },
      {
        answer: "I rely on friends and family to tell me what they've seen",
        points: 5,
        status: "unavailable",
      },
      {
        answer: "I subscribe to a likeness detection/monitoring service",
        points: 2,
        status: "backed",
        suggestedOn: "2026-10-09",
        reasoning:
          "Dedicated monitoring and takedown services help detect misused photos early and get them removed. Some exposure remains because detection tools are still imperfect against real-world deepfakes, especially of non-celebrities.",
        title: "Monitoring: a detection service",
        line: "Monitoring services help spot misused photos early, but detection tools are still imperfect against real-world deepfakes, especially of non-celebrities.",
        sources: [
          BLUEOCEAN,
          SECURITYHERO,
          "https://pimeyes.com/en/faq",
          "https://arxiv.org/html/2503.02857v5",
          CSIRO_DETECTORS,
        ],
      },
    ],
  },
];

/* Re-exported for the recommendations, which link to pages cited above. */
export const CITED = { BLUEOCEAN, META_NCII, NETSAFE, CSIRO_DETECTORS } as const;
