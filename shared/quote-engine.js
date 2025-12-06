(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.QuoteEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const PRICING = {
    phenolicPresetPrices: {
      "1x3": 2.97,
      "1.5x4.5": 6.75,
      "2x6": 11.88,
      "3x9": 26.73,
      "4x12": 47.52,
    },
    nonPhenolicSetPrice: 49.75,
    setSize: 25,
    currency: "USD",
  };

  const ORDER_STATES = ["draft", "proofed", "submitted"];
  const ORDER_TRANSITIONS = {
    draft: new Set(["proofed"]),
    proofed: new Set(["submitted", "draft"]),
    submitted: new Set(),
  };

  function roundCurrency(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }

  function formatDimKey(n) {
    const rounded = Math.round(n * 100) / 100;
    const intish = Math.abs(rounded - Math.round(rounded)) < 1e-9;
    return intish ? String(Math.round(rounded)) : String(rounded);
  }

  function sizeKeyForFormat(f) {
    if (!f) return null;
    const a = Number(f.w ?? f.width);
    const b = Number(f.h ?? f.height);
    if (!isFinite(a) || !isFinite(b)) return null;
    const sm = Math.min(a, b);
    const lg = Math.max(a, b);
    return `${formatDimKey(sm)}x${formatDimKey(lg)}`;
  }

  function classifyCategory(signType, signImages = {}) {
    if (signType === "custom") return "custom";
    const path = signImages[signType] || "";
    if (path.includes("assets/phenolic/")) return "phenolic";
    if (path.includes("assets/tags/")) return "non_phenolic";
    return "unknown";
  }

  function priceForFormat(f) {
    const key = sizeKeyForFormat(f);
    if (!key) return null;
    const val = PRICING.phenolicPresetPrices[key];
    return typeof val === "number" ? val : null;
  }

  function normalizePacks(n, setSize = PRICING.setSize) {
    const qty = parseInt(n, 10) || setSize;
    return Math.max(setSize, Math.ceil(qty / setSize) * setSize);
  }

  function computeQuote(input = {}) {
    const format = input.format || {};
    const signImages = input.signImages || {};
    const category = input.category || classifyCategory(input.signType, signImages);
    const qty = Math.max(1, parseInt(input.qty, 10) || 1);
    const sizeKey = sizeKeyForFormat(format);
    const base = {
      category,
      qty,
      sizeKey,
      currency: PRICING.currency,
      breakdown: {},
    };

    if (category === "custom") {
      return { ...base, estimatedTotal: null, unitPrice: null };
    }

    if (category === "phenolic") {
      const unitPrice = priceForFormat(format);
      if (unitPrice == null) return { ...base, estimatedTotal: null, unitPrice: null };
      const total = roundCurrency(unitPrice * qty);
      return {
        ...base,
        unitPrice: roundCurrency(unitPrice),
        estimatedTotal: total,
        breakdown: { mode: "unit", note: "phenolic preset", unitPrice },
      };
    }

    if (category === "non_phenolic") {
      const packs = normalizePacks(qty);
      const sets = Math.ceil(packs / PRICING.setSize);
      const total = roundCurrency(sets * PRICING.nonPhenolicSetPrice);
      return {
        ...base,
        qty: packs,
        unitPrice: roundCurrency(PRICING.nonPhenolicSetPrice / PRICING.setSize),
        estimatedTotal: total,
        breakdown: {
          mode: "set",
          sets,
          setSize: PRICING.setSize,
          setPrice: PRICING.nonPhenolicSetPrice,
        },
      };
    }

    return { ...base, estimatedTotal: null, unitPrice: null };
  }

  // Text layout: binary search font size to fit width, return positioned lines
  function measureTextWidth(text, fontFamily, fontWeight, fontSize) {
    const t = String(text || "");
    if (typeof document !== "undefined") {
      const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
      const ctx = canvas.getContext("2d");
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(t);
      return metrics.width;
    }
    return t.length * fontSize * 0.6;
  }

  function fitTextWidth(text, maxWidth, fontFamily, fontWeight, minSize, maxSize) {
    let lo = minSize;
    let hi = maxSize;
    let best = minSize;
    for (let i = 0; i < 14; i += 1) {
      const mid = (lo + hi) / 2;
      const w = measureTextWidth(text, fontFamily, fontWeight, mid);
      if (w <= maxWidth) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return Math.max(minSize, Math.min(best, maxSize));
  }

  function layoutTag(options = {}) {
    const vb = options.viewBox || { x: 0, y: 0, width: 500, height: 300 };
    const lines = (options.lines || []).filter((t) => typeof t === "string" && t.trim().length > 0);
    const maxLines = options.maxLines || 2;
    const toLayout = lines.slice(0, maxLines);
    if (!toLayout.length) toLayout.push("Your Text");

    const fontFamily = options.fontFamily || "Inter, sans-serif";
    const fontWeight = options.fontWeight || 700;
    const minSize = options.minSize || 10;
    const maxSize = options.maxSize || vb.height * 0.32;
    const targetWidth = vb.width * 0.88;

    const lineCount = toLayout.length;
    const layouts = [];
    toLayout.forEach((txt, idx) => {
      const fontSize = fitTextWidth(txt, targetWidth, fontFamily, fontWeight, minSize, maxSize);
      const yFactor = lineCount === 1 ? 0.54 : 0.4 + idx * 0.22;
      const y = vb.y + vb.height * yFactor;
      layouts.push({
        text: txt,
        x: vb.x + vb.width / 2,
        y,
        fontSize,
        fontFamily,
        fontWeight,
        anchor: "middle",
      });
    });

    return layouts;
  }

  const OrderStateMachine = {
    states: ORDER_STATES,
    transitions: ORDER_TRANSITIONS,
    normalize(status) {
      if (!status) return "draft";
      const s = String(status).toLowerCase();
      return ORDER_STATES.includes(s) ? s : "draft";
    },
    canTransition(from, to) {
      const f = this.normalize(from);
      const t = this.normalize(to);
      return ORDER_TRANSITIONS[f]?.has(t) || false;
    },
    transition(from, to) {
      const f = this.normalize(from);
      const t = this.normalize(to);
      if (!this.canTransition(f, t)) return { ok: false, from: f, to: t, error: "Invalid transition" };
      return { ok: true, from: f, to: t, status: t };
    },
  };

  function orderLogEntry(order, userId) {
    return {
      id: order.id,
      userId,
      status: OrderStateMachine.normalize(order.status),
      createdAt: order.createdAt,
      title: order.title,
      total: order.total,
      qty: order.qty,
      kind: order.kind,
    };
  }

  return {
    PRICING,
    sizeKeyForFormat,
    classifyCategory,
    priceForFormat,
    normalizePacks,
    computeQuote,
    layoutTag,
    OrderStateMachine,
    orderLogEntry,
  };
});
