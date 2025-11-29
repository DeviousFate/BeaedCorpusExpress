// User Profile page logic
const API_BASE = "/api";

const $ = (sel) => document.querySelector(sel);

function showProfileMessage(text, type = "info") {
  const el = $("#profileMessage");
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
  el.style.display = "block";
  setTimeout(() => {
    if (el.textContent === text) el.style.display = "none";
  }, 5000);
}

async function apiRequest(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
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

async function loadSession() {
  try {
    const data = await apiRequest("/session");
    return data.user || null;
  } catch (_) {
    return null;
  }
}

async function loadProfile() {
  const data = await apiRequest("/profile");
  return data.profile || {};
}

async function saveProfile(payload) {
  return apiRequest("/profile", { method: "POST", body: payload });
}

async function updatePassword(newPassword) {
  return apiRequest("/password/update", { method: "POST", body: { newPassword } });
}

function fillProfileForm(user, profile) {
  $("#profileEmail").value = user?.email || "";
  $("#profileSecondaryEmail").value = profile.secondaryEmail || "";
  $("#profileCompany").value = profile.company || "";
  $("#profileContact").value = profile.primaryContact || "";
  $("#profilePhone").value = profile.phone || user?.phone || "";
  $("#profileAddress").value = profile.address1 || "";
  $("#profileSuite").value = profile.address2 || "";
  $("#profileZip").value = profile.zip || "";
  hydrateSelect("#profileCountry", profile.country || "United States");
  hydrateSelect("#profileState", profile.state);
  hydrateSelect("#profileCity", profile.city);
}

function ensureOptions(sel, list, selected) {
  if (!sel) return;
  sel.innerHTML = "";
  list.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    if (opt === selected) o.selected = true;
    sel.appendChild(o);
  });
}

function hydrateSelect(selector, value) {
  const el = $(selector);
  if (!el) return;
  let opts = el.dataset.options ? el.dataset.options.split(",") : Array.from(el.options).map((o) => o.value);
  opts = opts.filter((v, idx) => opts.indexOf(v) === idx); // dedupe
  if (value && !opts.includes(value)) {
    opts.push(value);
  }
  ensureOptions(el, opts, value);
}

function setupGeoSelects() {
  const countrySel = $("#profileCountry");
  const stateSel = $("#profileState");
  const citySel = $("#profileCity");

  const countries = ["United States", "Canada", "Mexico"];
  const statesUS = ["", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"];
  const statesCA = ["", "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
  const statesMX = ["", "AG", "BC", "BS", "CM", "CS", "CH", "CO", "CL", "DG", "GT", "GR", "HG", "JC", "MX", "MC", "MR", "NA", "NL", "OA", "PU", "QT", "QR", "SL", "SI", "SO", "TB", "TM", "TL", "VE", "YU", "ZA"];

  const getStatesForCountry = (c) => {
    if (c === "Canada") return statesCA;
    if (c === "Mexico") return statesMX;
    return statesUS;
  };

  ensureOptions(countrySel, countries, "United States");
  ensureOptions(stateSel, getStatesForCountry(countrySel?.value || "United States"), "");
  ensureOptions(citySel, [""], "");

  countrySel?.addEventListener("change", () => {
    const c = countrySel.value;
    ensureOptions(stateSel, getStatesForCountry(c), "");
    ensureOptions(citySel, [""], "");
  });

  const zipInput = $("#profileZip");
  const zipCache = new Map();

  async function lookupZip() {
    const zip = (zipInput?.value || "").trim();
    const country = countrySel?.value || "United States";
    const cc = country === "Canada" ? "ca" : country === "Mexico" ? "mx" : "us";
    if (!zip) return;
    if (cc === "us" && !/^[0-9]{5}$/.test(zip)) return;
    const cacheKey = `${cc}-${zip}`;
    let data = zipCache.get(cacheKey);
    if (!data) {
      try {
        const res = await fetch(`https://api.zippopotam.us/${cc}/${encodeURIComponent(zip)}`);
        if (!res.ok) throw new Error("Lookup failed");
        data = await res.json();
        zipCache.set(cacheKey, data);
      } catch (err) {
        showProfileMessage("Could not look up city/state for that ZIP. Please pick manually.", "error");
        return;
      }
    }
    const places = Array.isArray(data.places) ? data.places : [];
    const cities = [...new Set(places.map((p) => p["place name"]).filter(Boolean))];
    const stateAbbr = places[0]?.["state abbreviation"] || places[0]?.state || "";
    if (cities.length) ensureOptions(citySel, cities, cities[0]);
    if (stateAbbr) ensureOptions(stateSel, getStatesForCountry(country), stateAbbr);
  }

  zipInput?.addEventListener("change", lookupZip);
  zipInput?.addEventListener("blur", lookupZip);
}

function showSignedBanner(user) {
  const banner = $("#signedBanner");
  if (!banner) return;
  if (user) {
    banner.textContent = `Signed in as ${user.email}`;
    banner.classList.remove("hidden");
  } else {
    banner.textContent = "";
    banner.classList.add("hidden");
  }
}

function bindResetForm() {
  const form = $("#profileResetForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPass = $("#resetNewPassword")?.value || "";
    const confirm = $("#resetConfirmPassword")?.value || "";
    const msg = $("#resetMessage");
    const showMsg = (text, type = "info") => {
      if (msg) {
        msg.textContent = text;
        msg.className = `message ${type}`;
        msg.style.display = "block";
      }
    };
    if (newPass !== confirm) {
      showMsg("Passwords do not match.", "error");
      return;
    }
    if (newPass.length < 8) {
      showMsg("Password must be at least 8 characters.", "error");
      return;
    }
    try {
      await updatePassword(newPass);
      showMsg("Password updated.", "success");
      if ($("#resetNewPassword")) $("#resetNewPassword").value = "";
      if ($("#resetConfirmPassword")) $("#resetConfirmPassword").value = "";
    } catch (err) {
      showMsg(err.message || "Could not update password.", "error");
    }
  });
}

async function initProfilePage() {
  const user = await loadSession();
  const form = $("#profileForm");
  const signedOut = $("#profileSignedOut");
  if (!user) {
    if (signedOut) signedOut.style.display = "block";
    if (form) form.style.display = "none";
    return;
  }
  if (signedOut) signedOut.style.display = "none";
  if (form) form.style.display = "flex";

  showSignedBanner(user);
  const resetCard = $("#resetCard");
  if (resetCard) resetCard.style.display = "block";

  setupGeoSelects();
  bindResetForm();

  try {
    const profile = await loadProfile();
    fillProfileForm(user, profile);
    const zipEl = $("#profileZip");
    if (zipEl && zipEl.value) {
      zipEl.dispatchEvent(new Event("change"));
    }
  } catch (err) {
    showProfileMessage(err.message || "Could not load profile.", "error");
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      company: $("#profileCompany")?.value || "",
      primaryContact: $("#profileContact")?.value || "",
      phone: $("#profilePhone")?.value || "",
      secondaryEmail: $("#profileSecondaryEmail")?.value || "",
      address1: $("#profileAddress")?.value || "",
      address2: $("#profileSuite")?.value || "",
      zip: $("#profileZip")?.value || "",
      city: $("#profileCity")?.value || "",
      state: $("#profileState")?.value || "",
      country: $("#profileCountry")?.value || "",
    };
    try {
      await saveProfile(payload);
      showProfileMessage("Profile updated.", "success");
    } catch (err) {
      showProfileMessage(err.message || "Could not update profile.", "error");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProfilePage);
} else {
  initProfilePage();
}
