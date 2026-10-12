/**
 * What the "General recommendations" card may say, and to whom — drawn from the same
 * v17 evidence report as ./evidence-v17.ts. TEMPORARY, with the rest of this folder.
 *
 * Every entry is advice a cited page actually gives or a finding it actually
 * reports, with that page's own words kept beside it in `quote` so the body can be
 * checked against it. The link is always that page. An entry is shown only to
 * visitors whose answers it addresses, and nothing here is keyed on age or gender:
 * the report's evidence for those answers describes who is targeted, and there is no
 * action in it that follows from being in a group.
 *
 * Considered and left out, so nobody adds them back without the evidence:
 *   - Reporting misuse on X as a copyright (DMCA) claim. The audit cited for X found
 *     it far more effective, but a DMCA notice needs the copyright, and X sent the
 *     poster an email about the report. Not advice to generate for a stranger.
 *   - Anything for prior misuse. Its only backed answer couldn't be loaded.
 *   - Anything for age 55+. The sources read include advice pages for older adults,
 *     but the report quotes none of their advice.
 */

import { CITED } from "./evidence-v17";

export type LocalRecommendation = {
  id: string;
  /** Shown to a visitor who gave any of these answers to this question. */
  when: { key: string; answers: readonly string[] };
  /** An instruction. At most 80 characters. */
  title: string;
  /** One sentence, at most 200. */
  body: string;
  /** The page the body rests on — always one the report cites. */
  link: { url: string; label: string | null };
  /** That page's own words, as the report quotes them. */
  quote: string;
};

export const RECOMMENDATIONS_V17: readonly LocalRecommendation[] = [
  {
    /* The advice is cited for the answer that DOES subscribe to a service; it is shown
       to the two that don't, which is who it is advice for. */
    id: "monitoring-alerts",
    when: {
      key: "q_il8uju",
      answers: [
        "I don’t have a way to monitor my likeness",
        "I rely on friends and family to tell me what they've seen",
      ],
    },
    title: "Set up alerts for your name and search for your photos",
    body: "Alerts for your name, and occasional searches for your name and photos on major platforms, can help you spot impostor accounts or misused photos early.",
    link: { url: CITED.BLUEOCEAN, label: null },
    quote:
      "you can set up Google Alerts for your name, brand, or organization, and occasionally search for your own name and photos across major platforms.",
  },
  {
    id: "meta-reporting",
    when: { key: "platforms", answers: ["Instagram", "Facebook"] },
    title: "Know how to report intimate images on Instagram and Facebook",
    body: "Meta's apps let you report nude or sexual images of yourself, or threats to share them, to help prevent them from being reshared.",
    link: { url: CITED.META_NCII, label: null },
    quote:
      "You can report nude or sexual photos or videos of yourself or threats to share these images or videos to our apps or technologies to prevent them from being reshared.",
  },
  {
    /* Says nothing about whether THIS visitor's accounts are public — the quiz never
       asks. "Review who can see" holds either way. */
    id: "photo-visibility",
    when: {
      key: "posting_volume",
      answers: ["Around once a month", "Weekly", "Daily or multiple times a day"],
    },
    title: "Review who can see the photos you post",
    body: "Scammers target public social media accounts because taking multiple photos makes an impersonation account more realistic.",
    link: { url: CITED.NETSAFE, label: null },
    quote:
      "Scammers target public social media accounts like Instagram as they can then take multiple photos to make the impersonation account more realistic.",
  },
  {
    /* For the visitor who already pays for monitoring: no tool catches everything,
       and the report's own reasoning for this answer says so. */
    id: "monitoring-limits",
    when: { key: "q_il8uju", answers: ["I subscribe to a likeness detection/monitoring service"] },
    title: "Don't rely on a monitoring service alone",
    body: "Deepfake detectors trained on celebrity faces have been found significantly less effective at spotting deepfakes of people who aren't celebrities.",
    link: { url: CITED.CSIRO_DETECTORS, label: null },
    quote:
      "the ICT (Identity Consistent Transformer) detector, which was trained on celebrity faces, was significantly less effective at detecting deepfakes featuring non-celebrities",
  },
];
