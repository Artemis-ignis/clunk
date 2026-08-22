/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * Standing render audit.
 *
 * Three defects that do not throw, do not fail a build and do not show up in a unit test, but
 * do make a product look unfinished:
 *   - text that fails WCAG AA contrast against whatever is actually painted behind it
 *   - text rendered below the size at which it stays readable
 *   - text clipped by an overflow rule without an ellipsis to say so
 *
 * All three were present across the whole site until they were measured: a --text-dim token at
 * 3.85:1, an --on-accent token that was referenced but never defined (1.89:1 on the dark
 * theme), and stat numbers rendering at 13px inside a 61px slot. This keeps them from coming
 * back.
 *
 * Usage: node scripts/qa-run-flow.mjs scripts/playwright-render-audit-flow.js
 */
async page => {
  const base = process.env.CLUNK_AUDIT_BASE ?? "http://localhost:3010";
  const user = process.env.CLUNK_AUDIT_USER ?? "render-audit-20260822";

  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": user,
    "oai-authenticated-user-email": `${user}@example.test`,
    "oai-authenticated-user-full-name": "Render%20Audit",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  const scan = () => {
    const rgb = (value) => (String(value).match(/[\d.]+/g) ?? [0, 0, 0]).map(Number);
    const lum = ([r, g, b]) => {
      const channel = (v) => {
        const n = v / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    // Walk up until something actually paints. A gradient counts: buttons here are painted by
    // background-image with a transparent background-color, and ignoring that made the audit
    // compare white button text against the white panel underneath and call it 1.07:1.
    const behind = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node);
        const image = style.backgroundImage;
        if (image && image !== "none" && image.includes("gradient")) {
          const stops = image.match(/rgba?([^)]+)/g);
          if (stops && stops.length) {
            // Darkest stop: the worst case a glyph can land on.
            return stops
              .map(rgb)
              .filter((c) => c.length < 4 || c[3] > 0.5)
              .sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))[0] ?? [255, 255, 255];
          }
        }
        const colour = style.backgroundColor;
        const parts = rgb(colour);
        if (parts.length >= 4 ? parts[3] > 0.5 : colour !== "rgba(0, 0, 0, 0)") return parts;
        node = node.parentElement;
      }
      return [255, 255, 255];
    };

    const tiny = [];
    const lowContrast = [];
    const clipped = [];

    for (const el of document.querySelectorAll("body *")) {
      // Visually hidden helpers are clipped to 1px on purpose.
      if (el.classList.contains("sr-only") || el.closest(".sr-only")) continue;
      const text = (el.textContent ?? "").trim();
      if (!text || el.children.length > 0) continue;

      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (Number(style.opacity) < 0.1) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      const size = parseFloat(style.fontSize);
      if (size < 11.5) tiny.push(`${text.slice(0, 20)} (${size}px)`);

      const a = lum(rgb(style.color));
      const b = lum(behind(el));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const isLarge = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (isLarge ? 3 : 4.5)) {
        lowContrast.push(`${text.slice(0, 20)} (${ratio.toFixed(2)}:1)`);
      }

      // An ellipsis is a deliberate truncation; a hard clip is a bug.
      if (el.scrollWidth > el.clientWidth + 2 && style.overflow === "hidden") {
        if (style.textOverflow !== "ellipsis") clipped.push(text.slice(0, 20));
      }
    }

    return { tiny, lowContrast, clipped };
  };

  const results = [];
  const record = async (label) => {
    const found = await page.evaluate(scan);
    results.push({ label, ...found });
  };

  /** 앞 화면이 남긴 저장소를 비운다. 지우지 못해도 감사는 계속한다. */
  const clearClientState = async () => {
    await page
      .evaluate(() => {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch {
          /* storage can be unavailable; the screen is still worth auditing */
        }
      })
      .catch(() => undefined);
  };

  const setTheme = async (theme) => {
    await page.evaluate((value) => {
      try {
        window.localStorage.setItem("clunk-theme", value);
      } catch {
        /* storage can be unavailable; the default theme is still worth auditing */
      }
    }, theme);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
  };

  for (const [width, height, view] of [[1440, 950, "desktop"], [390, 900, "mobile"]]) {
    await page.setViewportSize({ width, height });

    for (const theme of ["light", "dark"]) {
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      await setTheme(theme);
      for (const id of ["hero", "flow", "playground", "terminal", "proof", "start"]) {
        await page.evaluate((section) => {
          document.getElementById(section)?.scrollIntoView({ block: "start", behavior: "instant" });
        }, id);
        await page.waitForTimeout(900);
        await record(`${view}/${theme} · landing#${id}`);
      }

      for (const path of ["/pricing", "/docs", "/support", "/app", "/dashboard", "/settings"]) {
        // 화면마다 앞 화면이 남긴 클라이언트 상태를 지운다.
        //
        // 58개 화면이 페이지 하나를 공유한다. goto가 DOM은 새로 그리지만 localStorage와
        // sessionStorage는 남고, 그러면 앞 화면이 켠 상태가 뒤 화면의 판정을 바꾼다.
        // 통과했을 때 그 통과를 믿을 수 없게 만드는 종류의 결합이라, 실패가 없더라도
        // 끊어 두는 것이 맞다. 테마는 바로 아래에서 다시 세운다.
        await clearClientState();
        await page.goto(base + path, { waitUntil: "networkidle" });
        await setTheme(theme);
        await page.waitForTimeout(2000);
        await record(`${view}/${theme} · ${path}`);
      }
    }
  }

  // Static screens are the easy half. The states a paying user actually hits — a file that
  // will not parse, a queue mid-run, a save that failed — render markup the default screens
  // never show, so they get audited too.
  const fixtures = "C:/Users/50106/Desktop/Clunk/public/samples";
  const assetInput = 'input[aria-label="GLB 또는 GLTF 파일 선택"]';

  for (const [width, height, view] of [[1440, 950, "desktop"], [390, 900, "mobile"]]) {
    await page.setViewportSize({ width, height });

    // A file the core cannot read: the diagnostic and the refusal notice.
    await page.goto(base + "/app", { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="GLB 또는 GLTF 파일 선택"]');
      const file = new File([new TextEncoder().encode("this is not a glb")], "broken.glb");
      const data = new DataTransfer();
      data.items.add(file);
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForTimeout(4000);
    await record(view + "/light · /app 파싱 실패");

    // A batch queue: rows, progress, per-file verdicts.
    await page.goto(base + "/app", { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    await page.locator(assetInput).setInputFiles([
      fixtures + "/clunk-messy-sample.glb",
      fixtures + "/clunk-ready-sample.glb",
    ]);
    await page.waitForTimeout(2500);
    await record(view + "/light · /app 큐 대기");

    const start = page.getByRole("button", { name: /일괄 검사 시작/ });
    if (await start.count()) {
      await start.first().click();
      await page.waitForTimeout(9000);
      await record(view + "/light · /app 큐 완료");
    }
  }

  // The two screens where money is at stake. A queue that cannot be paid for, and the panel
  // that uploads a file for a signed verdict — if either renders wrong the user finds out
  // after being charged, which is the same conversation as a refund.
  const surplusDir = process.env.CLUNK_AUDIT_QUEUE_DIR;
  if (surplusDir) {
    const many = Array.from({ length: 30 }, (_, i) =>
      `${surplusDir}/asset-${String(i).padStart(2, "0")}.glb`,
    );
    for (const [width, height, view] of [[1440, 950, "desktop"], [390, 900, "mobile"]]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + "/app", { waitUntil: "networkidle" });
      await page.waitForTimeout(2200);
      await page.locator(assetInput).setInputFiles(many);
      await page.waitForTimeout(3000);
      await record(view + "/light · /app 크레딧 부족 경고");
    }
  }

  for (const [width, height, view] of [[1440, 950, "desktop"], [390, 900, "mobile"]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base + "/app", { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    await page.locator(assetInput).setInputFiles(fixtures + "/clunk-messy-sample.glb");
    await page.waitForTimeout(6000);
    if (await page.locator(".verify-card").count()) {
      await record(view + "/light · /app 서버 검증 카드");
    }
  }

  const failures = results.filter(
    (row) => row.tiny.length > 0 || row.lowContrast.length > 0 || row.clipped.length > 0,
  );

  const summary = { pass: failures.length === 0, screensChecked: results.length, failures };
  if (!summary.pass) {
    throw new Error(`render audit failed\n${JSON.stringify(summary, null, 2)}`);
  }
  return summary;
}
