import Script from "next/script";

export default function HomePage() {
  return (
    <>
      <div id="app" className="app-shell" hidden>
        <header className="top-bar">
          <div className="top-bar__row">
            <h1 className="top-bar__title">İndirim Takip</h1>
            <div className="top-bar__actions">
              <button
                type="button"
                className="icon-btn"
                id="btn-refresh"
                aria-label="Listeyi yenile"
                title="Yenile"
              >
                <span className="btn__label">↻</span>
              </button>
              <button
                type="button"
                className="icon-btn"
                id="btn-logout"
                aria-label="Çıkış yap"
                title="Çıkış yap"
              >
                Çıkış
              </button>
            </div>
          </div>
          <p className="top-bar__sub">
            <span id="summary-text" aria-live="polite">
              Yükleniyor…
            </span>
          </p>
        </header>

        <div className="actions-bar">
          <button type="button" className="btn btn--primary" id="btn-open-add">
            + Ürün ekle
          </button>
          <button type="button" className="btn btn--secondary" id="btn-check">
            <span className="btn__label">Fiyatları kontrol et</span>
          </button>
        </div>

        <nav className="tabs" role="tablist" aria-label="Görünüm">
          <button type="button" role="tab" className="tab" data-tab="all" aria-selected="true">
            Tümü <span className="tab__count" id="count-all" />
          </button>
          <button type="button" role="tab" className="tab" data-tab="drops" aria-selected="false">
            Fiyatı düşenler <span className="tab__count tab__count--ok" id="count-drops" />
          </button>
        </nav>

        <section className="panel panel--list" id="view-products" role="tabpanel">
          <div className="list-tools" id="list-tools" hidden>
            <input
              className="field__input field__input--sm"
              type="search"
              id="input-filter"
              placeholder="Listede ara…"
              aria-label="Listede ara"
            />
            <select className="field__input field__input--sm" id="select-sort" aria-label="Sırala">
              <option value="closest">Hedefe en yakın</option>
              <option value="newest">En yeni</option>
              <option value="cheapest">En ucuz</option>
              <option value="name">Ada göre</option>
            </select>
          </div>
          <p className="panel__intro" id="drops-intro" hidden>
            Takibe aldığınız fiyata göre ucuzlayan ürünler; en çok düşen en üstte.
          </p>

          <ul id="product-list" className="product-list" aria-live="polite" />

          <div id="empty-state" className="empty-state" hidden>
            <p className="empty-state__title">Henüz takip ettiğiniz ürün yok</p>
            <p>Bir ürün linki ekleyin, fiyatı düşünce Telegram&apos;dan haber verelim.</p>
            <button type="button" className="btn btn--primary btn--sm" data-open-add>
              + İlk ürünü ekle
            </button>
          </div>
          <p id="drops-empty" className="empty-state" hidden>
            Şimdilik fiyatı düşen ürün yok. Düşüş olunca burada görünecek.
          </p>
          <p id="no-match" className="empty-state" hidden>
            Aramanızla eşleşen ürün yok.
          </p>
        </section>

      </div>

      <dialog id="dialog-add" className="dialog">
        <form id="form-add" className="dialog__body" autoComplete="off" noValidate>
          <h2 className="dialog__title">Ürün ekle</h2>
          <label className="field">
            <span className="field__label">Ürün linki</span>
            <div className="field__row">
              <input
                className="field__input"
                type="url"
                name="url"
                id="input-url"
                inputMode="url"
                placeholder="https://www.trendyol.com/…"
                aria-describedby="url-hint"
              />
              <button type="button" className="btn btn--ghost btn--paste" id="btn-paste" hidden>
                Yapıştır
              </button>
            </div>
            <span className="field__hint" id="url-hint">
              Trendyol, Hepsiburada, Akakçe veya Cimri linki.
            </span>
          </label>

          <p className="field__label field__label--group">
            Ne zaman haber verelim? <span className="muted">(en az biri)</span>
          </p>
          <div className="field-group__grid">
            <label className="field">
              <span className="field__hint">Fiyat şunun altına inince</span>
              <div className="field__affix">
                <input
                  className="field__input"
                  type="text"
                  name="target_price"
                  id="input-target-price"
                  inputMode="decimal"
                  enterKeyHint="next"
                  placeholder="2500"
                  autoComplete="off"
                />
                <span className="field__suffix">TL</span>
              </div>
            </label>
            <label className="field">
              <span className="field__hint">veya şu kadar düşünce</span>
              <div className="field__affix">
                <span className="field__prefix">%</span>
                <input
                  className="field__input field__input--prefixed"
                  type="text"
                  name="target_drop_percent"
                  id="input-target-percent"
                  inputMode="decimal"
                  enterKeyHint="done"
                  placeholder="10"
                  autoComplete="off"
                />
              </div>
            </label>
          </div>
          <div className="chips" role="group" aria-label="Hızlı yüzde seçimi">
            <button type="button" className="chip" data-percent="5">%5</button>
            <button type="button" className="chip" data-percent="10">%10</button>
            <button type="button" className="chip" data-percent="20">%20</button>
            <button type="button" className="chip" data-percent="30">%30</button>
          </div>

          <p className="form-error" id="add-error" role="alert" hidden />

          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" id="btn-add-cancel">
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" id="btn-add">
              <span className="btn__label">Takibe al</span>
            </button>
          </div>
        </form>
      </dialog>

      <dialog id="dialog-token" className="dialog">
        <form method="dialog" id="form-token" className="dialog__body">
          <h2 className="dialog__title">Panele giriş</h2>
          <p className="dialog__text">
            Size verilen panel anahtarını girin. Anahtar yalnızca bu cihazda saklanır.
          </p>
          <label className="field">
            <span className="field__label">Panel anahtarı</span>
            <div className="field__row">
              <input
                className="field__input"
                type="password"
                name="token"
                id="input-token"
                autoComplete="current-password"
                required
              />
              <button type="button" className="btn btn--ghost btn--paste" id="btn-token-toggle">
                Göster
              </button>
            </div>
          </label>
          <p className="form-error" id="token-error" role="alert" hidden />
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" id="btn-token-cancel" hidden>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" id="btn-token-save">
              <span className="btn__label">Giriş yap</span>
            </button>
          </div>
        </form>
      </dialog>

      <dialog id="dialog-edit" className="dialog">
        <form method="dialog" id="form-edit" className="dialog__body" noValidate>
          <h2 className="dialog__title">Uyarıyı düzenle</h2>
          <p className="dialog__text" id="edit-product-name" />
          <div className="field-group__grid">
            <label className="field">
              <span className="field__label">Fiyat şunun altına inince</span>
              <div className="field__affix">
                <input
                  className="field__input"
                  type="text"
                  id="edit-target-price"
                  inputMode="decimal"
                  placeholder="boş = yok"
                  autoComplete="off"
                />
                <span className="field__suffix">TL</span>
              </div>
            </label>
            <label className="field">
              <span className="field__label">veya şu kadar düşünce</span>
              <div className="field__affix">
                <span className="field__prefix">%</span>
                <input
                  className="field__input field__input--prefixed"
                  type="text"
                  id="edit-target-percent"
                  inputMode="decimal"
                  placeholder="boş = yok"
                  autoComplete="off"
                />
              </div>
            </label>
          </div>
          <label className="check">
            <input type="checkbox" id="edit-reset-baseline" />
            <span>
              Yüzdeyi şu anki fiyattan hesapla{" "}
              <span className="muted" id="edit-current-price" />
            </span>
          </label>
          <p className="field__hint">
            Bir alanı boş bırakırsanız o uyarı kaldırılır. En az biri dolu olmalı.
          </p>
          <p className="form-error" id="edit-error" role="alert" hidden />
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" id="btn-edit-cancel">
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" id="btn-edit-save">
              <span className="btn__label">Kaydet</span>
            </button>
          </div>
        </form>
      </dialog>

      <div id="toast" className="toast" role="status" aria-live="polite" hidden />
      <Script src="/assets/app.js?v=8" strategy="afterInteractive" />
    </>
  );
}
