// ==UserScript==
// @name         Site Redirector Pro
// @name:zh-CN   网站重定向助手
// @namespace    https://github.com/Jsaeron/site-redirector
// @version      1.7.0
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

    const STORAGE = {
        redirectTarget: 'redirectTarget',
        blacklist: 'blacklist',
        blockCount: 'blockCount',
        blockCountBySite: 'blockCountBySite',
        dailyQuotaMinutes: 'dailyQuotaMinutes',
        dailyQuotaVisits: 'dailyQuotaVisits',
        themeMode: 'themeMode',
        debugMode: 'debugMode',
        forceMode: 'forceMode',
        bypassReasonLog: 'bypassReasonLog'
    };

    const DEFAULTS = {
        target: 'https://claude.ai',
        blacklist: ['bilibili.com', 'douyin.com', 'weibo.com', 'x.com'],
        cooldown: 30,
        bypassMs: 5 * 60 * 1000
    };

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

    const TITLES = [
        '这真的是你想要的吗？',
        '未来的你会感谢现在的决定',
        '此刻的选择，定义你的一天',
        '你的目标还记得吗？',
        '时间正在流逝...',
        '这是最好的时间利用方式吗？',
        '你确定不会后悔吗？',
        '想想你真正想成为的人',
        '休息一下，想想再决定',
        '深呼吸，冷静一下',
        '给自己30秒思考时间',
        '暂停一下，整理思绪',
        '慢下来，听听内心的声音',
        '这是一个选择的时刻'
    ];

    const BLOCK_PAGE_TITLE = 'Site Redirector Pro';
    const ROOT_ID = 'site-redirector-root';
    const STYLE_ID = 'site-redirector-style';
    const ACTIVE_ATTR = 'data-site-redirector-active';
    const SESSION_PREFIX = 'blockSession_';
    const BYPASS_PREFIX = 'bypass_';
    const REASONS = ['逃避任务', '无聊', '习惯性打开', '想看一眼', '社交回复', '其他'];
    const normalizedDomain = normalizeDomain(location.hostname);
    const debugEnabled = GM_getValue(STORAGE.debugMode, false);

    function logDebug() {
        if (!debugEnabled) {
            return;
        }
        console.log('[Site Redirector]', ...arguments);
    }

    function normalizeDomain(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .replace(/\/.*$/, '')
            .replace(/^\.+/, '')
            .replace(/\.+$/, '');
    }

    function getTodayStr() {
        return new Date().toISOString().slice(0, 10);
    }

    function getRandomTitle() {
        return TITLES[Math.floor(Math.random() * TITLES.length)];
    }

    function getThemeMode() {
        return GM_getValue(STORAGE.themeMode, 'auto');
    }

    function getActiveThemeName() {
        const mode = getThemeMode();
        if (mode === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return mode;
    }

    function getTheme() {
        return THEMES[getActiveThemeName()];
    }

    function getTarget() {
        return GM_getValue(STORAGE.redirectTarget, DEFAULTS.target);
    }

    function getDailyQuotaMinutes() {
        return GM_getValue(STORAGE.dailyQuotaMinutes, 0);
    }

    function getDailyQuotaVisits() {
        return GM_getValue(STORAGE.dailyQuotaVisits, 0);
    }

    function getBlacklist() {
        const stored = GM_getValue(STORAGE.blacklist, DEFAULTS.blacklist);
        const list = Array.isArray(stored) ? stored : String(stored).split(/[,\n，；;]+/);
        const normalized = list.map(normalizeDomain).filter(Boolean);
        if (!Array.isArray(stored) || normalized.length !== stored.length) {
            GM_setValue(STORAGE.blacklist, normalized);
        }
        return normalized;
    }

    function isBlockedDomain(hostname) {
        const current = normalizeDomain(hostname);
        return getBlacklist().some(site => current === site || current.endsWith('.' + site));
    }

    function getQuotaUsageKey(dateStr, domain) {
        return `quotaUsage_${dateStr}_${domain}`;
    }

    function getQuotaVisitKey(dateStr, domain) {
        return `quotaVisits_${dateStr}_${domain}`;
    }

    function isQuotaEnabled() {
        return getDailyQuotaMinutes() > 0 || getDailyQuotaVisits() > 0;
    }

    function canAccessWithinQuota(domain) {
        if (!isQuotaEnabled()) {
            return false;
        }
        const today = getTodayStr();
        const usedMinutes = GM_getValue(getQuotaUsageKey(today, domain), 0);
        const usedVisits = GM_getValue(getQuotaVisitKey(today, domain), 0);
        const minutesLimit = getDailyQuotaMinutes();
        const visitsLimit = getDailyQuotaVisits();
        const minutesOk = minutesLimit === 0 || usedMinutes < minutesLimit;
        const visitsOk = visitsLimit === 0 || usedVisits < visitsLimit;
        return minutesOk && visitsOk;
    }

    function startQuotaSession(domain) {
        const today = getTodayStr();
        const visitKey = getQuotaVisitKey(today, domain);
        GM_setValue(visitKey, GM_getValue(visitKey, 0) + 1);

        const timer = window.setInterval(() => {
            const usageKey = getQuotaUsageKey(today, domain);
            GM_setValue(usageKey, GM_getValue(usageKey, 0) + 1);
        }, 60 * 1000);

        window.addEventListener('beforeunload', () => {
            clearInterval(timer);
        }, { once: true });
    }

    function getBypassKey(hostname) {
        return BYPASS_PREFIX + normalizeDomain(hostname);
    }

    function isBypassed(hostname) {
        return Date.now() < GM_getValue(getBypassKey(hostname), 0);
    }

    function getBlockSessionKey(domain) {
        return SESSION_PREFIX + domain;
    }

    function getBlockSession(domain) {
        const session = GM_getValue(getBlockSessionKey(domain), null);
        if (!session || typeof session !== 'object') {
            return null;
        }
        if (session.expiresAt <= Date.now()) {
            GM_setValue(getBlockSessionKey(domain), null);
            return null;
        }
        return session;
    }

    function startOrRefreshBlockSession(domain) {
        const existing = getBlockSession(domain);
        if (existing) {
            return existing;
        }
        const session = {
            startedAt: Date.now(),
            expiresAt: Date.now() + DEFAULTS.cooldown * 1000
        };
        GM_setValue(getBlockSessionKey(domain), session);
        return session;
    }

    function clearBlockSession(domain) {
        GM_setValue(getBlockSessionKey(domain), null);
    }

    function isForceModeEnabled() {
        return GM_getValue(STORAGE.forceMode, false);
    }

    function getBypassReasonLog() {
        const log = GM_getValue(STORAGE.bypassReasonLog, []);
        return Array.isArray(log) ? log : [];
    }

    function recordBypassReason(domain, reason) {
        const log = getBypassReasonLog();
        log.push({
            ts: Date.now(),
            date: getTodayStr(),
            domain,
            reason: reason || '其他'
        });
        GM_setValue(STORAGE.bypassReasonLog, log.slice(-500));
    }

    function getPastDateStr(offsetDays) {
        const date = new Date();
        date.setDate(date.getDate() - offsetDays);
        return date.toISOString().slice(0, 10);
    }

    function getRecentBypassReasons(days) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return getBypassReasonLog().filter(item => item && item.ts >= cutoff);
    }

    function getFocusStreakDays() {
        const log = getBypassReasonLog();
        if (log.length === 0) {
            return 0;
        }
        let streak = 0;
        const bypassDates = new Set(log.map(item => item.date));
        for (let i = 0; i < 365; i++) {
            const dateStr = getPastDateStr(i);
            if (bypassDates.has(dateStr)) {
                break;
            }
            streak += 1;
        }
        return streak;
    }

    function getAchievementText(stats, streakDays) {
        if (isForceModeEnabled()) {
            return '硬核模式已开启';
        }
        if (streakDays >= 14) {
            return '连续专注两周';
        }
        if (streakDays >= 7) {
            return '连续专注一周';
        }
        if (stats.todayCount <= 1) {
            return '今天控制得很好';
        }
        if (stats.todayCount <= 3) {
            return '今天还在掌控范围';
        }
        return '先把今天稳住';
    }

    function getWeeklySummary() {
        const days = [];
        const hourlyTotals = Array(24).fill(0);
        const siteTotals = {};
        for (let i = 6; i >= 0; i--) {
            const dateStr = getPastDateStr(i);
            const count = GM_getValue('blockCount_' + dateStr, 0);
            days.push({ date: dateStr, count });
            const hourCounts = GM_getValue('blockHours_' + dateStr, []);
            for (let hour = 0; hour < 24; hour++) {
                hourlyTotals[hour] += hourCounts[hour] || 0;
            }
            const daySites = GM_getValue('blockCountBySite_' + dateStr, {});
            Object.entries(daySites).forEach(([site, count]) => {
                siteTotals[site] = (siteTotals[site] || 0) + count;
            });
        }

        const reasons = {};
        getRecentBypassReasons(7).forEach((item) => {
            reasons[item.reason] = (reasons[item.reason] || 0) + 1;
        });

        const topHour = hourlyTotals.indexOf(Math.max(...hourlyTotals));
        const topSites = Object.entries(siteTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const topReasons = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const weeklyBlocks = days.reduce((sum, item) => sum + item.count, 0);
        const streakDays = getFocusStreakDays();

        return {
            days,
            topHour,
            topSites,
            topReasons,
            weeklyBlocks,
            streakDays
        };
    }

    function isIncognitoContext() {
        return Boolean(window.chrome && chrome.extension && chrome.extension.inIncognitoContext);
    }

    function incrementBlockStats(domain) {
        const today = getTodayStr();
        const totalCount = GM_getValue(STORAGE.blockCount, 0) + 1;
        GM_setValue(STORAGE.blockCount, totalCount);

        const todayKey = 'blockCount_' + today;
        const todayCount = GM_getValue(todayKey, 0) + 1;
        GM_setValue(todayKey, todayCount);

        const hourKey = 'blockHours_' + today;
        const hourCounts = GM_getValue(hourKey, Array(24).fill(0));
        const hour = new Date().getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        GM_setValue(hourKey, hourCounts);

        const siteCounts = GM_getValue(STORAGE.blockCountBySite, {});
        siteCounts[domain] = (siteCounts[domain] || 0) + 1;
        GM_setValue(STORAGE.blockCountBySite, siteCounts);

        const dailySiteKey = 'blockCountBySite_' + today;
        const dailySiteCounts = GM_getValue(dailySiteKey, {});
        dailySiteCounts[domain] = (dailySiteCounts[domain] || 0) + 1;
        GM_setValue(dailySiteKey, dailySiteCounts);

        return {
            totalCount,
            todayCount
        };
    }

    function fetchJson(url, onSuccess, fallback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload(response) {
                try {
                    onSuccess(JSON.parse(response.responseText));
                } catch (error) {
                    fallback();
                }
            },
            onerror() {
                fallback();
            }
        });
    }

    function registerMenuCommands() {
        GM_registerMenuCommand('🎯 设置重定向目标', () => {
            const current = getTarget();
            const input = prompt('请输入重定向目标网址：', current);
            if (!input || !input.trim()) {
                return;
            }
            try {
                const url = new URL(input.trim());
                GM_setValue(STORAGE.redirectTarget, url.toString());
                alert(`重定向目标已设置为：${url.toString()}`);
            } catch (error) {
                alert('无效的网址格式，请输入完整的 URL（如 https://example.com）');
            }
        });

        GM_registerMenuCommand('📋 查看黑名单', () => {
            const blacklist = getBlacklist();
            alert(`当前黑名单（${blacklist.length} 个网站）：\n\n${blacklist.join('\n')}`);
        });

        GM_registerMenuCommand('➕ 添加网站到黑名单', () => {
            const input = prompt('请输入要拦截的域名（如 example.com）：', '');
            if (!input || !input.trim()) {
                return;
            }
            const domain = normalizeDomain(input);
            const blacklist = getBlacklist();
            if (blacklist.includes(domain)) {
                alert(`${domain} 已在黑名单中`);
                return;
            }
            blacklist.push(domain);
            GM_setValue(STORAGE.blacklist, blacklist);
            alert(`已添加 ${domain} 到黑名单`);
        });

        GM_registerMenuCommand('➖ 从黑名单移除网站', () => {
            const blacklist = getBlacklist();
            if (blacklist.length === 0) {
                alert('黑名单为空');
                return;
            }
            const input = prompt(`当前黑名单：\n${blacklist.join('\n')}\n\n请输入要移除的域名：`, '');
            if (!input || !input.trim()) {
                return;
            }
            const domain = normalizeDomain(input);
            const next = blacklist.filter(site => site !== domain);
            if (next.length === blacklist.length) {
                alert(`${domain} 不在黑名单中`);
                return;
            }
            GM_setValue(STORAGE.blacklist, next);
            alert(`已从黑名单移除 ${domain}`);
        });

        GM_registerMenuCommand('✏️ 编辑完整黑名单', () => {
            const blacklist = getBlacklist();
            const input = prompt('编辑黑名单（每行一个域名，用换行或逗号分隔）：', blacklist.join(', '));
            if (input === null) {
                return;
            }
            const next = input.split(/[,\n，；;]+/).map(normalizeDomain).filter(Boolean);
            GM_setValue(STORAGE.blacklist, next);
            alert(`黑名单已更新，共 ${next.length} 个网站`);
        });

        GM_registerMenuCommand('🔙 重置为默认黑名单', () => {
            if (!confirm(`确定要重置黑名单为默认设置吗？\n\n默认黑名单：\n${DEFAULTS.blacklist.join('\n')}`)) {
                return;
            }
            GM_setValue(STORAGE.blacklist, DEFAULTS.blacklist.slice());
            alert('黑名单已重置为默认设置');
        });

        GM_registerMenuCommand('⏱️ 设置每日配额', () => {
            const minutesInput = prompt('请输入每日可访问分钟数（0 表示禁用）：', getDailyQuotaMinutes());
            if (minutesInput === null) {
                return;
            }
            const visitsInput = prompt('请输入每日可访问次数（0 表示禁用）：', getDailyQuotaVisits());
            if (visitsInput === null) {
                return;
            }
            const minutesValue = Math.max(0, parseInt(minutesInput, 10) || 0);
            const visitsValue = Math.max(0, parseInt(visitsInput, 10) || 0);
            GM_setValue(STORAGE.dailyQuotaMinutes, minutesValue);
            GM_setValue(STORAGE.dailyQuotaVisits, visitsValue);
            alert(`每日配额已更新：分钟数 ${minutesValue} / 次数 ${visitsValue}`);
        });

        GM_registerMenuCommand('🔄 重置拦截计数', () => {
            GM_setValue(STORAGE.blockCount, 0);
            GM_setValue(STORAGE.blockCountBySite, {});
            alert('拦截计数已重置！');
        });

        GM_registerMenuCommand('📊 查看拦截统计', () => {
            const today = getTodayStr();
            const total = GM_getValue(STORAGE.blockCount, 0);
            const todayTotal = GM_getValue('blockCount_' + today, 0);
            const themeMode = getThemeMode();
            const themeLabel = { auto: '跟随系统', light: '明亮模式', dark: '暗黑模式' }[themeMode];
            const quotaMinutes = getDailyQuotaMinutes();
            const quotaVisits = getDailyQuotaVisits();
            const quotaText = quotaMinutes || quotaVisits ? `${quotaMinutes} 分钟 / ${quotaVisits} 次` : '未启用';
            alert(`今日拦截次数：${todayTotal}\n累计拦截次数：${total}\n当前重定向目标：${getTarget()}\n黑名单网站数：${getBlacklist().length}\n每日配额：${quotaText}\n当前主题：${themeLabel}`);
        });

        GM_registerMenuCommand('📈 查看本周趋势', () => {
            const days = [];
            const hourlyTotals = Array(24).fill(0);
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().slice(0, 10);
                const dayCount = GM_getValue('blockCount_' + dateStr, 0);
                days.push(`${dateStr}: ${dayCount}`);
                const hourCounts = GM_getValue('blockHours_' + dateStr, []);
                for (let hour = 0; hour < 24; hour++) {
                    hourlyTotals[hour] += hourCounts[hour] || 0;
                }
            }
            const peakHour = hourlyTotals.indexOf(Math.max(...hourlyTotals));
            alert(`近7天拦截趋势：\n${days.join('\n')}\n\n高峰时段：${peakHour}:00 - ${peakHour + 1}:00`);
        });

        GM_registerMenuCommand('🧠 查看专注周报', () => {
            const summary = getWeeklySummary();
            const topSites = summary.topSites.length
                ? summary.topSites.map(([site, count], index) => `${index + 1}. ${site} - ${count} 次`).join('\n')
                : '暂无数据';
            const topReasons = summary.topReasons.length
                ? summary.topReasons.map(([reason, count], index) => `${index + 1}. ${reason} - ${count} 次`).join('\n')
                : '暂无摸鱼放行记录';
            alert(
                `近7天累计拦截：${summary.weeklyBlocks} 次\n` +
                `最容易分心时段：${summary.topHour}:00 - ${summary.topHour + 1}:00\n` +
                `连续专注天数：${summary.streakDays} 天\n\n` +
                `最容易分心的站点：\n${topSites}\n\n` +
                `继续摸鱼原因：\n${topReasons}`
            );
        });

        GM_registerMenuCommand('🏆 查看站点排行', () => {
            const siteCounts = GM_getValue(STORAGE.blockCountBySite, {});
            const entries = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]);
            if (entries.length === 0) {
                alert('暂无站点拦截排行数据');
                return;
            }
            const topList = entries.slice(0, 10).map(([site, count], index) => `${index + 1}. ${site} - ${count} 次`);
            alert(`被拦截最多的站点排行：\n${topList.join('\n')}`);
        });

        GM_registerMenuCommand('🎨 切换主题模式', () => {
            const current = getThemeMode();
            const labels = { auto: '跟随系统', light: '明亮模式', dark: '暗黑模式' };
            const input = prompt(`当前主题：${labels[current]}\n\n请输入主题模式：\n1. auto - 跟随系统\n2. light - 明亮模式\n3. dark - 暗黑模式\n\n输入 1、2、3 或 auto、light、dark：`, current);
            if (input === null) {
                return;
            }
            let next = input.trim().toLowerCase();
            if (next === '1') next = 'auto';
            else if (next === '2') next = 'light';
            else if (next === '3') next = 'dark';
            if (!['auto', 'light', 'dark'].includes(next)) {
                alert('无效的选择');
                return;
            }
            GM_setValue(STORAGE.themeMode, next);
            alert(`主题已切换为：${labels[next]}\n刷新页面后生效`);
        });

        GM_registerMenuCommand('🔒 切换强制模式', () => {
            const next = !isForceModeEnabled();
            GM_setValue(STORAGE.forceMode, next);
            alert(next ? '强制模式已开启：冷静期内不能直接跳走，倒计时结束后也不能选择继续摸鱼。' : '强制模式已关闭');
        });
    }

    function createStyles(theme) {
        return `
            html[${ACTIVE_ATTR}="1"], body[${ACTIVE_ATTR}="1"] {
                overflow: hidden !important;
            }
            #${ROOT_ID}, #${ROOT_ID} * {
                box-sizing: border-box;
            }
            #${ROOT_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: ${theme.bg};
                color: ${theme.text};
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                text-align: center;
            }
            #${ROOT_ID} .sr-container {
                width: min(100%, 720px);
            }
            #${ROOT_ID} .sr-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }
            #${ROOT_ID} .sr-title {
                font-size: 28px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            #${ROOT_ID} .sr-subtitle {
                color: ${theme.accent};
                margin-bottom: 8px;
                font-size: 14px;
            }
            #${ROOT_ID} .sr-count {
                color: ${theme.textMuted};
                margin-bottom: 18px;
            }
            #${ROOT_ID} .sr-meta {
                color: ${theme.textHint};
                font-size: 13px;
                margin-bottom: 22px;
                line-height: 1.7;
            }
            #${ROOT_ID} .sr-warning {
                color: ${theme.accent};
                font-size: 13px;
                margin-bottom: 16px;
            }
            #${ROOT_ID} .sr-timer {
                font-size: 72px;
                font-weight: 700;
                color: ${theme.accent};
                margin-bottom: 20px;
                font-variant-numeric: tabular-nums;
            }
            #${ROOT_ID} .sr-hint {
                color: ${theme.textHint};
                font-size: 14px;
            }
            #${ROOT_ID} .sr-actions {
                margin-top: 30px;
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            #${ROOT_ID} .sr-btn {
                padding: 10px 24px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 14px;
            }
            #${ROOT_ID} .sr-btn-secondary {
                background: transparent;
                border: 1px solid ${theme.btnBorder};
                color: ${theme.btnText};
            }
            #${ROOT_ID} .sr-btn-secondary:hover {
                border-color: ${theme.btnHoverBorder};
                color: ${theme.btnHoverText};
            }
            #${ROOT_ID} .sr-choice {
                display: none;
                margin-top: 30px;
            }
            #${ROOT_ID} .sr-choice-title {
                font-size: 20px;
                margin-bottom: 20px;
                color: ${theme.choiceTitle};
            }
            #${ROOT_ID} .sr-pills {
                display: flex;
                gap: 30px;
                justify-content: center;
                flex-wrap: wrap;
            }
            #${ROOT_ID} .sr-pill {
                padding: 20px 40px;
                border-radius: 30px;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 16px;
                font-weight: 600;
                border: none;
                min-width: 160px;
                color: #fff;
            }
            #${ROOT_ID} .sr-pill-blue {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            }
            #${ROOT_ID} .sr-pill-blue:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            #${ROOT_ID} .sr-pill-red {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
            }
            #${ROOT_ID} .sr-pill-red:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 20px rgba(245, 87, 108, 0.6);
            }
            #${ROOT_ID} .sr-pill-label {
                display: block;
                font-size: 12px;
                margin-top: 5px;
                opacity: 0.8;
                font-weight: normal;
            }
            #${ROOT_ID} .sr-quote-wrap {
                margin-top: 40px;
                padding: 20px;
                max-width: 500px;
                margin-left: auto;
                margin-right: auto;
            }
            #${ROOT_ID} .sr-quote {
                color: ${theme.quoteText};
                font-size: 16px;
                font-style: italic;
                line-height: 1.6;
            }
            #${ROOT_ID} .sr-quote-source {
                color: ${theme.textHint};
                font-size: 12px;
                margin-top: 10px;
            }
            @media (max-width: 640px) {
                #${ROOT_ID} .sr-title {
                    font-size: 22px;
                }
                #${ROOT_ID} .sr-timer {
                    font-size: 56px;
                }
                #${ROOT_ID} .sr-pill {
                    width: 100%;
                    min-width: 0;
                }
            }
        `;
    }

    function createMarkup(hostname, stats, session) {
        const streakDays = getFocusStreakDays();
        const summary = getWeeklySummary();
        const topSite = summary.topSites[0] ? summary.topSites[0][0] : '暂无';
        const warningText = [];
        if (isForceModeEnabled()) {
            warningText.push('强制模式：本次不能选择继续摸鱼');
        }
        if (isIncognitoContext()) {
            warningText.push('无痕模式提醒：用户脚本可能受浏览器隐私设置影响');
        }
        return `
            <div class="sr-container">
                <div class="sr-icon" id="sr-emoji">🛑</div>
                <div class="sr-title">${getRandomTitle()}</div>
                <div class="sr-subtitle">${hostname}</div>
                <div class="sr-count">今日第 <strong>${stats.todayCount}</strong> 次 / 累计第 <strong>${stats.totalCount}</strong> 次被拦截</div>
                <div class="sr-meta">连续专注 <strong>${streakDays}</strong> 天 · 本周最易分心站点 <strong>${topSite}</strong> · 成就：<strong>${getAchievementText(stats, streakDays)}</strong></div>
                ${warningText.length ? `<div class="sr-warning">${warningText.join(' · ')}</div>` : ''}
                <div class="sr-timer" id="sr-countdown">${Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000))}</div>
                <div class="sr-hint" id="sr-hint">${Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000))}秒冷静期后做出你的选择</div>
                <div class="sr-actions" id="sr-actions">
                    ${isForceModeEnabled() ? '' : '<button class="sr-btn sr-btn-secondary" id="sr-skip">算了，回去干活</button>'}
                </div>
                <div class="sr-choice" id="sr-choice">
                    <div class="sr-choice-title">冷静期结束，做出你的选择</div>
                    <div class="sr-pills">
                        <button class="sr-pill sr-pill-blue" id="sr-blue-pill">
                            💼 回去干活
                            <span class="sr-pill-label">前往工作页面</span>
                        </button>
                        ${isForceModeEnabled() ? '' : `
                        <button class="sr-pill sr-pill-red" id="sr-red-pill">
                            🎮 就要摸鱼
                            <span class="sr-pill-label">继续访问此网站</span>
                        </button>`}
                    </div>
                </div>
                <div class="sr-quote-wrap">
                    <div class="sr-quote" id="sr-quote">加载中...</div>
                    <div class="sr-quote-source" id="sr-quote-source"></div>
                </div>
            </div>
        `;
    }

    function getOrCreateStyleElement(cssText) {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
        }
        style.textContent = cssText;
        return style;
    }

    function getOrCreateRoot() {
        let root = document.getElementById(ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = ROOT_ID;
        }
        return root;
    }

    function mountBlockPage(stats, session) {
        const theme = getTheme();

        function mount() {
            if (!document.documentElement) {
                return false;
            }

            const style = getOrCreateStyleElement(createStyles(theme));
            if (style.parentNode !== document.documentElement && style.parentNode !== document.head) {
                const parent = document.head || document.documentElement;
                parent.appendChild(style);
            }

            const root = getOrCreateRoot();
            root.innerHTML = createMarkup(location.hostname, stats, session);
            if (root.parentNode !== document.documentElement) {
                document.documentElement.appendChild(root);
            }

            document.documentElement.setAttribute(ACTIVE_ATTR, '1');
            if (document.body) {
                document.body.setAttribute(ACTIVE_ATTR, '1');
            }
            document.title = BLOCK_PAGE_TITLE;

            keepOverlayMounted(root, style);
            wireBlockPageInteractions(root);
            populateDynamicContent(root);

            logDebug('block page mounted', {
                hostname: location.hostname,
                readyState: document.readyState
            });

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
    }

    function keepOverlayMounted(root, style) {
        const observer = new MutationObserver(() => {
            if (!document.documentElement.contains(style)) {
                (document.head || document.documentElement).appendChild(style);
            }
            if (!document.documentElement.contains(root)) {
                document.documentElement.appendChild(root);
            }
            document.documentElement.setAttribute(ACTIVE_ATTR, '1');
            if (document.body) {
                document.body.setAttribute(ACTIVE_ATTR, '1');
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function populateDynamicContent(root) {
        fetchJson(
            'https://emojihub.yurace.pro/api/random',
            (data) => {
                const emoji = root.querySelector('#sr-emoji');
                if (!emoji) {
                    return;
                }
                if (data && Array.isArray(data.htmlCode) && data.htmlCode[0]) {
                    emoji.innerHTML = data.htmlCode[0];
                } else if (data && typeof data.emoji === 'string') {
                    emoji.textContent = data.emoji;
                } else {
                    emoji.textContent = '🛑';
                }
            },
            () => {
                const emoji = root.querySelector('#sr-emoji');
                if (emoji) {
                    emoji.textContent = '🛑';
                }
            }
        );

        fetchJson(
            'https://v1.hitokoto.cn/?c=d&c=h&c=i&c=k',
            (data) => {
                const quote = root.querySelector('#sr-quote');
                const source = root.querySelector('#sr-quote-source');
                if (!quote || !source) {
                    return;
                }
                quote.textContent = `「${data.hitokoto}」`;
                source.textContent = data.from_who ? `—— ${data.from_who}「${data.from}」` : `—— ${data.from}`;
            },
            () => {
                const quote = root.querySelector('#sr-quote');
                const source = root.querySelector('#sr-quote-source');
                if (quote) {
                    quote.textContent = '「你的时间有限，不要浪费在别人的生活里」';
                }
                if (source) {
                    source.textContent = '—— 乔布斯';
                }
            }
        );
    }

    function promptBypassReason() {
        const input = prompt(`继续摸鱼前，记录一下原因：\n1. 逃避任务\n2. 无聊\n3. 习惯性打开\n4. 想看一眼\n5. 社交回复\n6. 其他`, '1');
        if (input === null) {
            return null;
        }
        const normalized = input.trim();
        if (/^[1-6]$/.test(normalized)) {
            return REASONS[parseInt(normalized, 10) - 1];
        }
        return REASONS.includes(normalized) ? normalized : '其他';
    }

    function wireBlockPageInteractions(root) {
        const countdownEl = root.querySelector('#sr-countdown');
        const hintEl = root.querySelector('#sr-hint');
        const actionsEl = root.querySelector('#sr-actions');
        const choiceEl = root.querySelector('#sr-choice');
        const skipBtn = root.querySelector('#sr-skip');
        const blueBtn = root.querySelector('#sr-blue-pill');
        const redBtn = root.querySelector('#sr-red-pill');

        const session = getBlockSession(normalizedDomain) || startOrRefreshBlockSession(normalizedDomain);
        let remaining = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
        const timer = window.setInterval(() => {
            remaining = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
            if (countdownEl) {
                countdownEl.textContent = String(remaining);
            }
            if (hintEl && remaining > 0) {
                hintEl.textContent = `${remaining}秒冷静期后做出你的选择`;
            }
            if (remaining > 0) {
                return;
            }
            clearInterval(timer);
            if (countdownEl) {
                countdownEl.textContent = '⏰';
            }
            if (hintEl) {
                hintEl.textContent = '时间到！做出你的选择';
            }
            if (actionsEl) {
                actionsEl.style.display = 'none';
            }
            if (choiceEl) {
                choiceEl.style.display = 'block';
            }
            clearBlockSession(normalizedDomain);
        }, 1000);

        function redirectToTarget() {
            clearInterval(timer);
            clearBlockSession(normalizedDomain);
            window.location.replace(getTarget());
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', redirectToTarget);
        }
        blueBtn.addEventListener('click', redirectToTarget);
        if (redBtn) {
            redBtn.addEventListener('click', () => {
                const reason = promptBypassReason();
                if (reason === null) {
                    return;
                }
                clearInterval(timer);
                clearBlockSession(normalizedDomain);
                recordBypassReason(normalizedDomain, reason);
                GM_setValue(getBypassKey(location.hostname), Date.now() + DEFAULTS.bypassMs);
                window.location.reload();
            });
        }

        if (isForceModeEnabled()) {
            window.addEventListener('beforeunload', (event) => {
                if (Date.now() < session.expiresAt) {
                    event.preventDefault();
                    event.returnValue = '';
                }
            });
        }
    }

    function main() {
        registerMenuCommands();

        if (!isBlockedDomain(location.hostname)) {
            logDebug('hostname not blocked', location.hostname);
            return;
        }

        if (canAccessWithinQuota(normalizedDomain)) {
            logDebug('within quota, allow access', normalizedDomain);
            startQuotaSession(normalizedDomain);
            return;
        }

        if (isBypassed(location.hostname)) {
            logDebug('bypass active', location.hostname);
            return;
        }

        const existingSession = getBlockSession(normalizedDomain);
        const session = existingSession || startOrRefreshBlockSession(normalizedDomain);
        const stats = existingSession
            ? {
                totalCount: GM_getValue(STORAGE.blockCount, 0),
                todayCount: GM_getValue('blockCount_' + getTodayStr(), 0)
            }
            : incrementBlockStats(normalizedDomain);
        mountBlockPage(stats, session);
    }

    main();
})();
