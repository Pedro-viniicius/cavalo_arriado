# Achadinhos Black · landing do grupo de WhatsApp

Página estática, pré-renderizada, sem frameworks.

```
content.json        ← TUDO que muda por campanha/nicho (textos, link, IDs, A/B)
build.js            ← node build.js  (Node 18+, sem dependências)
src/template.html   ← template único
src/styles.css      ← tokens e estilos
src/main.js         ← barra fixa, consentimento, analytics, evento de clique
src/assets/         ← fontes Archivo (subset latino, woff2), favicon, OG 1200x630
dist/               ← pronto para publicar (suba o conteúdo desta pasta)
```

## Fluxo
1. Edite `content.json`.
2. `node build.js` (avisa no terminal quais placeholders `[...]` ainda restam).
3. Publique `dist/` em qualquer host estático.

## Novo nicho ou grupo lotou
- **Grupo lotou:** troque `inviteUrl` e rode o build.
- **Novo nicho:** copie o objeto da página em `pages`, mude `slug` (ex.: `pet`), `niche`, textos, `stores`, `seo.ogImage` e `inviteUrl`. O build gera `dist/pet.html`.

## A/B
`?h=1&c=2` troca headline e CTA (índices de `ab.headlines` / `ab.ctas`). Sem parâmetro, vale o índice 0, que está pré-renderizado. A variante vai no evento como `variant` (ex.: `h1c2`).

## Medição
Preencha `ga4Id`, `clarityId` e, se usar, `metaPixelId`. Com qualquer ID, aparece o banner de consentimento. Nada carrega antes do aceite nem antes do `load`.
Evento: `click_whatsapp_cta` com `cta_location` (hero | sticky | final), `niche`, `variant`, via beacon.
O site mede **cliques**, não entradas. Para estimar entradas, use um grupo/link por campanha ou compare o crescimento do grupo.
