// ============================================================================
// DATA: Format Definitions
// ============================================================================
const FORMATS = [
  {
    id: "rect-1x3",
    label: "Rectangle 1\" x 3\"",
    shape: "rect",
    w: 3.0,
    h: 1.0,
    viewBox: [0, 0, 300, 100],
    hole: "none",
  },
  {
    id: "rect-1_5x4_5",
    label: "Rectangle 1.5\" x 4.5\"",
    shape: "rect",
    w: 4.5,
    h: 1.5,
    viewBox: [0, 0, 450, 150],
    hole: "none",
  },
  {
    id: "rect-2x6",
    label: "Rectangle 2\" x 6\"",
    shape: "rect",
    w: 6.0,
    h: 2.0,
    viewBox: [0, 0, 600, 200],
    hole: "none",
  },
  {
    id: "rect-3x9",
    label: "Rectangle 3\" x 9\"",
    shape: "rect",
    w: 9.0,
    h: 3.0,
    viewBox: [0, 0, 900, 300],
    hole: "none",
  },
  {
    id: "rect-4x12",
    label: "Rectangle 4\" x 12\"",
    shape: "rect",
    w: 12.0,
    h: 4.0,
    viewBox: [0, 0, 1200, 400],
    hole: "none",
  },
];

// ============================================================================
// PRICING LOGIC
// Rules:
// - Custom tags: no price shown
// - Preset phenolic (assets/phenolic): price by size map
// - Preset non-phenolic (assets/tags): sold in sets of 25 for $49.75
// ============================================================================
const PRICING = {
  phenolicPresetPrices: {
    // width x height (smaller first)
    '1x3': 2.97,
    '1.5x4.5': 6.75,
    '2x6': 11.88,
    '3x9': 26.73,
    '4x12': 47.52,
  },
  nonPhenolicSetPrice: 49.75,
  setSize: 25,
};

function formatDimKey(n) {
  const rounded = Math.round(n * 100) / 100;
  const intish = Math.abs(rounded - Math.round(rounded)) < 1e-9;
  return intish ? String(Math.round(rounded)) : String(rounded);
}

function sizeKeyForFormat(f) {
  if (!f) return null;
  const a = Number(f.w), b = Number(f.h);
  if (!isFinite(a) || !isFinite(b)) return null;
  const sm = Math.min(a, b);
  const lg = Math.max(a, b);
  return `${formatDimKey(sm)}x${formatDimKey(lg)}`;
}

function currentCategory() {
  if (state.signType === 'custom') return 'custom';
  const path = SIGN_IMAGES[state.signType] || '';
  if (path.includes('assets/phenolic/')) return 'phenolic';
  if (path.includes('assets/tags/')) return 'non_phenolic';
  return 'unknown';
}

function phenolicUnitPriceForCurrentFormat() {
  const key = sizeKeyForFormat(fmt());
  if (!key) return null;
  const val = PRICING.phenolicPresetPrices[key];
  return typeof val === 'number' ? val : null;
}

function phenolicUnitPriceForFormat(f) {
  const key = sizeKeyForFormat(f);
  if (!key) return null;
  const val = PRICING.phenolicPresetPrices[key];
  return typeof val === 'number' ? val : null;
}

// Normalize to packs of 25
function normalizePacks(n) {
  const qty = parseInt(n, 10) || 25;
  return Math.max(25, Math.ceil(qty / 25) * 25);
}

// Calculate price estimate
function estimatePrice() {
  let qty = parseInt(state.qty, 10) || 1;
  qty = Math.max(1, qty);
  state.qty = qty; // Sync UI

  const cat = currentCategory();
  if (cat === 'custom') {
    return null; // no price shown for custom designs
  }
  if (cat === 'phenolic') {
    const unit = phenolicUnitPriceForCurrentFormat();
    if (unit == null) return null; // unknown size -> no price
    return unit * qty;
  }
  if (cat === 'non_phenolic') {
    const sets = Math.ceil(qty / PRICING.setSize);
    return sets * PRICING.nonPhenolicSetPrice;
  }
  return null;
}

// ============================================================================
// SIGN TYPE PRESETS (Maps to image assets)
// ============================================================================
const SIGN_IMAGES = {
  custom: "assets/phenolic/Custom.png", // Fallback blank template
  high_voltage: "assets/phenolic/High_Voltage.jpg",
  danger: "assets/phenolic/Danger.jpg",
  warning: "assets/phenolic/Warning.jpg",
  caution: "assets/phenolic/Caution.jpg",
  notice: "assets/phenolic/Notice.jpg",
};

// Stock safety tags (non-phenolic presets)
const STOCK_TAGS = [
  { id: 'no_oil', label: 'No Oil', img: 'assets/tags/NoOilTag.jpeg' },
  { id: 'notice', label: 'Notice', img: 'assets/tags/NoticeTag.jpeg' },
  { id: 'out_of_service', label: 'Out of Service', img: 'assets/tags/OutofServiceTag.jpeg' },
  { id: 'repair_required', label: 'Repair Required', img: 'assets/tags/RepairRequiredTag.jpeg' },
  { id: 'safe_to_use', label: 'Safe To Use', img: 'assets/tags/SafeToUseTag.jpeg' },
];

// ============================================================================
// APPLICATION STATE
// ============================================================================
const state = {
  formatId: FORMATS[0].id,
  line1: "PUMP 12",
  line2: "480V",
  signType: "custom",
  font: "Inter, sans-serif",
  textCase: "upper",
  topColor: "#ffffff",
  coreColor: "#000000",
  textColor: "auto",
  outline: "none",
  hole: "h0125",
  adhesive: "none",
  thickness: "1.6",
  qty: 1,
  // Stock safety tags state
  stockSelectedId: (STOCK_TAGS[0] && STOCK_TAGS[0].id) || null,
  stockQty: 25,
};

// ============================================================================
// AUTH & ORDERS (API-backed)
// ============================================================================
const MIN_PASSWORD_LENGTH = 8;

const authState = {
  user: null, // { email, passwordChangeRequired }
  orders: [],
  latestResetTemp: null, // demo-only temp password surface
};

// ============================================================================
// DOM HELPERS
// ============================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = () => FORMATS.find((f) => f.id === state.formatId);

// ============================================================================
// API HELPERS (backend parity)
// ============================================================================
const API_BASE = "/api";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function apiRequest(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    credentials: "include",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

async function apiGetSession() {
  return apiRequest("/session");
}
async function apiSignup(email, password) {
  return apiRequest("/signup", { method: "POST", body: { email: normalizeEmail(email), password } });
}
async function apiLogin(email, password) {
  return apiRequest("/login", { method: "POST", body: { email: normalizeEmail(email), password } });
}
async function apiLogout() {
  return apiRequest("/logout", { method: "POST" });
}
async function apiResetPassword(email) {
  return apiRequest("/password/reset", { method: "POST", body: { email: normalizeEmail(email) } });
}
async function apiUpdatePassword(newPassword) {
  return apiRequest("/password/update", { method: "POST", body: { newPassword } });
}
async function apiListOrders() {
  return apiRequest("/orders");
}
async function apiCreateOrder(order) {
  return apiRequest("/orders", { method: "POST", body: { order } });
}

// Apply text case transformation
function applyCase(str) {
  if (!str) return "";
  if (state.textCase === "upper") return str.toUpperCase();
  if (state.textCase === "title") {
    return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }
  return str; // exact
}

// ============================================================================
// RENDER FORMAT CARDS (Grid in Hero Section)
// ============================================================================
function renderFormatCards() {
  const grid = $("#formatGrid");
  if (!grid) return;
  grid.innerHTML = "";

  FORMATS.forEach((f) => {
    const el = document.createElement("button");
    el.className = "format-card";
    el.type = "button";
    el.setAttribute("aria-pressed", f.id === state.formatId ? "true" : "false");

    if (f.id === state.formatId) {
      el.classList.add("active");
    }

    const unit = currentCategory() === 'phenolic' ? phenolicUnitPriceForFormat(f) : null;
    const badge = unit != null ? `Base $${unit.toFixed(2)}` : 'N/A';
    el.innerHTML = `
      <div style="flex:0 0 64px;display:grid;place-items:center">
        ${previewThumbSVG(f)}
      </div>
      <div style="flex:1">
        <div class="title">${f.label}</div>
        <div class="small">${f.shape === 'circle' ? 'Round equipment/valve tag' : 'Panel/plate label'}</div>
      </div>
      <span class="badge mono">${badge}</span>
    `;

    el.addEventListener("click", () => {
      state.formatId = f.id;
      state.hole = f.hole || "none";
      updateAll();
    });

    grid.appendChild(el);
  });
}

// Populate format dropdown in section 3
function populateFormatSelect() {
  const sel = $("#formatSelect");
  if (!sel) return;
  sel.innerHTML = FORMATS.map((f) => `<option value="${f.id}">${f.label}</option>`).join("");
  sel.value = state.formatId;
}

// Generate thumbnail SVG for format cards
function previewThumbSVG(f) {
  if (f.shape === "circle") {
    return `<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="24" fill="${state.topColor}" stroke="#1f2937"/>
      <circle cx="28" cy="28" r="2" fill="#1f2937"/>
    </svg>`;
  }
  return `<svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true">
    <rect x="2" y="6" width="60" height="28" rx="4" fill="${state.topColor}" stroke="#1f2937"/>
  </svg>`;
}

// ============================================================================
// RENDER LIVE PREVIEW (Main Image Display)
// ============================================================================
function renderPreview() {
  const img = $("#tagPreviewImg");
  const f = fmt();
  const cat = currentCategory();

  if (cat === 'custom') {
    if (img) img.style.display = 'none';
    const svg = ensureCustomSVG();
    if (svg && f) renderCustomTagSVG(svg, f);
  } else {
    // Use pre-rendered image assets
    removeCustomSVG();
    if (img) {
      const imagePath = SIGN_IMAGES[state.signType] || '';
      img.src = imagePath;
      img.alt = `Preview of ${state.signType} tag: ${state.line1 || ''} ${state.line2 || ''}`;
      img.style.display = 'block';
    }
  }

  const curLabel = $("#currentFormatLabel");
  if (curLabel && f) curLabel.textContent = f.label;

  const total = estimatePrice();
  const priceEl = $("#priceEstimate");
  if (priceEl) {
    priceEl.textContent = (typeof total === 'number') ? `$${total.toFixed(2)}` : 'N/A';
  }
}

// Ensure an SVG exists for custom preview
function ensureCustomSVG() {
  let svg = $("#tagPreview");
  if (svg) return svg;
  const img = $("#tagPreviewImg");
  const wrap = img ? img.parentElement : null;
  if (!wrap) return null;
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'tagPreview');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Tag preview');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.display = 'block';
  wrap.appendChild(svg);
  return svg;
}

function removeCustomSVG() {
  const svg = $("#tagPreview");
  if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
}

function renderCustomTagSVG(svg, f) {
  // ViewBox
  const vb = Array.isArray(f.viewBox) && f.viewBox.length === 4 ? f.viewBox : [0, 0, 500, 300];
  const [vx, vy, vw, vh] = vb;
  svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
  // Keep consistent aspect ratio in the preview area
  try { svg.style.aspectRatio = `${vw}/${vh}`; } catch (_) {}

  // Clear previous
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // Base plate rectangle
  const plate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  plate.setAttribute('x', String(vx));
  plate.setAttribute('y', String(vy));
  plate.setAttribute('width', String(vw));
  plate.setAttribute('height', String(vh));
  plate.setAttribute('rx', '12');
  plate.setAttribute('fill', state.topColor);
  if (state.outline && state.outline !== 'none') {
    plate.setAttribute('stroke', state.coreColor);
    plate.setAttribute('stroke-width', state.outline === 'thin' ? '3' : '0');
  }
  svg.appendChild(plate);

  // Holes (simple corner holes when requested)
  if (state.hole && state.hole !== 'none') {
    const r = state.hole === 'h0187' ? 10 : 8; // approx radius for 3/16" vs 1/8"
    const off = 24; // offset from edges
    const holes = [
      [vx + off, vy + off],
      [vx + vw - off, vy + off],
      [vx + off, vy + vh - off],
      [vx + vw - off, vy + vh - off],
    ];
    holes.forEach(([cx, cy]) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(cx));
      c.setAttribute('cy', String(cy));
      c.setAttribute('r', String(r));
      c.setAttribute('fill', '#ffffff');
      c.setAttribute('stroke', '#1f2937');
      c.setAttribute('stroke-width', '2');
      svg.appendChild(c);
    });
  }

  // Text content
  const line1 = applyCase(state.line1 || '');
  const line2 = applyCase(state.line2 || '');
  const hasL1 = line1.length > 0;
  const hasL2 = line2.length > 0;
  const fill = state.textColor === 'auto' ? state.coreColor : state.textColor;

  const midX = vx + vw / 2;

  function addText(txt, yPct, weight = 700) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const baseSize = vh * 0.24; // base size as fraction of height
    const n = Math.max(1, txt.length);
    // approximate char width factor ~0.6 of font-size
    const maxWidth = vw * 0.88;
    let fs = Math.min(baseSize, maxWidth / (n * 0.6));
    fs = Math.max(10, fs);
    t.setAttribute('x', String(midX));
    t.setAttribute('y', String(vy + vh * yPct));
    t.setAttribute('fill', fill);
    t.setAttribute('font-family', state.font);
    t.setAttribute('font-size', String(fs));
    t.setAttribute('font-weight', String(weight));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.textContent = txt;
    svg.appendChild(t);
  }

  if (hasL1 && hasL2) {
    addText(line1, 0.43, 700);
    addText(line2, 0.65, 600);
  } else if (hasL1) {
    addText(line1, 0.54, 700);
  } else if (hasL2) {
    addText(line2, 0.54, 700);
  } else {
    addText('Your Text', 0.54, 600);
  }
}

// ============================================================================
// BIND FORM CONTROLS
// ============================================================================
function bindControls() {
  const signTypeEl = $("#signType");
  signTypeEl?.addEventListener("change", (e) => {
    state.signType = e.target.value;
    updateAll();
  });

  ["line1", "line2"].forEach((id) => {
    const el = $("#" + id);
    el?.addEventListener("input", (e) => {
      state[id] = e.target.value;
      updateAll();
    });
  });

  $("#fontFamily")?.addEventListener("change", (e) => {
    state.font = e.target.value;
    updateAll();
  });

  $("#textCase")?.addEventListener("change", (e) => {
    state.textCase = e.target.value;
    updateAll();
  });

  $("#topColor")?.addEventListener("change", (e) => {
    state.topColor = e.target.value;
    updateAll();
  });

  $("#coreColor")?.addEventListener("change", (e) => {
    state.coreColor = e.target.value;
    updateAll();
  });

  $("#textColor")?.addEventListener("change", (e) => {
    state.textColor = e.target.value;
    updateAll();
  });

  $("#outline")?.addEventListener("change", (e) => {
    state.outline = e.target.value;
    updateAll();
  });

  $("#formatSelect")?.addEventListener("change", (e) => {
    state.formatId = e.target.value;
    updateAll();
  });

  $("#holeOpt")?.addEventListener("change", (e) => {
    state.hole = e.target.value;
    updateAll();
  });

  $("#adhesiveOpt")?.addEventListener("change", (e) => {
    state.adhesive = e.target.value;
    updateAll();
  });

  $("#thickness")?.addEventListener("change", (e) => {
    state.thickness = e.target.value;
    updateAll();
  });

  $("#qty")?.addEventListener("input", (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    state.qty = val;
    e.target.value = state.qty; // reflect sanitized value
    updateAll();
  });

  $("#resetBtn")?.addEventListener("click", () => {
    state.formatId = FORMATS[0].id;
    state.line1 = "";
    state.line2 = "";
    state.signType = "custom";
    state.font = "Inter, sans-serif";
    state.textCase = "upper";
    state.topColor = "#ffffff";
    state.coreColor = "#000000";
    state.textColor = "auto";
    state.outline = "none";
    state.hole = "none";
    state.adhesive = "none";
    state.thickness = "1.6";
    state.qty = 1;

    $("#line1") && ($("#line1").value = "");
    $("#line2") && ($("#line2").value = "");
    $("#signType") && ($("#signType").value = "custom");
    $("#fontFamily") && ($("#fontFamily").value = "Inter, sans-serif");
    $("#textCase") && ($("#textCase").value = "upper");
    $("#topColor") && ($("#topColor").value = "#ffffff");
    $("#coreColor") && ($("#coreColor").value = "#000000");
    $("#textColor") && ($("#textColor").value = "auto");
    $("#outline") && ($("#outline").value = "none");
    $("#holeOpt") && ($("#holeOpt").value = "none");
    $("#adhesiveOpt") && ($("#adhesiveOpt").value = "none");
    $("#thickness") && ($("#thickness").value = "1.6");
    $("#qty") && ($("#qty").value = 1);

    updateAll();
  });

  $("#scrollToConfig")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("config")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// ============================================================================
// FORM SUBMISSION & DOWNLOAD
// ============================================================================
function bindFormActions() {
  const form = $("#quoteForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const qty = parseInt($("#qty")?.value || "0", 10);
    if (isNaN(qty) || qty < 1) {
      alert("Quantity must be at least 1.");
      return;
    }

    const config = buildConfigJSON();
    const jsonArea = $("#configJson");
    if (jsonArea) jsonArea.value = JSON.stringify(config, null, 2);

    // Save to user history if signed in
    recordCustomOrder(config);

    try {
      showMessage("Preparing proof PDF and email...", "success");
      const blob = await generateProofPDFBlob();
      await composeQuoteEmailWithPDF(config, blob);
    } catch (err) {
      console.error(err);
      showMessage("Could not generate or attach PDF automatically. Email opened without attachment.", "error");
      await composeQuoteEmailWithPDF(config, null);
    }
  });

  // Export PDF (print-friendly)
  $("#exportPdfBtn")?.addEventListener("click", () => {
    exportSpecsToPDF();
  });
}

// Build complete configuration object
function buildConfigJSON() {
  const f = fmt();
  return {
    timestamp: new Date().toISOString(),
    format: {
      id: state.formatId,
      label: f?.label,
      dimensions: { width: f?.w, height: f?.h },
      shape: f?.shape,
    },
    text: {
      line1: applyCase(state.line1),
      line2: applyCase(state.line2),
      font: state.font,
      case: state.textCase,
    },
    colors: {
      signType: state.signType,
      top: state.topColor,
      core: state.coreColor,
      text: state.textColor,
      outline: state.outline,
    },
    options: {
      hole: state.hole,
      adhesive: state.adhesive,
      thickness: state.thickness,
    },
    order: {
      company: $("#company")?.value,
      contact: $("#contact")?.value,
      email: $("#email")?.value,
      quantity: state.qty,
    },
    pricing: {
      estimatedTotal: (typeof estimatePrice() === 'number') ? estimatePrice().toFixed(2) : null,
      currency: "USD",
    },
    preview: {
      imageUsed: SIGN_IMAGES[state.signType],
    },
  };
}

// Build a print-friendly HTML document and trigger browser PDF print
function exportSpecsToPDF() {
  const cfg = buildConfigJSON();
  const cat = currentCategory();
  const f = fmt();

  // Build preview markup: inline SVG for custom, image for presets
  let previewMarkup = '';
  if (cat === 'custom') {
    // Create an SVG off-DOM and render into it
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    if (f) renderCustomTagSVG(svg, f);
    // Constrain width for print
    svg.setAttribute('style', 'max-width:6.5in;width:100%;height:auto;display:block;');
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svg);
    previewMarkup = svgText;
  } else {
    const src = SIGN_IMAGES[state.signType] || '';
    previewMarkup = `<img src="${src}" alt="Preview" style="max-width:6.5in;width:100%;height:auto;display:block;"/>`;
  }

  const specRows = [
    ['Date', new Date(cfg.timestamp).toLocaleString()],
    ['Company', cfg.order.company || ''],
    ['Contact', cfg.order.contact || ''],
    ['Email', cfg.order.email || ''],
    ['Sign Type', cfg.colors.signType],
    ['Format', `${cfg.format.label || ''}`],
    ['Dimensions', `${cfg.format.dimensions.width}\" x ${cfg.format.dimensions.height}\"`],
    ['Shape', cfg.format.shape || 'rect'],
    ['Text Line 1', cfg.text.line1 || ''],
    ['Text Line 2', cfg.text.line2 || ''],
    ['Font', cfg.text.font],
    ['Case', cfg.text.case],
    ['Top/Core/Text', `${cfg.colors.top} / ${cfg.colors.core} / ${cfg.colors.text}`],
    ['Outline', cfg.colors.outline],
    ['Hole', cfg.options.hole],
    ['Adhesive', cfg.options.adhesive],
    ['Thickness', `${cfg.options.thickness} mm`],
    ['Quantity', String(cfg.order.quantity)],
    ['Estimated Total', cfg.pricing.estimatedTotal ? `$${cfg.pricing.estimatedTotal} ${cfg.pricing.currency}` : 'N/A'],
  ];

  const tableRowsHTML = specRows
    .map(([k, v]) => `<tr><th>${escapeHTML(k)}</th><td>${escapeHTML(v)}</td></tr>`)
    .join('');

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Tag Specifications</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      :root { --ink:#0b1220; --muted:#555; --border:#ddd; }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--ink); margin: 0; }
      .page { width: 8.5in; min-height: 11in; margin: 0 auto; padding: 0.6in 0.6in; }
      h1 { margin: 0 0 12px; font-size: 20px; }
      .row { display:flex; gap:24px; align-items:flex-start; }
      .col { flex:1; }
      .specs { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .specs th { text-align: left; width: 38%; padding: 6px 8px; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 600; }
      .specs td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
      .preview-outer { display: grid; place-items: center; padding: 12px; border:1px solid var(--border); border-radius: 8px; background:#fff; }
      .footer { margin-top: 16px; color: var(--muted); font-size: 12px; }
      @media print { .page { padding: 0.5in; } }
    </style>
  </head>
  <body>
    <div class="page">
      <h1>Tag Specification</h1>
      <div class="row">
        <div class="col" style="flex:0 0 55%">
          <div class="preview-outer">
            ${previewMarkup}
          </div>
        </div>
        <div class="col">
          <table class="specs">
            ${tableRowsHTML}
          </table>
        </div>
      </div>
      <div class="footer">Generated by the configurator. Images are illustrative; final production is per shop tolerances.</div>
    </div>
    <script>
      window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 200); });
    </script>
  </body>
  </html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Pop-up blocked. Please allow pop-ups to export PDF.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHTML(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Generate a proof PDF as a Blob from an offscreen DOM snapshot
async function generateProofPDFBlob() {
  if (!(window.html2canvas) || !(window.jspdf)) {
    throw new Error('PDF libs not loaded');
  }
  const cfg = buildConfigJSON();
  const cat = currentCategory();
  const f = fmt();

  const wrapper = document.createElement('div');
  wrapper.style.width = '816px'; /* ~8.5in at 96dpi */
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#111827';
  wrapper.style.padding = '32px';
  wrapper.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  wrapper.style.lineHeight = '1.35';
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-20000px';
  wrapper.style.top = '0';

  const heading = document.createElement('h1');
  heading.textContent = 'Tag Specification Proof';
  heading.style.margin = '0 0 12px 0';
  wrapper.appendChild(heading);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '24px';
  row.style.alignItems = 'flex-start';
  wrapper.appendChild(row);

  const col1 = document.createElement('div');
  col1.style.flex = '0 0 55%';
  const prevOuter = document.createElement('div');
  prevOuter.style.display = 'grid';
  prevOuter.style.placeItems = 'center';
  prevOuter.style.border = '1px solid #e5e7eb';
  prevOuter.style.borderRadius = '8px';
  prevOuter.style.padding = '12px';
  prevOuter.style.background = '#fff';
  col1.appendChild(prevOuter);

  if (cat === 'custom') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    if (f) renderCustomTagSVG(svg, f);
    svg.style.maxWidth = '100%';
    svg.style.width = '100%';
    svg.style.height = 'auto';
    prevOuter.appendChild(svg);
  } else {
    const img = document.createElement('img');
    img.src = SIGN_IMAGES[state.signType] || '';
    img.alt = 'Preview';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    prevOuter.appendChild(img);
  }
  row.appendChild(col1);

  const col2 = document.createElement('div');
  col2.style.flex = '1';
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  const specRows = [
    ['Date', new Date(cfg.timestamp).toLocaleString()],
    ['Company', cfg.order.company || ''],
    ['Contact', cfg.order.contact || ''],
    ['Email', cfg.order.email || ''],
    ['Sign Type', cfg.colors.signType],
    ['Format', `${cfg.format.label || ''}`],
    ['Dimensions', `${cfg.format.dimensions.width}\" x ${cfg.format.dimensions.height}\"`],
    ['Shape', cfg.format.shape || 'rect'],
    ['Text Line 1', cfg.text.line1 || ''],
    ['Text Line 2', cfg.text.line2 || ''],
    ['Font', cfg.text.font],
    ['Case', cfg.text.case],
    ['Top/Core/Text', `${cfg.colors.top} / ${cfg.colors.core} / ${cfg.colors.text}`],
    ['Outline', cfg.colors.outline],
    ['Hole', cfg.options.hole],
    ['Adhesive', cfg.options.adhesive],
    ['Thickness', `${cfg.options.thickness} mm`],
    ['Quantity', String(cfg.order.quantity)],
    ['Estimated Total', cfg.pricing.estimatedTotal ? `$${cfg.pricing.estimatedTotal} ${cfg.pricing.currency}` : 'N/A'],
  ];
  specRows.forEach(([k, v]) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = k;
    th.style.textAlign = 'left';
    th.style.verticalAlign = 'top';
    th.style.padding = '6px 8px';
    th.style.color = '#6b7280';
    th.style.borderBottom = '1px solid #e5e7eb';
    const td = document.createElement('td');
    td.textContent = v;
    td.style.padding = '6px 8px';
    td.style.borderBottom = '1px solid #e5e7eb';
    tr.appendChild(th); tr.appendChild(td); table.appendChild(tr);
  });
  col2.appendChild(table);
  row.appendChild(col2);

  document.body.appendChild(wrapper);

  const canvas = await window.html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
  const w = canvas.width * scale;
  const imgHeight = canvas.height * scale;
  const x = (pageW - w) / 2;
  const y = margin;
  doc.addImage(imgData, 'PNG', x, y, w, imgHeight, undefined, 'FAST');

  const blob = doc.output('blob');
  wrapper.remove();
  return blob;
}

async function composeQuoteEmailWithPDF(config, blob) {
  const filename = `tag-proof-${Date.now()}.pdf`;
  // If Web Share API supports files (mobile), try sharing with email client
  if (blob && navigator.canShare && typeof File !== 'undefined') {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Tag Proof',
          text: 'Attached is the proof PDF and specs for this quote request.'
        });
        return;
      }
    } catch (_) { /* noop */ }
  }

  // Fallback: download the PDF and open a prefilled mailto link
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const lines = [
    'Quote Request',
    '',
    `Company: ${config.order.company || ''}`,
    `Contact: ${config.order.contact || ''}`,
    `Email: ${config.order.email || ''}`,
    '',
    `Sign Type: ${config.colors.signType}`,
    `Format: ${config.format.label}`,
    `Dimensions: ${config.format.dimensions.width}\" x ${config.format.dimensions.height}\"`,
    `Quantity: ${config.order.quantity}`,
    `Estimated Total: ${config.pricing.estimatedTotal ? '$' + config.pricing.estimatedTotal + ' ' + config.pricing.currency : 'N/A'}`,
    '',
    blob ? 'A proof PDF has been downloaded. Please attach it to this email.' : 'Unable to generate a PDF automatically.',
  ];
  const subject = `Quote Request: ${config.format.label} x ${config.order.quantity}`;
  const body = lines.join('\r\n');
  const mailto = `mailto:${encodeURIComponent('lawrence.mannjr@gmail.com')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const link = document.createElement('a');
  link.href = mailto;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => link.remove(), 0);
}

// Show user feedback messages
function showMessage(text, type = "success") {
  let msgEl = $("#formMessage");

  if (!msgEl) {
    msgEl = document.createElement("div");
    msgEl.id = "formMessage";
    msgEl.className = "message";
    const form = $("#quoteForm");
    const actions = $("#quoteForm .actions");
    if (form) form.insertBefore(msgEl, actions || form.firstChild);
  }

  msgEl.className = `message ${type}`;
  msgEl.textContent = text;
  msgEl.style.display = "block";

  setTimeout(() => {
    msgEl.style.display = "none";
  }, 5000);
}

// ============================================================================
// AUTH & ORDER HISTORY (API-backed)
// ============================================================================
let activeAuthPanel = "loginPanel";

function flashAuthMessage(text, type = "info") {
  const el = $("#authMessage");
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
  el.style.display = "block";
  setTimeout(() => {
    if (el.textContent === text) el.style.display = "none";
  }, 5000);
}

function toggleTempPasswordDisplay(temp) {
  const wrap = $("#tempPasswordDisplay");
  const val = $("#tempPasswordReveal");
  if (!wrap || !val) return;
  if (temp) {
    val.textContent = temp;
    wrap.classList.remove("hidden");
  } else {
    val.textContent = "";
    wrap.classList.add("hidden");
  }
}

function switchAuthPanel(panelName) {
  activeAuthPanel = panelName || activeAuthPanel;
  const forceChange = !!(authState.user && authState.user.passwordChangeRequired);
  const panels = $$(".auth-panel");
  panels.forEach((panel) => {
    const name = panel.dataset.panel;
    const target = forceChange ? "changePanel" : activeAuthPanel;
    panel.classList.toggle("hidden", name !== target);
  });

  $$(".auth-tab").forEach((btn) => {
    const target = forceChange ? "changePanel" : activeAuthPanel;
    btn.classList.toggle("active", btn.dataset.panel === target);
  });
}

function renderAuthUI() {
  const statusEl = $("#authStatus");
  const logoutBtn = $("#logoutBtn");
  const user = authState.user;
  const isSignedIn = !!user;
  if (statusEl) {
    statusEl.textContent = isSignedIn
      ? `Signed in as ${user.email}${user.passwordChangeRequired ? " (update password)" : ""}`
      : "Signed out";
  }
  if (logoutBtn) logoutBtn.style.display = isSignedIn ? "inline-flex" : "none";

  switchAuthPanel(activeAuthPanel || "loginPanel");
  renderOrderHistory();
}

function renderOrderHistory() {
  const list = $("#orderHistoryList");
  const empty = $("#orderHistoryEmpty");
  if (!list || !empty) return;

  list.innerHTML = "";

  if (!authState.user) {
    empty.textContent = "Sign in to view your order history.";
    empty.classList.remove("hidden");
    return;
  }

  const orders = Array.isArray(authState.orders) ? authState.orders : [];
  if (!orders.length) {
    empty.textContent = "No saved orders yet. Submit a quote while signed in to store it here.";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  const frag = document.createDocumentFragment();
  orders.forEach((ord) => {
    const item = document.createElement("div");
    item.className = "order-item";

    const titleRow = document.createElement("div");
    titleRow.className = "order-top";
    const title = document.createElement("div");
    title.className = "order-title";
    title.textContent = ord.title || "Order";
    const badge = document.createElement("span");
    badge.className = "badge mono";
    badge.textContent = `${ord.kind === "stock" ? "Stock" : "Custom"} - Qty ${ord.qty || ord.quantity || 0}`;
    titleRow.appendChild(title);
    titleRow.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "order-meta";
    const when = document.createElement("span");
    when.textContent = new Date(ord.createdAt || Date.now()).toLocaleString();
    const price = document.createElement("span");
    const total = typeof ord.total === "number" ? ord.total : parseFloat(ord.total);
    price.textContent = isFinite(total) ? `$${total.toFixed(2)}` : "No estimate";
    const desc = document.createElement("span");
    desc.textContent = ord.summary || ord.detail || "";
    meta.appendChild(when);
    meta.appendChild(price);
    if (desc.textContent) meta.appendChild(desc);

    item.appendChild(titleRow);
    item.appendChild(meta);
    frag.appendChild(item);
  });

  list.appendChild(frag);
}

async function persistOrderToServer(order) {
  if (!authState.user) return;
  try {
    await apiCreateOrder(order);
    await refreshOrders();
  } catch (err) {
    flashAuthMessage(err.message || "Could not save order to your account.", "error");
  }
}

function recordCustomOrder(config) {
  if (!authState.user) return;
  const order = {
    kind: "custom",
    title: `${config.format.label || config.format.id || "Custom"} (${config.colors.signType})`,
    qty: config.order.quantity,
    total: config.pricing.estimatedTotal ? Number(config.pricing.estimatedTotal) : null,
    summary: [config.text.line1, config.text.line2].filter(Boolean).join(" / "),
    config,
  };
  persistOrderToServer(order);
}

function recordStockOrder(sel, qty, total) {
  if (!authState.user) return;
  const order = {
    kind: "stock",
    title: `${sel.label || "Stock tag"}`,
    qty,
    total,
    summary: `Image: ${sel.img}`,
  };
  persistOrderToServer(order);
}

async function handleLogin(email, password) {
  toggleTempPasswordDisplay(null);
  if (!email || !password) {
    flashAuthMessage("Email and password are required to sign in.", "error");
    return;
  }
  try {
    const data = await apiLogin(email, password);
    authState.user = data.user || null;
    flashAuthMessage(data.message || "Signed in. Orders will be saved to your account.", "success");
    activeAuthPanel = authState.user?.passwordChangeRequired ? "changePanel" : "loginPanel";
    switchAuthPanel(activeAuthPanel);
    await refreshOrders();
    renderAuthUI();
  } catch (err) {
    flashAuthMessage(err.message || "Could not sign in.", "error");
  }
}

async function handleSignup(email, password, confirm) {
  toggleTempPasswordDisplay(null);
  if (!email || !password || !confirm) {
    flashAuthMessage("All fields are required to create an account.", "error");
    return;
  }
  if (password !== confirm) {
    flashAuthMessage("Passwords do not match.", "error");
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    flashAuthMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, "error");
    return;
  }
  try {
    const data = await apiSignup(email, password);
    authState.user = data.user || null;
    flashAuthMessage(data.message || "Account created and signed in.", "success");
    activeAuthPanel = "loginPanel";
    switchAuthPanel(activeAuthPanel);
    await refreshOrders();
    renderAuthUI();
  } catch (err) {
    flashAuthMessage(err.message || "Could not create account.", "error");
  }
}

async function handlePasswordReset(email) {
  if (!email) {
    flashAuthMessage("Enter the email on your account to reset the password.", "error");
    return;
  }
  try {
    const data = await apiResetPassword(email);
    authState.user = null;
    authState.orders = [];
    authState.latestResetTemp = data.demoTempPassword || null;
    toggleTempPasswordDisplay(authState.latestResetTemp);
    flashAuthMessage(data.message || "Temporary password generated. Check your email.", "info");
    activeAuthPanel = "loginPanel";
    switchAuthPanel(activeAuthPanel);
    renderAuthUI();
  } catch (err) {
    flashAuthMessage(err.message || "Could not reset password.", "error");
  }
}

async function handlePasswordChange(newPass, confirm) {
  if (!authState.user) {
    flashAuthMessage("Sign in with your temporary password first.", "error");
    return;
  }
  if (newPass !== confirm) {
    flashAuthMessage("Passwords do not match.", "error");
    return;
  }
  if (newPass.length < MIN_PASSWORD_LENGTH) {
    flashAuthMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, "error");
    return;
  }
  try {
    const data = await apiUpdatePassword(newPass);
    authState.user = data.user || null;
    flashAuthMessage(data.message || "Password updated. You can continue saving orders.", "success");
    activeAuthPanel = "loginPanel";
    switchAuthPanel(activeAuthPanel);
    await refreshOrders();
    renderAuthUI();
  } catch (err) {
    flashAuthMessage(err.message || "Could not update password.", "error");
  }
}

function bindAuthUI() {
  $$(".auth-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (authState.user?.passwordChangeRequired) return; // force change flow
      switchAuthPanel(btn.dataset.panel);
    });
  });

  $("#loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleLogin($("#loginEmail")?.value, $("#loginPassword")?.value);
  });

  $("#signupForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSignup($("#signupEmail")?.value, $("#signupPassword")?.value, $("#signupConfirm")?.value);
  });

  $("#resetForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handlePasswordReset($("#resetEmail")?.value);
  });

  $("#changePasswordForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handlePasswordChange($("#newPassword")?.value, $("#confirmPassword")?.value);
  });

  $("#logoutBtn")?.addEventListener("click", async () => {
    try {
      await apiLogout();
    } catch (_) { /* swallow */ }
    authState.user = null;
    authState.orders = [];
    authState.latestResetTemp = null;
    toggleTempPasswordDisplay(null);
    flashAuthMessage("Signed out.", "info");
    activeAuthPanel = "loginPanel";
    switchAuthPanel(activeAuthPanel);
    renderAuthUI();
  });
}

async function refreshSession() {
  try {
    const data = await apiGetSession();
    authState.user = data.user || null;
  } catch (_) {
    authState.user = null;
  }
  renderAuthUI();
}

async function refreshOrders() {
  if (!authState.user) {
    authState.orders = [];
    renderOrderHistory();
    return;
  }
  try {
    const data = await apiListOrders();
    authState.orders = Array.isArray(data.orders) ? data.orders : [];
  } catch (err) {
    flashAuthMessage(err.message || "Could not load orders.", "error");
  }
  renderOrderHistory();
}

async function initAuth() {
  bindAuthUI();
  await refreshSession();
  await refreshOrders();
}

// ============================================================================
// UPDATE ALL UI ELEMENTS
// ============================================================================
function updateAll() {
  renderFormatCards();
  renderPreview();
  populateFormatSelect();

  $("#formatSelect") && ($("#formatSelect").value = state.formatId);
  $("#holeOpt") && ($("#holeOpt").value = state.hole);
  $("#adhesiveOpt") && ($("#adhesiveOpt").value = state.adhesive);
  $("#thickness") && ($("#thickness").value = state.thickness);
  $("#qty") && ($("#qty").value = state.qty);
  // Also refresh stock tags UI if present
  renderStockTagCards();
  updateStockTagPreviewAndPrice();
}

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
  renderFormatCards();
  populateFormatSelect();
  bindControls();
  bindFormActions();
  // Stock safety tags events
  bindStockTagControls();
  initAuth();
  updateAll();
}

// ============================================================================
// STOCK SAFETY TAGS (assets/tags)
// ============================================================================
function renderStockTagCards() {
  const grid = document.getElementById('tagGrid');
  if (!grid) return;
  grid.innerHTML = '';

  STOCK_TAGS.forEach((t) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'format-card';
    if (t.id === state.stockSelectedId) el.classList.add('active');

    const badge = `Set 25: $${PRICING.nonPhenolicSetPrice.toFixed(2)}`;
    el.innerHTML = `
      <div style="flex:0 0 64px;display:grid;place-items:center">
        <img src="${t.img}" alt="${t.label} tag" style="width:56px;height:56px;object-fit:cover;border-radius:6px;"/>
      </div>
      <div style="flex:1">
        <div class="title">${t.label}</div>
        <div class="small">Stock safety tag</div>
      </div>
      <span class="badge mono">${badge}</span>
    `;

    el.addEventListener('click', () => {
      state.stockSelectedId = t.id;
      updateStockTagPreviewAndPrice();
      renderStockTagCards(); // re-render to update active state
    });

    grid.appendChild(el);
  });
}

function bindStockTagControls() {
  const qtyEl = document.getElementById('stockQty');
  if (qtyEl) {
    qtyEl.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < PRICING.setSize) val = PRICING.setSize;
      state.stockQty = normalizePacks(val);
      e.target.value = state.stockQty;
      updateStockTagPreviewAndPrice();
    });
  }

  const orderBtn = document.getElementById('stockOrderBtn');
  if (orderBtn) {
    orderBtn.addEventListener('click', submitStockOrderEmail);
  }
}

function updateStockTagPreviewAndPrice() {
  const sel = STOCK_TAGS.find((t) => t.id === state.stockSelectedId) || STOCK_TAGS[0];
  const img = document.getElementById('tagImagePreview');
  if (img && sel) {
    img.src = sel.img;
    img.alt = `${sel.label} stock tag`;
  }

  const qty = normalizePacks(state.stockQty || 25);
  state.stockQty = qty;
  const sets = Math.ceil(qty / PRICING.setSize);
  const total = sets * PRICING.nonPhenolicSetPrice;
  const est = document.getElementById('stockTagEstimate');
  if (est) est.textContent = `$${total.toFixed(2)}`;
}

function submitStockOrderEmail() {
  const sel = STOCK_TAGS.find((t) => t.id === state.stockSelectedId) || STOCK_TAGS[0];
  if (!sel) return;

  const qty = normalizePacks(state.stockQty || PRICING.setSize);
  const sets = Math.ceil(qty / PRICING.setSize);
  const total = sets * PRICING.nonPhenolicSetPrice;

  // Save to user history if signed in
  recordStockOrder(sel, qty, total);

  const company = document.getElementById('company')?.value || '';
  const contact = document.getElementById('contact')?.value || '';
  const email = document.getElementById('email')?.value || '';

  const subject = `Stock Safety Tag Order: ${sel.label} x ${qty}`;
  const lines = [
    'Stock Safety Tag Order',
    '',
    `Tag: ${sel.label}`,
    `Image: ${sel.img}`,
    `Quantity (units): ${qty}`,
    `Sets of ${PRICING.setSize}: ${sets}`,
    `Estimated Total: $${total.toFixed(2)} USD`,
    '',
    'Customer Information',
    `Company: ${company}`,
    `Contact: ${contact}`,
    `Email: ${email}`,
    '',
    'Comments / PO #:',
  ];
  const body = lines.join('\r\n');

  const mailto = `mailto:${encodeURIComponent('lawrence.mannjr@gmail.com')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  // Prefer opening a temp <a> to better support some browsers
  const a = document.createElement('a');
  a.href = mailto;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); }, 0);
}

// Run on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
