// --- Data: default formats (extendable) ---
const FORMATS = [
  { id:"circle-2in", label:"Circle — 2.00\"", shape:"circle", diameter:2.00, viewBox:[0,0,300,300], hole:"h0125", basePrice:3.50 },
  { id:"rect-3x1p5", label:"Rectangle — 3.00×1.50\"", shape:"rect", w:3.00, h:1.50, viewBox:[0,0,360,180], hole:"none", basePrice:4.25 },
  { id:"rect-2x1", label:"Rectangle — 2.00×1.00\"", shape:"rect", w:2.00, h:1.00, viewBox:[0,0,300,150], hole:"none", basePrice:3.00 }
];

// Simple pricing estimator
const PRICING = {
  basePerFormat: id => FORMATS.find(f=>f.id===id)?.basePrice ?? 3.00,
  perChar: 0.02,
  perLineOver1: 0.20,
};

// State
const state = {
  formatId: FORMATS[0].id,
  line1: "PUMP 12",
  line2: "480V",
  font: "Inter, sans-serif",
  textCase: "upper",
  topColor: "#ffffff",
  coreColor: "#000000",
  textColor: "auto",
  outline: "none",
  hole: "h0125",
  adhesive: "none",
  thickness: "1.6",
  qty: 10
};

// DOM helpers
const $ = (sel) => document.querySelector(sel);
const fmt = () => FORMATS.find(f=>f.id===state.formatId);

function applyCase(str){
  if(!str) return "";
  if(state.textCase === "upper") return str.toUpperCase();
  if(state.textCase === "title") return str.replace(/\w\S*/g, t=> t.charAt(0).toUpperCase()+t.slice(1).toLowerCase());
  return str;
}

function estimatePrice(){
  const base = PRICING.basePerFormat(state.formatId);
  const chars = (state.line1?.length||0) + (state.line2?.length||0);
  const lines = (state.line1?1:0) + (state.line2?1:0);
  const extraLines = Math.max(0, lines-1);
  const est = base + chars*PRICING.perChar + extraLines*PRICING.perLineOver1;
  return est * (parseInt(state.qty,10)||1);
}

function renderFormatCards(){
  const grid = $("#formatGrid");
  grid.innerHTML = "";
  FORMATS.forEach(f=>{
    const el = document.createElement("button");
    el.className = "format-card card";
    el.type = "button";
    el.setAttribute("aria-pressed", f.id===state.formatId ? "true" : "false");
    el.innerHTML = `
      <div style="flex:0 0 64px;display:grid;place-items:center">
        ${previewThumbSVG(f)}
      </div>
      <div style="flex:1">
        <div class="title">${f.label}</div>
        <div class="small">${f.shape === 'circle' ? 'Round equipment/valve tag' : 'Panel/plate label'}</div>
      </div>
      <span class="badge mono">Base $${PRICING.basePerFormat(f.id).toFixed(2)}</span>
    `;
    el.addEventListener('click', ()=>{ state.formatId = f.id; state.hole = f.hole||"none"; updateAll(); });
    grid.appendChild(el);
  });
}

function populateFormatSelect(){
  const sel = $("#formatSelect");
  sel.innerHTML = FORMATS.map(f=>`<option value="${f.id}">${f.label}</option>`).join("");
  sel.value = state.formatId;
}

function previewThumbSVG(f){
  if(f.shape==='circle'){
    return `<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24" fill="${state.topColor}" stroke="#1f2937"/><circle cx="28" cy="28" r="2" fill="#1f2937"/></svg>`;
  }
  return `<svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="6" width="60" height="28" rx="4" fill="${state.topColor}" stroke="#1f2937"/></svg>`;
}

function renderPreview(){
  const svg = $("#tagPreview");
  const f = fmt();
  const textColor = state.textColor === 'auto' ? state.coreColor : state.textColor;

  let content = "";
  if(f.shape === 'circle'){
    const vb = f.viewBox; svg.setAttribute('viewBox', vb.join(' '));
    content += `<defs><clipPath id="clip"><circle cx="150" cy="150" r="120"/></clipPath></defs>`;
    content += `<circle cx="150" cy="150" r="120" fill="${state.topColor}" stroke="#1f2937" stroke-width="2"/>`;
    if(state.hole !== 'none') content += `<circle cx="150" cy="44" r="8" fill="#0b0f14" stroke="#1f2937"/>`;
    content += drawTextStack(150, 160, textColor, true);
  } else {
    const vb = f.viewBox; svg.setAttribute('viewBox', vb.join(' '));
    const rx = 14;
    content += `<rect x="8" y="8" width="${vb[2]-16}" height="${vb[3]-16}" rx="${rx}" fill="${state.topColor}" stroke="#1f2937" stroke-width="2"/>`;
    if(state.hole === 'h0125') content += `<circle cx="28" cy="${vb[3]/2}" r="7" fill="#0b0f14" stroke="#1f2937"/>`;
    if(state.hole === 'h0187') content += `<circle cx="${vb[2]-28}" cy="${vb[3]/2}" r="9" fill="#0b0f14" stroke="#1f2937"/>`;
    content += drawTextStack(vb[2]/2, vb[3]/2+5, textColor, false);
  }
  svg.innerHTML = content;

  function drawTextStack(cx, cy, fill, center){
    const lines = [applyCase(state.line1||""), applyCase(state.line2||"")].filter(Boolean);
    const font = state.font;
    const outline = state.outline;
    const gap = lines.length===1 ? 0 : 24;
    return lines.map((t,i)=>{
      const y = cy + (i===0 && lines.length===2 ? -gap/2 : (i===1? gap/2 : 0));
      const base = `font-family:${font}; font-weight:700;`;
      const size = lines.length===1? 34 : 28;
      const anchor = center? 'middle' : 'middle';
      const outlineEl = outline!=="none" ? `<text x="${cx}" y="${y}" text-anchor="${anchor}" style="${base} font-size:${size}px" fill="#0b0f14" stroke="#0b0f14" stroke-width="2">${escapeHTML(t)}</text>` : "";
      return outlineEl + `<text x="${cx}" y="${y}" text-anchor="${anchor}" style="${base} font-size:${size}px" fill="${fill}">${escapeHTML(t)}</text>`;
    }).join("");
  }
}

function escapeHTML(str){
  return str.replace(/[&<>\"']/g, (m)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}

// Bind controls
function bindControls(){
  // Text
  ["line1","line2"].forEach(id=> $("#"+id).addEventListener('input', e=>{ state[id] = e.target.value; updateAll(); }));
  $("#fontFamily").addEventListener('change', e=>{ state.font = e.target.value; updateAll(); });
  $("#textCase").addEventListener('change', e=>{ state.textCase = e.target.value; updateAll(); });

  // Colors
  $("#topColor").addEventListener('change', e=>{ state.topColor = e.target.value; updateAll(); });
  $("#coreColor").addEventListener('change', e=>{ state.coreColor = e.target.value; updateAll(); });
  $("#textColor").addEventListener('change', e=>{ state.textColor = e.target.value; updateAll(); });
  $("#outline").addEventListener('change', e=>{ state.outline = e.target.value; updateAll(); });

  // Format opts
  $("#formatSelect").addEventListener('change', e=>{ state.formatId = e.target.value; updateAll(); });
  $("#holeOpt").addEventListener('change', e=>{ state.hole = e.target.value; updateAll(); });
  $("#adhesiveOpt").addEventListener('change', e=>{ state.adhesive = e.target.value; updateAll(); });
  $("#thickness").addEventListener('change', e=>{ state.thickness = e.target.value; updateAll(); });

  // Qty
  $("#qty").addEventListener('input', e=>{ state.qty = e.target.value; updateAll(); });

  // Reset
  $("#resetBtn").addEventListener('click', ()=>{
    Object.assign(state, {
      formatId: FORMATS[0].id, line1:"PUMP 12", line2:"480V", font:"Inter, sans-serif",
      textCase:"upper", topColor:"#ffffff", coreColor:"#000000", textColor:"auto",
      outline:"none", hole:FORMATS[0].hole||"none", adhesive:"none", thickness:"1.6", qty:10
    });
    updateAll(); window.location.hash = "";
  });

  // Smooth scroll
  $("#scrollToConfig").addEventListener('click', ()=>{
    setTimeout(()=> document.querySelector('#config').scrollIntoView({behavior:'smooth'}), 0);
  });

  // Form handling (compile spec -> mailto for MVP)
  $("#quoteForm").addEventListener('submit', (e)=>{
    e.preventDefault();
    const payload = buildPayload();
    const mailto = buildMailto(payload);
    window.location.href = mailto;
  });

  // Download JSON spec
  $("#downloadBtn").addEventListener('click', ()=>{
    const payload = buildPayload();
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tag-spec-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  });
}

function buildPayload(){
  const f = fmt();
  const spec = {
    format: f,
    options: {
      text: { line1: state.line1, line2: state.line2, font: state.font, case: state.textCase },
      colors: { top: state.topColor, core: state.coreColor, text: state.textColor },
      features: { hole: state.hole, adhesive: state.adhesive, thickness_mm: state.thickness },
    },
    quantity: parseInt(state.qty,10)||1,
    estimate_total: Number(estimatePrice().toFixed(2))
  };
  $("#configJson").value = JSON.stringify(spec);
  return spec;
}

function buildMailto(payload){
  const to = "quotes@example.com"; // TODO: replace with your address or service endpoint
  const subject = encodeURIComponent("Phenolic Tag Quote Request");
  const lines = [];
  lines.push(`Format: ${payload.format.label} [${payload.format.id}]`);
  lines.push(`Qty: ${payload.quantity}`);
  lines.push(`Text: "${payload.options.text.line1}"${payload.options.text.line2? ` / "${payload.options.text.line2}"`:''}`);
  lines.push(`Font: ${payload.options.text.font} | Case: ${payload.options.text.case}`);
  lines.push(`Colors: Top ${payload.options.colors.top}, Core ${payload.options.colors.core}, Text ${payload.options.colors.text}`);
  lines.push(`Features: Hole ${state.hole}, Adhesive ${state.adhesive}, Thick ${state.thickness}mm`);
  lines.push(`Estimate (non-binding): $${payload.estimate_total.toFixed(2)}`);
  lines.push("");
  lines.push("JSON Spec:");
  lines.push(JSON.stringify(payload, null, 2));
  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

// Persist config in URL hash so you can share a configured link
function persistToHash(){
  const copy = {...state};
  const safe = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(copy)))));
  history.replaceState(null, '', `#cfg=${safe}`);
}

function restoreFromHash(){
  const m = location.hash.match(/#cfg=([^&]+)/);
  if(!m) return;
  try{
    const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
    const obj = JSON.parse(json);
    Object.assign(state, obj);
  }catch(err){ /* ignore */ }
}

// Update loop
function updateAll(){
  // Bind state to controls
  $("#line1").value = state.line1 || "";
  $("#line2").value = state.line2 || "";
  $("#fontFamily").value = state.font;
  $("#textCase").value = state.textCase;
  $("#topColor").value = state.topColor;
  $("#coreColor").value = state.coreColor;
  $("#textColor").value = state.textColor;
  $("#outline").value = state.outline;
  $("#formatSelect").value = state.formatId;
  $("#holeOpt").value = state.hole;
  $("#adhesiveOpt").value = state.adhesive;
  $("#thickness").value = state.thickness;
  $("#qty").value = state.qty;

  $("#currentFormatLabel").textContent = FORMATS.find(f=>f.id===state.formatId)?.label || "—";
  $("#priceEstimate").textContent = `$${estimatePrice().toFixed(2)}`;

  renderPreview();
  persistToHash();
}

// Init
(function init(){
  document.getElementById('year').textContent = new Date().getFullYear();
  renderFormatCards();
  populateFormatSelect();
  bindControls();
  restoreFromHash();
  updateAll();
})();
