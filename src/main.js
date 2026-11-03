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
      w.fbq("init", a.metaPixelId); w.fbq("track", "PageView");
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
      if (w.fbq) w.fbq("trackCustom", "click_whatsapp_cta", p);
    } catch (e) {}
  }, { capture: true });
})();
