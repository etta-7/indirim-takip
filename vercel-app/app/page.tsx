import Script from "next/script";

export default function HomePage() {
  return (
    <>
      <div id="app" className="app-shell" hidden aria-live="polite">
        <header className="top-bar">
          <div className="top-bar__titles">
            <h1 className="top-bar__title">İndirim Takip</h1>
            <p className="top-bar__sub" id="summary-text">
              Yükleniyor…
            </p>
          </div>
          <button type="button" className="btn btn--primary btn--check" id="btn-check">
            Şimdi kontrol et
          </button>
        </header>

        <section className="panel panel--add" aria-labelledby="add-heading">
          <h2 id="add-heading" className="panel__heading">
            Ürün ekle
          </h2>
          <form id="form-add" className="form-add" autoComplete="off">
            <label className="field">
              <span className="field__label">Ürün linki</span>
              <input
                className="field__input"
                type="url"
                name="url"
                inputMode="url"
                placeholder="https://www.trendyol.com/…"
                required
              />
            </label>
            <fieldset className="field-group" aria-labelledby="alert-heading">
              <legend id="alert-heading" className="field-group__legend">
                Uyarı eşiği (en az biri)
              </legend>
              <label className="field">
                <span className="field__label">Hedef fiyat (TL)</span>
                <input
                  className="field__input"
                  type="text"
                  name="target_price"
                  id="input-target-price"
                  inputMode="decimal"
                  enterKeyHint="next"
                  placeholder="ör. 2500"
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="field__label">Yüzde düşüş (%)</span>
                <input
                  className="field__input"
                  type="text"
                  name="target_drop_percent"
                  id="input-target-percent"
                  inputMode="numeric"
                  enterKeyHint="done"
                  placeholder="ör. 10"
                  autoComplete="off"
                />
                <span className="field__hint">
                  Sadece yüzde, sadece TL veya ikisi birlikte — bot ile aynı mantık
                </span>
              </label>
            </fieldset>
            <button type="submit" className="btn btn--secondary btn--block">
              Listeye ekle
            </button>
          </form>
        </section>

        <section className="panel" aria-labelledby="list-heading">
          <div className="panel__row">
            <h2 id="list-heading" className="panel__heading">
              Takip listesi
            </h2>
            <button type="button" className="btn btn--ghost btn--sm" id="btn-refresh">
              Yenile
            </button>
          </div>
          <ul id="product-list" className="product-list" />
          <p id="empty-state" className="empty-state" hidden>
            Henüz ürün yok. Yukarıdan bir link ekleyin.
          </p>
        </section>

        <footer className="foot">
          <button type="button" className="btn btn--ghost btn--sm" id="btn-settings">
            Panel anahtarı
          </button>
        </footer>
      </div>

      <dialog id="dialog-token" className="dialog">
        <form method="dialog" id="form-token" className="dialog__body">
          <h2 className="dialog__title">Panel anahtarı</h2>
          <p className="dialog__text">
            <code>DASHBOARD_TOKEN</code> değerini girin. Bu cihazda saklanır; yalnızca sizin
            kullanımınız içindir.
          </p>
          <label className="field">
            <span className="field__label">Anahtar</span>
            <input
              className="field__input"
              type="password"
              name="token"
              id="input-token"
              autoComplete="off"
              required
            />
          </label>
          <div className="dialog__actions">
            <button type="submit" className="btn btn--primary btn--block">
              Kaydet ve devam et
            </button>
          </div>
        </form>
      </dialog>

      <div id="toast" className="toast" role="status" hidden />
      <Script src="/assets/app.js?v=4" strategy="afterInteractive" />
    </>
  );
}
