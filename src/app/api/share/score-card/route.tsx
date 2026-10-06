import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { bandLabel, riskLevelOf } from "@/lib/score";
import { loadScore } from "@/lib/score-record";
import { linkLabel, POSTER_SIZE, SHARE_PITCH, SHARE_URL } from "@/lib/score-share";
import { CENTER, FRAME, HEADROOM, posterGaugeSvg, TICKS } from "./gauge";

/**
 * GET /api/share/score-card — the picture a visitor shares: their score card on the
 * app's branded 9:16 poster, as a PNG.
 *
 * The app's `ScoreSharePoster` + `ScoreShareCard`, measurement for measurement. Why
 * a poster rather than the card alone is the app's reason too: Instagram and
 * Snapchat stories drop the caption and keep only the image, so the mark, the claim
 * and the link all have to be readable INSIDE the picture.
 *
 * Drawn on the server, off the session cookie, so the number in it is the stored
 * score — never one a query string could edit — and so it needs no canvas or
 * screenshot library in the browser.
 */

/* The app lays the poster out at 405pt wide and writes it at 1080px. Every number
   below is the app's own, in points, run through this — so each one can be checked
   against the app's source rather than against a second set of pixel values. */
const K = POSTER_SIZE.width / 405;
const px = (pt: number) => pt * K;

/* Plus Jakarta Sans as TTF: the renderer reads ttf/otf/woff only, not the woff2 the
   page itself loads. Read once per server, not per request. */
const fontDir = join(process.cwd(), "assets/fonts");
const [regular, medium, semibold, bold, logo] = await Promise.all([
  readFile(join(fontDir, "PlusJakartaSans-Regular.ttf")),
  readFile(join(fontDir, "PlusJakartaSans-Medium.ttf")),
  readFile(join(fontDir, "PlusJakartaSans-SemiBold.ttf")),
  readFile(join(fontDir, "PlusJakartaSans-Bold.ttf")),
  readFile(join(process.cwd(), "public/media/logo-wordmark.svg")),
]);
const FONT = "Plus Jakarta Sans";
const fonts = [
  { name: FONT, data: regular, weight: 400 as const, style: "normal" as const },
  { name: FONT, data: medium, weight: 500 as const, style: "normal" as const },
  { name: FONT, data: semibold, weight: 600 as const, style: "normal" as const },
  { name: FONT, data: bold, weight: 700 as const, style: "normal" as const },
];
const LOGO = `data:image/svg+xml;base64,${logo.toString("base64")}`;

/** The app's band colours, by the band the API served. */
const RISK_COLOUR = { low: "#39BEB7", moderate: "#FFB020", high: "#FF3B5C" } as const;

/** The legend as the app's card prints it: best band first, hyphenated ranges. */
const LEGEND = [
  { colour: RISK_COLOUR.low, label: "Low Risk", range: "80-100" },
  { colour: RISK_COLOUR.moderate, label: "Moderate Risk", range: "50-79" },
  { colour: RISK_COLOUR.high, label: "High Risk", range: "0-49" },
];

/**
 * Where a line box has to start for its text to sit on `baseline`, at a line height
 * equal to the font size. 0.908 is Plus Jakarta Sans's own: ascender 1.038 and
 * descender 0.222 centre a 1.26em content box in a 1em line, putting the baseline
 * 0.908em down. The app's export gives baselines, so this is how they're honoured.
 */
const topFor = (baseline: number, size: number) => baseline - 0.908 * size;

/**
 * A line of text whose ℠ is drawn the way the card title draws its own: the font
 * has no ℠ glyph, so the mark is "SM" at 7/16 of the text's size on a line half as
 * tall, which a flex row hangs from the top of the line — a superscript. The
 * caller's div sets the size and weight; these are the numbers it set them to.
 */
function Marked({ text, size, lineHeight }: { text: string; size: number; lineHeight: number }) {
  const at = text.indexOf("℠");
  if (at === -1) return <div style={{ display: "flex" }}>{text}</div>;

  const after = text.slice(at + 1);
  return (
    <div style={{ display: "flex" }}>
      {text.slice(0, at)}
      <span style={{ fontSize: (size * 7) / 16, lineHeight: `${lineHeight / 2}px`, marginLeft: px(1) }}>
        SM
      </span>
      {after ? after : null}
    </div>
  );
}

const UNAVAILABLE: Record<string, number> = {
  "signed-out": 401,
  stale: 401,
  missing: 404,
  outdated: 409,
  pending: 409,
  unavailable: 502,
};

export async function GET() {
  const loaded = await loadScore();
  if (!loaded.ok) {
    return Response.json(
      { error: "No score to share", reason: loaded.reason },
      { status: UNAVAILABLE[loaded.reason] ?? 502 },
    );
  }

  const { score } = loaded.record;
  const level = riskLevelOf(score);
  const gauge = `data:image/svg+xml;base64,${Buffer.from(
    posterGaugeSvg(score.live, level),
  ).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          height: "100%",
          /* The colour it falls back to if the gradient doesn't draw — never white. */
          backgroundColor: "#380E99",
          backgroundImage: "linear-gradient(180deg, #7F48FF 0%, #380E99 100%)",
          padding: `${px(56)}px ${px(21.5)}px ${px(48)}px`,
          fontFamily: FONT,
        }}
      >
        {/* The lockup signs the picture; under half the canvas, as the app's. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page. */}
        <img src={LOGO} width={px(160)} height={(px(160) * 40) / 178} alt="" />

        {/* The card, centred in whatever the mark and the footer leave. */}
        <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: px(362),
              backgroundColor: "#FFFFFF",
              borderRadius: px(16),
              border: `${px(1)}px solid #DEDEDE`,
              paddingTop: px(26.2),
              paddingBottom: px(24.5),
            }}
          >
            {/* The font has no ℠ glyph, so it is set the way the page sets it.
                "My", not the app card's "Your": this is the sharer's own post, read
                by someone else, so it speaks in the first person like the line
                under the card does. */}
            <div
              style={{
                display: "flex",
                paddingLeft: px(18.8),
                fontSize: px(16),
                lineHeight: `${px(20)}px`,
                fontWeight: 700,
                color: "#212121",
              }}
            >
              My Likeness Health Score
              <span style={{ fontSize: px(7), lineHeight: `${px(10)}px`, marginLeft: px(1) }}>
                SM
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: px(179.2),
                  paddingLeft: px(19),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    marginTop: px(14.7),
                    minHeight: px(56),
                    fontSize: px(50),
                    lineHeight: `${px(50)}px`,
                    fontWeight: 700,
                    color: "#212121",
                  }}
                >
                  {String(score.live)}
                </div>
                {/* The app's month-trend slot. A score from the funnel is brand new
                    and has no month behind it, so the slot stays empty — at its
                    height, so the legend sits where the app's does. */}
                <div style={{ display: "flex", minHeight: px(12), marginTop: px(4.9), marginBottom: px(19.2) }} />
                <div style={{ display: "flex", flexDirection: "column", gap: px(6) }}>
                  {LEGEND.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: px(148.5),
                        minHeight: px(14),
                        fontSize: px(10),
                        fontWeight: 500,
                        color: "rgba(33,33,33,0.5)",
                      }}
                    >
                      <div
                        style={{
                          width: px(8),
                          height: px(8),
                          borderRadius: px(4),
                          backgroundColor: item.colour,
                        }}
                      />
                      <div style={{ display: "flex", marginLeft: px(8) }}>{item.label}</div>
                      <div style={{ display: "flex", flexGrow: 1, justifyContent: "flex-end" }}>
                        {item.range}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  position: "relative",
                  marginTop: px(11.7),
                  width: px(FRAME.width),
                  height: px(FRAME.height),
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG. */}
                <img
                  src={gauge}
                  width={px(FRAME.width)}
                  height={px(FRAME.height + HEADROOM)}
                  alt=""
                  style={{ position: "absolute", left: 0, top: -px(HEADROOM) }}
                />
                <Centred x={CENTER.x} baseline={CENTER.labelY} size={CENTER.labelSize} weight={500} colour="#212121">
                  Risk Level
                </Centred>
                {/* The served band, as the page's headline names it — the app works
                    its own word out from the number, which this site never does. */}
                <Centred
                  x={CENTER.x}
                  baseline={CENTER.valueY}
                  size={CENTER.valueSize}
                  weight={700}
                  colour={RISK_COLOUR[level]}
                >
                  {bandLabel(score)}
                </Centred>
                {TICKS.map((tick) => (
                  <Centred key={tick.value} x={tick.x} baseline={tick.y} size={12} weight={700} colour="#666666">
                    {tick.value}
                  </Centred>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#FFFFFF" }}>
          {/* Broken by hand, as the app breaks it: left to wrap, the sentence
              strands "out" at the end of the first line. */}
          <div style={{ display: "flex", fontSize: px(22), lineHeight: `${px(30)}px`, fontWeight: 700 }}>
            <Marked text="My Likeness Health Score℠" size={px(22)} lineHeight={px(30)} />
          </div>
          <div style={{ display: "flex", fontSize: px(22), lineHeight: `${px(30)}px`, fontWeight: 700 }}>
            {`is ${score.live} out of 100.`}
          </div>
          {/* The pitch to whoever sees the post, above the link it points to — the
              caption's own closing words, broken where `SHARE_PITCH` breaks them. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: px(14),
              fontSize: px(15),
              lineHeight: `${px(22)}px`,
              fontWeight: 400,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {SHARE_PITCH.map((lines, i) => (
              <div
                key={lines[0]}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginTop: i === 0 ? 0 : px(10),
                }}
              >
                {lines.map((line) => (
                  <Marked key={line} text={line} size={px(15)} lineHeight={px(22)} />
                ))}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: px(4),
              fontSize: px(16),
              lineHeight: `${px(24)}px`,
              fontWeight: 600,
            }}
          >
            {linkLabel(SHARE_URL)}
          </div>
        </div>
      </div>
    ),
    {
      ...POSTER_SIZE,
      fonts,
      headers: {
        /* The visitor's own score — never let a proxy hold onto it. */
        "Cache-Control": "no-store, private",
      },
    },
  );
}

/**
 * One line of gauge text, centred on `x` with its baseline on `baseline` — both in
 * the app's 164-wide gauge frame, as its export gives them.
 */
function Centred({
  x,
  baseline,
  size,
  weight,
  colour,
  children,
}: {
  x: number;
  baseline: number;
  size: number;
  weight: number;
  colour: string;
  children: React.ReactNode;
}) {
  const width = 120;
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        justifyContent: "center",
        left: px(x - width / 2),
        top: px(topFor(baseline, size)),
        width: px(width),
        fontSize: px(size),
        lineHeight: `${px(size)}px`,
        fontWeight: weight,
        color: colour,
      }}
    >
      {children}
    </div>
  );
}
