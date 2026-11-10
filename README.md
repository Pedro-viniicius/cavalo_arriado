# Achadinhos Black · landing do grupo de WhatsApp

Página estática, pré-renderizada, sem frameworks, publicada em https://radardablackfriday.store (Hostinger, com PHP).

```
content.json         ← TUDO que muda por campanha/nicho (textos, link, IDs, A/B)
build.js             ← node build.js  (Node 18+, sem dependências)
src/template.html    ← template da página longa (/)
src/styles.css       ← tokens e estilos da página longa
src/template-hero.html ← template da página só hero (/grupo), para página com "layout": "hero"
src/hero.css         ← estilos da página só hero (o build embute no HTML dela)
src/main.js          ← barra fixa, consentimento, analytics, evento, contagem, deep link e retorno do toque (as duas páginas)
src/privacidade.html ← política de privacidade (/privacidade)
src/contar.php       ← contador anônimo de toques (idêntico ao da Desejo de Menina e da Decisões)
src/entrar.php       ← link direto do anúncio para o grupo, com contagem (idem)
src/.htaccess        ← HTTPS, URLs sem .html, cabeçalhos de segurança e cache
src/assets/          ← fontes Archivo (subset latino, woff2), favicon, OG 1200x630
test/grupo.test.js   ← testes da página só hero e da contagem (node:test, sem dependências)
dist/                ← pronto para publicar (precisa de PHP por causa do contar.php e do entrar.php)
```

## Fluxo
1. Edite `content.json`.
2. `node build.js` (avisa no terminal quais placeholders `[...]` ainda restam).
3. Publique os arquivos alterados de `dist/` na Hostinger, um a um (TUS com `override`), sem apagar o resto.
4. Confira: `/contar.php` dá 405, `/contagem/` dá 404, `HEAD /entrar.php` dá 302 para o convite e um toque real aparece no resumo (abaixo).

## Novo nicho ou grupo lotou
- **Grupo lotou:** troque `inviteUrl` no `content.json` **e** o convite de `radardablackfriday.store` em `CONVITES` no `entrar.php`, nas três cópias (aqui em `src/`, em `Lange_meninas/site/hostinger/` e em `lange_tech/public/`, mais o teste `site/test/contar-hostinger.test.js` do Lange_meninas). Rode o build e publique.
- **Novo nicho:** copie o objeto da página em `pages`, mude `slug` (ex.: `pet`), `niche`, textos, `stores`, `seo.ogImage` e `inviteUrl`. O build gera `dist/pet.html`.

## Página só hero (`/grupo`)
Variante de anúncio com um hero e um único botão (identidade "Operação Black", pranchas de 10/11/2026 em `~/Documentos/relatorios-campanhas/2026-11-10/operacao-black/identidade/`). Publicada em 10/11/2026; recebe os anúncios do conjunto `BLACK | F1 | B so hero`.
- **De onde sai:** a página `grupo` do `content.json` (`"layout": "hero"`) + `src/template-hero.html` + `src/hero.css` → `dist/grupo.html`, servida em `https://radardablackfriday.store/grupo` (o `.htaccess` já serve `/pagina` a partir de `pagina.html`; o nome `entrar` é do `entrar.php`). O CSS vai embutido no HTML; a página pede só o `main.js`, as duas fontes e o favicon (cerca de 44 KB transferidos).
- **Convite:** `"inviteFrom": "index"` faz a página usar o `inviteUrl` da página `index`. Grupo lotou: troque num lugar só (mais o `entrar.php`, como acima).
- **Textos:** `hero.headlineLines` (uma linha do título por item; `headlineHighlight` fica em amarelo), `subheadline`, `cta`, `ctaOpening` (rótulo do botão logo depois do toque), `badges` (até 3) e `legal.storesNotice`. O selo do topo é o `site.eventLabel` e o aviso de afiliado é o `site.legal.affiliateNotice`. Escreva em caixa normal: a caixa alta é do CSS.
- **Clicável:** só o botão (`data-cta="hero-b"`), a reserva (`data-reserva`, não conta e não força o app) e a política de privacidade. O logo não é link.
- **Fora da busca:** `seo.robots` = `noindex,follow`, com `canonical` para ela mesma.
- **Retorno do toque:** o rótulo vira "Abrindo o WhatsApp…" e volta em 4 s (`main.js`; só no botão que traz `data-cta-texto` e `data-abrindo`, ou seja, não muda a página longa). Não segura a navegação nem trava toques.
- **Fontes:** a de título troca quando chega (`swap`; o título e o logo têm altura fixa); a de texto é `optional`: se não chegar para a primeira pintura, a página fica com a fonte do sistema e nada se desloca.
- **Sem banner de cookies:** o site não tem pixel. Antes de preencher um ID em `site.analytics`, esta página precisa ganhar o banner de consentimento (hoje só a página longa tem).
- **Testes:** `node build.js && node --test test/grupo.test.js`. A parte de navegador usa o Chrome headless contra um servidor local, que recebe o que iria para o `contar.php`; nada vai para a produção. Sem Chrome, Chromium ou `CHROME_BIN`, essa parte é pulada.

## A/B
A comparação entre a página longa (`/`) e a só hero (`/grupo`) é feita por anúncio: cada um aponta para um endereço e leva o seu rótulo (`utm_term` para o conjunto, `utm_content` para o anúncio). A página não sorteia nada.

`?h=1&cta=2` troca headline e CTA (índices de `ab.headlines` / `ab.ctas`). Sem parâmetro, vale o índice 0, que está pré-renderizado. A variante vai no evento como `variant` (ex.: `h1c2`). O `?c=` é do rótulo do conjunto de anúncios (contagem), não do A/B.

## Medição
- **Contagem anônima (sempre ligada):** cada toque nos botões do grupo (`hero`, `sticky`, `final`; `hero-b` na página `/grupo`) soma 1 no total do dia, no `contar.php`, com o rótulo do conjunto (`c`) quando a URL traz `c`, `utm_term` ou `utm_campaign` começando por `BLACK` (ex.: `utm_term=BLACK | F1 | C1`) e com o nome do anúncio (`a`) quando traz `utm_content` começando por `BLACK` (ex.: `utm_content=BLACK | C2 2000 ofertas`). Sem cookie, IP ou identificador. Para anúncio que leva direto ao grupo, use `https://radardablackfriday.store/entrar.php?c=BLACK-...` (conta em `direto`).
- **Desde 10/11/2026:** o `contar.php` também guarda o nome do anúncio (`a`, do `utm_content`, mesma regra do `c`), o total de cada hora por botão (`h["HH|origem"]`) e, à parte, o plano B das páginas novas dos outros sites (`reserva`). O `main.js` manda `{origem}`, `{origem, c}` ou `{origem, c, a}`, nas duas páginas. Mudou o `main.js`? Publique junto o HTML das páginas, por causa do `?v=` (o JS tem cache de 1 ano). Detalhes no ADR 0010 da Desejo de Menina.
- **Ler o resumo:** a chave fica só em `~/.config/contador-hostinger/radardablackfriday.token` (nunca no Git):
  ```bash
  CAB=$(mktemp) && chmod 600 "$CAB"
  printf 'X-Chave: %s\n' "$(tr -d '\n' < ~/.config/contador-hostinger/radardablackfriday.token)" > "$CAB"
  curl -s -H @"$CAB" "https://radardablackfriday.store/contar.php?resumo"; rm -f "$CAB"
  ```
- **Entradas no grupo:** o site mede toques, não entradas. As entradas pelo link aparecem no Achadinho Turbo (grupo "Achadinhos Black 💎"; até 10/11/2026 se chamava "💎 Garimpo da Black").
- **Pixel, GA4 e Clarity (só com consentimento):** preencha `ga4Id`, `clarityId` e/ou `metaPixelId`. Com qualquer ID, aparece o banner. Nada carrega antes do aceite. O toque vai como `Contact` (`content_name` = hero, sticky ou final), com `autoConfig` desligado. A página `/grupo` não tem o banner (veja acima). **Antes de preencher um ID:** atualize a política (nomeie a ferramenta), ofereça um jeito de mudar a escolha de cookies e passe pela revisão de segurança.
- **Abrir o convite direto no app:** no navegador do Instagram e do Facebook, o primeiro toque num botão do grupo vai antes para `whatsapp://chat/?code=` e, se o app não abrir em 2,5 s, segue para o `https` (mesmo desenho do ADR 0012 da Desejo de Menina). Chave: `ABRIR_NO_APP` no `src/main.js` (com `false`, só `?app=1` liga, para teste). Desligar se entradas ÷ toques ficar abaixo de 43% em 2 dias seguidos com pelo menos 5 toques no dia, ou ao primeiro relato de "não abriu".
- **Reserva "Não abriu o WhatsApp? Toque aqui"** (`data-reserva`): mesmo convite, não conta e não força o app.

## Publicações
- **10/11/2026, 17h37:** página só hero `grupo.html` (`/grupo`), `main.js` (envio do `a` e retorno do toque) e `index.html` (só o `?v=` novo), por TUS. Conferido no ar por hash; um toque de teste em cada página gravou `c` e `a` (`BLACK-teste-A`, `BLACK-teste-B`).
- **10/11/2026:** `contar.php` (com `hero-b`, as origens das páginas novas dos outros sites, `a`, `h` e `reserva`), `entrar.php` e `privacidade.html` de `dist/`, por TUS. O `contar.php` que estava no ar era anterior ao `hero-b`. A landing (`index.html`) não mudou.
- **06/11/2026:** contagem anônima, deep link, reserva, política de privacidade, campos sem preencher do FAQ e do rodapé corrigidos, HTTPS forçado e cabeçalhos de segurança no `.htaccess`.
