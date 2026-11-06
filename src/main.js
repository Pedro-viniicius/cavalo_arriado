/* Achadinhos Black · JS mínimo. A página funciona sem ele:
   os CTAs são <a href> diretos para o convite. */
(function () {
  "use strict";
  var d = document, w = window;
  var cfg = {};
  try { cfg = JSON.parse(d.getElementById("page-config").textContent); } catch (e) {}
  var variant = d.documentElement.getAttribute("data-variant") || "h0c0";

  /* ---------- Barra fixa: aparece quando o CTA do hero sai da tela,
     some quando o CTA final aparece (ou quando já passou dele) ---------- */
  var sticky = d.getElementById("sticky");
  var heroCta = d.getElementById("cta-hero");
  var finalCta = d.getElementById("final");
  var consentOpen = false;
  var heroGone = false, finalNear = false;
  function updateSticky() {
    if (!sticky) return;
    sticky.classList.toggle("is-visible", heroGone && !finalNear && !consentOpen);
  }
  if (sticky && heroCta && finalCta && "IntersectionObserver" in w) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; });
      updateSticky();
    }).observe(heroCta);
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { finalNear = e.isIntersecting || e.boundingClientRect.top < 0; });
      updateSticky();
    }).observe(finalCta);
  }

  /* ---------- Consentimento + analytics (só se houver IDs) ---------- */
  var a = cfg.analytics || {};
  var hasAnalytics = !!(a.ga4Id || a.clarityId || a.metaPixelId);
  var KEY = "ab_consent_v1";
  function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadScript(src) {
    var s = d.createElement("script"); s.async = true; s.src = src; d.head.appendChild(s);
  }
  var loaded = false;
  function loadAnalytics() {
    if (loaded || !hasAnalytics) return; loaded = true;
    if (a.ga4Id) {
      w.dataLayer = w.dataLayer || [];
      w.gtag = function () { w.dataLayer.push(arguments); };
      w.gtag("js", new Date());
      w.gtag("config", a.ga4Id, { niche: cfg.niche, variant: variant });
      loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(a.ga4Id));
    }
    if (a.clarityId) {
      w.clarity = w.clarity || function () { (w.clarity.q = w.clarity.q || []).push(arguments); };
      loadScript("https://www.clarity.ms/tag/" + encodeURIComponent(a.clarityId));
      w.clarity("set", "variant", variant);
    }
    if (a.metaPixelId) {
      var f = w.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
      if (!w._fbq) w._fbq = f; f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
      loadScript("https://connect.facebook.net/en_US/fbevents.js");
      w.fbq("set", "autoConfig", false, a.metaPixelId); w.fbq("init", a.metaPixelId); w.fbq("track", "PageView");
    }
  }
  function afterLoad(fn) {
    var run = function () { (w.requestIdleCallback || function (cb) { setTimeout(cb, 1) })(fn); };
    if (d.readyState === "complete") run(); else w.addEventListener("load", run, { once: true });
  }

  if (hasAnalytics) {
    var banner = d.getElementById("consent");
    var c = getConsent();
    if (c === "granted") afterLoad(loadAnalytics);
    else if (c === null && banner) {
      afterLoad(function () { banner.hidden = false; consentOpen = true; updateSticky(); });
      banner.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-consent]"); if (!b) return;
        var v = b.getAttribute("data-consent");
        setConsent(v); banner.hidden = true; consentOpen = false; updateSticky();
        if (v === "granted") loadAnalytics();
      });
    }
  }

  /* ---------- Evento de clique: não segura a navegação ---------- */
  d.addEventListener("click", function (ev) {
    var link = ev.target.closest && ev.target.closest("a[data-cta]");
    if (!link || !loaded) return;
    var p = { cta_location: link.getAttribute("data-cta"), niche: cfg.niche, variant: variant };
    try {
      if (w.gtag) w.gtag("event", "click_whatsapp_cta", Object.assign({ transport_type: "beacon" }, p));
      if (w.clarity) w.clarity("event", "click_whatsapp_cta");
      if (w.fbq) w.fbq("track", "Contact", { content_name: p.cta_location });
    } catch (e) {}
  }, { capture: true });
})();

/* ---------- Contagem anônima do toque (contar.php, igual ao da Desejo de Menina e da Decisões)
   Não depende do aceite: não envia cookie, identificador nem referer, só a origem do botão
   (hero, sticky ou final) e, se a URL trouxer, o rótulo do conjunto de anúncios em "c" (o
   parâmetro c, senão utm_term, senão utm_campaign), filtrado como no servidor. A reserva
   ("Não abriu o WhatsApp?") não conta. O envio usa keepalive e não segura a navegação. ---------- */
(function () {
  "use strict";
  var UTM_SEGURA = /^[\p{L}\p{M}0-9 _.|:+-]+$/u;
  function rotulo(busca) {
    var q = new URLSearchParams(busca), bruto = null;
    ["c", "utm_term", "utm_campaign"].some(function (k) { var v = (q.get(k) || "").trim(); if (v) { bruto = v; return true; } return false; });
    if (!bruto || Array.from(bruto).length > 80 || !UTM_SEGURA.test(bruto)) return null;
    if (/\d{8,}/.test(bruto.replace(/(\d)[\s._|:+-]+(?=\d)/g, "$1"))) return null;
    return bruto;
  }
  document.addEventListener("click", function (ev) {
    var link = ev.target.closest && ev.target.closest("a[data-cta]");
    if (!link || !/^https:\/\/chat\.whatsapp\.com\//.test(link.href)) return;
    var corpo = { origem: link.getAttribute("data-cta") }, c = rotulo(location.search);
    if (c) corpo.c = c;
    try {
      fetch("/contar.php", { method: "POST", keepalive: true, credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(function () {});
    } catch (e) { /* sem fetch com keepalive: segue sem contar */ }
  });
})();

/* ---------- Abrir o convite direto no app (mesmo desenho do ADR 0012 da Desejo de Menina) ----------
   No navegador interno do Instagram e do Facebook, o primeiro toque num botão do grupo vai para
   whatsapp://chat/?code=<convite> (o mesmo endereço da página de convite do WhatsApp) e, se a página
   continuar visível 2,5 s depois, segue para o https. Os toques seguintes vão direto ao https.
   Este ouvinte vem depois da contagem e do evento. Sem JS, fora desses navegadores, na reserva ou
   com ABRIR_NO_APP = false (exceto com ?app=1), nada muda. ---------- */
(function () {
  "use strict";
  var ABRIR_NO_APP = true;
  var NAVEGADOR_DO_APP = /\b(?:Instagram|FBAN|FBAV|FB_IAB|FBIOS)\b/;
  var ligado = ABRIR_NO_APP || new URLSearchParams(location.search).get("app") === "1";
  var tentouApp = false;
  function linkDoApp(href) {
    var m = /^https:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]{10,40})\/?$/.exec(String(href));
    return m ? "whatsapp://chat/?code=" + m[1] : null;
  }
  document.addEventListener("click", function (ev) {
    if (!ligado || tentouApp) return;
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (!NAVEGADOR_DO_APP.test(navigator.userAgent)) return;
    var link = ev.target.closest && ev.target.closest("a[data-cta]");
    if (!link) return;
    var app = linkDoApp(link.href);
    if (!app) return;
    ev.preventDefault();
    tentouApp = true;
    var web = link.href, inicio = Date.now(), saiu = false;
    var aoSair = function () { saiu = true; };
    var aoMudar = function () { if (document.visibilityState === "hidden") saiu = true; };
    document.addEventListener("visibilitychange", aoMudar);
    window.addEventListener("pagehide", aoSair);
    window.addEventListener("blur", aoSair);
    window.location.href = app;
    setTimeout(function () {
      document.removeEventListener("visibilitychange", aoMudar);
      window.removeEventListener("pagehide", aoSair);
      window.removeEventListener("blur", aoSair);
      if (!saiu && document.visibilityState !== "hidden" && Date.now() - inicio < 4000) window.location.href = web;
    }, 2500);
  });
})();
