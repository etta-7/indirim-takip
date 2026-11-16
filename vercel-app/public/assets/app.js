const STORAGE_KEY = "indirim_takip_dashboard_token";
const SORT_KEY = "indirim_takip_sort";
const STALE_CHECK_MS = 28 * 60 * 1000;

const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const listEl = $("#product-list");
const emptyEl = $("#empty-state");
const noMatchEl = $("#no-match");
const summaryEl = $("#summary-text");
const dropsIntroEl = $("#drops-intro");
const dropsEmptyEl = $("#drops-empty");
const dialogAdd = $("#dialog-add");
const TAB_KEY = "indirim_takip_tab";
let activeTab = "all";
const toolsEl = $("#list-tools");
const filterEl = $("#input-filter");
const sortEl = $("#select-sort");
const toastEl = $("#toast");
const dialogToken = $("#dialog-token");
const formToken = $("#form-token");
const tokenErrorEl = $("#token-error");
const formAdd = $("#form-add");
const addErrorEl = $("#add-error");
const urlInput = $("#input-url");
const urlHint = $("#url-hint");
const priceInput = $("#input-target-price");
const percentInput = $("#input-target-percent");

const URL_HINT_DEFAULT = urlHint.textContent;

let products = [];
let lastLatestCheck = null;
let autoTickInFlight = false;
let loadedOnce = false;

/* ---------- Storage ---------- */

function safeGet(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeSet(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* depolama kapalı olabilir */
  }
}

const getToken = () => safeGet(STORAGE_KEY);
const setToken = (v) => safeSet(STORAGE_KEY, String(v || "").trim());

/* ---------- Helpers ---------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTl(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function formatPct(n) {
  return `%${Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
}

function relativeTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  const diff = Math.max(0, Date.now() - t);
  const min = Math.round(diff / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

const SITES = {
  trendyol: "Trendyol",
  hepsiburada: "Hepsiburada",
  akakce: "Akakçe",
  cimri: "Cimri",
};

const siteLabel = (site) => SITES[site] || site;

function detectSite(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes("trendyol")) return "trendyol";
  if (u.includes("hepsiburada")) return "hepsiburada";
  if (u.includes("akakce") || u.includes("akakçe")) return "akakce";
  if (u.includes("cimri")) return "cimri";
  return null;
}

function hasPriceTarget(p) {
  return p.target_price != null && p.target_price >= 0;
}

/**
 * Ürünün hedefe göre durumu: hedefe ulaştı mı, ne kadar kaldı?
 * Sunucudaki uyarı mantığıyla aynı kurallar (TL hedefi ve bazdan yüzde düşüş).
 */
function productStatus(p) {
  const last = p.last_price;
  if (last == null) {
    return { kind: "pending", text: "İlk fiyat kontrolü bekleniyor", score: Infinity };
  }
  const base = p.baseline_price;
  const dropNow = base > 0 ? ((base - last) / base) * 100 : null;
  if (isStaleProduct(p)) {
    return { kind: "stale", text: "Fiyat alınamıyor", score: 1e6, dropNow };
  }

  const remaining = [];
  if (hasPriceTarget(p)) {
    if (last <= p.target_price) return { kind: "hit", text: "Hedef fiyata ulaştı", score: -1, dropNow };
    remaining.push(last - p.target_price);
  }
  if (p.target_drop_percent != null && base > 0) {
    if (dropNow >= p.target_drop_percent) {
      return { kind: "hit", text: `${formatPct(dropNow)} düştü — hedefe ulaştı`, score: -1, dropNow };
    }
    const needPrice = base * (1 - p.target_drop_percent / 100);
    remaining.push(last - needPrice);
  }
  if (!remaining.length) return { kind: "pending", text: "Hedef bekleniyor", score: Infinity, dropNow };
  const left = Math.min(...remaining);
  return {
    kind: "waiting",
    text: `Hedefe ${formatTl(left)} kaldı`,
    score: left / last,
    dropNow,
  };
}

/** Son genel kontrolde bu ürünün fiyatı alınamadıysa (mağaza engeli vb.) true. */
function isStaleProduct(p) {
  if (!p.last_checked_at || !lastLatestCheck) return false;
  const gap = new Date(lastLatestCheck).getTime() - new Date(p.last_checked_at).getTime();
  return gap > 20 * 60 * 1000;
}

function targetLines(p) {
  const out = [];
  if (hasPriceTarget(p)) out.push(`${formatTl(p.target_price)} altı`);
  if (p.target_drop_percent != null) out.push(`${formatPct(p.target_drop_percent)} düşüş`);
  return out.length ? out.join(" veya ") : "—";
}

/* ---------- Toast ---------- */

let toastTimer = null;

function showToast(message, type = "info", ms = 3500) {
  toastEl.textContent = message;
  toastEl.className = `toast toast--${type}`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, ms);
}

toastEl.addEventListener("click", () => {
  toastEl.hidden = true;
});

/* ---------- API ---------- */

class AuthError extends Error {}

async function api(path, options = {}) {
  const h = { Accept: "application/json", "Content-Type": "application/json" };
  const t = getToken();
  if (t) h["X-Dashboard-Token"] = t;

  let res;
  try {
    res = await fetch(path, { ...options, headers: { ...h, ...(options.headers || {}) } });
  } catch {
    throw new Error("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
  }
  let data = null;
  if ((res.headers.get("content-type") || "").includes("application/json")) {
    data = await res.json().catch(() => null);
  }
  if (res.status === 401) {
    throw new AuthError(data?.detail || "Panel anahtarı geçersiz.");
  }
  if (!res.ok) {
    const msg = data?.detail;
    if (typeof msg === "string") throw new Error(msg);
    if (res.status >= 500) throw new Error("Sunucuda bir sorun oluştu. Biraz sonra tekrar deneyin.");
    throw new Error(`İstek başarısız (${res.status}).`);
  }
  return data;
}

function handleError(e, fallback) {
  if (e instanceof AuthError) {
    setToken("");
    openTokenDialog(e.message);
    return;
  }
  showToast(e?.message || fallback, "error", 5000);
}

function setBusy(btn, busy, label) {
  const labelEl = btn.querySelector(".btn__label") || btn;
  if (busy) {
    btn.dataset.idleLabel = labelEl.textContent;
    labelEl.textContent = label;
    btn.disabled = true;
    btn.classList.add("is-busy");
  } else {
    labelEl.textContent = btn.dataset.idleLabel || labelEl.textContent;
    btn.disabled = false;
    btn.classList.remove("is-busy");
  }
}

/* ---------- Render ---------- */

function renderSkeleton() {
  listEl.innerHTML = Array.from({ length: 2 })
    .map(() => '<li><div class="card card--skeleton" aria-hidden="true"></div></li>')
    .join("");
}

function sortProducts(list) {
  const mode = sortEl.value;
  const copy = [...list];
  if (mode === "newest") copy.sort((a, b) => b.id - a.id);
  else if (mode === "cheapest") {
    copy.sort((a, b) => (a.last_price ?? Infinity) - (b.last_price ?? Infinity));
  } else if (mode === "name") {
    copy.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url, "tr"));
  } else copy.sort((a, b) => productStatus(a).score - productStatus(b).score);
  return copy;
}

/** İlk fiyata göre ucuzlama: { pct, amount } veya null. */
function priceDrop(p) {
  const base = p.baseline_price;
  const last = p.last_price;
  if (!(base > 0) || last == null || last >= base) return null;
  const pct = ((base - last) / base) * 100;
  if (pct < 0.1) return null;
  return { pct, amount: base - last };
}

function shortTl(n) {
  return `${Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
}

function cardHtml(p) {
  const st = productStatus(p);
  const title = p.title || "Ürün adı ilk kontrolde alınacak";
  const shortTitle = escapeHtml(title.slice(0, 60));
  const drop = priceDrop(p);
  let change = "";
  if (drop) change = `<span class="delta delta--down">▼ ${formatPct(drop.pct)}</span>`;
  else if (st.dropNow != null && st.dropNow <= -0.1) {
    change = `<span class="delta delta--up">▲ ${formatPct(-st.dropNow)}</span>`;
  }
  const meta = [];
  if (drop) meta.push(`${shortTl(drop.amount)} ucuz`);
  if (hasPriceTarget(p)) meta.push(`hedef ${shortTl(p.target_price)}`);
  if (p.target_drop_percent != null) meta.push(`hedef ${formatPct(p.target_drop_percent)}`);
  if (p.baseline_price != null) meta.push(`ilk ${shortTl(p.baseline_price)}`);
  meta.push(relativeTime(p.last_checked_at) || "kontrol bekleniyor");
  return `
    <article class="card card--${st.kind}" data-id="${p.id}">
      <div class="card__top">
        <span class="badge">${escapeHtml(siteLabel(p.site))}</span>
        <h3 class="card__title" title="${escapeHtml(title)}">${escapeHtml(title.slice(0, 140))}</h3>
      </div>
      <div class="card__price">
        <span class="card__price-now">${formatTl(p.last_price)}</span>
        ${change}
        <div class="card__actions">
          <a class="icon-btn icon-btn--sm" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" title="Mağazada aç" aria-label="${shortTitle} mağazada aç">↗</a>
          <button type="button" class="icon-btn icon-btn--sm" data-edit="${p.id}" title="Uyarıyı düzenle" aria-label="${shortTitle} uyarısını düzenle">✎</button>
          <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-remove="${p.id}" title="Sil" aria-label="${shortTitle} ürününü sil">✕</button>
        </div>
      </div>
      <div class="card__bottom">
        <span class="status status--${st.kind}">${escapeHtml(st.text)}</span>
        <span class="card__meta">${escapeHtml(meta.join(" · "))}</span>
      </div>
    </article>`;
}

function renderProducts() {
  const drops = products.filter((p) => priceDrop(p));
  $("#count-all").textContent = products.length || "";
  $("#count-drops").textContent = drops.length || "";

  const inDrops = activeTab === "drops";
  const base = inDrops ? drops : products;
  const q = filterEl.value.trim().toLocaleLowerCase("tr");
  const filtered = q
    ? base.filter((p) =>
        `${p.title || ""} ${p.url} ${siteLabel(p.site)}`.toLocaleLowerCase("tr").includes(q)
      )
    : base;
  const sorted = inDrops
    ? [...filtered].sort((a, b) => priceDrop(b).pct - priceDrop(a).pct)
    : sortProducts(filtered);

  listEl.innerHTML = sorted.map((p) => `<li>${cardHtml(p)}</li>`).join("");

  emptyEl.hidden = products.length > 0;
  dropsIntroEl.hidden = !inDrops || drops.length === 0;
  dropsEmptyEl.hidden = !(inDrops && products.length > 0 && drops.length === 0);
  noMatchEl.hidden = !(base.length > 0 && filtered.length === 0);
  toolsEl.hidden = products.length < 4;
  sortEl.hidden = inDrops;
}

function setTab(tab) {
  activeTab = tab;
  safeSet(TAB_KEY, tab);
  document.querySelectorAll(".tab").forEach((t) => {
    const on = t.dataset.tab === tab;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", String(on));
  });
  renderProducts();
}

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => setTab(t.dataset.tab))
);
activeTab = safeGet(TAB_KEY) === "drops" ? "drops" : "all";

function updateSummary() {
  if (!loadedOnce) return;
  const hits = products.filter((p) => productStatus(p).kind === "hit").length;
  const parts = [products.length ? `${products.length} ürün takipte` : "Liste boş"];
  if (hits) parts.push(`${hits} hedefte`);
  if (autoTickInFlight) parts.push("fiyatlar güncelleniyor…");
  else {
    const rel = relativeTime(lastLatestCheck);
    parts.push(rel ? `son kontrol ${rel}` : "henüz kontrol yapılmadı");
  }
  summaryEl.textContent = parts.join(" · ");
}

/* ---------- Data ---------- */

async function loadProducts() {
  const data = await api("/api/products");
  products = data.products || [];
  lastLatestCheck = data.latest_check || null;
  loadedOnce = true;
  renderProducts();
  updateSummary();
  return data;
}

function isCheckStale(iso) {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) || Date.now() - t >= STALE_CHECK_MS;
}

async function maybeAutoPriceCheck() {
  if (document.hidden || autoTickInFlight || !getToken() || !products.length) return;
  if (!isCheckStale(lastLatestCheck)) return;
  autoTickInFlight = true;
  updateSummary();
  try {
    const data = await api("/api/schedule/tick", { method: "POST" });
    if (data.result === "ran") {
      await loadProducts();
      showToast("Fiyatlar otomatik olarak güncellendi.", "success");
    } else if (data.latest_check) {
      lastLatestCheck = data.latest_check;
    }
  } catch {
    /* sessiz: ağ hatası veya başka bir kontrol zaten çalışıyor */
  } finally {
    autoTickInFlight = false;
    updateSummary();
  }
}

async function runCheck() {
  const btn = $("#btn-check");
  if (!products.length) {
    openAddDialog();
    return;
  }
  setBusy(btn, true, "Kontrol ediliyor…");
  showToast("Fiyatlar kontrol ediliyor, bu biraz sürebilir…", "info", 60000);
  try {
    const data = await api("/api/check", { method: "POST" });
    await loadProducts();
    if (data.failed_count) {
      showToast(
        `${data.ok_count} ürün güncellendi, ${data.failed_count} ürünün fiyatı alınamadı (mağaza erişimi engelliyor olabilir).`,
        "warn",
        6000
      );
    } else {
      showToast(`${data.ok_count} ürünün fiyatı güncellendi.`, "success");
    }
  } catch (e) {
    handleError(e, "Kontrol başarısız.");
  } finally {
    setBusy(btn, false);
  }
}

/* ---------- Token dialog ---------- */

function openTokenDialog(errorMsg) {
  $("#input-token").value = getToken();
  tokenErrorEl.textContent = errorMsg || "";
  tokenErrorEl.hidden = !errorMsg;
  $("#btn-token-cancel").hidden = !loadedOnce || !getToken();
  if (dialogToken.open) return;
  if (typeof dialogToken.showModal === "function") dialogToken.showModal();
  else dialogToken.setAttribute("open", "");
  setTimeout(() => $("#input-token").focus(), 50);
}

function closeTokenDialog() {
  if (typeof dialogToken.close === "function") dialogToken.close();
  else dialogToken.removeAttribute("open");
}

formToken.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const token = $("#input-token").value.trim();
  if (!token) {
    tokenErrorEl.textContent = "Lütfen panel anahtarını girin.";
    tokenErrorEl.hidden = false;
    return;
  }
  const prev = getToken();
  setToken(token);
  const btn = $("#btn-token-save");
  setBusy(btn, true, "Kontrol ediliyor…");
  try {
    await loadProducts();
    closeTokenDialog();
    app.hidden = false;
    setTab(activeTab);
    showToast("Giriş başarılı.", "success");
    maybeAutoPriceCheck();
  } catch (e) {
    setToken(e instanceof AuthError ? "" : prev);
    tokenErrorEl.textContent =
      e instanceof AuthError ? "Anahtar hatalı, lütfen tekrar deneyin." : e.message;
    tokenErrorEl.hidden = false;
  } finally {
    setBusy(btn, false);
  }
});

$("#btn-token-cancel").addEventListener("click", closeTokenDialog);
dialogToken.addEventListener("cancel", (ev) => {
  // Anahtar yokken Esc ile kapatılıp boş ekranda kalınmasın.
  if (!getToken() || !loadedOnce) ev.preventDefault();
});

$("#btn-token-toggle").addEventListener("click", (ev) => {
  const input = $("#input-token");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  ev.currentTarget.textContent = show ? "Gizle" : "Göster";
});

/* ---------- Add form ---------- */

function parseOptionalPrice(raw) {
  let s = String(raw || "").trim().replace(/\s|tl|₺/gi, "");
  if (!s) return null;
  // "2.500,50" veya "2500,50" → 2500.50 ; "2.500" → 2500
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function parseOptionalPercent(raw) {
  const s = String(raw || "").trim().replace("%", "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return undefined;
  return n;
}

function showAddError(msg, focusEl) {
  addErrorEl.textContent = msg;
  addErrorEl.hidden = !msg;
  if (focusEl) focusEl.focus();
}

function updateUrlHint() {
  const v = urlInput.value.trim();
  urlHint.classList.remove("field__hint--ok", "field__hint--bad");
  if (!v) {
    urlHint.textContent = URL_HINT_DEFAULT;
    return;
  }
  const site = detectSite(v);
  if (site) {
    urlHint.textContent = `✓ ${siteLabel(site)} linki algılandı`;
    urlHint.classList.add("field__hint--ok");
  } else {
    urlHint.textContent = "Bu link desteklenmiyor. Trendyol, Hepsiburada, Akakçe veya Cimri linki girin.";
    urlHint.classList.add("field__hint--bad");
  }
}

urlInput.addEventListener("input", () => {
  updateUrlHint();
  showAddError("");
});
[priceInput, percentInput].forEach((el) => el.addEventListener("input", () => showAddError("")));

document.querySelectorAll("[data-percent]").forEach((chip) => {
  chip.addEventListener("click", () => {
    percentInput.value = chip.dataset.percent;
    showAddError("");
  });
});

const pasteBtn = $("#btn-paste");
if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
  pasteBtn.hidden = false;
  pasteBtn.addEventListener("click", async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return showToast("Pano boş.", "info");
      urlInput.value = text;
      updateUrlHint();
      priceInput.focus();
    } catch {
      showToast("Panoya erişilemedi; linki elle yapıştırın.", "info");
    }
  });
}

formAdd.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return showAddError("Ürün linkini girin.", urlInput);
  if (!/^https?:\/\//i.test(url)) {
    return showAddError("Link https:// ile başlamalı. Ürün sayfasının adresini kopyalayın.", urlInput);
  }
  if (!detectSite(url)) {
    return showAddError("Bu link desteklenmiyor. Trendyol, Hepsiburada, Akakçe veya Cimri linki girin.", urlInput);
  }

  const target_price = parseOptionalPrice(priceInput.value);
  const target_drop_percent = parseOptionalPercent(percentInput.value);
  if (target_price === undefined) {
    return showAddError("Hedef fiyat geçerli bir sayı olmalı (ör. 2500 veya 2.499,90).", priceInput);
  }
  if (target_drop_percent === undefined) {
    return showAddError("Yüzde 1 ile 99 arasında bir sayı olmalı (ör. 10).", percentInput);
  }
  if (target_price == null && target_drop_percent == null) {
    return showAddError("Ne zaman haber verelim? Bir hedef fiyat veya yüzde girin.", priceInput);
  }

  const body = { url };
  if (target_price != null) body.target_price = target_price;
  if (target_drop_percent != null) body.target_drop_percent = target_drop_percent;

  const btn = $("#btn-add");
  setBusy(btn, true, "Ekleniyor…");
  try {
    await api("/api/products", { method: "POST", body: JSON.stringify(body) });
    formAdd.reset();
    updateUrlHint();
    showAddError("");
    closeDialog(dialogAdd);
    await loadProducts();
    showToast("Ürün takibe alındı. Fiyatı bir sonraki kontrolde görünecek.", "success", 4500);
  } catch (e) {
    if (e instanceof AuthError) handleError(e);
    else showAddError(e.message || "Ürün eklenemedi.");
  } finally {
    setBusy(btn, false);
  }
});

/* ---------- Edit dialog ---------- */

const dialogEdit = $("#dialog-edit");
const formEdit = $("#form-edit");
const editErrorEl = $("#edit-error");
const editPrice = $("#edit-target-price");
const editPercent = $("#edit-target-percent");
const editReset = $("#edit-reset-baseline");
let editingId = null;

function formatInputNumber(n) {
  return n == null ? "" : String(n).replace(".", ",");
}

function openEditDialog(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  editingId = id;
  $("#edit-product-name").textContent = p.title || p.url;
  editPrice.value = hasPriceTarget(p) ? formatInputNumber(p.target_price) : "";
  editPercent.value = formatInputNumber(p.target_drop_percent);
  editReset.checked = false;
  editReset.disabled = p.last_price == null;
  $("#edit-current-price").textContent = p.last_price != null ? `(${formatTl(p.last_price)})` : "";
  editErrorEl.hidden = true;
  if (typeof dialogEdit.showModal === "function") dialogEdit.showModal();
  else dialogEdit.setAttribute("open", "");
  setTimeout(() => editPrice.focus(), 50);
}

function closeEditDialog() {
  editingId = null;
  if (typeof dialogEdit.close === "function") dialogEdit.close();
  else dialogEdit.removeAttribute("open");
}

function showEditError(msg, focusEl) {
  editErrorEl.textContent = msg;
  editErrorEl.hidden = !msg;
  if (focusEl) focusEl.focus();
}

[editPrice, editPercent].forEach((el) => el.addEventListener("input", () => showEditError("")));
$("#btn-edit-cancel").addEventListener("click", closeEditDialog);

formEdit.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (editingId == null) return;
  const target_price = parseOptionalPrice(editPrice.value);
  const target_drop_percent = parseOptionalPercent(editPercent.value);
  if (target_price === undefined) {
    return showEditError("Hedef fiyat geçerli bir sayı olmalı (ör. 2500 veya 2.499,90).", editPrice);
  }
  if (target_drop_percent === undefined) {
    return showEditError("Yüzde 1 ile 99 arasında bir sayı olmalı (ör. 10).", editPercent);
  }
  if (target_price == null && target_drop_percent == null) {
    return showEditError("En az bir uyarı girin: hedef fiyat veya yüzde.", editPrice);
  }
  const btn = $("#btn-edit-save");
  setBusy(btn, true, "Kaydediliyor…");
  try {
    const updated = await api(`/api/products/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify({ target_price, target_drop_percent, reset_baseline: editReset.checked }),
    });
    products = products.map((x) => (x.id === updated.id ? { ...x, ...updated } : x));
    closeEditDialog();
    renderProducts();
    updateSummary();
    showToast("Uyarı güncellendi.", "success");
  } catch (e) {
    if (e instanceof AuthError) {
      closeEditDialog();
      handleError(e);
    } else showEditError(e.message || "Kaydedilemedi.");
  } finally {
    setBusy(btn, false);
  }
});

/* ---------- List actions ---------- */

listEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-edit]");
  if (btn) openEditDialog(Number(btn.getAttribute("data-edit")));
});

listEl.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-remove]");
  if (!btn) return;
  const id = Number(btn.getAttribute("data-remove"));
  const p = products.find((x) => x.id === id);
  const name = p?.title ? `"${p.title.slice(0, 60)}"` : "Bu ürün";
  if (!confirm(`${name} takip listesinden çıkarılsın mı?`)) return;
  setBusy(btn, true, "Siliniyor…");
  try {
    await api(`/api/products/${id}`, { method: "DELETE" });
    products = products.filter((x) => x.id !== id);
    renderProducts();
    updateSummary();
    showToast("Ürün listeden çıkarıldı.", "success");
  } catch (e) {
    setBusy(btn, false);
    handleError(e, "Silinemedi.");
  }
});

filterEl.addEventListener("input", renderProducts);
sortEl.value = safeGet(SORT_KEY) || "closest";
sortEl.addEventListener("change", () => {
  safeSet(SORT_KEY, sortEl.value);
  renderProducts();
});

$("#btn-check").addEventListener("click", runCheck);
$("#btn-refresh").addEventListener("click", async (ev) => {
  const btn = ev.currentTarget;
  setBusy(btn, true, "");
  try {
    await loadProducts();
  } catch (e) {
    handleError(e, "Liste yenilenemedi.");
  } finally {
    setBusy(btn, false);
  }
});
/* ---------- Pencereler ---------- */

function openDialog(d) {
  if (d.open) return;
  if (typeof d.showModal === "function") d.showModal();
  else d.setAttribute("open", "");
}

function closeDialog(d) {
  if (typeof d.close === "function") d.close();
  else d.removeAttribute("open");
}

$("#btn-logout").addEventListener("click", () => {
  if (!confirm("Bu cihazda çıkış yapılsın mı?")) return;
  setToken("");
  products = [];
  loadedOnce = false;
  listEl.innerHTML = "";
  app.hidden = true;
  openTokenDialog();
});

/* ---------- Ürün ekleme penceresi ---------- */

function openAddDialog() {
  showAddError("");
  updateUrlHint();
  openDialog(dialogAdd);
  setTimeout(() => urlInput.focus(), 50);
}

$("#btn-open-add").addEventListener("click", openAddDialog);
$("#btn-add-cancel").addEventListener("click", () => closeDialog(dialogAdd));
document.addEventListener("click", (ev) => {
  if (ev.target.closest("[data-open-add]")) openAddDialog();
});

/* ---------- Boot ---------- */

if (getToken()) {
  app.hidden = false;
  setTab(activeTab);
  renderSkeleton();
  loadProducts()
    .then(() => maybeAutoPriceCheck())
    .catch((e) => {
      if (e instanceof AuthError) handleError(e);
      else {
        listEl.innerHTML = "";
        summaryEl.textContent = "Liste yüklenemedi.";
        showToast(e.message, "error", 6000);
      }
    });
} else {
  openTokenDialog();
}

setInterval(() => {
  if (document.hidden || !getToken()) return;
  maybeAutoPriceCheck();
  updateSummary(); // "x dk önce" metnini taze tut
}, 60_000);

setInterval(() => {
  if (document.hidden || !getToken() || document.querySelector("dialog[open]")) return;
  loadProducts().catch(() => {});
}, 2 * 60_000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && getToken() && loadedOnce) {
    loadProducts()
      .then(() => maybeAutoPriceCheck())
      .catch(() => {});
  }
});
