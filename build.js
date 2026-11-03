#!/usr/bin/env node
/* Build sem dependências: node build.js
   Lê content.json + src/template.html e gera dist/<slug>.html para cada página. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const content = JSON.parse(fs.readFileSync(path.join(ROOT, "content.json"), "utf8"));
const template = fs.readFileSync(path.join(SRC, "template.html"), "utf8");
const version = Date.now().toString(36);

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const isPlaceholder = (s) => /^\s*\[.*\]\s*$/.test(String(s || ""));

/* ---------- Ícones SVG inline (decorativos) ---------- */
const svg = (inner, vb = "0 0 24 24") =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICONS = {
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  circleCheck: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  bell: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  shield: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 0 1 2.2 12C2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9a9.7 9.7 0 0 1 2.9 6.9c0 5.4-4.4 9.8-9.8 9.8zm8.4-18.2A11.8 11.8 0 0 0 12 .2C5.5.2.2 5.5.2 12c0 2.1.5 4.1 1.6 5.9L.1 24l6.3-1.7a11.8 11.8 0 0 0 5.6 1.4c6.5 0 11.8-5.3 11.8-11.8 0-3.1-1.2-6.1-3.4-8.3z"/></svg>',
};

/* Símbolo da marca: etiqueta inclinada com % */
const TAG = (cls = "logo__mark") =>
  `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g transform="rotate(-14 32 32)"><path fill="#FFC21A" d="M14 14h36a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H14L4 32z"/><circle cx="13" cy="32" r="3.2" fill="#0E0E10"/><circle cx="27" cy="23.5" r="4.6" fill="none" stroke="#0E0E10" stroke-width="3.4"/><circle cx="43" cy="40.5" r="4.6" fill="none" stroke="#0E0E10" stroke-width="3.4"/><path d="M42 20 28 44" stroke="#0E0E10" stroke-width="3.6" stroke-linecap="round"/></g></svg>`;
const logo = (brand) => {
  const [a, ...b] = brand.split(" ");
  return `<a class="logo" href="#conteudo" aria-label="${esc(brand)}">${TAG()}<span class="logo__word" aria-hidden="true"><span class="logo__a">${esc(a.toUpperCase())}</span><span class="logo__b">${esc(b.join(" ").toUpperCase())}</span></span></a>`;
};
const logoStatic = (brand) => logo(brand).replace(/^<a class="logo" href="#conteudo" aria-label="([^"]*)">/, '<p class="logo"><span class="visually-hidden">$1</span>').replace(/<\/a>$/, "</p>");

const heroArt = `<svg class="hero__art" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g transform="rotate(-14 32 32)"><path fill="currentColor" d="M14 14h36a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H14L4 32z"/><circle cx="13" cy="32" r="3.2" fill="#0E0E10"/><circle cx="27" cy="23.5" r="4.6" fill="none" stroke="#0E0E10" stroke-width="3.4"/><circle cx="43" cy="40.5" r="4.6" fill="none" stroke="#0E0E10" stroke-width="3.4"/><path d="M42 20 28 44" stroke="#0E0E10" stroke-width="3.6" stroke-linecap="round"/></g></svg>`;

function highlight(text, word) {
  const t = esc(text);
  if (!word) return t;
  const w = esc(word);
  const i = t.indexOf(w);
  return i < 0 ? t : t.slice(0, i) + `<span class="hl">${w}</span>` + t.slice(i + w.length);
}

function renderPage(site, p) {
  const fill = (s) => String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => p[k] ?? "");
  const benefits = p.benefits.slice(0, 3).map((b) =>
    `      <li class="benefit"><span class="benefit__icon">${ICONS[b.icon] || ICONS.check}</span><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></li>`).join("\n");
  const steps = p.steps.slice(0, 3).map((s, i) =>
    `        <li class="step"><span class="step__n" aria-hidden="true">${i + 1}</span><h3><span class="visually-hidden">Passo ${i + 1}: </span>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("\n");

  let preview = "";
  if (p.preview && p.preview.items?.length) {
    const items = p.preview.items.map((it) => {
      const img = isPlaceholder(it.image)
        ? `<!-- ${esc(it.image)} --><span class="offer__img offer__ph" aria-hidden="true">[FOTO]</span>`
        : `<img class="offer__img" src="${esc(it.image)}" alt="${esc(it.alt || it.name)}" width="64" height="64" loading="lazy" decoding="async">`;
      return `          <li class="offer">${img}<div><span class="badge badge--${esc(it.badgeType || "accent")}">${esc(it.badge)}</span><p class="offer__name">${esc(it.name)}</p><p class="offer__old"><s>${esc(it.oldPrice)}</s></p><p class="offer__price">${esc(it.price)}</p></div></li>`;
    }).join("\n");
    preview = `    <figure class="preview" style="margin:0">
      <div class="preview__head">${TAG()}<div><p class="preview__name">${esc(p.preview.senderName)}</p><p class="preview__label">Prévia de como as ofertas chegam</p></div></div>
      <ul class="offers" role="list">
${items}
      </ul>
      <figcaption class="preview__label" style="margin-top:12px">${esc(p.preview.label)}</figcaption>
    </figure>`;
  }

  const trustPoints = p.trust.points.map((t) =>
    `      <li>${ICONS.circleCheck}<span>${esc(t)}</span></li>`).join("\n");
  const faq = p.trust.faq.map((f) =>
    `      <details><summary>${esc(f.q)}</summary><p>${esc(fill(f.a))}</p></details>`).join("\n");

  const a = site.analytics || {};
  const hasAnalytics = !!(a.ga4Id || a.clarityId || a.metaPixelId);
  const consent = hasAnalytics ? `<div class="consent" id="consent" role="region" aria-label="Cookies" hidden>
  <p>Usamos cookies de medição para melhorar esta página. <a href="${esc(site.privacyUrl)}">Saiba mais</a>.</p>
  <div class="consent__actions"><button type="button" data-consent="denied">Recusar</button><button type="button" data-consent="granted">Aceitar</button></div>
</div>` : "";

  // A/B: índice via ?h= e ?c=, aplicado antes da pintura (script síncrono logo após o hero).
  const ab = p.ab || {};
  const abScript = (ab.headlines?.length > 1 || ab.ctas?.length > 1)
    ? `<script>(function(){var q=new URLSearchParams(location.search),H=${JSON.stringify(ab.headlines || [])},C=${JSON.stringify(ab.ctas || [])},hl=${JSON.stringify(p.hero.headlineHighlight || "")};
var h=+q.get("h")||0,c=+q.get("c")||0;if(!H[h])h=0;if(!C[c])c=0;document.documentElement.setAttribute("data-variant","h"+h+"c"+c);
if(h){var el=document.getElementById("titulo"),t=H[h];el.textContent=t;var i=hl?t.indexOf(hl):-1;if(i>=0){el.textContent=t.slice(0,i);var s=document.createElement("span");s.className="hl";s.textContent=hl;el.appendChild(s);el.appendChild(document.createTextNode(t.slice(i+hl.length)))}}
if(c){document.querySelectorAll('[data-ab="cta"]').forEach(function(n){n.textContent=C[c]})}})();</script>`
    : "";

  const base = String(site.baseUrl).replace(/\/$/, "");
  const file = p.slug === "index" ? "" : `${p.slug}.html`;
  const config = { niche: p.niche, slug: p.slug, analytics: a };

  const vars = {
    niche: esc(p.niche), version,
    seoTitle: esc(p.seo.title), seoDescription: esc(p.seo.description),
    canonical: esc(`${base}/${file}`), ogImage: esc(`${base}/${p.seo.ogImage}`),
    brand: esc(site.brand), eventLabel: esc(site.eventLabel),
    configJson: JSON.stringify(config).replace(/</g, "\\u003c"),
    logo: logo(site.brand), logoSmall: logoStatic(site.brand),
    iconCheck: ICONS.check, iconWhatsapp: ICONS.whatsapp, heroArt,
    heroEyebrow: esc(p.hero.eyebrow),
    heroHeadline: highlight(p.hero.headline, p.hero.headlineHighlight),
    heroSub: esc(p.hero.subheadline), heroCta: esc(p.hero.cta), heroMicro: esc(p.hero.microcopy),
    inviteUrl: esc(p.inviteUrl), abScript,
    benefits, steps, preview, trustTitle: esc(p.trust.title), trustPoints, faq,
    finalHeadline: esc(p.final.headline), finalText: esc(p.final.text), finalCta: esc(p.final.cta || p.hero.cta),
    affiliateNotice: esc(site.legal.affiliateNotice), priceNotice: esc(site.legal.priceNotice),
    owner: esc(site.legal.owner), privacyUrl: esc(site.privacyUrl), consent,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error(`Variável sem valor no template: ${k}`);
    return vars[k];
  });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), t = path.join(to, e.name);
    e.isDirectory() ? copyDir(s, t) : fs.copyFileSync(s, t);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(SRC, "assets"), path.join(DIST, "assets"));
fs.copyFileSync(path.join(SRC, "styles.css"), path.join(DIST, "styles.css"));
fs.copyFileSync(path.join(SRC, "main.js"), path.join(DIST, "main.js"));

const warnings = [];
for (const p of content.pages) {
  const html = renderPage(content.site, p);
  fs.writeFileSync(path.join(DIST, `${p.slug}.html`), html);
  const ph = [...new Set((html.replace(/<script[\s\S]*?<\/script>/g, "").match(/\[(?!data-)[^\]<"]{1,200}\]/g) || []))];
  if (ph.length) warnings.push(`${p.slug}.html: ${ph.length} placeholders → ${ph.join(" | ")}`);
  if (/\[CODIGO\]/.test(p.inviteUrl)) warnings.push(`${p.slug}: inviteUrl ainda é placeholder`);
  console.log(`✓ dist/${p.slug}.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}
warnings.forEach((w) => console.warn("⚠ " + w));
