import Script from "next/script";

export default function HomePage() {
  return (
    <>
      <div id="app" className="app-shell" hidden>
        <header className="top-bar">
          <div className="top-bar__titles">
            <h1 className="top-bar__title">İndirim Takip</h1>
            <p className="top-bar__sub" id="summary-text" aria-live="polite">
              Yükleniyor…
            </p>
          </div>
          <button type="button" className="btn btn--primary btn--check" id="btn-check">
            <span className="btn__label">Fiyatları şimdi kontrol et</span>
          </button>
        </header>

        <section className="panel panel--add" aria-labelledby="add-heading">
          <h2 id="add-heading" className="panel__heading">
            Yeni ürün ekle
          </h2>
          <p className="panel__intro">
            Trendyol, Hepsiburada, Akakçe veya Cimri&apos;den ürün linkini yapıştırın; fiyat
            düştüğünde Telegram&apos;dan haber verelim.
          </p>
          <form id="form-add" className="form-add" autoComplete="off" noValidate>
            <label className="field">
              <span className="field__label">1. Ürün linki</span>
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
                Ürün sayfasındaki adres çubuğunu kopyalayın.
              </span>
            </label>

            <fieldset className="field-group">
              <legend className="field-group__legend">
                2. Ne zaman haber verelim? <span className="muted">(en az birini doldurun)</span>
              </legend>
              <div className="field-group__grid">
                <label className="field">
                  <span className="field__label">Fiyat şunun altına inince</span>
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
                  <span className="field__label">veya şu kadar düşünce</span>
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
              <p className="field__hint">
                Yüzde, ürünün eklendiği andaki fiyata göre hesaplanır. İkisini birden
                doldurursanız hangisi önce gerçekleşirse haber verilir.
              </p>
            </fieldset>

            <p className="form-error" id="add-error" role="alert" hidden />

            <button type="submit" className="btn btn--primary btn--block" id="btn-add">
              <span className="btn__label">Takibe al</span>
            </button>
          </form>
        </section>

        <section className="panel" aria-labelledby="list-heading">
          <div className="panel__row">
            <h2 id="list-heading" className="panel__heading">
              Takip listesi <span className="count" id="list-count" />
            </h2>
            <button type="button" className="btn btn--ghost btn--sm" id="btn-refresh">
              Yenile
            </button>
          </div>

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

          <ul id="product-list" className="product-list" aria-live="polite" />

          <div id="empty-state" className="empty-state" hidden>
            <p className="empty-state__title">Henüz takip ettiğiniz ürün yok</p>
            <p>Yukarıya bir ürün linki yapıştırıp hedef fiyat girerek başlayın.</p>
          </div>
          <p id="no-match" className="empty-state" hidden>
            Aramanızla eşleşen ürün yok.
          </p>
        </section>

        <footer className="foot">
          <button type="button" className="btn btn--link" id="btn-settings">
            Panel anahtarını değiştir
          </button>
        </footer>
      </div>

      <dialog id="dialog-token" className="dialog">
        <form method="dialog" id="form-token" className="dialog__body">
          <h2 className="dialog__title">Panele giriş</h2>
          <p className="dialog__text">
            Kurulumda belirlediğiniz <code>DASHBOARD_TOKEN</code> değerini girin. Anahtar
            yalnızca bu cihazda saklanır.
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
      <Script src="/assets/app.js?v=5" strategy="afterInteractive" />
    </>
  );
}
