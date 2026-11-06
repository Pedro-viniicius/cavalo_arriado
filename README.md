# Achadinhos Black · landing do grupo de WhatsApp

Página estática, pré-renderizada, sem frameworks, publicada em https://radardablackfriday.store (Hostinger, com PHP).

```
content.json         ← TUDO que muda por campanha/nicho (textos, link, IDs, A/B)
build.js             ← node build.js  (Node 18+, sem dependências)
src/template.html    ← template único
src/styles.css       ← tokens e estilos
src/main.js          ← barra fixa, consentimento, analytics, evento, contagem e deep link
src/privacidade.html ← política de privacidade (/privacidade)
src/contar.php       ← contador anônimo de toques (idêntico ao da Desejo de Menina e da Decisões)
src/entrar.php       ← link direto do anúncio para o grupo, com contagem (idem)
src/.htaccess        ← HTTPS, URLs sem .html, cabeçalhos de segurança e cache
src/assets/          ← fontes Archivo (subset latino, woff2), favicon, OG 1200x630
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

## A/B
`?h=1&cta=2` troca headline e CTA (índices de `ab.headlines` / `ab.ctas`). Sem parâmetro, vale o índice 0, que está pré-renderizado. A variante vai no evento como `variant` (ex.: `h1c2`). O `?c=` é do rótulo do conjunto de anúncios (contagem), não do A/B.

## Medição
- **Contagem anônima (sempre ligada):** cada toque nos botões do grupo (`hero`, `sticky`, `final`) soma 1 no total do dia, no `contar.php`, com o rótulo do conjunto quando a URL traz `c`, `utm_term` ou `utm_campaign` começando por `BLACK` (ex.: `utm_term=BLACK | F1 | C1`). Sem cookie, IP ou identificador. Para anúncio que leva direto ao grupo, use `https://radardablackfriday.store/entrar.php?c=BLACK-...` (conta em `direto`).
- **Ler o resumo:** a chave fica só em `~/.config/contador-hostinger/radardablackfriday.token` (nunca no Git):
  ```bash
  CAB=$(mktemp) && chmod 600 "$CAB"
  printf 'X-Chave: %s\n' "$(tr -d '\n' < ~/.config/contador-hostinger/radardablackfriday.token)" > "$CAB"
  curl -s -H @"$CAB" "https://radardablackfriday.store/contar.php?resumo"; rm -f "$CAB"
  ```
- **Entradas no grupo:** o site mede toques, não entradas. As entradas pelo link aparecem no Achadinho Turbo (grupo "💎 Garimpo da Black").
- **Pixel, GA4 e Clarity (só com consentimento):** preencha `ga4Id`, `clarityId` e/ou `metaPixelId`. Com qualquer ID, aparece o banner. Nada carrega antes do aceite. O toque vai como `Contact` (`content_name` = hero, sticky ou final), com `autoConfig` desligado. **Antes de preencher um ID:** atualize a política (nomeie a ferramenta), ofereça um jeito de mudar a escolha de cookies e passe pela revisão de segurança.
- **Abrir o convite direto no app:** no navegador do Instagram e do Facebook, o primeiro toque num botão do grupo vai antes para `whatsapp://chat/?code=` e, se o app não abrir em 2,5 s, segue para o `https` (mesmo desenho do ADR 0012 da Desejo de Menina). Chave: `ABRIR_NO_APP` no `src/main.js` (com `false`, só `?app=1` liga, para teste). Desligar se entradas ÷ toques ficar abaixo de 43% em 2 dias seguidos com pelo menos 5 toques no dia, ou ao primeiro relato de "não abriu".
- **Reserva "Não abriu o WhatsApp? Toque aqui"** (`data-reserva`): mesmo convite, não conta e não força o app.

## Publicações
- **06/11/2026:** contagem anônima, deep link, reserva, política de privacidade, campos sem preencher do FAQ e do rodapé corrigidos, HTTPS forçado e cabeçalhos de segurança no `.htaccess`.
