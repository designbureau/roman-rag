import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";

import { buildStories, normSuffix, parseEnglish, parseLatin } from "./cicero-letters-att.js";
import type { Editions } from "./work-registry.js";

const ED: Editions = {
  title: "Letters to Atticus",
  latUrn: "urn:cts:latinLit:phi0474.phi057.perseus-lat1",
  latUrl: "lat.xml",
  latEdition: "Purser, OCT 1903",
  engUrn: "urn:cts:latinLit:phi0474.phi057.perseus-eng1",
  engUrl: "eng.xml",
  translator: "Shuckburgh",
};

const LAT = `<?xml version="1.0"?>
<TEI><text><body>
  <div type="textpart" n="1" subtype="book">
    <div type="textpart" n="5" subtype="letter">
      <label rend="opener"><seg rend="salute">CICERO ATTICO salutem</seg></label>
      <div type="textpart" n="1" subtype="section"><p>Quod  tibi <pb n="2"/> scribo.<note>ed note</note><milestone unit="para"/></p></div>
      <div type="textpart" n="2" subtype="section"><p>Altera pars.</p></div>
    </div>
    <div type="textpart" n="6" subtype="letter">
      <div type="textpart" n="1" subtype="section"><p>Latin only letter.</p></div>
    </div>
  </div>
</body></text></TEI>`;

const ENG = `<?xml version="1.0"?>
<TEI><text><body>
  <div n="text=A:book=1:letter=5" type="letter">
    <epigraph><p>B.C. 68. editorial argument to strip.</p></epigraph>
    <head>I (A I, 5)</head>
    <opener><salute>TO ATTICUS</salute></opener>
    <p>What I write to you.<note n="1">a note</note><milestone unit="para"/></p>
    <p>Second paragraph.</p>
  </div>
  <div n="text=A:book=1:letter=7" type="letter">
    <p>English only letter.</p>
  </div>
</body></text></TEI>`;

describe("normSuffix", () => {
  it("case-normalises editorial sub-letters", () => {
    expect(normSuffix("4A")).toBe("4a");
    expect(normSuffix(" 9 ")).toBe("9");
  });
});

describe("parseLatin", () => {
  const lat = parseLatin(cheerio.load(LAT, { xml: true }));

  it("collapses sections to whole-letter, keeping the opener", () => {
    const l = lat.get("1.5");
    expect(l?.full).toBe("CICERO ATTICO salutem\n\nQuod tibi scribo.\n\nAltera pars.");
  });

  it("drops <note> and <pb>", () => {
    expect(lat.get("1.5")?.full).not.toContain("ed note");
    expect(lat.get("1.5")?.full).not.toContain("2");
  });

  it("keys by (book, letter)", () => {
    expect([...lat.keys()].sort()).toEqual(["1.5", "1.6"]);
  });
});

describe("parseEnglish", () => {
  const eng = parseEnglish(cheerio.load(ENG, { xml: true }));

  it("strips epigraph/head/note and splits paragraphs on milestones", () => {
    expect(eng.get("1.5")?.text).toBe("TO ATTICUS What I write to you.\n\nSecond paragraph.");
  });

  it("never leaks the editorial argument", () => {
    expect(eng.get("1.5")?.text).not.toContain("editorial argument");
    expect(eng.get("1.5")?.text).not.toContain("a note");
  });
});

describe("buildStories", () => {
  const lat = parseLatin(cheerio.load(LAT, { xml: true }));
  const eng = parseEnglish(cheerio.load(ENG, { xml: true }));
  const { stories, aligned } = buildStories(lat, eng, ED);
  const byId = new Map(stories.map((s) => [s.id, s]));

  it("ingests the union of both sides (never drops a side)", () => {
    // 1.5 aligned, 1.6 latin-only, 1.7 english-only → 3 stories, 1 aligned
    expect(stories).toHaveLength(3);
    expect(aligned).toBe(1);
  });

  it("produces a fully aligned, parallel-text Story", () => {
    const s = byId.get("letters-att__1-5");
    expect(s?.latin_text).toContain("Quod tibi scribo");
    expect(s?.english_text).toContain("What I write to you");
    expect(s?.cicero_ref).toBe("Att. 1.5");
    expect(s?.informant).toBe("Atticus");
    expect(s?.category).toBe("letter");
    expect(s?.translator).toBe("Evelyn S. Shuckburgh");
    expect(s?.source_url).toContain("perseus-lat1:1.5");
  });

  it("ingests a Latin-only letter with null English/translator", () => {
    const s = byId.get("letters-att__1-6");
    expect(s?.latin_text).toContain("Latin only letter");
    expect(s?.english_text).toBe("");
    expect(s?.translator).toBeNull();
  });

  it("ingests an English-only letter with null Latin", () => {
    const s = byId.get("letters-att__1-7");
    expect(s?.latin_text).toBeNull();
    expect(s?.english_text).toContain("English only letter");
    expect(s?.source_url).toContain("perseus-eng1:1.7");
  });
});
