"use strict";
/* Testes da página só hero (/grupo) e da contagem do toque. Sem dependências:

     node build.js && node --test test/grupo.test.js

   Lê o dist/ já gerado. A parte "no navegador" sobe um servidor local que serve o dist/ (com
   endereço sem .html, como o .htaccess), recebe no lugar do contar.php o que a página manda e abre
   o Chrome headless com a resolução de nomes travada em 127.0.0.1: nenhum toque de teste sai da
   máquina. Sem Chrome ou Chromium (ou CHROME_BIN), essa parte é pulada. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const content = JSON.parse(fs.readFileSync(path.join(ROOT, "content.json"), "utf8"));
const CONVITE = content.pages.find((p) => p.slug === "index").inviteUrl;
const ler = (f) => fs.readFileSync(path.join(DIST, f), "utf8");
const meta = (html, re) => (re.exec(html) || [])[1];

/* ---------- O HTML gerado ---------- */

test("grupo.html: um h1 e só três links (botão hero-b, reserva e privacidade)", () => {
  const html = ler("grupo.html");
  assert.match(html, /<html lang="pt-BR"/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.deepEqual(html.match(/<a\s[^>]*>/g), [
    `<a class="cta" href="${CONVITE}" data-cta="hero-b" rel="noopener">`,
    `<a href="${CONVITE}" data-reserva>`,
    `<a href="/privacidade">`,
  ]);
  assert.doesNotMatch(html, /<(button|input|form|select|textarea|iframe|img|picture|video)\b/);
  assert.match(html, /<h1><span class="l">A Black<\/span> <span class="l">no seu<\/span> <span class="l"><span class="hl">WhatsApp\.<\/span><\/span><\/h1>/);
  assert.match(html, /<span data-cta-texto data-abrindo="Abrindo o WhatsApp…">Entrar no grupo grátis<\/span>/);
  for (const selo of ["100% grátis", "Sai quando quiser", "+2.000 ofertas garimpadas"]) assert.ok(html.includes(`${selo}</li>`), selo);
  assert.ok(html.includes(content.site.legal.affiliateNotice), "aviso de afiliado no rodapé");
  assert.match(html, /Não somos o Mercado Livre nem a Amazon: pagamento, entrega e garantia são da própria loja\./);
});

test("grupo.html: fora da busca, canonical dela mesma, og:image da página atual", () => {
  const html = ler("grupo.html"), index = ler("index.html");
  assert.equal(meta(html, /<meta name="robots" content="([^"]*)">/), "noindex,follow");
  assert.equal(meta(html, /<link rel="canonical" href="([^"]*)">/), "https://radardablackfriday.store/grupo");
  const og = /<meta property="og:image" content="([^"]*)">/;
  assert.equal(meta(html, og), meta(index, og));
  assert.notEqual(meta(html, /<title>([^<]*)<\/title>/), meta(index, /<title>([^<]*)<\/title>/));
  assert.notEqual(meta(html, /<meta name="description" content="([^"]*)">/), meta(index, /<meta name="description" content="([^"]*)">/));
});

test("grupo.html: nada vem de fora do site e os SVGs são decorativos", () => {
  const html = ler("grupo.html");
  assert.doesNotMatch(html, /googleapis|gstatic|fbevents|connect\.facebook|googletagmanager|clarity\.ms/);
  // Tudo o que a página carrega é arquivo do próprio dist/.
  const carregados = [...html.matchAll(/<(?:script\s[^>]*src|link rel="(?:stylesheet|preload|icon|apple-touch-icon)"\s[^>]*href)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(carregados.length >= 4);
  for (const u of carregados) {
    assert.doesNotMatch(u, /^([a-z]+:)?\/\//i, u);
    assert.ok(fs.existsSync(path.join(DIST, u.split("?")[0])), `falta dist/${u}`);
  }
  // Fontes: só as duas que a página usa, locais e pré-carregadas.
  assert.deepEqual([...html.matchAll(/<link rel="preload" href="([^"]+)"/g)].map((m) => m[1]),
    ["assets/fonts/archivo-expanded-black.woff2", "assets/fonts/archivo-latin.woff2"]);
  assert.deepEqual([...html.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]),
    ['"assets/fonts/archivo-expanded-black.woff2"', '"assets/fonts/archivo-latin.woff2"']);
  const svgs = html.match(/<svg\b[^>]*>/g);
  assert.ok(svgs.length >= 6);
  for (const s of svgs) assert.match(s, /aria-hidden="true"/);
});

test("index.html: os três botões de sempre, sem o retorno visual da página nova", () => {
  const html = ler("index.html");
  assert.deepEqual([...html.matchAll(/data-cta="([^"]+)"/g)].map((m) => m[1]), ["hero", "final", "sticky"]);
  assert.doesNotMatch(html, /data-cta-texto|data-abrindo/);
  assert.match(html, /<link rel="stylesheet" href="styles\.css\?v=/);
});

/* ---------- No navegador ---------- */

// Roda dentro da página (o servidor de teste injeta antes do </body>): mede a primeira tela, toca
// no alvo do roteiro sem deixar a navegação sair e devolve o relato ao servidor.
function NO_NAVEGADOR() {
  var R = window.__ROTEIRO, cls = 0, relato = {};
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) { if (!e.hadRecentInput) cls += e.value; });
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) { cls = null; }
  function caixa(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { topo: r.top, base: r.bottom, esq: r.left, dir: r.right, larg: r.width, alt: r.height };
  }
  function enviar() { fetch("/__relato", { method: "POST", body: JSON.stringify(relato) }); }
  window.addEventListener("load", function () {
    document.fonts.ready.then(function () {
      var raiz = document.documentElement;
      relato.janela = { larg: window.innerWidth, alt: window.innerHeight, rolagemLarg: raiz.scrollWidth, rolagemAlt: raiz.scrollHeight };
      relato.caixas = { cta: caixa("a[data-cta]"), selos: caixa(".selos"), reserva: caixa("a[data-reserva]"), texto: caixa(".texto"), etiqueta: caixa(".arte svg"), h1: caixa("h1"), selo: caixa(".selo"), logo: caixa(".logo__p") };
      relato.fontes = Array.from(document.fonts).map(function (f) { return f.family.replace(/"/g, "") + ": " + f.status; });
      var rotulo = document.querySelector("a[data-cta] [data-cta-texto]") || document.querySelector("a[data-cta] span");
      // Largura do rótulo em "em": diz qual fonte foi de fato usada (Archivo 700 dá ~14,0 em).
      relato.rotuloEm = rotulo.getBoundingClientRect().width / parseFloat(getComputedStyle(rotulo).fontSize);
      relato.cls = cls;
      var alvo = R.tocar && document.querySelector(R.tocar);
      if (!alvo) return enviar();
      // Este ouvinte vem depois dos da página (que ficam no document): registra se ela segurou a
      // navegação e só então a cancela, para o teste não sair do endereço local.
      window.addEventListener("click", function (e) { relato.paginaSegurou = e.defaultPrevented; e.preventDefault(); });
      var aviso = document.querySelector("[data-aviso-abrindo]");
      relato.rotuloAntes = rotulo.textContent;
      alvo.click();
      relato.rotuloNoToque = rotulo.textContent;
      relato.classeNoToque = alvo.className;
      relato.avisoNoToque = aviso ? aviso.textContent : null;
      setTimeout(function () {
        relato.rotuloDepois = rotulo.textContent;
        relato.classeDepois = alvo.className;
        relato.avisoDepois = aviso ? aviso.textContent : null;
        enviar();
      }, R.espera || 300);
    });
  });
}

function acharChrome() {
  for (const c of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    if (c && spawnSync(c, ["--version"], { stdio: "ignore" }).status === 0) return c;
  }
  return null;
}

function subirServidor() {
  const estado = { roteiro: {}, toques: [], relato: null };
  const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, "http://local");
    if (req.method === "POST") {
      let corpo = "";
      req.on("data", (d) => { corpo += d; });
      req.on("end", () => {
        if (url.pathname === "/contar.php") estado.toques.push({ corpo, cabecalhos: req.headers });
        if (url.pathname === "/__relato") estado.relato = JSON.parse(corpo);
        res.writeHead(204).end();
      });
      return;
    }
    if (url.pathname === "/__moldura") {
      // Janela do tamanho exato de um celular: a página abre num iframe de larg × alt (o Chrome
      // headless não aceita janela mais estreita que 500 px fora do modo de captura).
      const [larg, alt] = [Number(url.searchParams.get("larg")), Number(url.searchParams.get("alt"))];
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(`<!doctype html><title>moldura</title><style>body{margin:0}iframe{display:block;border:0;width:${larg}px;height:${alt}px}</style><iframe src="${url.searchParams.get("src").replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe>`);
      return;
    }
    let arquivo = url.pathname === "/" ? "/index.html" : url.pathname;
    if (!path.extname(arquivo)) arquivo += ".html"; // /grupo -> grupo.html, como o .htaccess
    const caminho = path.join(DIST, path.normalize(arquivo));
    if (!caminho.startsWith(DIST + path.sep) || !fs.existsSync(caminho)) { res.writeHead(404).end(); return; }
    let dados = fs.readFileSync(caminho);
    if (arquivo.endsWith(".html")) {
      dados = String(dados).replace("</body>", () => `<script>window.__ROTEIRO=${JSON.stringify(estado.roteiro)};(${NO_NAVEGADOR})();</script></body>`);
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream", "Cache-Control": "no-store" }).end(dados);
  });
  return new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok({ estado, servidor, base: `http://127.0.0.1:${servidor.address().port}` })));
}

function rodarChrome(chrome, perfil, url) {
  return new Promise((ok, falha) => {
    const p = spawn(chrome, [
      "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-extensions",
      "--disable-background-networking", "--disable-component-update", "--disable-sync",
      // Só 127.0.0.1 resolve: nem o convite nem o site em produção são alcançados pelo teste.
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      `--user-data-dir=${perfil}`, "--window-size=1600,1200", "--hide-scrollbars",
      "--virtual-time-budget=8000", "--dump-dom", url,
    ], { stdio: "ignore" });
    const limite = setTimeout(() => p.kill("SIGKILL"), 45000);
    p.on("error", falha);
    p.on("exit", () => { clearTimeout(limite); ok(); });
  });
}

const chrome = acharChrome();
const UTM = "?utm_term=BLACK%20%7C%20F1%20%7C%20B%20so%20hero&utm_content=BLACK%20%7C%20C2%202000%20ofertas";

test("no navegador", { skip: chrome ? false : "sem Chrome ou Chromium (defina CHROME_BIN)", timeout: 600000 }, async (t) => {
  const { estado, servidor, base } = await subirServidor();
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "langeblack-teste-"));
  t.after(() => { servidor.close(); fs.rmSync(perfil, { recursive: true, force: true }); });

  async function abrir(caminho, roteiro, [larg, alt] = [390, 844]) {
    Object.assign(estado, { roteiro, toques: [], relato: null });
    await rodarChrome(chrome, perfil, `${base}/__moldura?larg=${larg}&alt=${alt}&src=${encodeURIComponent(caminho)}`);
    assert.ok(estado.relato, `a página ${caminho} não devolveu o relato`);
    return { relato: estado.relato, toques: estado.toques, corpos: estado.toques.map((x) => x.corpo) };
  }

  await t.test("(a) /grupo com utm_term e utm_content: o botão manda origem, c e a", async () => {
    const { corpos, toques } = await abrir("/grupo" + UTM, { tocar: 'a[data-cta="hero-b"]' });
    assert.deepEqual(corpos, ['{"origem":"hero-b","c":"BLACK | F1 | B so hero","a":"BLACK | C2 2000 ofertas"}']);
    // Anônimo: sem cookie e sem referer.
    assert.equal(toques[0].cabecalhos.cookie, undefined);
    assert.equal(toques[0].cabecalhos.referer, undefined);
    assert.equal(toques[0].cabecalhos["content-type"], "application/json");
  });

  await t.test("(b) /grupo sem parâmetros: só a origem", async () => {
    const { corpos } = await abrir("/grupo", { tocar: 'a[data-cta="hero-b"]' });
    assert.deepEqual(corpos, ['{"origem":"hero-b"}']);
  });

  await t.test("(c) página atual: o botão do hero continua mandando origem hero (agora com o a)", async () => {
    const semUtm = await abrir("/", { tocar: "#cta-hero" });
    assert.deepEqual(semUtm.corpos, ['{"origem":"hero"}']);
    const comUtm = await abrir("/" + UTM, { tocar: "#cta-hero" });
    assert.deepEqual(comUtm.corpos, ['{"origem":"hero","c":"BLACK | F1 | B so hero","a":"BLACK | C2 2000 ofertas"}']);
    // O retorno visual é só da página nova: aqui o rótulo não muda.
    assert.equal(comUtm.relato.rotuloNoToque, comUtm.relato.rotuloAntes);
    assert.equal(comUtm.relato.paginaSegurou, false);
  });

  await t.test("(d) o link reserva não conta", async () => {
    const { corpos, relato } = await abrir("/grupo" + UTM, { tocar: "a[data-reserva]" });
    assert.deepEqual(corpos, []);
    assert.equal(relato.rotuloNoToque, "Entrar no grupo grátis");
    assert.equal(relato.paginaSegurou, false);
  });

  await t.test("utm_content fora da regra (telefone, sinais) não vai no a; o c segue valendo", async () => {
    const telefone = await abrir("/grupo?utm_term=BLACK-F1&utm_content=BLACK%2031%2099999-0000", { tocar: "a[data-cta]" });
    assert.deepEqual(telefone.corpos, ['{"origem":"hero-b","c":"BLACK-F1"}']);
    const sinais = await abrir("/grupo?utm_content=%3Cscript%3E&c=BLACK-F2", { tocar: "a[data-cta]" });
    assert.deepEqual(sinais.corpos, ['{"origem":"hero-b","c":"BLACK-F2"}']);
    const soAnuncio = await abrir("/grupo?utm_content=BLACK%20%7C%20C1", { tocar: "a[data-cta]" });
    assert.deepEqual(soAnuncio.corpos, ['{"origem":"hero-b","a":"BLACK | C1"}']);
  });

  await t.test("retorno do toque: o rótulo vira Abrindo o WhatsApp…, não segura a navegação e volta em 4 s", async () => {
    const logo = (await abrir("/grupo", { tocar: "a[data-cta]" })).relato;
    assert.equal(logo.rotuloAntes, "Entrar no grupo grátis");
    assert.equal(logo.rotuloNoToque, "Abrindo o WhatsApp…");
    assert.equal(logo.avisoNoToque, "Abrindo o WhatsApp…");
    assert.match(logo.classeNoToque, /\babrindo\b/);
    assert.equal(logo.paginaSegurou, false);
    assert.equal(logo.rotuloDepois, "Abrindo o WhatsApp…"); // 0,3 s depois ainda está
    const depois = await abrir("/grupo", { tocar: "a[data-cta]", espera: 4300 });
    assert.equal(depois.relato.rotuloDepois, "Entrar no grupo grátis");
    assert.doesNotMatch(depois.relato.classeDepois, /\babrindo\b/);
    assert.equal(depois.relato.avisoDepois, "");
    assert.deepEqual(depois.corpos, ['{"origem":"hero-b"}']); // um toque, uma contagem
  });

  for (const tamanho of [[320, 568], [360, 640], [390, 844]]) {
    await t.test(`primeira tela em ${tamanho.join("×")}: botão, três selos e reserva sem rolar; sem rolagem lateral`, async () => {
      const { relato: r } = await abrir("/grupo", {}, tamanho);
      assert.deepEqual([r.janela.larg, r.janela.alt], tamanho);
      assert.ok(r.janela.rolagemLarg <= tamanho[0], `rolagem lateral: ${r.janela.rolagemLarg}`);
      assert.ok(r.caixas.cta.topo >= 0 && r.caixas.cta.base <= tamanho[1], "botão inteiro na primeira tela");
      assert.ok(r.caixas.selos.base <= tamanho[1], "os três selos na primeira tela");
      assert.ok(r.caixas.reserva.base <= tamanho[1], "reserva na primeira tela");
      assert.ok(r.caixas.cta.alt >= 48 && r.caixas.cta.larg >= tamanho[0] - 48, `área de toque: ${r.caixas.cta.larg}×${r.caixas.cta.alt}`);
      assert.ok(r.caixas.reserva.alt >= 44, "área de toque da reserva");
      // O título cabe na largura útil e a etiqueta grande não passa por trás dele nem do selo.
      assert.ok(r.caixas.h1.dir <= tamanho[0] && r.caixas.texto.dir <= tamanho[0]);
      // (O desenho da etiqueta começa a 10% da largura da caixa do SVG: a ponta esquerda.)
      const pontaDaEtiqueta = r.caixas.etiqueta.esq + 0.1 * r.caixas.etiqueta.larg;
      assert.ok(r.caixas.etiqueta.base <= r.caixas.h1.topo, "etiqueta acima do título");
      assert.ok(pontaDaEtiqueta >= r.caixas.selo.dir, "etiqueta à direita do selo");
      assert.ok(pontaDaEtiqueta >= r.caixas.logo.dir || r.caixas.etiqueta.topo >= r.caixas.logo.base, "etiqueta à direita do logo");
      assert.deepEqual(r.fontes.sort(), ["Archivo Expanded: loaded", "Archivo: loaded"]);
      assert.ok(Math.abs(r.rotuloEm - 14.03) < 0.15, `o rótulo do botão não está em Archivo 700: ${r.rotuloEm} em`);
      assert.equal(r.cls, 0);
    });
  }

  await t.test("desktop 1440×900: duas colunas, tudo numa tela", async () => {
    const { relato: r } = await abrir("/grupo", {}, [1440, 900]);
    assert.ok(r.janela.rolagemLarg <= 1440);
    assert.ok(r.janela.rolagemAlt <= 900, `altura da página: ${r.janela.rolagemAlt}`);
    assert.ok(r.caixas.etiqueta.esq >= r.caixas.texto.dir, "etiqueta na coluna da direita");
    assert.ok(r.caixas.h1.dir <= r.caixas.texto.dir + 1, "título dentro da coluna");
    assert.ok(r.caixas.cta.alt >= 80 && r.caixas.cta.larg <= 500);
    assert.equal(r.cls, 0);
  });
});
