(function() {
    var blockedKeys = [123, 73, 74, 85, 83];
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); e.stopPropagation(); return false; }
        if (e.ctrlKey && e.shiftKey && [73, 74, 67, 75].indexOf(e.keyCode) !== -1) { e.preventDefault(); e.stopPropagation(); return false; }
        if (e.ctrlKey && (e.keyCode === 85 || e.key === 'u' || e.key === 'U')) { e.preventDefault(); e.stopPropagation(); return false; }
        if (e.ctrlKey && (e.keyCode === 83 || e.key === 's' || e.key === 'S')) { e.preventDefault(); e.stopPropagation(); return false; }
    });
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
})();

var token = localStorage.getItem('admin_token');
if (token) {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('mainContent').style.display = '';
    document.querySelector('.login-bg').style.display = 'none';
} else {
    document.getElementById('loginBox').style.display = '';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.querySelector('.login-bg').style.display = '';
}

var userData = null;
var currentGroups = [];
var config = {};
var feedbacks = [];
var editingGroupIdx = null;
var editingCardGroupIdx = null;
var editingCardIdx = null;

function showToast(text, isError) {
    var t = document.getElementById('msgToast');
    t.textContent = text;
    t.style.background = isError ? '#fee2e2' : '#f0f9ff';
    t.style.color = isError ? '#b91c1c' : '#1e293b';
    t.style.display = 'block';
    setTimeout(function() { t.style.display = 'none'; }, 3000);
}

function api(action, data) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Token'] = token;
    return fetch('api.php', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ action: action, data: data || {} })
    }).then(function(r) {
        return r.json().then(function(json) {
            if (!r.ok) {
                throw new Error(json.message || '请求失败');
            }
            return json;
        });
    }).catch(function(err) {
        throw err;
    });
}

function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

let loginEnableGeetest = false;
let loginGeetestId = '';
let loginCaptchaObj = null;
let loginVerifyData = null;

window.addEventListener('DOMContentLoaded', function() {
    if (token) return;
    fetch('api.php?action=get_public_data&t=' + Date.now())
        .then(r => r.json())
        .then(data => {
            loginEnableGeetest = data.enableGeetest || false;
            loginGeetestId = data.geetestId || '';
            const wrap = document.getElementById('loginCaptchaWrap');
            if (loginEnableGeetest) {
                wrap.style.display = 'block';
                renderLoginCaptcha(loginGeetestId);
            } else {
                wrap.style.display = 'none';
            }
        })
        .catch(() => {
            loginEnableGeetest = true;
            loginGeetestId = 'ded33ac48c6b8d3aab54360bc97b6b4a';
            document.getElementById('loginCaptchaWrap').style.display = 'block';
            renderLoginCaptcha(loginGeetestId);
        });
});

function renderLoginCaptcha(captchaId) {
    const wrap = document.getElementById('loginCaptcha');
    if (!wrap) return;
    wrap.innerHTML = '';
    loginCaptchaObj = null;
    loginVerifyData = null;
    initGeetest4({
        captchaId: captchaId,
        product: "float",
        lang: "zh-cn"
    }, function(instance) {
        loginCaptchaObj = instance;
        loginCaptchaObj.appendTo("#loginCaptcha");
        loginCaptchaObj.onSuccess(function() {
            loginVerifyData = loginCaptchaObj.getValidate();
            document.getElementById('loginMsg').textContent = "";
        });
        loginCaptchaObj.onError(function(err) {
            document.getElementById('loginMsg').textContent = "验证码加载失败，请关闭广告拦截刷新页面";
        });
    });
}

function login() {
    var u = document.getElementById('loginUser').value.trim();
    var p = document.getElementById('loginPass').value.trim();
    if (!u || !p) { showToast('请输入用户名和密码', true); return; }
    var data = { action: 'login', data: { username: u, password: p } };
    if (loginEnableGeetest) {
        if (!loginVerifyData) {
            document.getElementById('loginMsg').textContent = "请先完成下方人机验证";
            return;
        }
        data.data.lot_number = loginVerifyData.lot_number;
        data.data.captcha_output = loginVerifyData.captcha_output;
        data.data.pass_token = loginVerifyData.pass_token;
        data.data.gen_time = loginVerifyData.gen_time;
    }

    fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            token = res.token;
            localStorage.setItem('admin_token', token);
            document.getElementById('loginBox').style.display = 'none';
            document.getElementById('sidebar').style.display = 'flex';
            document.getElementById('mainContent').style.display = '';
            document.querySelector('.login-bg').style.display = 'none';
            loadConfig();
            if (loginEnableGeetest && loginCaptchaObj) loginCaptchaObj.reset();
        } else {
            document.getElementById('loginMsg').textContent = res.message || '登录失败';
            if (loginEnableGeetest && loginCaptchaObj) loginCaptchaObj.reset();
        }
    })
    .catch(err => {
        document.getElementById('loginMsg').textContent = '网络错误，请重试';
    });
}

function logout() {
    localStorage.removeItem('admin_token');
    token = null;
    document.getElementById('loginBox').style.display = '';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.querySelector('.login-bg').style.display = '';
    window.location.reload();
}

function switchSection(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    var target = document.getElementById('section-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    var nav = document.querySelector('[data-section="' + name + '"]');
    if (nav) nav.classList.add('active');
    if (name === 'logs') loadLogs();
    if (name === 'feedbacks') loadFeedbacks();
}

function greeting() {
    var hour = new Date().getHours();
    var prefix = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    var name = userData ? userData.username : '用户';
    var text = prefix + '，' + name + '，今天又是活力满满的一天呢';
    var avatarBox = document.getElementById('profileAvatar');
    if (avatarBox) {
        if (userData && userData.avatar && userData.avatar.match(/^https?:\/\//)) {
            avatarBox.innerHTML = '<img src="' + userData.avatar + '" alt="avatar">';
        } else {
            var initial = name.charAt(0).toUpperCase() || 'U';
            avatarBox.textContent = initial;
        }
    }
    var textEl = document.getElementById('profileGreetingText');
    if (textEl) {
        textEl.textContent = text;
    }
}

function loadConfig() {
    api('get_config').then(function(res) {
        if (res.success) {
            var cfg = res.data;
            config = cfg;
            userData = cfg.user;
            currentGroups = cfg.groups || [];
            var popups = cfg.popups || [];
            var firstPopup = popups.length > 0 ? popups[0] : null;
            feedbacks = cfg.feedbacks || [];
            var s = cfg.settings || {};
            document.getElementById('siteTitle').value = s.title || '';
            document.getElementById('siteDesc').value = s.description || '';
            document.getElementById('siteIcon').value = s.icon || '';
            document.getElementById('primaryColor').value = s.primaryColor || '#3b82f6';
            document.getElementById('bgColor').value = s.backgroundColor || '#f0f4f8';
            document.getElementById('cardColor').value = s.cardColor || '#ffffff';
            document.getElementById('textColor').value = s.textColor || '#1e293b';
            document.getElementById('bgImage').value = s.backgroundImage || '';
            document.getElementById('bgOpacity').value = s.backgroundOpacity || 0.3;
            document.getElementById('globalFont').value = s.globalFont || '';
            document.getElementById('titleFontSize').value = s.titleFontSize || 2;
            document.getElementById('cardNameFontSize').value = s.cardNameFontSize || 0.88;
            document.getElementById('cardRadius').checked = s.cardRadius !== false;
            document.getElementById('cardShadow').checked = s.cardShadow !== false;
            document.getElementById('showIP').checked = s.showIP || false;
            document.getElementById('showWeather').checked = s.showWeather || false;
            document.getElementById('showClock').checked = s.showClock !== false;
            document.getElementById('showQuote').checked = s.showQuote !== false;
            document.getElementById('footerText').value = s.footerText || '';
            document.getElementById('offlineToggle').checked = s.offline || false;
            document.getElementById('offlineTitle').value = s.offlineTitle || '';
            document.getElementById('offlineMsg').value = s.offlineMessage || '';
            document.getElementById('enableGeetest').checked = s.enableGeetest || false;
            document.getElementById('geetestId').value = s.geetestId || '';
            document.getElementById('geetestKey').value = s.geetestKey || '';
            document.getElementById('noticeEnabled').checked = s.noticeEnabled || false;
            document.getElementById('popupEnabled').checked = s.popupEnabled || false;
            document.getElementById('noticeTitle').value = cfg.notice ? cfg.notice.title || '' : '';
            document.getElementById('noticeIcon').value = cfg.notice ? cfg.notice.icon || '' : '';
            document.getElementById('noticeContent').value = cfg.notice ? cfg.notice.content || '' : '';
            if (firstPopup) {
                document.getElementById('popupTitle').value = firstPopup.title || '';
                document.getElementById('popupContent').value = firstPopup.content || '';
                document.getElementById('popupStrategy').value = firstPopup.strategy || 'daily';
            } else {
                document.getElementById('popupTitle').value = '';
                document.getElementById('popupContent').value = '';
                document.getElementById('popupStrategy').value = 'daily';
            }
            document.getElementById('newUsername').value = cfg.user.username || '';
            document.getElementById('avatarUrl').value = cfg.user.avatar || '';

            renderGroups();
            greeting();
        } else if (res.require_login) {
            logout();
        }
    }).catch(function(err) {
        showToast('加载配置失败：' + err.message, true);
    });
}

function saveAllSettings() {
    var settings = {
        title: document.getElementById('siteTitle').value,
        description: document.getElementById('siteDesc').value,
        primaryColor: document.getElementById('primaryColor').value,
        backgroundColor: document.getElementById('bgColor').value,
        cardColor: document.getElementById('cardColor').value,
        textColor: document.getElementById('textColor').value,
        icon: document.getElementById('siteIcon').value,
        backgroundImage: document.getElementById('bgImage').value,
        backgroundOpacity: parseFloat(document.getElementById('bgOpacity').value) || 0.3,
        showIP: document.getElementById('showIP').checked,
        offline: document.getElementById('offlineToggle').checked,
        showWeather: document.getElementById('showWeather').checked,
        showClock: document.getElementById('showClock').checked,
        showQuote: document.getElementById('showQuote').checked,
        footerText: document.getElementById('footerText').value,
        cardRadius: document.getElementById('cardRadius').checked,
        cardShadow: document.getElementById('cardShadow').checked,
        globalFont: document.getElementById('globalFont').value,
        titleFontSize: parseFloat(document.getElementById('titleFontSize').value) || 2,
        cardNameFontSize: parseFloat(document.getElementById('cardNameFontSize').value) || 0.88,
        offlineTitle: document.getElementById('offlineTitle').value,
        offlineMessage: document.getElementById('offlineMsg').value,
        enableGeetest: document.getElementById('enableGeetest').checked,
        geetestId: document.getElementById('geetestId').value.trim(),
        geetestKey: document.getElementById('geetestKey').value.trim()
    };

    var noticeData = {
        noticeEnabled: document.getElementById('noticeEnabled').checked,
        popupEnabled: document.getElementById('popupEnabled').checked,
        title: document.getElementById('noticeTitle').value,
        icon: document.getElementById('noticeIcon').value,
        content: document.getElementById('noticeContent').value,
        popupTitle: document.getElementById('popupTitle').value,
        popupContent: document.getElementById('popupContent').value,
        popupStrategy: document.getElementById('popupStrategy').value
    };

    api('save_settings', { settings: settings }).then(function(res) {
        if (res.success) {
            return api('save_notice', noticeData);
        } else {
            throw new Error(res.message || '保存站点设置失败');
        }
    }).then(function(res2) {
        if (res2.success) {
            showToast('所有设置已保存');
            loadConfig();
        } else {
            throw new Error(res2.message || '保存公告与弹窗失败');
        }
    }).catch(function(err) {
        showToast(err.message, true);
    });
}

function renderGroups() {
    var container = document.getElementById('groupsContainer');
    container.innerHTML = '';
    currentGroups.forEach(function(group, gIdx) {
        var div = document.createElement('div');
        div.className = 'group-card';
        div.innerHTML = '<div class="group-header"><span class="group-name">' + (group.name || '未命名') + '</span><div class="inline-actions"><button class="btn-outline btn-sm" onclick="openEditGroup(' + gIdx + ')">编辑</button><button class="btn-outline btn-sm danger" onclick="deleteGroup(' + gIdx + ')">删除</button></div></div>';
        var cardsDiv = document.createElement('div');
        (group.cards || []).forEach(function(card, cIdx) {
            var cardEl = document.createElement('div');
            cardEl.className = 'card-item';
            cardEl.innerHTML = '<span>' + (card.name || '卡片') + '</span><span class="card-url">' + (card.url || '') + '</span><div class="inline-actions"><button class="btn-outline btn-sm" onclick="openEditCard(' + gIdx + ',' + cIdx + ')">编辑</button><button class="btn-outline btn-sm danger" onclick="deleteCard(' + gIdx + ',' + cIdx + ')">删除</button></div>';
            cardsDiv.appendChild(cardEl);
        });
        var addBtn = document.createElement('button');
        addBtn.className = 'btn-outline btn-sm';
        addBtn.textContent = '+ 添加卡片';
        addBtn.style.marginTop = '6px';
        addBtn.onclick = function() { openAddCard(gIdx); };
        cardsDiv.appendChild(addBtn);
        div.appendChild(cardsDiv);
        container.appendChild(div);
    });
}

function saveGroups() {
    api('save_groups', { groups: currentGroups }).then(function(res) {
        if (res.success) { showToast('分组已更新'); loadConfig(); }
        else showToast(res.message || '更新失败', true);
    });
}

function openAddGroup() {
    editingGroupIdx = null;
    document.getElementById('groupNameInput').value = '';
    document.getElementById('groupModalTitle').textContent = '新建分组';
    document.getElementById('groupModal').classList.add('active');
}

function openEditGroup(idx) {
    editingGroupIdx = idx;
    document.getElementById('groupNameInput').value = currentGroups[idx].name;
    document.getElementById('groupModalTitle').textContent = '编辑分组';
    document.getElementById('groupModal').classList.add('active');
}

function closeGroupModal() { document.getElementById('groupModal').classList.remove('active'); }

function deleteGroup(idx) {
    if (confirm('确定删除该分组及所有卡片？')) {
        currentGroups.splice(idx, 1);
        saveGroups();
    }
}

document.getElementById('groupModalSave').onclick = function() {
    var name = document.getElementById('groupNameInput').value.trim();
    if (!name) { showToast('名称不能为空', true); return; }
    if (editingGroupIdx !== null) { currentGroups[editingGroupIdx].name = name; }
    else { currentGroups.push({ name: name, cards: [] }); }
    saveGroups();
    closeGroupModal();
};

function openAddCard(gIdx) {
    editingCardGroupIdx = gIdx;
    editingCardIdx = null;
    document.getElementById('cardModalTitle').textContent = '添加卡片';
    document.getElementById('cardName').value = '';
    document.getElementById('cardUrl').value = '';
    document.getElementById('cardIcon').value = '';
    document.getElementById('cardDesc').value = '';
    document.getElementById('cardModal').classList.add('active');
}

function openEditCard(gIdx, cIdx) {
    editingCardGroupIdx = gIdx;
    editingCardIdx = cIdx;
    var card = currentGroups[gIdx].cards[cIdx];
    document.getElementById('cardModalTitle').textContent = '编辑卡片';
    document.getElementById('cardName').value = card.name || '';
    document.getElementById('cardUrl').value = card.url || '';
    document.getElementById('cardIcon').value = card.icon || '';
    document.getElementById('cardDesc').value = card.description || '';
    document.getElementById('cardModal').classList.add('active');
}

function closeCardModal() { document.getElementById('cardModal').classList.remove('active'); }

function deleteCard(gIdx, cIdx) {
    if (confirm('删除该卡片？')) {
        currentGroups[gIdx].cards.splice(cIdx, 1);
        saveGroups();
    }
}

document.getElementById('cardModalSave').onclick = function() {
    var name = document.getElementById('cardName').value.trim();
    var url = document.getElementById('cardUrl').value.trim();
    if (!name || !url) { showToast('名称和链接不能为空', true); return; }
    var card = {
        name: name,
        url: url,
        icon: document.getElementById('cardIcon').value.trim() || '📎',
        description: document.getElementById('cardDesc').value.trim()
    };
    if (editingCardIdx !== null) {
        currentGroups[editingCardGroupIdx].cards[editingCardIdx] = card;
    } else {
        currentGroups[editingCardGroupIdx].cards.push(card);
    }
    saveGroups();
    closeCardModal();
};

function fetchIcon() {
    var url = document.getElementById('cardUrl').value.trim();
    if (!url) { showToast('请先输入链接', true); return; }
    try { new URL(url); } catch (e) { showToast('无效URL', true); return; }
    document.getElementById('cardIcon').value = 'https://favicon.splitbee.io/?url=' + encodeURIComponent(url);
    showToast('已尝试获取图标');
}

function exportData() {
    api('export_data').then(function(res) {
        if (res.success) {
            var blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'backup_' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
        }
    });
}

function importData() {
    var file = document.getElementById('importFile').files[0];
    if (!file) { showToast('请选择文件', true); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            api('import_data', { data: data }).then(function(res) {
                if (res.success) { showToast('导入成功'); loadConfig(); }
                else showToast(res.message || '导入失败', true);
            });
        } catch (err) { showToast('无效JSON', true); }
    };
    reader.readAsText(file);
}

function updateUser() {
    var username = document.getElementById('newUsername').value.trim();
    var password = document.getElementById('newPassword').value;
    var avatar = document.getElementById('avatarUrl').value.trim();
    if (!username) { showToast('用户名不能为空', true); return; }
    api('update_user', { username: username, password: password || undefined, avatar: avatar }).then(function(res) {
        if (res.success) { showToast('账户已更新'); loadConfig(); }
        else showToast(res.message, true);
    });
}

function loadFeedbacks() {
    api('get_feedbacks').then(function(res) {
        var container = document.getElementById('feedbacksList');
        if (res.success && res.feedbacks && res.feedbacks.length) {
            container.innerHTML = res.feedbacks.slice().reverse().map(function(fb) {
                var time = new Date(fb.time).toLocaleString('zh-CN');
                return '<div class="log-item"><span class="log-time">' + time + '</span><span class="log-ip">' + (fb.contact || '匿名') + '</span><span class="log-detail">' + fb.content + '</span><button class="log-del" onclick="deleteFeedback(\'' + fb.id + '\')">✕</button></div>';
            }).join('');
        } else {
            container.innerHTML = '<div style="color:#64748b;">暂无用户反馈</div>';
        }
    }).catch(function() {
        document.getElementById('feedbacksList').innerHTML = '<div style="color:#ef4444;">加载失败</div>';
    });
}

function deleteFeedback(feedbackId) {
    if (!confirm('确定删除这条反馈吗？')) return;
    api('delete_feedback', { id: feedbackId }).then(function(res) {
        if (res.success) { showToast('反馈已删除'); loadFeedbacks(); }
        else showToast(res.message || '删除失败', true);
    });
}

function clearAllFeedbacks() {
    if (!confirm('确定清空全部反馈吗？')) return;
    api('clear_feedbacks').then(function(res) {
        if (res.success) { showToast('已清空'); loadFeedbacks(); }
    });
}

function loadLogs() {
    api('get_logs').then(function(res) {
        var tbody = document.getElementById('logTableBody');
        if (res.success && res.logs && res.logs.length) {
            var logs = res.logs.slice().reverse();
            var html = '';
            logs.forEach(function(log, index) {
                var time = new Date(log.time).toLocaleString('zh-CN', { hour12: false });
                var ip = log.ip || '未知';
                var detail = log.detail || log.action || '';
                var rowNum = index + 1;
                html += '<tr>';
                html += '<td style="color:#94a3b8; font-size:0.75rem;">' + rowNum + '</td>';
                html += '<td class="log-time">' + time + '</td>';
                html += '<td><span class="log-ip">' + ip + '</span></td>';
                html += '<td class="log-detail">' + detail + '</td>';
                html += '<td><button class="log-del" onclick="deleteLog(\'' + log.id + '\')">✕</button></td>';
                html += '</tr>';
            });
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">暂无操作记录</td></tr>';
        }
    }).catch(function() {
        document.getElementById('logTableBody').innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:20px;">加载失败</td></tr>';
    });
}

function exportLogs() {
    api('get_logs').then(function(res) {
        if (!res.success || !res.logs || !res.logs.length) {
            showToast('没有日志可导出', true);
            return;
        }
        var logs = res.logs.slice().reverse();
        var rows = [['时间', 'IP地址', '操作详情']];
        logs.forEach(function(log) {
            var time = new Date(log.time).toLocaleString('zh-CN', { hour12: false });
            var ip = log.ip || '未知';
            var detail = log.detail || log.action || '';
            rows.push([time, ip, detail]);
        });
        var csvContent = rows.map(function(row) {
            return row.map(function(cell) {
                if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                    return '"' + cell.replace(/"/g, '""') + '"';
                }
                return cell;
            }).join(',');
        }).join('\n');

        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'logs_' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('日志已导出');
    }).catch(function() {
        showToast('导出失败', true);
    });
}

function deleteLog(logId) {
    if (!confirm('确定删除这条日志吗？')) return;
    api('delete_log', { logId: logId }).then(function(res) {
        if (res.success) { showToast('已删除'); loadLogs(); }
    });
}

function clearAllLogs() {
    if (!confirm('确定清空全部日志吗？')) return;
    api('clear_logs').then(function(res) {
        if (res.success) { showToast('已清空'); loadLogs(); }
    });
}

if (token) {
    api('verify_token').then(function(res) {
        if (res.success) loadConfig();
        else {
            logout();
            showToast('登录已过期，请重新登录', true);
        }
    }).catch(function() {
        logout();
        showToast('登录验证失败，请重新登录', true);
    });
}

setInterval(function() {
    if (document.getElementById('mainContent').style.display !== 'none') greeting();
}, 60000);

var checkResults = [];
var currentCheckMode = 'fast';

function setCheckMode(mode) {
    currentCheckMode = mode;
    document.querySelectorAll('.check-mode-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    document.querySelector('[data-mode="' + mode + '"]').classList.add('active');
}

function startLinkCheck() {
    var btn = document.getElementById('checkLinksBtn');
    btn.disabled = true;
    btn.textContent = '检测中...';
    var area = document.getElementById('checkResultArea');
    area.style.display = 'block';
    document.getElementById('checkProgress').textContent = '正在收集卡片链接...';
    document.getElementById('checkStats').textContent = '';
    document.getElementById('checkList').innerHTML = '';
    document.getElementById('deleteBrokenBtn').style.display = 'none';
    
    var allCards = [];
    currentGroups.forEach(function(group) {
        (group.cards || []).forEach(function(card) {
            if (card.url) {
                allCards.push({
                    id: card._tempId || Math.random().toString(36).substr(2, 8),
                    url: card.url,
                    groupIndex: currentGroups.indexOf(group),
                    cardIndex: group.cards.indexOf(card),
                    title: card.name || card.url
                });
            }
        });
    });
    
    if (allCards.length === 0) {
        document.getElementById('checkProgress').textContent = '没有卡片需要检测。';
        btn.disabled = false;
        btn.textContent = '🔍 检测失效链接';
        return;
    }
    
    document.getElementById('checkProgress').textContent = '共 ' + allCards.length + ' 个链接，正在' + (currentCheckMode === 'deep' ? '深度' : '快速') + '检测...';
    var payload = { links: allCards.map(function(c) { return { id: c.id, url: c.url }; }), mode: currentCheckMode };
    
    var timeoutMs = currentCheckMode === 'deep' ? 60000 : 30000;
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);
    
    fetch('checklinks.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
    })
    .then(function(res) {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('服务器返回 ' + res.status);
        return res.json();
    })
    .then(function(data) {
        if (data.error) {
            document.getElementById('checkProgress').textContent = '检测失败：' + data.error;
            btn.disabled = false;
            btn.textContent = '🔍 检测失效链接';
            return;
        }
        
        var results = data.results || [];
        var finalResults = [];
        var okCount = 0, warningCount = 0, deadCount = 0;
        
        results.forEach(function(r) {
            var card = allCards.find(function(c) { return c.id === r.id; });
            var statusText = '';
            var statusLevel = '';
            
            if (r.status === 'ok') {
                statusText = '正常';
                statusLevel = 'ok';
                okCount++;
            } else if (r.status === 'warning') {
                statusText = '异常';
                statusLevel = 'warning';
                warningCount++;
            } else {
                statusText = '失效';
                statusLevel = 'dead';
                deadCount++;
            }
            
            finalResults.push({
                id: r.id,
                url: r.url,
                title: card ? card.title : r.url,
                status: statusText,
                level: statusLevel,
                code: r.code || 0,
                reason: r.reason || '',
                groupIndex: card ? card.groupIndex : -1,
                cardIndex: card ? card.cardIndex : -1
            });
        });
        
        checkResults = finalResults;
        renderCheckResults(finalResults, okCount, warningCount, deadCount);
        btn.disabled = false;
        btn.textContent = '🔍 检测失效链接';
    })
    .catch(function(err) {
        clearTimeout(timeoutId);
        document.getElementById('checkProgress').textContent = '检测请求失败：' + err.message;
        btn.disabled = false;
        btn.textContent = '🔍 检测失效链接';
        console.error('检测错误:', err);
    });
}

function renderCheckResults(results, okCount, warningCount, deadCount) {
    var progress = document.getElementById('checkProgress');
    progress.textContent = '检测完成。共 ' + results.length + ' 个链接，正常 ' + okCount + ' 个，异常 ' + warningCount + ' 个，失效 ' + deadCount + ' 个。';
    
    var stats = document.getElementById('checkStats');
    stats.innerHTML = '<span style="color:#64748b;">💡 异常站点多为反爬或临时故障，不建议批量删除；失效站点可确认后删除</span>';
    
    var list = document.getElementById('checkList');
    list.innerHTML = '';
    
    results.sort(function(a, b) {
        var order = { dead: 0, warning: 1, ok: 2 };
        return order[a.level] - order[b.level];
    });
    
    results.forEach(function(r, idx) {
        var div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        div.style.padding = '6px 0';
        div.style.borderBottom = '1px solid #f1f5f9';
        
        var statusColor = r.level === 'ok' ? '#22c55e' : (r.level === 'warning' ? '#f59e0b' : '#ef4444');
        var statusText = r.status + (r.code && r.code > 0 ? ' (' + r.code + ')' : '');
        
        div.innerHTML = '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + r.url + '">' + r.title + 
                        '</span><span style="color:' + statusColor + ';font-weight:500;min-width:60px;">' + statusText + 
                        '</span><span style="color:#94a3b8;font-size:0.75rem;min-width:100px;">' + r.reason + 
                        '</span><button class="btn-outline btn-sm" style="padding:2px 8px;font-size:0.75rem;" onclick="recheckSingle(' + idx + ')">重试</button>';
        list.appendChild(div);
    });
    
    var delBtn = document.getElementById('deleteBrokenBtn');
    if (deadCount > 0) {
        delBtn.style.display = 'inline-block';
        delBtn.textContent = '🗑️ 仅删除 ' + deadCount + ' 个失效卡片';
    } else {
        delBtn.style.display = 'none';
    }
}

function recheckSingle(index) {
    var item = checkResults[index];
    if (!item) return;
    
    var listItems = document.getElementById('checkList').children;
    if (listItems[index]) {
        listItems[index].querySelector('button').textContent = '检测中';
        listItems[index].querySelector('button').disabled = true;
    }
    
    var payload = { links: [{ id: item.id, url: item.url }], mode: 'deep' };
    
    fetch('checklinks.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(function(data) {
        if (data.results && data.results[0]) {
            var r = data.results[0];
            var statusText, statusLevel, reason;
            
            if (r.status === 'ok') {
                statusText = '正常'; statusLevel = 'ok';
            } else if (r.status === 'warning') {
                statusText = '异常'; statusLevel = 'warning';
            } else {
                statusText = '失效'; statusLevel = 'dead';
            }
            reason = r.reason || '';
            
            checkResults[index].status = statusText;
            checkResults[index].level = statusLevel;
            checkResults[index].code = r.code || 0;
            checkResults[index].reason = reason;
            
            var okCount = checkResults.filter(x => x.level === 'ok').length;
            var warningCount = checkResults.filter(x => x.level === 'warning').length;
            var deadCount = checkResults.filter(x => x.level === 'dead').length;
            renderCheckResults(checkResults, okCount, warningCount, deadCount);
        }
    })
    .catch(function() {
        if (listItems[index]) {
            listItems[index].querySelector('button').textContent = '重试';
            listItems[index].querySelector('button').disabled = false;
        }
    });
}

function deleteBrokenLinks() {
    var broken = checkResults.filter(function(r) { return r.level === 'dead'; });
    if (broken.length === 0) return;
    if (!confirm('确定要删除 ' + broken.length + ' 个失效卡片吗？异常站点不会被删除。此操作不可撤销。')) return;
    
    var toDelete = broken.map(function(r) { return { g: r.groupIndex, c: r.cardIndex }; });
    toDelete.sort(function(a, b) { return b.g - a.g || b.c - a.c; });
    
    toDelete.forEach(function(d) {
        if (d.g >= 0 && d.g < currentGroups.length) {
            var group = currentGroups[d.g];
            if (d.c >= 0 && d.c < group.cards.length) {
                group.cards.splice(d.c, 1);
            }
        }
    });
    
    currentGroups = currentGroups.filter(function(g) { return g.cards.length > 0; });
    saveGroups();
    document.getElementById('checkResultArea').style.display = 'none';
    checkResults = [];
    showToast('已删除 ' + broken.length + ' 个失效卡片');
}