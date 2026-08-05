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

var allGroups = [];
var currentEngine = 'baidu';
var searchPlaceholders = ['搜索导航卡片...', '今天想找什么？', '快速查找...', '输入关键词筛选...'];
var placeholderIndex = 0;
var syncedTimeOffset = 0, lastSyncTime = 0, clockTimer = null;
var publicInfo = {};

var enableGeetest = false;
var geetestId = '';

var quotes = [
    { icon: '✨', text: '每天都是一个新的开始' },
    { icon: '🌿', text: '心之所向，素履以往' },
    { icon: '☀️', text: '你若盛开，清风自来' },
    { icon: '🌙', text: '星光不问赶路人' },
    { icon: '🍃', text: '行到水穷处，坐看云起时' },
    { icon: '🕊️', text: '简单一点，快乐就多一点' },
    { icon: '🌸', text: '不负韶华，不负自己' },
    { icon: '🏔️', text: '路漫漫其修远兮' },
    { icon: '💫', text: '保持热爱，奔赴山海' },
    { icon: '🌻', text: '向阳而生，逐光而行' },
    { icon: '🍂', text: '人间有味是清欢' },
    { icon: '🌊', text: '心静自然凉，无事小神仙' }
];

function getRandomQuote() {
    var q = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quoteText').textContent = q.text;
    document.getElementById('quoteIcon').textContent = q.icon;
}

function getBeijingTimeFromLocal() {
    var now = new Date();
    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 8));
}

function syncBeijingTime() {
    fetch('https://api.reginvolver.cn/time', { cache: 'no-cache' })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.timestamp) {
                syncedTimeOffset = new Date(data.timestamp * 1000).getTime() - Date.now();
                lastSyncTime = Date.now();
                document.getElementById('clockSync').textContent = '✓';
            }
        })
        .catch(function() { document.getElementById('clockSync').textContent = '⚠'; });
}

function updateClock() {
    var now = Date.now();
    var beijingTime = syncedTimeOffset && (now - lastSyncTime < 120000) ? new Date(now + syncedTimeOffset) : getBeijingTimeFromLocal();
    document.getElementById('clockTime').textContent = beijingTime.getHours().toString().padStart(2,'0') + ':' + beijingTime.getMinutes().toString().padStart(2,'0');
    var days = ['周日','周一','周二','周三','周四','周五','周六'];
    document.getElementById('clockDate').textContent = (beijingTime.getMonth()+1) + '月' + beijingTime.getDate() + '日 ' + days[beijingTime.getDay()];
}

function rotatePlaceholder() {
    var input = document.getElementById('searchInput');
    if (input && document.activeElement !== input && input.value === '') {
        placeholderIndex = (placeholderIndex + 1) % searchPlaceholders.length;
        input.placeholder = searchPlaceholders[placeholderIndex];
    }
}

function createRipple(e) {
    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
    var ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', function() { ripple.remove(); });
}
document.addEventListener('click', createRipple);

function openPopupModal(icon, title, content) {
    document.getElementById('popupIcon').textContent = icon || '📢';
    document.getElementById('popupTitle').textContent = title || '公告';
    document.getElementById('popupBody').innerHTML = marked.parse(content);
    document.getElementById('popupModal').classList.add('active');
    console.log('[弹窗公告] 已打开');
}

function closePopupModal() {
    document.getElementById('popupModal').classList.remove('active');
    var popup = window._currentPopup;
    if (popup) {
        if (popup.strategy === 'always') {
            sessionStorage.setItem('popup_closed_' + popup.id, '1');
        } else if (popup.strategy === 'daily') {
            localStorage.setItem('popup_closed_date_' + popup.id, new Date().toISOString().slice(0,10));
        } else if (popup.strategy === 'weekly') {
            var now = new Date();
            var weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString().slice(0,10);
            localStorage.setItem('popup_closed_date_' + popup.id, weekStart);
        }
        window._currentPopup = null;
    }
    console.log('[弹窗公告] 已关闭');
}

function loadSite() {
    fetch('api.php?action=get_public_data&t=' + Date.now())
        .then(function(r) { return r.json(); })
        .then(function(data) {
            console.log('[数据] 加载成功', data);
            if (data.offline) {
                document.getElementById('mainView').style.display = 'none';
                document.getElementById('offlineView').style.display = '';
                document.getElementById('offlineTitle').textContent = data.offlineTitle || '加载中...';
                document.getElementById('offlineMsg').textContent = data.offlineMessage || '加载中...';
                document.title = data.offlineTitle || '加载中...';
                return;
            }
            document.getElementById('mainView').style.display = '';
            document.getElementById('offlineView').style.display = 'none';
            var s = data.settings || {};
            publicInfo = s;
            enableGeetest = data.enableGeetest || false;
            geetestId = data.geetestId || '';

            document.getElementById('siteTitle').textContent = s.title || '加载中...';
            document.getElementById('siteDesc').textContent = s.description || '';
            document.title = s.title || '加载中...';
            document.documentElement.style.setProperty('--primary', s.primaryColor || '#c67b5c');
            document.documentElement.style.setProperty('--bg', s.backgroundColor || '#faf6f1');
            document.documentElement.style.setProperty('--card-bg', s.cardColor || '#ffffff');
            document.documentElement.style.setProperty('--text', s.textColor || '#4a3728');
            var bgLayer = document.getElementById('bgLayer');
            if (s.backgroundImage) {
                bgLayer.style.backgroundImage = 'url(' + s.backgroundImage + ')';
                bgLayer.style.opacity = s.backgroundOpacity !== undefined ? s.backgroundOpacity : 0.3;
            } else { bgLayer.style.backgroundImage = ''; bgLayer.style.opacity = '0'; }
            if (s.icon) document.getElementById('favicon').href = s.icon;
            document.getElementById('ipDisplay').style.display = s.showIP && data.ip ? '' : 'none';
            if (s.showIP && data.ip) document.getElementById('ipDisplay').textContent = '您的IP: ' + data.ip;
            document.getElementById('clockWrap').style.display = s.showClock !== false ? 'flex' : 'none';
            document.documentElement.style.setProperty('--title-size', (s.titleFontSize || 2) + 'rem');
            document.documentElement.style.setProperty('--card-name-size', (s.cardNameFontSize || 0.88) + 'rem');
            document.documentElement.style.setProperty('--global-font', s.globalFont || '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif');
            document.documentElement.style.setProperty('--radius', s.cardRadius !== false ? '14px' : '0px');
            document.documentElement.style.setProperty('--radius-sm', s.cardRadius !== false ? '10px' : '0px');
            if (s.cardShadow !== false) {
                document.documentElement.style.setProperty('--shadow', '0 2px 12px rgba(74,55,40,0.07)');
                document.documentElement.style.setProperty('--shadow-hover', '0 8px 28px rgba(74,55,40,0.13)');
            } else {
                document.documentElement.style.setProperty('--shadow', 'none');
                document.documentElement.style.setProperty('--shadow-hover', 'none');
            }
            var weatherEl = document.getElementById('weatherWidget');
            if (s.showWeather && data.ip) {
                fetch('https://api.open-meteo.com/v1/forecast?latitude=39.9&longitude=116.4&current_weather=true&timezone=auto')
                    .then(function(r){return r.json();})
                    .then(function(wdata){
                        if (wdata && wdata.current_weather) {
                            var temp = wdata.current_weather.temperature;
                            var code = wdata.current_weather.weathercode;
                            var desc = {0:'晴',1:'晴',2:'多云',3:'阴',45:'雾',48:'雾凇',51:'小雨',53:'小雨',55:'小雨',61:'中雨',63:'中雨',65:'大雨',71:'小雪',73:'小雪',75:'中雪',80:'阵雨',81:'阵雨',82:'暴雨',95:'雷雨',96:'雷雨'}[code] || '';
                            weatherEl.style.display = 'block';
                            weatherEl.innerHTML = '🌤 ' + temp + '°C ' + desc;
                        } else {
                            weatherEl.style.display = 'none';
                        }
                    }).catch(function(){ weatherEl.style.display = 'none'; });
            } else { weatherEl.style.display = 'none'; }
            var noticeBar = document.getElementById('noticeBar');
            if (s.noticeEnabled && data.notice && data.notice.content.trim() !== '') {
                noticeBar.style.display = 'flex';
                document.getElementById('noticeContent').innerHTML = marked.parse(data.notice.content);
            } else { noticeBar.style.display = 'none'; }
            allGroups = data.groups || [];
            renderGroups(allGroups);
            if (s.footerText && s.footerText.trim() !== '') {
                document.getElementById('footerQuote').innerHTML = '<span class="quote-icon">📝</span><span>' + s.footerText + '</span>';
                document.getElementById('footerQuote').style.display = '';
            } else if (s.showQuote !== false) {
                getRandomQuote();
                document.getElementById('footerQuote').style.display = '';
            } else {
                document.getElementById('footerQuote').style.display = 'none';
            }
            if (s.showClock !== false) { syncBeijingTime(); updateClock(); if(clockTimer) clearInterval(clockTimer); clockTimer = setInterval(updateClock, 1000); setInterval(syncBeijingTime, 300000); }

            var captchaContainer = document.getElementById('captchaContainer');
            if (enableGeetest) {
                captchaContainer.style.display = 'block';
            } else {
                captchaContainer.style.display = 'none';
            }

            console.log('[弹窗公告] popupEnabled =', s.popupEnabled);
            console.log('[弹窗公告] popups =', data.popups);
            if (s.popupEnabled && data.popups && data.popups.length > 0) {
                var popup = data.popups[0];
                console.log('[弹窗公告] 取到的popup:', popup);
                if (popup.content && popup.content.trim() !== '') {
                    var shouldShow = true;
                    var storageKey = 'popup_closed_date_' + popup.id;
                    var lastClosed = localStorage.getItem(storageKey);
                    if (popup.strategy === 'daily') {
                        var today = new Date().toISOString().slice(0,10);
                        if (lastClosed === today) shouldShow = false;
                    } else if (popup.strategy === 'weekly') {
                        var now = new Date();
                        var weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString().slice(0,10);
                        if (lastClosed === weekStart) shouldShow = false;
                    } else if (popup.strategy === 'always') {
                        var sessionKey = 'popup_closed_' + popup.id;
                        if (sessionStorage.getItem(sessionKey)) shouldShow = false;
                    }
                    console.log('[弹窗公告] shouldShow =', shouldShow);
                    if (shouldShow) {
                        window._currentPopup = popup;
                        openPopupModal(popup.icon || '📢', popup.title || '公告', popup.content);
                    } else {
                        console.log('[弹窗公告] 根据策略跳过弹出');
                    }
                } else {
                    console.log('[弹窗公告] 弹窗内容为空，不弹出');
                }
            } else {
                console.log('[弹窗公告] 条件不满足：popupEnabled=' + s.popupEnabled + ', popups存在=' + !!data.popups + ', 长度=' + (data.popups ? data.popups.length : 'undefined'));
            }
        })
        .catch(function(err) { console.error('加载失败:', err); });
}

function renderGroups(groups) {
    var container = document.getElementById('groupsContainer');
    container.innerHTML = '';
    var visibleCount = 0;
    groups.forEach(function(group) {
        var section = document.createElement('div');
        section.className = 'group-section';
        var titleEl = document.createElement('div');
        titleEl.className = 'group-title';
        titleEl.textContent = group.name || '未命名分组';
        section.appendChild(titleEl);
        var cardsGrid = document.createElement('div');
        cardsGrid.className = 'cards-grid';
        (group.cards || []).forEach(function(card) {
            var a = document.createElement('a');
            a.className = 'card-item';
            a.href = card.url || '#';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            var iconDiv = document.createElement('div');
            iconDiv.className = 'card-icon';
            if (card.icon && card.icon.match(/^https?:\/\//)) {
                var img = document.createElement('img');
                img.src = card.icon;
                img.alt = '';
                img.loading = 'lazy';
                img.onerror = function() { this.style.display = 'none'; iconDiv.textContent = '📎'; };
                iconDiv.appendChild(img);
            } else if (card.icon && card.icon.trim()) {
                iconDiv.textContent = card.icon.trim();
            } else { iconDiv.textContent = '📎'; }
            a.appendChild(iconDiv);
            var infoDiv = document.createElement('div');
            infoDiv.className = 'card-info';
            var nameSpan = document.createElement('span');
            nameSpan.className = 'card-name';
            nameSpan.textContent = card.name || '未命名';
            infoDiv.appendChild(nameSpan);
            if (card.description) {
                var descSpan = document.createElement('span');
                descSpan.className = 'card-desc';
                descSpan.textContent = card.description;
                infoDiv.appendChild(descSpan);
            }
            a.appendChild(infoDiv);
            cardsGrid.appendChild(a);
            visibleCount++;
        });
        section.appendChild(cardsGrid);
        container.appendChild(section);
    });
}

function filterCards(query) {
    var q = query.toLowerCase().trim();
    var filtered = [];
    allGroups.forEach(function(group) {
        var filteredCards = (group.cards || []).filter(function(card) {
            return (card.name || '').toLowerCase().indexOf(q) !== -1 || (card.description || '').toLowerCase().indexOf(q) !== -1 || (card.url || '').toLowerCase().indexOf(q) !== -1;
        });
        if (filteredCards.length > 0 || q === '') filtered.push({ name: group.name, cards: q === '' ? (group.cards || []) : filteredCards });
    });
    renderGroups(q === '' ? allGroups : filtered);
}

function performSearch() {
    var query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    var urls = { google: 'https://www.google.com/search?q=', baidu: 'https://www.baidu.com/s?wd=', bing: 'https://www.bing.com/search?q=', duckduckgo: 'https://duckduckgo.com/?q=' };
    window.open((urls[currentEngine] || urls['baidu']) + encodeURIComponent(query), '_blank');
}

function openAboutModal() {
    document.getElementById('infoIcon').textContent = 'ℹ️';
    document.getElementById('infoTitle').textContent = '关于本站';
    document.getElementById('infoBody').innerHTML = '加载中...';
    document.getElementById('infoModal').classList.add('active');
    fetch('about.md?t=' + Date.now())
        .then(function(res) { return res.text(); })
        .then(function(text) {
            document.getElementById('infoBody').innerHTML = marked.parse(text);
        })
        .catch(function() {
            document.getElementById('infoBody').innerHTML = '暂无关于信息。';
        });
}

function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('active');
}

let captchaObj = null;
let gtValidData = null;

function openFeedbackModal() {
    document.getElementById('feedbackContact').value = '';
    document.getElementById('feedbackContent').value = '';
    gtValidData = null;
    document.getElementById('feedbackModal').classList.add('active');
    if (enableGeetest) {
        setTimeout(function() {
            initFeedbackCaptcha();
        }, 300);
    }
}

function closeFeedbackModal() {
    document.getElementById('feedbackModal').classList.remove('active');
    if (captchaObj) captchaObj.reset();
    gtValidData = null;
}

function initFeedbackCaptcha() {
    if (!enableGeetest) return;
    const container = document.getElementById('gt4-captcha');
    container.innerHTML = '';
    captchaObj = null;
    gtValidData = null;

    initGeetest4({
        captchaId: geetestId
    }, function (instance) {
        captchaObj = instance;
        captchaObj.appendTo("#gt4-captcha");
        captchaObj.onSuccess(function () {
            gtValidData = captchaObj.getValidate();
        });
        captchaObj.onError(function (err) {
            console.error("GT4加载失败", err);
            alert("人机验证加载失败，请关闭广告拦截插件，刷新页面重试");
        });
    });
}

function submitFeedback() {
    const contact = document.getElementById('feedbackContact').value.trim();
    const content = document.getElementById('feedbackContent').value.trim();
    if (!content) {
        alert('请输入反馈内容');
        return;
    }
    if (enableGeetest) {
        if (!gtValidData) {
            alert('请先完成人机验证');
            return;
        }
    }
    const safeContact = contact.replace(/</g, '<').replace(/>/g, '&gt;');
    const safeContent = content.replace(/</g, '<').replace(/>/g, '&gt;');

    let postData = {
        action: 'submit_feedback',
        data: {
            contact: safeContact,
            content: safeContent
        }
    };
    if (enableGeetest && gtValidData) {
        postData.data.lot_number = gtValidData.lot_number;
        postData.data.captcha_output = gtValidData.captcha_output;
        postData.data.pass_token = gtValidData.pass_token;
        postData.data.gen_time = gtValidData.gen_time;
    }

    fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
    })
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            alert('感谢您的反馈！');
            closeFeedbackModal();
        } else {
            alert('提交失败：' + (res.message || '未知错误'));
            if (captchaObj) captchaObj.reset();
            gtValidData = null;
        }
    })
    .catch(() => {
        alert('网络错误，请稍后重试');
    });
}

document.getElementById('searchInput').addEventListener('input', function() { filterCards(this.value); });
document.getElementById('searchInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') performSearch(); });
document.getElementById('searchButton').addEventListener('click', performSearch);

document.getElementById('engineSelect').addEventListener('change', function(e) {
    currentEngine = this.value;
});

setInterval(rotatePlaceholder, 4000);
rotatePlaceholder();
loadSite();