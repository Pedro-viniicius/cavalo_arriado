<?php
/*
 * Contador anônimo de cliques, para a hospedagem compartilhada da Hostinger.
 * O mesmo arquivo serve desejodemenina.com, decisoesquedaolucro.com e radardablackfriday.store:
 * ele fica em Pagina_desejoMenina/site/hostinger/contar.php, em achadosTech/public/contar.php e
 * em langeBlack/src/contar.php.
 * Mudou um, mude o outro, e confira com diff antes de publicar.
 *
 * POST /contar.php com {"origem": "hero"}         -> soma 1 no toque do botão do grupo
 * POST /contar.php com {"origem": "hero", "c": "conjunto-a"}
 *      -> soma 1 em grupo.hero e 1 em c."conjunto-a" (rótulo do conjunto de anúncios, que a
 *         página lê do parâmetro c, utm_term ou utm_campaign da URL). Rótulo fora da regra
 *         (até 80 caracteres, só letras, números de 0 a 9, espaço e _ . | : + -, sem 8 dígitos
 *         seguidos, e começando com o prefixo do site em PREFIXOS_ROTULO) vira "outro"; depois de
 *         LIMITE_ROTULOS rótulos diferentes no dia, os novos também.
 * POST /contar.php com {"produto": "liz-flora"}   -> soma 1 no toque de um achadinho
 *      (só na Desejo; o .htaccess de lá também manda /api/clique para cá)
 * GET  /contar.php?resumo com o cabeçalho X-Chave -> totais dos últimos 31 dias, em JSON, com os
 *      grupos "grupo", "c" e "produto" de cada dia
 * O entrar.php (link direto do anúncio para o convite) grava no mesmo arquivo do dia, com a
 * origem "direto" e as mesmas funções rotuloValido(), rotuloDoSite() e somar(), copiadas daqui.
 * Ele não conta robôs de prévia de link nem pré-carga do navegador.
 *
 * Não grava cookie, IP, user agent, referer nem nenhum identificador: só o total do dia por
 * botão. (O log de acesso da própria Hostinger registra o pedido, como qualquer acesso.)
 * Os totais ficam em ../contagem/AAAA-MM-DD.json, FORA do public_html, porque o deploy do
 * site substitui o public_html inteiro.
 * A chave de leitura não fica aqui, só o SHA-256 dela. A chave é aleatória (32 bytes de
 * CSPRNG) e fica no computador do dono, em ~/.config/contador-hostinger/<site>.token.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');

const SITES = [
    'desejodemenina.com' => 'f5966f21b6e95f47f0aebe372c4b4e53da7ca2b668064a18748721e00968709e',
    'decisoesquedaolucro.com' => 'a3dde3bd2507f7c2808fa18b32e5ccc909ad29023ccfca9f2271b679ec955534',
    'radardablackfriday.store' => 'ad50c7a3bbb1d02532763df9ede3193b8c93fd02c0970f1d562b0f8c0b87cc5e',
];
// Prefixo do rótulo do conjunto em cada site (o nome dos anúncios começa com ele, como em
// "DESEJO | F1 | C1 Desejo" ou "DESEJO-F1-C4-Direto"). Rótulo de outro prefixo vira "outro".
const PREFIXOS_ROTULO = [
    'desejodemenina.com' => 'DESEJO',
    'decisoesquedaolucro.com' => 'ACHADOS',
    'radardablackfriday.store' => 'BLACK',
];
// Origens dos botões do grupo nas três páginas. Qualquer outro valor vira "outro".
const ORIGENS = [
    'topo', 'hero', 'meio', 'quiz', 'final', 'sticky',
    'flutuante', 'como-comprar', 'rodape', 'oferta', 'privacidade', 'direto',
];
// Teto por chave e por dia, bem acima do volume real (centenas por dia). Não impede quem forjar
// pedidos fora do navegador, mas deixa a inflação visível: ao bater o teto, o dia ganha
// "_teto": true no resumo, e a contagem daquela chave para.
const TETO_POR_DIA = 2000;
const TAMANHO_MAXIMO = 512;
// Rótulos diferentes por dia no grupo "c": o anúncio usa poucos conjuntos, e o teto impede que
// pedidos forjados com rótulos sempre novos inchem o arquivo do dia.
const LIMITE_ROTULOS = 200;

function responder(int $status, ?array $corpo = null): void
{
    http_response_code($status);
    if ($corpo !== null) {
        header('Content-Type: application/json; charset=utf-8');
        // JSON_FORCE_OBJECT: um rótulo numérico ("0", "1"...) continua chave de objeto, e não lista.
        echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_FORCE_OBJECT);
    }
    exit;
}

/** Lê um arquivo do dia com trava compartilhada. Devolve null se não existir ou estiver inválido. */
function lerDia(string $arquivo): ?array
{
    $ponteiro = @fopen($arquivo, 'r');
    if ($ponteiro === false) {
        return null;
    }
    flock($ponteiro, LOCK_SH);
    $conteudo = stream_get_contents($ponteiro);
    flock($ponteiro, LOCK_UN);
    fclose($ponteiro);
    $dados = $conteudo ? json_decode($conteudo, true) : null;
    return is_array($dados) ? $dados : null;
}

/**
 * Rótulo do conjunto de anúncios, com a mesma regra da página (corpoDoToque no index.html da
 * Desejo; corpoDaContagem no script.js do achadosTech):
 * texto de até 80 caracteres, só letras, números de 0 a 9, espaço e _ . | : + -, sem sequência
 * de 8 dígitos ou mais, mesmo separados por esses sinais (telefone, CPF). Fora disso, "outro".
 */
function rotuloValido($valor): string
{
    if (!is_string($valor)) {
        return 'outro';
    }
    $valor = trim($valor);
    if (!preg_match('/^[\p{L}\p{M}0-9 _.|:+-]{1,80}$/u', $valor)) {
        return 'outro';
    }
    $digitos = (string) preg_replace('/(?<=\d)[\s._|:+-]+(?=\d)/u', '', $valor);
    return preg_match('/\d{8,}/', $digitos) ? 'outro' : $valor;
}

/**
 * Rótulo do conjunto para este site: a regra de rotuloValido() e, além dela, começar com o
 * prefixo do site (PREFIXOS_ROTULO) seguido de fim, espaço, |, _ ou -. Fora disso, "outro".
 */
function rotuloDoSite(string $host, $valor): string
{
    $rotulo = rotuloValido($valor);
    $prefixo = PREFIXOS_ROTULO[$host] ?? '';
    if ($prefixo === '' || !preg_match('/^' . preg_quote($prefixo, '/') . '(?=$|[ |_-])/', $rotulo)) {
        return 'outro';
    }
    return $rotulo;
}

/**
 * Soma 1 em cada par grupo => chave, numa única gravação. Devolve o status HTTP: 204 se gravou
 * (ou se o teto já tinha sido batido). Igual à somar() do entrar.php: mudou uma, mude a outra.
 */
function somar(string $arquivo, array $chaves): int
{
    $ponteiro = @fopen($arquivo, 'c+');
    if ($ponteiro === false) {
        return 500;
    }
    $status = 500;
    if (flock($ponteiro, LOCK_EX)) {
        $conteudo = stream_get_contents($ponteiro);
        $dados = $conteudo === '' || $conteudo === false ? [] : json_decode($conteudo, true);
        // Arquivo corrompido (por exemplo, cota de disco cheia numa gravação anterior): não
        // sobrescreve, para não zerar o dia inteiro em silêncio.
        if (is_array($dados)) {
            $mudou = false;
            foreach ($chaves as $grupo => $chave) {
                $atuais = is_array($dados[$grupo] ?? null) ? $dados[$grupo] : [];
                if ($grupo === 'c' && !array_key_exists($chave, $atuais) && count($atuais) >= LIMITE_ROTULOS) {
                    $chave = 'outro';
                }
                $atual = (int) ($atuais[$chave] ?? 0);
                if ($atual >= TETO_POR_DIA) {
                    if (empty($dados['_teto'])) {
                        $dados['_teto'] = true;
                        $mudou = true;
                    }
                } else {
                    $atuais[$chave] = $atual + 1;
                    $dados[$grupo] = $atuais;
                    $mudou = true;
                }
            }
            $status = $mudou ? gravar($ponteiro, $dados) : 204;
        }
        flock($ponteiro, LOCK_UN);
    }
    fclose($ponteiro);
    return $status;
}

/** Regrava o arquivo inteiro e confere se tudo foi escrito. */
function gravar($ponteiro, array $dados): int
{
    $json = json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_FORCE_OBJECT);
    if ($json === false || !ftruncate($ponteiro, 0) || !rewind($ponteiro)) {
        return 500;
    }
    if (fwrite($ponteiro, $json) !== strlen($json) || !fflush($ponteiro)) {
        return 500;
    }
    return 204;
}

$host = strtolower(preg_replace('/^www\./', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
if (!array_key_exists($host, SITES)) {
    responder(404);
}

$pasta = dirname(__DIR__) . '/contagem';
date_default_timezone_set('America/Sao_Paulo');
$metodo = $_SERVER['REQUEST_METHOD'] ?? '';

// ---------- Leitura dos totais (só com a chave) ----------
if ($metodo === 'GET' && isset($_GET['resumo'])) {
    $chave = (string) ($_SERVER['HTTP_X_CHAVE'] ?? '');
    if ($chave === '' || !hash_equals(SITES[$host], hash('sha256', $chave))) {
        responder(404);
    }
    $dias = [];
    for ($i = 30; $i >= 0; $i--) {
        $dia = date('Y-m-d', strtotime("-$i days"));
        $dados = lerDia("$pasta/$dia.json");
        if ($dados !== null) {
            $dias[$dia] = $dados;
        }
    }
    responder(200, ['site' => $host, 'fusoHorario' => 'America/Sao_Paulo', 'dias' => $dias]);
}

// ---------- Registro de um toque ----------
if ($metodo !== 'POST') {
    header('Allow: POST');
    responder(405);
}

// Só aceita envio da própria página (o navegador sempre manda Origin num POST com fetch).
$origemHttp = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origemHttp !== "https://$host" && $origemHttp !== "https://www.$host") {
    responder(403);
}

$bruto = (string) file_get_contents('php://input', false, null, 0, TAMANHO_MAXIMO + 1);
if ($bruto === '' || strlen($bruto) > TAMANHO_MAXIMO) {
    responder(400);
}
$corpo = json_decode($bruto, true);
if (!is_array($corpo) || count($corpo) < 1 || count($corpo) > 2) {
    responder(400);
}

if (isset($corpo['produto']) && count($corpo) === 1) {
    // Achadinho: só ids que existem no achadinhos.json publicado. (A página só mostra os itens
    // completos; um id de item incompleto também conta aqui, o que não muda nada na prática.)
    $produto = $corpo['produto'];
    if (!is_string($produto) || !preg_match('/^[a-z0-9-]{1,40}$/', $produto)) {
        responder(400);
    }
    $lista = is_file(__DIR__ . '/achadinhos.json')
        ? json_decode((string) file_get_contents(__DIR__ . '/achadinhos.json'), true)
        : null;
    $ids = is_array($lista) ? array_column($lista, 'id') : [];
    if (!in_array($produto, $ids, true)) {
        responder(400);
    }
    $chaves = ['produto' => $produto];
} elseif (isset($corpo['origem']) && (count($corpo) === 1 || array_key_exists('c', $corpo))) {
    // {origem} ou {origem, c}: qualquer outro campo é recusado.
    $origem = $corpo['origem'];
    $chaves = ['grupo' => is_string($origem) && in_array($origem, ORIGENS, true) ? $origem : 'outro'];
    if (array_key_exists('c', $corpo)) {
        $chaves['c'] = rotuloDoSite($host, $corpo['c']);
    }
} else {
    responder(400);
}

if (!is_dir($pasta) && !@mkdir($pasta, 0700, true) && !is_dir($pasta)) {
    responder(500);
}

responder(somar($pasta . '/' . date('Y-m-d') . '.json', $chaves));
