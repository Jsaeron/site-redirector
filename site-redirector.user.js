// ==UserScript==
// @name         Site Redirector Pro
// @name:zh-CN   网站重定向助手
// @namespace    https://github.com/Jsaeron/site-redirector
// @version      1.6.5
// @description  Block distracting websites with a cooldown timer and redirect to productive sites
// @description:zh-CN  拦截分心网站，冷静倒计时后重定向到指定网站，帮助你保持专注
// @author       Daniel
// @license      MIT
// @homepage     https://github.com/Jsaeron/site-redirector
// @supportURL   https://github.com/Jsaeron/site-redirector/issues
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      v1.hitokoto.cn
// @connect      emojihub.yurace.pro
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ============ 配置区域 ============
    const DEFAULT_TARGET = 'https://claude.ai';
    const DEFAULT_BLACKLIST = ['bilibili.com', 'douyin.com', 'weibo.com', 'x.com'];
    const CONFIG = {
        target: GM_getValue('redirectTarget', DEFAULT_TARGET),  // 重定向目标（可通过菜单修改）
        cooldown: 30,                  // 冷静期秒数
        dailyQuotaMinutes: GM_getValue('dailyQuotaMinutes', 0), // 每日可访问分钟数（0=禁用）
        dailyQuotaVisits: GM_getValue('dailyQuotaVisits', 0)    // 每日可访问次数（0=禁用）
    };

    // 主题配置
    const THEMES = {
        dark: {
            bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            text: '#fff',
            textMuted: '#888',
            textHint: '#666',
            accent: '#e94560',
            quoteText: '#aaa',
            btnBorder: '#444',
            btnText: '#666',
            btnHoverBorder: '#888',
            btnHoverText: '#aaa',
            choiceTitle: '#aaa'
        },
        light: {
            bg: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            text: '#1a1a2e',
            textMuted: '#666',
            textHint: '#888',
            accent: '#e94560',
            quoteText: '#555',
            btnBorder: '#ccc',
            btnText: '#666',
            btnHoverBorder: '#999',
            btnHoverText: '#333',
            choiceTitle: '#555'
        }
    };

    // 获取当前主题模式
    function getThemeMode() {
        return GM_getValue('themeMode', 'auto');  // auto, light, dark
    }

    // 获取实际应用的主题
    function getActiveTheme() {
        const mode = getThemeMode();
        if (mode === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return mode;
    }

    const currentTheme = THEMES[getActiveTheme()];
    const DEBUG = GM_getValue('debugMode', false);

    function debugLog() {
        if (!DEBUG) {
            return;
        }
        console.log('[Site Redirector]', ...arguments);
    }

    // 随机标题文案（灵魂拷问 + 温和提醒）
    const TITLES = [
        // 灵魂拷问风格
        '这真的是你想要的吗？',
        '未来的你会感谢现在的决定',
        '此刻的选择，定义你的一天',
        '你的目标还记得吗？',
        '时间正在流逝...',
        '这是最好的时间利用方式吗？',
        '你确定不会后悔吗？',
        '想想你真正想成为的人',
        // 温和提醒风格
        '休息一下，想想再决定',
        '深呼吸，冷静一下',
        '给自己30秒思考时间',
        '暂停一下，整理思绪',
        '慢下来，听听内心的声音',
        '这是一个选择的时刻',
    ];
    const randomTitle = TITLES[Math.floor(Math.random() * TITLES.length)];

    function normalizeDomain(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .replace(/\/.*$/, '')
            .replace(/^\.+/, '')
            .replace(/\.+$/, '');
    }

    // 获取黑名单
    function getBlacklist() {
        const stored = GM_getValue('blacklist', DEFAULT_BLACKLIST);
        const list = Array.isArray(stored)
            ? stored
            : String(stored).split(/[,\n，；;]+/);
        const normalized = list.map(normalizeDomain).filter(s => s.length > 0);
        if (!Array.isArray(stored) || normalized.length !== stored.length) {
            GM_setValue('blacklist', normalized);
        }
        return normalized;
    }

    function getTodayStr() {
        return new Date().toISOString().slice(0, 10);
    }

    // 检查当前网站是否在黑名单中
    function isBlocked(hostname) {
        const blacklist = getBlacklist();
        const normalizedHostname = normalizeDomain(hostname);
        return blacklist.some(site => normalizedHostname === site || normalizedHostname.endsWith('.' + site));
    }

    function getQuotaUsageKey(dateStr, domain) {
        return `quotaUsage_${dateStr}_${domain}`;
    }

    function getQuotaVisitKey(dateStr, domain) {
        return `quotaVisits_${dateStr}_${domain}`;
    }

    function isQuotaEnabled() {
        return CONFIG.dailyQuotaMinutes > 0 || CONFIG.dailyQuotaVisits > 0;
    }

    function canAccessWithinQuota(domain) {
        if (!isQuotaEnabled()) {
            return false;
        }
        const todayStr = getTodayStr();
        const usedMinutes = GM_getValue(getQuotaUsageKey(todayStr, domain), 0);
        const usedVisits = GM_getValue(getQuotaVisitKey(todayStr, domain), 0);
        const minutesOk = CONFIG.dailyQuotaMinutes === 0 || usedMinutes < CONFIG.dailyQuotaMinutes;
        const visitsOk = CONFIG.dailyQuotaVisits === 0 || usedVisits < CONFIG.dailyQuotaVisits;
        return minutesOk && visitsOk;
    }

    function startQuotaSession(domain) {
        const todayStr = getTodayStr();
        const visitKey = getQuotaVisitKey(todayStr, domain);
        GM_setValue(visitKey, GM_getValue(visitKey, 0) + 1);

        let sessionMinutes = 0;
        const intervalId = setInterval(() => {
            sessionMinutes += 1;
            const usageKey = getQuotaUsageKey(todayStr, domain);
            GM_setValue(usageKey, GM_getValue(usageKey, 0) + 1);
        }, 60 * 1000);

        window.addEventListener('beforeunload', () => {
            clearInterval(intervalId);
        });
    }

    // ============ 早期退出检查 ============
    // 如果不在黑名单中，直接退出
    if (!isBlocked(location.hostname)) {
        return;
    }

    const normalizedDomain = normalizeDomain(location.hostname);
    if (canAccessWithinQuota(normalizedDomain)) {
        startQuotaSession(normalizedDomain);
        return;
    }

    // 检查临时绕过（选择继续摸鱼后 5 分钟内不再拦截）
    const bypassKey = 'bypass_' + location.hostname;
    const bypassExpire = GM_getValue(bypassKey, 0);
    if (Date.now() < bypassExpire) {
        return;  // 在绕过期内，不拦截
    }
    // =====================================

    // 注册菜单命令：设置重定向目标
    GM_registerMenuCommand('🎯 设置重定向目标', () => {
        const current = GM_getValue('redirectTarget', DEFAULT_TARGET);
        const newTarget = prompt('请输入重定向目标网址：', current);
        if (newTarget && newTarget.trim()) {
            try {
                new URL(newTarget.trim());  // 验证 URL 格式
                GM_setValue('redirectTarget', newTarget.trim());
                alert(`重定向目标已设置为：${newTarget.trim()}`);
            } catch (e) {
                alert('无效的网址格式，请输入完整的 URL（如 https://example.com）');
            }
        }
    });

    // 注册菜单命令：查看黑名单
    GM_registerMenuCommand('📋 查看黑名单', () => {
        const blacklist = getBlacklist();
        alert(`当前黑名单（${blacklist.length} 个网站）：\n\n${blacklist.join('\n')}`);
    });

    // 注册菜单命令：添加到黑名单
    GM_registerMenuCommand('➕ 添加网站到黑名单', () => {
        const site = prompt('请输入要拦截的域名（如 example.com）：', '');
        if (site && site.trim()) {
            const domain = normalizeDomain(site);
            const blacklist = getBlacklist();
            if (blacklist.includes(domain)) {
                alert(`${domain} 已在黑名单中`);
            } else {
                blacklist.push(domain);
                GM_setValue('blacklist', blacklist);
                alert(`已添加 ${domain} 到黑名单`);
            }
        }
    });

    // 注册菜单命令：从黑名单移除
    GM_registerMenuCommand('➖ 从黑名单移除网站', () => {
        const blacklist = getBlacklist();
        if (blacklist.length === 0) {
            alert('黑名单为空');
            return;
        }
        const site = prompt(`当前黑名单：\n${blacklist.join('\n')}\n\n请输入要移除的域名：`, '');
        if (site && site.trim()) {
            const domain = normalizeDomain(site);
            const index = blacklist.indexOf(domain);
            if (index > -1) {
                blacklist.splice(index, 1);
                GM_setValue('blacklist', blacklist);
                alert(`已从黑名单移除 ${domain}`);
            } else {
                alert(`${domain} 不在黑名单中`);
            }
        }
    });

    // 注册菜单命令：编辑完整黑名单
    GM_registerMenuCommand('✏️ 编辑完整黑名单', () => {
        const blacklist = getBlacklist();
        const input = prompt('编辑黑名单（每行一个域名，用换行或逗号分隔）：', blacklist.join(', '));
        if (input !== null) {
            const newList = input.split(/[,\n]/).map(normalizeDomain).filter(s => s.length > 0);
            GM_setValue('blacklist', newList);
            alert(`黑名单已更新，共 ${newList.length} 个网站`);
        }
    });

    // 注册菜单命令：设置每日配额
    GM_registerMenuCommand('⏱️ 设置每日配额', () => {
        const currentMinutes = GM_getValue('dailyQuotaMinutes', 0);
        const currentVisits = GM_getValue('dailyQuotaVisits', 0);
        const minutesInput = prompt('请输入每日可访问分钟数（0 表示禁用）：', currentMinutes);
        if (minutesInput === null) {
            return;
        }
        const visitsInput = prompt('请输入每日可访问次数（0 表示禁用）：', currentVisits);
        if (visitsInput === null) {
            return;
        }
        const minutesValue = Math.max(0, parseInt(minutesInput, 10) || 0);
        const visitsValue = Math.max(0, parseInt(visitsInput, 10) || 0);
        GM_setValue('dailyQuotaMinutes', minutesValue);
        GM_setValue('dailyQuotaVisits', visitsValue);
        alert(`每日配额已更新：分钟数 ${minutesValue} / 次数 ${visitsValue}`);
    });

    // 注册菜单命令：重置黑名单
    GM_registerMenuCommand('🔙 重置为默认黑名单', () => {
        if (confirm(`确定要重置黑名单为默认设置吗？\n\n默认黑名单：\n${DEFAULT_BLACKLIST.join('\n')}`)) {
            GM_setValue('blacklist', DEFAULT_BLACKLIST);
            alert('黑名单已重置为默认设置');
        }
    });

    // 注册菜单命令：重置计数
    GM_registerMenuCommand('🔄 重置拦截计数', () => {
        GM_setValue('blockCount', 0);
        alert('拦截计数已重置！');
    });

    // 注册菜单命令：查看统计
    GM_registerMenuCommand('📊 查看拦截统计', () => {
        const total = GM_getValue('blockCount', 0);
        const todayStr = getTodayStr();
        const todayTotal = GM_getValue('blockCount_' + todayStr, 0);
        const target = GM_getValue('redirectTarget', DEFAULT_TARGET);
        const blacklist = getBlacklist();
        const themeMode = getThemeMode();
        const themeModeText = { auto: '跟随系统', light: '明亮模式', dark: '暗黑模式' }[themeMode];
        const quotaMinutes = GM_getValue('dailyQuotaMinutes', 0);
        const quotaVisits = GM_getValue('dailyQuotaVisits', 0);
        const quotaText = quotaMinutes || quotaVisits ? `${quotaMinutes} 分钟 / ${quotaVisits} 次` : '未启用';
        alert(`今日拦截次数：${todayTotal}\n累计拦截次数：${total}\n当前重定向目标：${target}\n黑名单网站数：${blacklist.length}\n每日配额：${quotaText}\n当前主题：${themeModeText}`);
    });

    // 注册菜单命令：查看本周趋势
    GM_registerMenuCommand('📈 查看本周趋势', () => {
        const days = [];
        const hourlyTotals = Array(24).fill(0);
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().slice(0, 10);
            const count = GM_getValue('blockCount_' + dateStr, 0);
            days.push(`${dateStr}: ${count}`);
            const hourlyKey = 'blockHours_' + dateStr;
            const hourlyCounts = GM_getValue(hourlyKey, []);
            for (let h = 0; h < 24; h++) {
                hourlyTotals[h] += hourlyCounts[h] || 0;
            }
        }
        const peakHour = hourlyTotals.indexOf(Math.max(...hourlyTotals));
        alert(`近7天拦截趋势：\n${days.join('\n')}\n\n高峰时段：${peakHour}:00 - ${peakHour + 1}:00`);
    });

    // 注册菜单命令：站点排行
    GM_registerMenuCommand('🏆 查看站点排行', () => {
        const siteCounts = GM_getValue('blockCountBySite', {});
        const entries = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            alert('暂无站点拦截排行数据');
            return;
        }
        const topList = entries.slice(0, 10).map(([site, count], index) => `${index + 1}. ${site} - ${count} 次`);
        alert(`被拦截最多的站点排行：\n${topList.join('\n')}`);
    });

    // 注册菜单命令：切换主题
    GM_registerMenuCommand('🎨 切换主题模式', () => {
        const current = getThemeMode();
        const modes = ['auto', 'light', 'dark'];
        const labels = { auto: '跟随系统', light: '明亮模式', dark: '暗黑模式' };
        const currentLabel = labels[current];
        const choice = prompt(`当前主题：${currentLabel}\n\n请输入主题模式：\n1. auto - 跟随系统\n2. light - 明亮模式\n3. dark - 暗黑模式\n\n输入 1、2、3 或 auto、light、dark：`, current);
        if (choice !== null) {
            let newMode = choice.trim().toLowerCase();
            if (newMode === '1') newMode = 'auto';
            else if (newMode === '2') newMode = 'light';
            else if (newMode === '3') newMode = 'dark';
            if (modes.includes(newMode)) {
                GM_setValue('themeMode', newMode);
                alert(`主题已切换为：${labels[newMode]}\n刷新页面后生效`);
            } else {
                alert('无效的选择');
            }
        }
    });

    // 更新拦截计数
    const totalCount = GM_getValue('blockCount', 0) + 1;
    GM_setValue('blockCount', totalCount);

    // 更新今日计数
    const today = getTodayStr();  // YYYY-MM-DD
    const todayKey = 'blockCount_' + today;
    const todayCount = GM_getValue(todayKey, 0) + 1;
    GM_setValue(todayKey, todayCount);

    // 更新每小时计数
    const hour = new Date().getHours();
    const hourKey = 'blockHours_' + today;
    const hourCounts = GM_getValue(hourKey, Array(24).fill(0));
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    GM_setValue(hourKey, hourCounts);

    // 更新站点计数
    const siteCounts = GM_getValue('blockCountBySite', {});
    siteCounts[normalizedDomain] = (siteCounts[normalizedDomain] || 0) + 1;
    GM_setValue('blockCountBySite', siteCounts);

    function renderBlockPage(onMounted) {
        const styles = `
            #site-redirector-root, #site-redirector-root * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            html[data-site-redirector-active="1"], body[data-site-redirector-active="1"] {
                width: 100%;
                min-height: 100%;
                overflow: hidden !important;
            }
            #site-redirector-root {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${currentTheme.bg};
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: ${currentTheme.text};
            }
            .container { text-align: center; padding: 20px; }
            .icon { font-size: 64px; margin-bottom: 20px; }
            .title { font-size: 28px; font-weight: 600; margin-bottom: 10px; }
            .subtitle { color: ${currentTheme.accent}; margin-bottom: 8px; font-size: 14px; }
            .count { color: ${currentTheme.textMuted}; margin-bottom: 40px; }
            .timer {
                font-size: 72px;
                font-weight: 700;
                color: ${currentTheme.accent};
                margin-bottom: 20px;
                font-variant-numeric: tabular-nums;
            }
            .hint { color: ${currentTheme.textHint}; font-size: 14px; }
            .quote-container { margin-top: 40px; padding: 20px; max-width: 500px; }
            .quote-text { color: ${currentTheme.quoteText}; font-size: 16px; font-style: italic; line-height: 1.6; }
            .quote-source { color: ${currentTheme.textHint}; font-size: 12px; margin-top: 10px; }
            .actions { margin-top: 30px; display: flex; gap: 12px; justify-content: center; }
            .btn {
                padding: 10px 24px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 14px;
            }
            .btn-primary {
                background: ${currentTheme.accent};
                border: none;
                color: #fff;
            }
            .btn-primary:hover { background: #d63850; }
            .btn-secondary {
                background: transparent;
                border: 1px solid ${currentTheme.btnBorder};
                color: ${currentTheme.btnText};
            }
            .btn-secondary:hover { border-color: ${currentTheme.btnHoverBorder}; color: ${currentTheme.btnHoverText}; }
            .choice-container { display: none; margin-top: 30px; }
            .choice-title { font-size: 20px; margin-bottom: 20px; color: ${currentTheme.choiceTitle}; }
            .pills { display: flex; gap: 30px; justify-content: center; }
            .pill {
                padding: 20px 40px;
                border-radius: 30px;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 16px;
                font-weight: 600;
                border: none;
                min-width: 160px;
            }
            .pill-blue {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #fff;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            }
            .pill-blue:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6); }
            .pill-red {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: #fff;
                box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
            }
            .pill-red:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(245, 87, 108, 0.6); }
            .pill-label { display: block; font-size: 12px; margin-top: 5px; opacity: 0.8; font-weight: normal; }
        `;
        const content = `
            <div class="container">
                <div class="icon" id="random-emoji"></div>
                <div class="title">${randomTitle}</div>
                <div class="subtitle">${location.hostname}</div>
                <div class="count">今日第 <strong>${todayCount}</strong> 次 / 累计第 <strong>${totalCount}</strong> 次被拦截</div>
                <div class="timer" id="countdown">${CONFIG.cooldown}</div>
                <div class="hint" id="hint">${CONFIG.cooldown}秒冷静期后做出你的选择</div>
                <div class="actions" id="actions">
                    <button class="btn btn-secondary" id="skip">算了，回去干活</button>
                </div>
                <div class="choice-container" id="choice">
                    <div class="choice-title">冷静期结束，做出你的选择</div>
                    <div class="pills">
                        <button class="pill pill-blue" id="blue-pill">
                            💼 回去干活
                            <span class="pill-label">前往工作页面</span>
                        </button>
                        <button class="pill pill-red" id="red-pill">
                            🎮 就要摸鱼
                            <span class="pill-label">继续访问此网站</span>
                        </button>
                    </div>
                </div>
                <div class="quote-container">
                    <div class="quote-text" id="quote">加载中...</div>
                    <div class="quote-source" id="quote-source"></div>
                </div>
            </div>
        `;

        function mount() {
            if (!document.documentElement) {
                return false;
            }

            let head = document.head;
            if (!head) {
                return false;
            }

            let styleEl = document.getElementById('site-redirector-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'site-redirector-style';
                head.appendChild(styleEl);
            }
            styleEl.textContent = styles;

            let body = document.body;
            if (!body) {
                return false;
            }

            let root = document.getElementById('site-redirector-root');
            if (!root) {
                root = document.createElement('div');
                root.id = 'site-redirector-root';
                body.appendChild(root);
            }
            root.innerHTML = content;
            document.title = 'Site Redirector Pro';
            body.setAttribute('data-site-redirector-active', '1');
            document.documentElement.setAttribute('data-site-redirector-active', '1');
            debugLog('block page mounted', {
                readyState: document.readyState,
                hostname: location.hostname
            });
            if (onMounted) onMounted();
            return true;
        }

        if (mount()) {
            return;
        }

        const observer = new MutationObserver(() => {
            if (mount()) {
                observer.disconnect();
            }
        });
        observer.observe(document, { childList: true, subtree: true });

        window.addEventListener('DOMContentLoaded', () => {
            if (mount()) {
                observer.disconnect();
            }
        }, { once: true });

        debugLog('waiting for DOM to mount block page', {
            readyState: document.readyState,
            hostname: location.hostname
        });
    }

    // 挂载成功后才设置倒计时和事件监听，避免 document-start 时 DOM 未就绪导致 null 引用崩溃
    renderBlockPage(function setupInteractions() {
        // 防止网站自身 JS（React/Vue hydration 等）替换 body 后 overlay 消失
        // 保存元素引用，直接 re-append 而不重新初始化（避免重复绑定事件/重置计时器）
        const rootEl = document.getElementById('site-redirector-root');
        const styleEl = document.getElementById('site-redirector-style');
        const remountObserver = new MutationObserver(() => {
            if (!document.contains(rootEl)) {
                debugLog('overlay removed by site JS, re-appending');
                if (styleEl && !document.contains(styleEl)) {
                    document.head.appendChild(styleEl);
                }
                document.body.appendChild(rootEl);
                document.body.setAttribute('data-site-redirector-active', '1');
            }
        });
        remountObserver.observe(document.body, { childList: true, subtree: false });

        GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://emojihub.yurace.pro/api/random',
        onload: function(response) {
            const emojiEl = document.getElementById('random-emoji');
            if (!emojiEl) {
                return;
            }
            try {
                const data = JSON.parse(response.responseText);
                if (data && Array.isArray(data.htmlCode) && data.htmlCode[0]) {
                    emojiEl.innerHTML = data.htmlCode[0];
                } else if (data && typeof data.emoji === 'string') {
                    emojiEl.textContent = data.emoji;
                } else {
                    emojiEl.textContent = '🛑';
                }
            } catch (e) {
                emojiEl.textContent = '🛑';
            }
        },
        onerror: function() {
            const emojiEl = document.getElementById('random-emoji');
            if (emojiEl) {
                emojiEl.textContent = '🛑';
            }
        }
    });

    // 获取一言语录
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://v1.hitokoto.cn/?c=d&c=h&c=i&c=k',  // d=哲学, h=影视, i=诗词, k=网易云热评
        onload: function(response) {
            try {
                const data = JSON.parse(response.responseText);
                document.getElementById('quote').textContent = `「${data.hitokoto}」`;
                const source = data.from_who ? `—— ${data.from_who}「${data.from}」` : `—— ${data.from}`;
                document.getElementById('quote-source').textContent = source;
            } catch (e) {
                document.getElementById('quote').textContent = '「自律给我自由」';
                document.getElementById('quote-source').textContent = '—— 康德';
            }
        },
        onerror: function() {
            document.getElementById('quote').textContent = '「你的时间有限，不要浪费在别人的生活里」';
            document.getElementById('quote-source').textContent = '—— 乔布斯';
        }
    });

    // 倒计时
    let remaining = CONFIG.cooldown;
    const countdownEl = document.getElementById('countdown');
    const timer = setInterval(() => {
        remaining--;
        countdownEl.textContent = remaining;
        if (remaining <= 0) {
            clearInterval(timer);
            showChoice();
        }
    }, 1000);

    // 显示选择界面
    function showChoice() {
        document.getElementById('countdown').textContent = '⏰';
        document.getElementById('hint').textContent = '时间到！做出你的选择';
        document.getElementById('actions').style.display = 'none';
        document.getElementById('choice').style.display = 'block';
    }

    // 直接跳转按钮（冷静期内）
    document.getElementById('skip').addEventListener('click', () => {
        clearInterval(timer);
        window.location.replace(CONFIG.target);
    });

    // 蓝色药丸：回去干活
    document.getElementById('blue-pill').addEventListener('click', () => {
        window.location.replace(CONFIG.target);
    });

    // 红色药丸：继续摸鱼（设置 5 分钟绕过）
    document.getElementById('red-pill').addEventListener('click', () => {
        const bypassKey = 'bypass_' + location.hostname;
        GM_setValue(bypassKey, Date.now() + 5 * 60 * 1000);  // 5 分钟后过期
        location.reload();
    });
    }); // end renderBlockPage callback
})();
