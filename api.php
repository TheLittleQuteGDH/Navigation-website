<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
error_reporting(E_ALL);
ini_set('display_errors', 0);

define('DATA_FILE', __DIR__ . '/data.json');
define('FEEDBACK_FILE', __DIR__ . '/feedbacks.json');
define('TOKEN_SECRET', 'nav_secure_2026');

function loadData() {
    if (!file_exists(DATA_FILE)) {
        $default = [
            'user' => ['username' => 'admin', 'password' => password_hash('admin123', PASSWORD_BCRYPT), 'avatar' => ''],
            'settings' => [
                'title' => '导航站',
                'description' => '导航站点',
                'primaryColor' => '#3b82f6',
                'backgroundColor' => '#f0f4f8',
                'cardColor' => '#ffffff',
                'textColor' => '#1e293b',
                'icon' => '',
                'backgroundImage' => '',
                'backgroundOpacity' => 0.3,
                'showIP' => false,
                'offline' => false,
                'offlineTitle' => '网站暂时下线',
                'offlineMessage' => '请稍后再来~',
                'noticeEnabled' => false,
                'popupEnabled' => false,
                'showWeather' => false,
                'showClock' => true,
                'showQuote' => true,
                'footerText' => '',
                'cardRadius' => true,
                'cardShadow' => true,
                'globalFont' => '',
                'titleFontSize' => 2,
                'cardNameFontSize' => 0.88,
                'enableGeetest' => false,
                'geetestId' => '',
                'geetestKey' => ''
            ],
            'groups' => [],
            'logs' => [],
            'notice' => ['title' => '', 'icon' => '', 'content' => ''],
            'popups' => []
        ];
        file_put_contents(DATA_FILE, json_encode($default, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        return $default;
    }
    $content = file_get_contents(DATA_FILE);
    if ($content === false) {
        http_response_code(500);
        die(json_encode(['success' => false, 'message' => '无法读取数据文件']));
    }
    $data = json_decode($content, true);
    if ($data === null) {
        http_response_code(500);
        die(json_encode(['success' => false, 'message' => '数据文件格式错误']));
    }

    if (!isset($data['logs'])) $data['logs'] = [];
    if (!isset($data['notice'])) $data['notice'] = ['title' => '', 'icon' => '', 'content' => ''];
    if (!isset($data['popups'])) $data['popups'] = [];
    if (!isset($data['settings']['showWeather'])) $data['settings']['showWeather'] = false;
    if (!isset($data['settings']['showClock'])) $data['settings']['showClock'] = true;
    if (!isset($data['settings']['showQuote'])) $data['settings']['showQuote'] = true;
    if (!isset($data['settings']['footerText'])) $data['settings']['footerText'] = '';
    if (!isset($data['settings']['cardRadius'])) $data['settings']['cardRadius'] = true;
    if (!isset($data['settings']['cardShadow'])) $data['settings']['cardShadow'] = true;
    if (!isset($data['settings']['globalFont'])) $data['settings']['globalFont'] = '';
    if (!isset($data['settings']['titleFontSize'])) $data['settings']['titleFontSize'] = 2;
    if (!isset($data['settings']['cardNameFontSize'])) $data['settings']['cardNameFontSize'] = 0.88;
    if (!isset($data['settings']['enableGeetest'])) $data['settings']['enableGeetest'] = false;
    if (!isset($data['settings']['geetestId'])) $data['settings']['geetestId'] = 'ded33ac48c6b8d3aab54360bc97b6b4a';
    if (!isset($data['settings']['geetestKey'])) $data['settings']['geetestKey'] = '746912500197fc41fbc8fcccf684e301';
    return $data;
}

function saveData($data) {
    file_put_contents(DATA_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function loadFeedbacks() {
    if (!file_exists(FEEDBACK_FILE)) {
        file_put_contents(FEEDBACK_FILE, json_encode([]));
        return [];
    }
    $content = file_get_contents(FEEDBACK_FILE);
    return json_decode($content, true) ?? [];
}

function saveFeedbacks($feedbacks) {
    file_put_contents(FEEDBACK_FILE, json_encode($feedbacks, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function generateToken($username) {
    return hash_hmac('sha256', $username . 'nav_secure_token_salt', TOKEN_SECRET);
}

function verifyToken($token, $data) {
    $user = $data['user'];
    $expected = hash_hmac('sha256', $user['username'] . 'nav_secure_token_salt', TOKEN_SECRET);
    return hash_equals($expected, $token);
}

function getClientIP() {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) return $_SERVER['HTTP_CLIENT_IP'];
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) return explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

function sanitize($str) {
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}

function recordLog(&$data, $ip, $action, $detail = '') {
    $data['logs'][] = [
        'id' => uniqid('log_', true),
        'time' => date('c'),
        'ip' => $ip,
        'action' => $action,
        'detail' => $detail
    ];
}

function verifyGeetest($lot_number, $captcha_output, $pass_token, $gen_time, $captcha_id, $captcha_key) {
    $api_server = "https://gcaptcha4.geetest.com";
    $sign_token = hash_hmac('sha256', $lot_number, $captcha_key);
    $post_data = [
        'lot_number'    => $lot_number,
        'captcha_output' => $captcha_output,
        'pass_token'    => $pass_token,
        'gen_time'      => $gen_time,
        'sign_token'    => $sign_token,
    ];
    $verify_url = $api_server . "/validate?captcha_id=" . $captcha_id;
    $ch = curl_init($verify_url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    $gt_result = json_decode($response, true);
    if (isset($gt_result['result']) && $gt_result['result'] === 'success') {
        return ['success' => true];
    } else {
        $reason = $gt_result['reason'] ?? '人机验证失败';
        return ['success' => false, 'message' => $reason];
    }
}

function getRequestHeaders() {
    $headers = [];
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    } else {
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) === 'HTTP_') {
                $key = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                $headers[$key] = $value;
            }
        }
    }
    $lower = [];
    foreach ($headers as $k => $v) {
        $lower[strtolower($k)] = $v;
    }
    return $lower;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? ($_GET['action'] ?? '');
$data = loadData();

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_public_data') {
    $settings = $data['settings'] ?? [];
    $response = [
        'offline' => $settings['offline'] ?? false,
        'offlineTitle' => $settings['offlineTitle'] ?? '网站暂时下线',
        'offlineMessage' => $settings['offlineMessage'] ?? '请稍后再来~',
        'settings' => $settings,
        'groups' => $data['groups'] ?? [],
        'notice' => $data['notice'] ?? [],
        'popups' => $data['popups'] ?? [],
        'ip' => getClientIP(),
        'enableGeetest' => $settings['enableGeetest'] ?? false,
        'geetestId' => $settings['geetestId'] ?? ''
    ];
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '方法不允许']);
    exit;
}

if ($action === 'submit_feedback') {
    $contact = sanitize($input['data']['contact'] ?? '');
    $content = sanitize($input['data']['content'] ?? '');
    if (empty($content)) {
        echo json_encode(['success' => false, 'message' => '反馈内容不能为空']);
        exit;
    }

    $settings = $data['settings'] ?? [];
    if (!empty($settings['enableGeetest'])) {
        $lot_number = $input['data']['lot_number'] ?? '';
        $captcha_output = $input['data']['captcha_output'] ?? '';
        $pass_token = $input['data']['pass_token'] ?? '';
        $gen_time = $input['data']['gen_time'] ?? '';
        if (empty($lot_number) || empty($captcha_output) || empty($pass_token) || empty($gen_time)) {
            echo json_encode(['success' => false, 'message' => '请完成人机验证', 'resetCaptcha' => true]);
            exit;
        }
        $verify = verifyGeetest($lot_number, $captcha_output, $pass_token, $gen_time, $settings['geetestId'], $settings['geetestKey']);
        if (!$verify['success']) {
            echo json_encode(['success' => false, 'message' => $verify['message'], 'resetCaptcha' => true]);
            exit;
        }
    }

    $feedbacks = loadFeedbacks();
    $feedbacks[] = [
        'id' => uniqid('fb_', true),
        'time' => date('c'),
        'contact' => $contact,
        'content' => $content
    ];
    saveFeedbacks($feedbacks);
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'login') {
    $username = sanitize($input['data']['username'] ?? '');
    $password = $input['data']['password'] ?? '';

    $settings = $data['settings'] ?? [];
    if (!empty($settings['enableGeetest'])) {
        $lot_number = $input['data']['lot_number'] ?? '';
        $captcha_output = $input['data']['captcha_output'] ?? '';
        $pass_token = $input['data']['pass_token'] ?? '';
        $gen_time = $input['data']['gen_time'] ?? '';
        if (empty($lot_number) || empty($captcha_output) || empty($pass_token) || empty($gen_time)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '请先完成人机验证', 'resetCaptcha' => true]);
            exit;
        }
        $verify = verifyGeetest($lot_number, $captcha_output, $pass_token, $gen_time, $settings['geetestId'], $settings['geetestKey']);
        if (!$verify['success']) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $verify['message'], 'resetCaptcha' => true]);
            exit;
        }
    }

    $user = $data['user'];
    if ($username === $user['username'] && password_verify($password, $user['password'])) {
        $token = generateToken($username);
        recordLog($data, getClientIP(), '登录成功');
        saveData($data);
        echo json_encode(['success' => true, 'token' => $token]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => '用户名或密码错误', 'resetCaptcha' => true]);
    }
    exit;
}

$headers = getRequestHeaders();
$token = $headers['x-token'] ?? '';
if (empty($token) || !verifyToken($token, $data)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'require_login' => true, 'message' => '未授权']);
    exit;
}

$ip = getClientIP();

switch ($action) {
    case 'verify_token':
        echo json_encode(['success' => true]);
        break;

    case 'get_config':
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'save_settings':
        $settings = $input['data']['settings'] ?? [];
        $allowed = [
            'title', 'description', 'primaryColor', 'backgroundColor', 'cardColor', 'textColor',
            'icon', 'backgroundImage', 'backgroundOpacity', 'showIP', 'offline',
            'offlineTitle', 'offlineMessage', 'showWeather', 'showClock', 'showQuote',
            'footerText', 'cardRadius', 'cardShadow', 'globalFont', 'titleFontSize', 'cardNameFontSize',
            'enableGeetest', 'geetestId', 'geetestKey'
        ];
        foreach ($allowed as $key) {
            if (isset($settings[$key])) {
                $data['settings'][$key] = is_string($settings[$key]) ? sanitize($settings[$key]) : $settings[$key];
            }
        }
        recordLog($data, $ip, '修改站点设置');
        saveData($data);
        echo json_encode(['success' => true]);
        break;

    case 'save_notice':
        $data['settings']['noticeEnabled'] = !empty($input['data']['noticeEnabled']);
        $data['settings']['popupEnabled'] = !empty($input['data']['popupEnabled']);
        
        $data['notice'] = [
            'title' => sanitize($input['data']['title'] ?? ''),
            'icon' => sanitize($input['data']['icon'] ?? ''),
            'content' => $input['data']['content'] ?? ''
        ];

        if (isset($input['data']['popupTitle']) || isset($input['data']['popupContent']) || isset($input['data']['popupStrategy'])) {
            $popup = [
                'id' => uniqid('pop_', true),
                'type' => 'notice',
                'title' => sanitize($input['data']['popupTitle'] ?? ''),
                'icon' => '',
                'content' => $input['data']['popupContent'] ?? '',
                'strategy' => sanitize($input['data']['popupStrategy'] ?? 'daily'),
                'enabled' => true
            ];
            $data['popups'] = [$popup];
        } else {
            $data['popups'] = [];
        }

        recordLog($data, $ip, '更新公告与弹窗');
        saveData($data);
        echo json_encode(['success' => true]);
        break;

    case 'save_groups':
        $groups = $input['data']['groups'] ?? [];
        $cleanGroups = [];
        foreach ($groups as $group) {
            $g = ['name' => sanitize($group['name'] ?? ''), 'cards' => []];
            foreach ($group['cards'] ?? [] as $card) {
                $g['cards'][] = [
                    'name' => sanitize($card['name'] ?? ''),
                    'url' => sanitize($card['url'] ?? ''),
                    'description' => sanitize($card['description'] ?? ''),
                    'icon' => sanitize($card['icon'] ?? '')
                ];
            }
            $cleanGroups[] = $g;
        }
        $data['groups'] = $cleanGroups;
        recordLog($data, $ip, '更新导航分组');
        saveData($data);
        echo json_encode(['success' => true]);
        break;

    case 'export_data':
        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'import_data':
        $imported = $input['data']['data'] ?? null;
        if (!$imported || !isset($imported['settings']) || !isset($imported['groups'])) {
            echo json_encode(['success' => false, 'message' => '数据格式无效']);
            break;
        }
        $data['settings'] = array_merge($data['settings'], $imported['settings']);
        $data['groups'] = $imported['groups'] ?? [];
        $data['notice'] = $imported['notice'] ?? $data['notice'];
        $data['popups'] = $imported['popups'] ?? [];
        recordLog($data, $ip, '导入备份数据');
        saveData($data);
        echo json_encode(['success' => true]);
        break;

    case 'update_user':
        $newUsername = sanitize($input['data']['username'] ?? $data['user']['username']);
        $newPassword = $input['data']['password'] ?? '';
        $newAvatar = sanitize($input['data']['avatar'] ?? $data['user']['avatar']);
        if (empty($newUsername)) {
            echo json_encode(['success' => false, 'message' => '用户名不能为空']);
            break;
        }
        $data['user']['username'] = $newUsername;
        if (!empty($newPassword)) {
            $data['user']['password'] = password_hash($newPassword, PASSWORD_BCRYPT);
        }
        $data['user']['avatar'] = $newAvatar;
        recordLog($data, $ip, '更新账户');
        saveData($data);
        echo json_encode(['success' => true]);
        break;

    case 'get_feedbacks':
        echo json_encode(['success' => true, 'feedbacks' => loadFeedbacks()]);
        break;

    case 'delete_feedback':
        $feedbackId = $input['data']['id'] ?? '';
        $feedbacks = loadFeedbacks();
        $feedbacks = array_values(array_filter($feedbacks, function($fb) use ($feedbackId) {
            return $fb['id'] !== $feedbackId;
        }));
        saveFeedbacks($feedbacks);
        echo json_encode(['success' => true]);
        break;

    case 'clear_feedbacks':
        saveFeedbacks([]);
        echo json_encode(['success' => true]);
        break;

    case 'get_logs':
        echo json_encode(['success' => true, 'logs' => $data['logs'] ?? []]);
        break;

    case 'delete_log':
        $logId = $input['data']['logId'] ?? '';
        if (empty($logId)) {
            echo json_encode(['success' => false, 'message' => '缺少日志ID']);
            break;
        }
        $found = false;
        foreach ($data['logs'] as $index => $log) {
            if (isset($log['id']) && $log['id'] === $logId) {
                array_splice($data['logs'], $index, 1);
                $found = true;
                break;
            }
        }
        if ($found) {
            saveData($data);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => '未找到该日志']);
        }
        break;

    case 'clear_logs':
        $data['logs'] = [];
        recordLog($data, $ip, '清空日志', '手动清空了所有操作记录');
        saveData($data);
        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '未知操作']);
}