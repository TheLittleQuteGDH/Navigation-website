<?php
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);
set_time_limit(0);

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['links']) || !is_array($input['links'])) {
    http_response_code(400);
    echo json_encode(['error' => '缺少 links 参数']);
    exit;
}

$links = $input['links'];
$mode = $input['mode'] ?? 'fast';
$results = [];
$multiHandle = curl_multi_init();
$curlHandles = [];

$userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
];

$trustDomains = [
    'douyin.com', 'www.douyin.com',
    'bilibili.com', 'www.bilibili.com',
    'baidu.com', 'www.baidu.com',
    'zhihu.com', 'www.zhihu.com',
    'weibo.com', 'www.weibo.com',
    'taobao.com', 'www.taobao.com',
    'jd.com', 'www.jd.com',
    'qq.com', 'www.qq.com',
    '163.com', 'www.163.com',
    'sohu.com', 'www.sohu.com',
    'github.com', 'www.github.com',
    'stackoverflow.com', 'www.stackoverflow.com'
];

foreach ($links as $item) {
    $url = trim($item['url'] ?? '');
    $id = $item['id'] ?? uniqid();
    
    if (filter_var($url, FILTER_VALIDATE_URL) === false) {
        $results[] = ['id' => $id, 'url' => $url, 'status' => 'invalid', 'code' => 0, 'reason' => 'URL格式无效'];
        continue;
    }
    
    $host = parse_url($url, PHP_URL_HOST);
    if ($host && !gethostbynamel($host)) {
        $results[] = ['id' => $id, 'url' => $url, 'status' => 'dead', 'code' => 0, 'reason' => '域名解析失败'];
        continue;
    }
    
    $ch = curl_init($url);
    $timeout = $mode === 'deep' ? 10 : 5;
    $connectTimeout = $mode === 'deep' ? 6 : 3;
    
    curl_setopt_array($ch, [
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => $connectTimeout,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 8,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_USERAGENT => $userAgents[array_rand($userAgents)],
        CURLOPT_NOBODY => true,
        CURLOPT_HEADER => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => 'gzip, deflate, br',
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_2_0,
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding: gzip, deflate, br',
            'Cache-Control: max-age=0',
            'Connection: keep-alive',
            'Sec-Ch-Ua: "Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            'Sec-Ch-Ua-Mobile: ?0',
            'Sec-Ch-Ua-Platform: "Windows"',
            'Sec-Fetch-Dest: document',
            'Sec-Fetch-Mode: navigate',
            'Sec-Fetch-Site: none',
            'Sec-Fetch-User: ?1',
            'Upgrade-Insecure-Requests: 1',
            'DNT: 1'
        ]
    ]);
    
    curl_multi_add_handle($multiHandle, $ch);
    $curlHandles[] = ['ch' => $ch, 'id' => $id, 'url' => $url, 'host' => $host];
}

$running = null;
do {
    curl_multi_exec($multiHandle, $running);
    curl_multi_select($multiHandle);
} while ($running > 0);

$needRetry = [];
foreach ($curlHandles as $handleInfo) {
    $ch = $handleInfo['ch'];
    $id = $handleInfo['id'];
    $url = $handleInfo['url'];
    $host = $handleInfo['host'];
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $errno = curl_errno($ch);
    
    curl_multi_remove_handle($multiHandle, $ch);
    curl_close($ch);
    
    $status = classifyHttpStatus($code, $error, $errno, $host, $GLOBALS['trustDomains']);
    
    if ($status['level'] === 'ok') {
        $results[] = ['id' => $id, 'url' => $url, 'status' => 'ok', 'code' => $code, 'reason' => $status['reason']];
    } elseif ($status['level'] === 'warning') {
        $needRetry[] = $handleInfo;
    } else {
        $results[] = ['id' => $id, 'url' => $url, 'status' => 'dead', 'code' => $code, 'reason' => $status['reason']];
    }
}

if (!empty($needRetry)) {
    $multiHandle2 = curl_multi_init();
    $retryHandles = [];
    
    foreach ($needRetry as $item) {
        $ch = curl_init($item['url']);
        curl_setopt_array($ch, [
            CURLOPT_TIMEOUT => 12,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 8,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_USERAGENT => $userAgents[array_rand($userAgents)],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => 'gzip, deflate, br',
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_2_0,
            CURLOPT_RANGE => '0-4096',
            CURLOPT_HTTPHEADER => [
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding: gzip, deflate, br',
                'Cache-Control: no-cache',
                'Connection: keep-alive',
                'Referer: https://www.baidu.com/',
                'Sec-Ch-Ua: "Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
                'Sec-Ch-Ua-Mobile: ?0',
                'Sec-Ch-Ua-Platform: "Windows"',
                'Sec-Fetch-Dest: document',
                'Sec-Fetch-Mode: navigate',
                'Sec-Fetch-Site: cross-site',
                'Upgrade-Insecure-Requests: 1'
            ],
            CURLOPT_COOKIE => 'bdshare_firstime=1; t=abcdef1234567890;'
        ]);
        
        curl_multi_add_handle($multiHandle2, $ch);
        $retryHandles[] = ['ch' => $ch, 'id' => $item['id'], 'url' => $item['url'], 'host' => $item['host']];
    }
    
    $running2 = null;
    do {
        curl_multi_exec($multiHandle2, $running2);
        curl_multi_select($multiHandle2);
    } while ($running2 > 0);
    
    foreach ($retryHandles as $handleInfo) {
        $ch = $handleInfo['ch'];
        $id = $handleInfo['id'];
        $url = $handleInfo['url'];
        $host = $handleInfo['host'];
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        $errno = curl_errno($ch);
        $body = curl_multi_getcontent($ch);
        $bodyLen = strlen($body);
        
        curl_multi_remove_handle($multiHandle2, $ch);
        curl_close($ch);
        
        if ($code == 404 && $bodyLen > 1000) {
            $results[] = ['id' => $id, 'url' => $url, 'status' => 'warning', 'code' => $code, 'reason' => '反爬拦截(页面存活)'];
            continue;
        }
        
        if (in_array(strtolower($host), $GLOBALS['trustDomains']) && $code > 0) {
            if ($code >= 200 && $code < 500) {
                $results[] = ['id' => $id, 'url' => $url, 'status' => 'ok', 'code' => $code, 'reason' => '可信站点正常'];
                continue;
            }
        }
        
        $status = classifyHttpStatus($code, $error, $errno, $host, $GLOBALS['trustDomains']);
        $results[] = [
            'id' => $id, 
            'url' => $url, 
            'status' => $status['level'] === 'dead' ? 'dead' : ($status['level'] === 'ok' ? 'ok' : 'warning'), 
            'code' => $code, 
            'reason' => $status['reason']
        ];
    }
    
    curl_multi_close($multiHandle2);
}

curl_multi_close($multiHandle);
echo json_encode(['results' => $results], JSON_UNESCAPED_UNICODE);

function classifyHttpStatus($code, $error, $errno, $host = '', $trustDomains = []) {
    if ($error) {
        if (in_array($errno, [CURLE_OPERATION_TIMEDOUT, CURLE_CONNECTTIMEOUT])) {
            return ['level' => 'warning', 'reason' => '连接超时'];
        }
        if (in_array($errno, [CURLE_SSL_CONNECT_ERROR, CURLE_SSL_CERTPROBLEM])) {
            return ['level' => 'warning', 'reason' => 'SSL连接异常'];
        }
        if (in_array($errno, [CURLE_COULDNT_CONNECT, CURLE_COULDNT_RESOLVE_HOST])) {
            return ['level' => 'dead', 'reason' => '服务器不可达'];
        }
        return ['level' => 'warning', 'reason' => '连接异常'];
    }
    
    if ($code >= 200 && $code < 300) {
        return ['level' => 'ok', 'reason' => '正常访问'];
    }
    
    if ($code >= 300 && $code < 400) {
        return ['level' => 'ok', 'reason' => '重定向正常'];
    }
    
    if ($code >= 400 && $code < 500) {
        if (in_array(strtolower($host), $trustDomains)) {
            return ['level' => 'warning', 'reason' => '可信站点拦截(' . $code . ')'];
        }
        
        if (in_array($code, [404, 410])) {
            return ['level' => 'dead', 'reason' => '页面不存在'];
        }
        if (in_array($code, [401, 403, 405, 429])) {
            return ['level' => 'warning', 'reason' => '访问受限(' . $code . ')'];
        }
        return ['level' => 'warning', 'reason' => '客户端错误(' . $code . ')'];
    }
    
    if ($code >= 500 && $code < 600) {
        if (in_array($code, [502, 503, 504])) {
            return ['level' => 'warning', 'reason' => '服务端临时故障(' . $code . ')'];
        }
        return ['level' => 'dead', 'reason' => '服务端错误(' . $code . ')'];
    }
    
    return ['level' => 'warning', 'reason' => '未知状态'];
}