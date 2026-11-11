const STORAGE_KEY = "indirim_takip_dashboard_token";

const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const listEl = $("#product-list");
const emptyEl = $("#empty-state");
const summaryEl = $("#summary-text");
const toastEl = $("#toast");
const dialogToken = $("#dialog-token");
const formToken = $("#form-token");
const formAdd = $("#form-add");

function getToken() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

function setToken(value) {
  const v = value.trim();
  if (v) {
    localStorage.setItem(STORAGE_KEY, v);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function headers() {
  const h = { Accept: "application/json", "Content-Type": "application/json" };
  const t = getToken();
  if (t) {
    h["X-Dashboard-Token"] = t;
  }
  return h;
}

let toastTimer = null;

function showToast(message, ms = 3200) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, ms);
}

function formatTl(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const s = Number(n).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${s} TL`;
}

function formatPercent(n) {
  if (n == null) return "—";
  return `%${Number(n)}`;
}

function siteLabel(site) {
  const map = {
    trendyol: "Trendyol",
    hepsiburada: "Hepsiburada",
    akakce: "Akakçe",
    cimri: "Cimri",
  };
  return map[site] || site;
}

function targetSummary(p) {
  const parts = [];
  if (p.target_price != null && p.target_price >= 0) {
    parts.push(`Hedef: ${formatTl(p.target_price)}`);
  }
  if (p.target_drop_percent != null) {
    parts.push(`Düşüş: ${formatPercent(p.target_drop_percent)}`);
  }
  return parts.length ? parts.join(" · ") : "Uyarı eşiği yok";
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    data = await res.json();
  }
  if (res.status === 401) {
    setToken("");
    openTokenDialog();
    throw new Error(data?.detail || "Oturum geçersiz.");
  }
  if (!res.ok) {
    const msg = data?.detail || `İstek başarısız (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

function renderProducts(products) {
  listEl.innerHTML = "";
  emptyEl.hidden = products.length > 0;
  products.forEach((p) => {
    const li = document.createElement("li");
    const title = (p.title || p.url).slice(0, 120);
    const checked = p.last_checked_at
      ? new Date(p.last_checked_at).toLocaleString("tr-TR")
      : "Henüz yok";
    li.innerHTML = `
      <article class="card" data-id="${p.id}">
        <div class="card__head">
          <h3 class="card__title">#${p.id} ${escapeHtml(title)}</h3>
          <span class="badge">${escapeHtml(siteLabel(p.site))}</span>
        </div>
        <dl class="card__meta">
          <div><dt>Son fiyat</dt><dd>${formatTl(p.last_price)}</dd></div>
          <div><dt>Hedef / %</dt><dd>${escapeHtml(targetSummary(p))}</dd></div>
          <div><dt>Baz fiyat</dt><dd>${formatTl(p.baseline_price)}</dd></div>
          <div><dt>Son kontrol</dt><dd>${escapeHtml(checked)}</dd></div>
        </dl>
        <a class="card__link" href="${escapeAttr(p.url)}" target="_blank" rel="noopener noreferrer">Ürün sayfası</a>
        <div class="card__actions">
          <button type="button" class="btn btn--danger" data-remove="${p.id}">Sil</button>
        </div>
      </article>
    `;
    listEl.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

const STALE_CHECK_MS = 28 * 60 * 1000;
let lastLatestCheck = null;
let autoTickInFlight = false;

function formatLatestCheck(iso) {
  if (!iso) return "henüz kontrol yok";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

function isCheckStale(iso) {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t >= STALE_CHECK_MS;
}

function updateSummary(products, latestCheck) {
  lastLatestCheck = latestCheck || null;
  const base =
    products.length === 0
      ? "Liste boş"
      : `${products.length} ürün takipte`;
  const when = formatLatestCheck(lastLatestCheck);
  const stale = isCheckStale(lastLatestCheck);
  summaryEl.textContent = stale
    ? `${base} · Son kontrol: ${when} (güncelleniyor…)`
    : `${base} · Son kontrol: ${when}`;
}

async function loadProducts() {
  const data = await api("/api/products");
  const products = data.products || [];
  renderProducts(products);
  updateSummary(products, data.latest_check);
  return data;
}

async function maybeAutoPriceCheck() {
  if (document.hidden || autoTickInFlight || !getToken()) return;
  if (!isCheckStale(lastLatestCheck)) return;
  autoTickInFlight = true;
  try {
    const data = await api("/api/schedule/tick", { method: "POST" });
    if (data.result === "ran") {
      showToast("Otomatik fiyat kontrolü yapıldı.");
      await loadProducts();
    } else if (data.latest_check) {
      lastLatestCheck = data.latest_check;
      const products = listEl.querySelectorAll("li").length;
      updateSummary(
        { length: products },
        data.latest_check
      );
    }
  } catch {
    /* sessiz: ağ veya kilit */
  } finally {
    autoTickInFlight = false;
  }
}

async function runCheck() {
  const btn = $("#btn-check");
  btn.disabled = true;
  btn.textContent = "Kontrol ediliyor…";
  try {
    const data = await api("/api/check", { method: "POST" });
    showToast(
      `Tamamlandı: ${data.ok_count} başarılı, ${data.failed_count} hata.`
    );
    await loadProducts();
  } catch (e) {
    showToast(e.message || "Kontrol başarısız.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Şimdi kontrol et";
  }
}

function openTokenDialog() {
  $("#input-token").value = getToken();
  if (typeof dialogToken.showModal === "function") {
    dialogToken.showModal();
  } else {
    dialogToken.setAttribute("open", "");
  }
}

function closeTokenDialog() {
  if (typeof dialogToken.close === "function") {
    dialogToken.close();
  } else {
    dialogToken.removeAttribute("open");
  }
}

async function initApp() {
  app.hidden = false;
  await loadProducts();
}

formToken.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const token = $("#input-token").value.trim();
  if (!token) return;
  setToken(token);
  closeTokenDialog();
  try {
    await initApp();
    showToast("Anahtar kaydedildi.");
  } catch {
    showToast("Anahtar geçersiz; tekrar deneyin.");
    openTokenDialog();
  }
});

function parseOptionalPrice(raw) {
  const s = String(raw || "").trim().replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
}

function parseOptionalPercent(raw) {
  const s = String(raw || "").trim().replace("%", "").replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  if (Number.isNaN(n) || n <= 0 || n > 100) return undefined;
  return n;
}

formAdd.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const fd = new FormData(formAdd);
  const url = String(fd.get("url") || "").trim();
  const priceRaw = fd.get("target_price");
  const pctRaw = fd.get("target_drop_percent");
  const target_price = parseOptionalPrice(priceRaw);
  const target_drop_percent = parseOptionalPercent(pctRaw);
  if (target_price === undefined || target_drop_percent === undefined) {
    showToast("Geçersiz hedef. TL: 2500 · Yüzde: 1–100 arası sayı.");
    return;
  }
  const body = { url };
  if (target_price != null) body.target_price = target_price;
  if (target_drop_percent != null) body.target_drop_percent = target_drop_percent;
  // Her iki alan boşsa yalnızca URL ile ekleme dene (sunucu kuralları geçerli).
  try {
    await api("/api/products", {
      method: "POST",
      body: JSON.stringify(body),
    });
    formAdd.reset();
    showToast("Ürün eklendi.");
    await loadProducts();
  } catch (e) {
    showToast(e.message || "Eklenemedi.");
  }
});

listEl.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-remove]");
  if (!btn) return;
  const id = btn.getAttribute("data-remove");
  if (!id) return;
  if (!confirm(`#${id} silinsin mi?`)) return;
  try {
    await api(`/api/products/${id}`, { method: "DELETE" });
    showToast(`#${id} silindi.`);
    await loadProducts();
  } catch (e) {
    showToast(e.message || "Silinemedi.");
  }
});

$("#btn-check").addEventListener("click", runCheck);
$("#btn-refresh").addEventListener("click", () => {
  loadProducts().catch((e) => showToast(e.message));
});
$("#btn-settings").addEventListener("click", openTokenDialog);

if (getToken()) {
  initApp()
    .then(() => maybeAutoPriceCheck())
    .catch(() => openTokenDialog());
} else {
  openTokenDialog();
}

setInterval(() => {
  if (document.hidden || !getToken()) return;
  maybeAutoPriceCheck();
}, 60_000);

setInterval(() => {
  if (document.hidden || !getToken()) return;
  loadProducts().catch(() => {});
}, 2 * 60_000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && getToken()) {
    loadProducts().then(() => maybeAutoPriceCheck()).catch(() => {});
  }
});
