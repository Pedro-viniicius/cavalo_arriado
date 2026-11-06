<?php
/*
 * Link direto do anúncio para o grupo, com contagem anônima, para a hospedagem compartilhada da
 * Hostinger. O mesmo arquivo serve desejodemenina.com, decisoesquedaolucro.com e
 * radardablackfriday.store, como o contar.php: ele fica em Pagina_desejoMenina/site/hostinger/,
 * em achadosTech/public/ e em langeBlack/src/. Mudou um, mude os outros, e confira com diff antes
 * de publicar. Trocou o convite de um site? Troque também em CONVITES, aqui nas três cópias.
 *
 * GET /entrar.php?c=conjunto-a -> soma 1 em grupo.direto e 1 em c."conjunto-a" no arquivo do dia
 *                                 do contar.php e responde 302 para o convite do grupo do site.
 * GET /entrar.php              -> soma 1 só em grupo.direto e redireciona do mesmo jeito.
 * HEAD                         -> só redireciona, sem contar (pré-visualização de link).
 * GET de robô ou pré-carga     -> só redireciona, sem contar: cabeçalho X-Purpose, Purpose ou
 *                                 Sec-Purpose com "preview" ou "prefetch", ou user agent de robô
 *                                 de prévia (Meta, WhatsApp, Telegram...) ou de busca (veja
 *                                 ehRoboOuPreCarga). O navegador interno do Instagram e do
 *                                 Facebook (FBAN, FBAV, Instagram) é gente e conta.
 *
 * O convite é FIXO por site, na constante CONVITES: nenhum valor da URL decide o destino (sem
 * open redirect). O rótulo segue a regra do contar.php (até 80 caracteres, só letras, números
 * de 0 a 9, espaço e _ . | : + -, sem 8 dígitos seguidos, começando com o prefixo do site em
 * PREFIXOS_ROTULO); fora dela, vira "outro". Se a contagem falhar, o redirecionamento acontece
 * mesmo assim.
 *
 * Lê o user agent só para descartar robôs, sem gravar. Não grava cookie, IP, user agent,
 * referer nem nenhum identificador: só o total do dia por chave, em ../contagem/AAAA-MM-DD.json,
 * fora do public_html (o mesmo arquivo do contar.php).
 */

declare(strict_types=1);

ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

// Convite de cada site. Trocou o grupo? Troque aqui (e o CONFIG.whatsappGroupUrl da página).
const CONVITES = [
    'desejodemenina.com' => 'https://chat.whatsapp.com/Bba5ASxHhJA2VWjiuhtkfh',
    'decisoesquedaolucro.com' => 'https://chat.whatsapp.com/DSoAYP6PNEI3p2xo1WDxWc',
    'radardablackfriday.store' => 'https://chat.whatsapp.com/KLwTFYR6pW5Jw7SrWzQIvn',
];
// Os mesmos prefixos e limites do contar.php.
const PREFIXOS_ROTULO = [
    'desejodemenina.com' => 'DESEJO',
    'decisoesquedaolucro.com' => 'ACHADOS',
    'radardablackfriday.store' => 'BLACK',
];
const TETO_POR_DIA = 2000;
const LIMITE_ROTULOS = 200;

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
 * Robô de prévia de link, robô de busca ou pré-carga do navegador: recebe o 302, mas não conta.
 * O user agent e os cabeçalhos são lidos só aqui, em memória, e nunca gravados. FBAN, FBAV e
 * Instagram ficam de fora de propósito: são pessoas no navegador interno dos apps da Meta.
 */
function ehRoboOuPreCarga(): bool
{
    $finalidade = ($_SERVER['HTTP_X_PURPOSE'] ?? '') . ' ' . ($_SERVER['HTTP_PURPOSE'] ?? '')
        . ' ' . ($_SERVER['HTTP_SEC_PURPOSE'] ?? '');
    if (preg_match('/preview|prefetch/i', (string) $finalidade)) {
        return true;
    }
    return (bool) preg_match(
        '/facebookexternalhit|facebookcatalog|meta-externalagent|WhatsApp\/|TelegramBot|Twitterbot|Slackbot|Discordbot|bot|crawler|spider/i',
        (string) ($_SERVER['HTTP_USER_AGENT'] ?? '')
    );
}

/** Igual à somar() do contar.php (cópia, para cada arquivo funcionar sozinho): mudou uma, mude a outra. */
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

/** Igual à gravar() do contar.php. */
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
if (!array_key_exists($host, CONVITES)) {
    http_response_code(404);
    exit;
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? '';
if ($metodo !== 'GET' && $metodo !== 'HEAD') {
    header('Allow: GET, HEAD');
    http_response_code(405);
    exit;
}

if ($metodo === 'GET' && !ehRoboOuPreCarga()) {
    $chaves = ['grupo' => 'direto'];
    if (isset($_GET['c']) && $_GET['c'] !== '') {
        $chaves['c'] = rotuloDoSite($host, $_GET['c']);
    }
    $pasta = dirname(__DIR__) . '/contagem';
    date_default_timezone_set('America/Sao_Paulo');
    // A contagem é o de menos: se a pasta ou o arquivo falharem, a visitante segue para o grupo.
    if (is_dir($pasta) || @mkdir($pasta, 0700, true) || is_dir($pasta)) {
        somar($pasta . '/' . date('Y-m-d') . '.json', $chaves);
    }
}

header('Location: ' . CONVITES[$host], true, 302);
exit;
