// ==UserScript==
// @name         Site Redirector Pro
// @name:zh-CN   网站重定向助手
// @namespace    https://github.com/Jsaeron/site-redirector
// @version      1.8.0
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
        blockRules: 'blockRules',
        allowRules: 'allowRules',
        blockCount: 'blockCount',
        blockCountBySite: 'blockCountBySite',
        dailyQuotaMinutes: 'dailyQuotaMinutes',
        dailyQuotaVisits: 'dailyQuotaVisits',
        siteQuotaMinutes: 'siteQuotaMinutes',
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

    const COPYWRITING = {
        gentle: [
            { title: '休息一下，想想再决定', subtitle: '先别急着点进去，给自己一点缓冲。' },
            { title: '深呼吸，冷静一下', subtitle: '你不需要立刻回应这个冲动。' },
            { title: '给自己30秒思考时间', subtitle: '暂停一下，看看现在真正重要的是什么。' },
            { title: '暂停一下，整理思绪', subtitle: '也许你要的不是这个页面，而是一点喘息。' },
            { title: '慢下来，听听内心的声音', subtitle: '先确认这是不是你此刻真正想做的事。' },
            { title: '这是一个选择的时刻', subtitle: '今天的节奏，要不要继续守住？' },
            { title: '这一刻，值得更清醒一点', subtitle: '别把注意力随手交出去。' },
            { title: '先稳住，再决定', subtitle: '冲动过去之后，判断通常会更准。' }
        ],
        strict: [
            { title: '别让“就看一眼”偷走半小时', subtitle: '你已经知道点开之后会发生什么。' },
            { title: '注意力很贵，别随手花掉', subtitle: '现在退出，比一会儿后悔要容易。' },
            { title: '你确定不会后悔吗？', subtitle: '这是分心，不是放松。' },
            { title: '你来这里，是有意图，还是只是习惯？', subtitle: '别让习惯替你做决定。' },
            { title: '别把今天最好的精力送给无关紧要的内容', subtitle: '真正重要的事还在等你推进。' },
            { title: '真正难的不是工作，是抵抗分心', subtitle: '这一次忍住，比你想的更有价值。' },
            { title: '控制感，就从这一次开始', subtitle: '不要把决定权交给推荐流。' },
            { title: '这不是奖励，这是打断', subtitle: '现在停下，后面的状态才保得住。' }
        ],
        coach: [
            { title: '未来的你会感谢现在的决定', subtitle: '每一次守住专注，都是在给自己加分。' },
            { title: '此刻的选择，定义你的一天', subtitle: '先把正事推进一点，再回来也不迟。' },
            { title: '你的目标还记得吗？', subtitle: '先把今天最重要的那一步走出去。' },
            { title: '想想你真正想成为的人', subtitle: '专注不是天赋，是一次次小决定。' },
            { title: '每一次忍住，都是在给自己加分', subtitle: '你在训练的是掌控力。' },
            { title: '让今天保持一点锋利感', subtitle: '不要让状态在这里松掉。' },
            { title: '你是来掌控时间的，不是来被时间带走的', subtitle: '守住这一分钟，后面会轻松很多。' },
            { title: '先完成，再奖励自己', subtitle: '把分心留到任务推进之后。' }
        ],
        funny: [
            { title: '算法已经准备好把你打包带走了', subtitle: '你现在还有机会体面撤退。' },
            { title: '推荐流：欢迎回家。你：先等等。', subtitle: '别被熟练地带偏。' },
            { title: '就看一眼，通常是本日最大谎言', subtitle: '这句话你应该已经听过很多次了。' },
            { title: '再点下去，时间会表演消失术', subtitle: '而且是无痕消失。' },
            { title: '你的手很快，但理智还能追上', subtitle: '给它30秒。' },
            { title: '页面很精彩，代价也很稳定', subtitle: '半小时起步，专注归零。' },
            { title: '你不是来摸鱼的，你只是路过鱼塘', subtitle: '路过就好，不要下水。' },
            { title: '今天和分心拉扯了吗？先别让它赢', subtitle: '这一局还能翻。' }
        ]
    };

    const BLOCK_PAGE_TITLE = 'Site Redirector Pro';
    const ROOT_ID = 'site-redirector-root';
    const STYLE_ID = 'site-redirector-style';
    const SETTINGS_ROOT_ID = 'site-redirector-settings-root';
    const SETTINGS_STYLE_ID = 'site-redirector-settings-style';
    const ACTIVE_ATTR = 'data-site-redirector-active';
    const SESSION_PREFIX = 'blockSession_';
    const BYPASS_PREFIX = 'bypass_';
    const REASONS = ['逃避任务', '无聊', '习惯性打开', '想看一眼', '社交回复', '其他'];
    const normalizedDomain = normalizeDomain(location.hostname);
    const debugEnabled = GM_getValue(STORAGE.debugMode, false);
    const runtimeState = {
        menuRegistered: false,
        blockPageRequested: false,
        quotaSessionStarted: false,
        startupChecksInstalled: false
    };

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

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function splitListInput(value) {
        return String(value || '')
            .split(/\n+/)
            .flatMap((line) => {
                const trimmed = line.trim();
                return /^regex:/i.test(trimmed) ? [trimmed] : trimmed.split(/[,，；;]+/);
            })
            .map(item => item.trim())
            .filter(Boolean);
    }

    function normalizeRule(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return '';
        }
        if (/^regex:/i.test(raw)) {
            return 'regex:' + raw.slice(6).trim();
        }
        try {
            const url = new URL(raw);
            const domain = normalizeDomain(url.hostname);
            if (url.pathname === '/' && !url.search) {
                return domain;
            }
            return domain + url.pathname + url.search;
        } catch (error) {
            return raw
                .replace(/^(https?:\/\/)?(www\.)?/i, '')
                .replace(/#.*$/, '')
                .replace(/^\.+/, '')
                .replace(/\.+$/, '');
        }
    }

    function normalizeRuleList(value) {
        const list = Array.isArray(value) ? value : splitListInput(value);
        return Array.from(new Set(list.map(normalizeRule).filter(Boolean)));
    }

    function getBlockRules() {
        const storedRules = GM_getValue(STORAGE.blockRules, null);
        if (Array.isArray(storedRules)) {
            const normalized = normalizeRuleList(storedRules);
            if (normalized.length !== storedRules.length || normalized.some((rule, index) => rule !== storedRules[index])) {
                GM_setValue(STORAGE.blockRules, normalized);
            }
            return normalized;
        }
        const legacy = getBlacklist();
        GM_setValue(STORAGE.blockRules, legacy.slice());
        return legacy;
    }

    function getAllowRules() {
        const storedRules = GM_getValue(STORAGE.allowRules, []);
        const normalized = normalizeRuleList(storedRules);
        if (!Array.isArray(storedRules) || normalized.length !== storedRules.length || normalized.some((rule, index) => rule !== storedRules[index])) {
            GM_setValue(STORAGE.allowRules, normalized);
        }
        return normalized;
    }

    function globToRegExp(pattern) {
        const escaped = String(pattern || '').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return new RegExp('^' + escaped + '$');
    }

    function getUrlParts() {
        return {
            href: location.href,
            host: normalizeDomain(location.hostname),
            path: location.pathname + location.search
        };
    }

    function matchRule(rule, parts) {
        if (/^regex:/i.test(rule)) {
            try {
                return new RegExp(rule.slice(6)).test(parts.href);
            } catch (error) {
                return false;
            }
        }

        const slashIndex = rule.indexOf('/');
        const domain = slashIndex === -1 ? normalizeDomain(rule) : normalizeDomain(rule.slice(0, slashIndex));
        const pathPattern = slashIndex === -1 ? '' : rule.slice(slashIndex);
        const domainMatches = parts.host === domain || parts.host.endsWith('.' + domain);
        if (!domainMatches) {
            return false;
        }
        if (!pathPattern) {
            return true;
        }
        return globToRegExp(pathPattern).test(parts.path);
    }

    function getMatchingRule(rules) {
        const parts = getUrlParts();
        return rules.find(rule => matchRule(rule, parts)) || null;
    }

    function getLocalDateStr(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getTodayStr() {
        return getLocalDateStr(new Date());
    }

    function pickRandom(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    function getCopyTone(stats, streakDays) {
        if (isForceModeEnabled()) {
            return 'strict';
        }
        if (streakDays >= 7) {
            return 'coach';
        }
        if (stats.todayCount >= 4) {
            return 'strict';
        }
        if (stats.todayCount === 3) {
            return 'funny';
        }
        return 'gentle';
    }

    function getCopywriting(stats, streakDays) {
        const tone = getCopyTone(stats, streakDays);
        const entry = pickRandom(COPYWRITING[tone]);
        const toneLabel = {
            gentle: '温和提醒',
            strict: '直接制动',
            coach: '目标驱动',
            funny: '轻松吐槽'
        }[tone];
        return {
            tone,
            toneLabel,
            title: entry.title,
            subtitle: entry.subtitle
        };
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

    function getSiteQuotaMinutesMap() {
        const stored = GM_getValue(STORAGE.siteQuotaMinutes, {});
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
            return {};
        }
        const normalized = {};
        Object.entries(stored).forEach(([site, minutes]) => {
            const domain = normalizeDomain(site);
            const value = Math.max(0, parseInt(minutes, 10) || 0);
            if (domain) {
                normalized[domain] = value;
            }
        });
        if (JSON.stringify(normalized) !== JSON.stringify(stored)) {
            GM_setValue(STORAGE.siteQuotaMinutes, normalized);
        }
        return normalized;
    }

    function setSiteQuotaMinutesMap(map) {
        const normalized = {};
        Object.entries(map || {}).forEach(([site, minutes]) => {
            const domain = normalizeDomain(site);
            const value = Math.max(0, parseInt(minutes, 10) || 0);
            if (domain) {
                normalized[domain] = value;
            }
        });
        GM_setValue(STORAGE.siteQuotaMinutes, normalized);
    }

    function parseSiteQuotaInput(value) {
        const map = {};
        String(value || '').split(/\n+/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                return;
            }
            const match = trimmed.match(/^(.+?)(?:\s*[,，:：=]\s*|\s+)(\d+)$/);
            if (!match) {
                throw new Error(`站点配额格式无效：${trimmed}`);
            }
            const domain = normalizeDomain(match[1]);
            if (!domain) {
                throw new Error(`站点域名无效：${trimmed}`);
            }
            map[domain] = Math.max(0, parseInt(match[2], 10) || 0);
        });
        return map;
    }

    function formatSiteQuotaInput(map) {
        return Object.entries(map || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([site, minutes]) => `${site} ${minutes}`)
            .join('\n');
    }

    function getQuotaLimitMinutes(domain) {
        const normalized = normalizeDomain(domain);
        const siteQuotas = getSiteQuotaMinutesMap();
        if (Object.prototype.hasOwnProperty.call(siteQuotas, normalized)) {
            return siteQuotas[normalized];
        }
        return getDailyQuotaMinutes();
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

    function setBlockRules(rules) {
        const normalized = normalizeRuleList(rules);
        GM_setValue(STORAGE.blockRules, normalized);
        GM_setValue(STORAGE.blacklist, normalized.filter(rule => !/^regex:/i.test(rule) && !rule.includes('/')).map(normalizeDomain));
    }

    function isBlockedDomain(hostname) {
        if (getMatchingRule(getAllowRules())) {
            return false;
        }
        const current = normalizeDomain(hostname);
        return getBlockRules().some((rule) => {
            if (rule.includes('/') || /^regex:/i.test(rule)) {
                return matchRule(rule, getUrlParts());
            }
            const site = normalizeDomain(rule);
            return current === site || current.endsWith('.' + site);
        });
    }

    function getQuotaDomain(hostname) {
        const rule = getMatchingRule(getBlockRules());
        if (rule && !/^regex:/i.test(rule)) {
            const slashIndex = rule.indexOf('/');
            return normalizeDomain(slashIndex === -1 ? rule : rule.slice(0, slashIndex));
        }
        return normalizeDomain(hostname);
    }

    function getQuotaUsageKey(dateStr, domain) {
        return `quotaUsage_${dateStr}_${domain}`;
    }

    function getQuotaUsageMsKey(dateStr, domain) {
        return `quotaUsageMs_${dateStr}_${domain}`;
    }

    function getQuotaVisitKey(dateStr, domain) {
        return `quotaVisits_${dateStr}_${domain}`;
    }

    function getQuotaUsageMs(dateStr, domain) {
        const msKey = getQuotaUsageMsKey(dateStr, domain);
        const storedMs = GM_getValue(msKey, null);
        if (Number.isFinite(storedMs)) {
            return storedMs;
        }
        return (GM_getValue(getQuotaUsageKey(dateStr, domain), 0) || 0) * 60 * 1000;
    }

    function addQuotaUsageMs(dateStr, domain, elapsedMs) {
        if (elapsedMs <= 0) {
            return getQuotaUsageMs(dateStr, domain);
        }
        const msKey = getQuotaUsageMsKey(dateStr, domain);
        const nextMs = getQuotaUsageMs(dateStr, domain) + elapsedMs;
        GM_setValue(msKey, nextMs);
        GM_setValue(getQuotaUsageKey(dateStr, domain), Math.floor(nextMs / 60000));
        return nextMs;
    }

    function isQuotaEnabled(domain) {
        return getQuotaLimitMinutes(domain) > 0 || getDailyQuotaVisits() > 0;
    }

    function canAccessWithinQuota(domain) {
        if (!isQuotaEnabled(domain)) {
            return false;
        }
        const today = getTodayStr();
        const usedMs = getQuotaUsageMs(today, domain);
        const usedVisits = GM_getValue(getQuotaVisitKey(today, domain), 0);
        const minutesLimit = getQuotaLimitMinutes(domain);
        const visitsLimit = getDailyQuotaVisits();
        const minutesOk = minutesLimit === 0 || usedMs < minutesLimit * 60 * 1000;
        const visitsOk = visitsLimit === 0 || usedVisits < visitsLimit;
        return minutesOk && visitsOk;
    }

    function startQuotaSession(domain) {
        const today = getTodayStr();
        const visitKey = getQuotaVisitKey(today, domain);
        GM_setValue(visitKey, GM_getValue(visitKey, 0) + 1);

        const limitMinutes = getQuotaLimitMinutes(domain);
        if (limitMinutes <= 0) {
            return;
        }

        let lastTick = document.visibilityState === 'visible' ? Date.now() : null;
        const timer = window.setInterval(() => {
            if (document.visibilityState !== 'visible') {
                lastTick = null;
                return;
            }
            const now = Date.now();
            if (lastTick === null) {
                lastTick = now;
                return;
            }
            const usedMs = addQuotaUsageMs(today, domain, now - lastTick);
            lastTick = now;
            if (usedMs >= limitMinutes * 60 * 1000) {
                clearInterval(timer);
                evaluateBlocking('quota-expired');
            }
        }, 1000);

        document.addEventListener('visibilitychange', () => {
            lastTick = document.visibilityState === 'visible' ? Date.now() : null;
        });

        window.addEventListener('beforeunload', () => {
            if (lastTick !== null && document.visibilityState === 'visible') {
                addQuotaUsageMs(today, domain, Date.now() - lastTick);
            }
            clearInterval(timer);
        }, { once: true });
    }

    function getQuotaStatusText(domain) {
        const limitMinutes = getQuotaLimitMinutes(domain);
        if (limitMinutes <= 0) {
            return '未开放';
        }
        const usedMs = getQuotaUsageMs(getTodayStr(), domain);
        const usedMinutes = Math.floor(usedMs / 60000);
        const remainingMinutes = Math.max(0, Math.ceil((limitMinutes * 60000 - usedMs) / 60000));
        return `${usedMinutes}/${limitMinutes} 分钟，剩 ${remainingMinutes}`;
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
        return getLocalDateStr(date);
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

    function getCurrentBlockStats() {
        return {
            totalCount: GM_getValue(STORAGE.blockCount, 0),
            todayCount: GM_getValue('blockCount_' + getTodayStr(), 0)
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

    function getConfigSnapshot() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            settings: {
                redirectTarget: getTarget(),
                blockRules: getBlockRules(),
                allowRules: getAllowRules(),
                dailyQuotaMinutes: getDailyQuotaMinutes(),
                dailyQuotaVisits: getDailyQuotaVisits(),
                siteQuotaMinutes: getSiteQuotaMinutesMap(),
                themeMode: getThemeMode(),
                forceMode: isForceModeEnabled()
            },
            stats: {
                blockCount: GM_getValue(STORAGE.blockCount, 0),
                blockCountBySite: GM_getValue(STORAGE.blockCountBySite, {}),
                bypassReasonLog: getBypassReasonLog()
            }
        };
    }

    function applyConfigSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            throw new Error('配置不是有效 JSON 对象');
        }
        const settings = snapshot.settings || snapshot;
        if (settings.redirectTarget) {
            const url = new URL(settings.redirectTarget);
            GM_setValue(STORAGE.redirectTarget, url.toString());
        }
        if (settings.blockRules || settings.blacklist) {
            setBlockRules(settings.blockRules || settings.blacklist);
        }
        if (settings.allowRules) {
            GM_setValue(STORAGE.allowRules, normalizeRuleList(settings.allowRules));
        }
        if (settings.dailyQuotaMinutes !== undefined) {
            GM_setValue(STORAGE.dailyQuotaMinutes, Math.max(0, parseInt(settings.dailyQuotaMinutes, 10) || 0));
        }
        if (settings.dailyQuotaVisits !== undefined) {
            GM_setValue(STORAGE.dailyQuotaVisits, Math.max(0, parseInt(settings.dailyQuotaVisits, 10) || 0));
        }
        if (settings.siteQuotaMinutes !== undefined) {
            setSiteQuotaMinutesMap(settings.siteQuotaMinutes);
        }
        if (['auto', 'light', 'dark'].includes(settings.themeMode)) {
            GM_setValue(STORAGE.themeMode, settings.themeMode);
        }
        if (settings.forceMode !== undefined) {
            GM_setValue(STORAGE.forceMode, Boolean(settings.forceMode));
        }

        const stats = snapshot.stats;
        if (stats && typeof stats === 'object') {
            if (Number.isFinite(stats.blockCount)) {
                GM_setValue(STORAGE.blockCount, stats.blockCount);
            }
            if (stats.blockCountBySite && typeof stats.blockCountBySite === 'object') {
                GM_setValue(STORAGE.blockCountBySite, stats.blockCountBySite);
            }
            if (Array.isArray(stats.bypassReasonLog)) {
                GM_setValue(STORAGE.bypassReasonLog, stats.bypassReasonLog.slice(-500));
            }
        }
    }

    function createSettingsStyles() {
        return `
            #${SETTINGS_ROOT_ID}, #${SETTINGS_ROOT_ID} * {
                box-sizing: border-box;
            }
            #${SETTINGS_ROOT_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(15, 23, 42, 0.76);
                color: #172033;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #${SETTINGS_ROOT_ID} .sr-settings-panel {
                width: min(100%, 1080px);
                height: min(92vh, 820px);
                display: grid;
                grid-template-columns: 238px minmax(0, 1fr);
                background: #f8fafc;
                border: 1px solid rgba(148, 163, 184, 0.45);
                border-radius: 8px;
                box-shadow: 0 24px 70px rgba(15, 23, 42, 0.32);
                overflow: hidden;
            }
            #${SETTINGS_ROOT_ID} .sr-console-nav {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 18px;
                background: #0f172a;
                color: #e2e8f0;
            }
            #${SETTINGS_ROOT_ID} .sr-settings-title {
                font-size: 18px;
                font-weight: 700;
            }
            #${SETTINGS_ROOT_ID} .sr-settings-subtitle {
                color: #94a3b8;
                font-size: 13px;
                margin-top: 4px;
                line-height: 1.45;
            }
            #${SETTINGS_ROOT_ID} .sr-nav-list {
                display: grid;
                gap: 8px;
                margin-top: 10px;
            }
            #${SETTINGS_ROOT_ID} .sr-nav-item {
                display: flex;
                align-items: center;
                gap: 10px;
                border: 1px solid rgba(148, 163, 184, 0.18);
                border-radius: 8px;
                padding: 10px 11px;
                color: #cbd5e1;
                font-size: 13px;
                font-weight: 650;
                background: rgba(255, 255, 255, 0.03);
            }
            #${SETTINGS_ROOT_ID} .sr-nav-item strong {
                display: grid;
                place-items: center;
                width: 24px;
                height: 24px;
                border-radius: 6px;
                background: rgba(37, 99, 235, 0.22);
                color: #bfdbfe;
            }
            #${SETTINGS_ROOT_ID} .sr-console-main {
                min-width: 0;
                overflow: auto;
                display: grid;
                grid-template-rows: auto 1fr auto;
            }
            #${SETTINGS_ROOT_ID} .sr-settings-header {
                position: sticky;
                top: 0;
                z-index: 1;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 16px 20px;
                background: rgba(255, 255, 255, 0.94);
                border-bottom: 1px solid #e2e8f0;
                backdrop-filter: blur(14px);
            }
            #${SETTINGS_ROOT_ID} .sr-status-strip {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            #${SETTINGS_ROOT_ID} .sr-status-pill {
                border: 1px solid #dbe3ee;
                border-radius: 999px;
                background: #fff;
                color: #475569;
                font-size: 12px;
                padding: 6px 10px;
            }
            #${SETTINGS_ROOT_ID} .sr-settings-body {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 260px;
                align-items: start;
                gap: 16px;
                padding: 20px;
            }
            #${SETTINGS_ROOT_ID} .sr-section-stack {
                display: grid;
                gap: 16px;
            }
            #${SETTINGS_ROOT_ID} .sr-section {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
            }
            #${SETTINGS_ROOT_ID} .sr-section-title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 14px;
            }
            #${SETTINGS_ROOT_ID} .sr-section-title h3 {
                margin: 0;
                font-size: 15px;
                line-height: 1.2;
            }
            #${SETTINGS_ROOT_ID} .sr-section-title span {
                color: #64748b;
                font-size: 12px;
            }
            #${SETTINGS_ROOT_ID} .sr-settings-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 14px;
            }
            #${SETTINGS_ROOT_ID} .sr-field-full {
                grid-column: 1 / -1;
            }
            #${SETTINGS_ROOT_ID} label {
                display: block;
                color: #334155;
                font-size: 13px;
                font-weight: 650;
                margin-bottom: 7px;
            }
            #${SETTINGS_ROOT_ID} input,
            #${SETTINGS_ROOT_ID} select,
            #${SETTINGS_ROOT_ID} textarea {
                width: 100%;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #fff;
                color: #172033;
                font: inherit;
                font-size: 13px;
                padding: 10px 11px;
                outline: none;
            }
            #${SETTINGS_ROOT_ID} textarea {
                min-height: 128px;
                resize: vertical;
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                line-height: 1.45;
            }
            #${SETTINGS_ROOT_ID} input:focus,
            #${SETTINGS_ROOT_ID} select:focus,
            #${SETTINGS_ROOT_ID} textarea:focus {
                border-color: #2563eb;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
            }
            #${SETTINGS_ROOT_ID} .sr-help {
                color: #64748b;
                font-size: 12px;
                margin-top: 6px;
                line-height: 1.5;
            }
            #${SETTINGS_ROOT_ID} .sr-check-row {
                display: flex;
                align-items: center;
                gap: 9px;
                height: 40px;
            }
            #${SETTINGS_ROOT_ID} .sr-check-row input {
                width: 16px;
                height: 16px;
                padding: 0;
            }
            #${SETTINGS_ROOT_ID} .sr-settings-side {
                display: flex;
                flex-direction: column;
                gap: 12px;
                position: sticky;
                top: 84px;
            }
            #${SETTINGS_ROOT_ID} .sr-stat-box {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 14px;
            }
            #${SETTINGS_ROOT_ID} .sr-stat-box strong {
                display: block;
                font-size: 24px;
                margin-bottom: 2px;
            }
            #${SETTINGS_ROOT_ID} .sr-stat-box span {
                color: #64748b;
                font-size: 12px;
            }
            #${SETTINGS_ROOT_ID} .sr-actions-row {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                padding: 14px 20px;
                border-top: 1px solid #e2e8f0;
                background: #fff;
            }
            #${SETTINGS_ROOT_ID} button {
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #fff;
                color: #172033;
                cursor: pointer;
                font: inherit;
                font-size: 13px;
                font-weight: 650;
                padding: 9px 13px;
            }
            #${SETTINGS_ROOT_ID} button:hover {
                border-color: #94a3b8;
                background: #f1f5f9;
            }
            #${SETTINGS_ROOT_ID} .sr-primary {
                border-color: #2563eb;
                background: #2563eb;
                color: #fff;
            }
            #${SETTINGS_ROOT_ID} .sr-primary:hover {
                border-color: #1d4ed8;
                background: #1d4ed8;
            }
            #${SETTINGS_ROOT_ID} .sr-danger {
                border-color: #fecaca;
                color: #b91c1c;
            }
            #${SETTINGS_ROOT_ID} .sr-import-export {
                min-height: 170px;
            }
            @media (max-width: 880px) {
                #${SETTINGS_ROOT_ID} {
                    padding: 10px;
                    align-items: stretch;
                }
                #${SETTINGS_ROOT_ID} .sr-settings-panel {
                    height: auto;
                    max-height: calc(100vh - 20px);
                    grid-template-columns: 1fr;
                    overflow: auto;
                }
                #${SETTINGS_ROOT_ID} .sr-console-nav {
                    display: none;
                }
                #${SETTINGS_ROOT_ID} .sr-settings-body,
                #${SETTINGS_ROOT_ID} .sr-settings-grid {
                    grid-template-columns: 1fr;
                }
                #${SETTINGS_ROOT_ID} .sr-settings-side {
                    position: static;
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }
            @media (max-width: 560px) {
                #${SETTINGS_ROOT_ID} .sr-settings-header {
                    align-items: flex-start;
                    flex-direction: column;
                }
                #${SETTINGS_ROOT_ID} .sr-settings-side {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }

    function getSettingsMarkup() {
        const stats = getCurrentBlockStats();
        const summary = getWeeklySummary();
        const themeMode = getThemeMode();
        const blockRules = getBlockRules();
        const allowRules = getAllowRules();
        const forceLabel = isForceModeEnabled() ? '强制模式' : '冷静模式';
        const siteQuotaText = formatSiteQuotaInput(getSiteQuotaMinutesMap());
        return `
            <div class="sr-settings-panel" role="dialog" aria-modal="true">
                <div class="sr-console-nav">
                    <div>
                        <div class="sr-settings-title">Site Redirector Pro 设置</div>
                        <div class="sr-settings-subtitle">规则按白名单优先、再匹配拦截规则的顺序执行。</div>
                    </div>
                    <div class="sr-nav-list">
                        <div class="sr-nav-item"><strong>1</strong> 基础</div>
                        <div class="sr-nav-item"><strong>2</strong> 规则</div>
                        <div class="sr-nav-item"><strong>3</strong> 策略</div>
                        <div class="sr-nav-item"><strong>4</strong> 数据</div>
                    </div>
                </div>
                <div class="sr-console-main">
                    <div class="sr-settings-header">
                        <div class="sr-status-strip">
                            <span class="sr-status-pill">${forceLabel}</span>
                            <span class="sr-status-pill">${blockRules.length} 条拦截规则</span>
                            <span class="sr-status-pill">${allowRules.length} 条白名单</span>
                            <span class="sr-status-pill">今日 ${stats.todayCount} 次</span>
                        </div>
                        <button type="button" id="sr-settings-close">关闭</button>
                    </div>
                    <div class="sr-settings-body">
                        <div class="sr-section-stack">
                            <div class="sr-section">
                                <div class="sr-section-title">
                                    <h3>基础设置</h3>
                                    <span>跳转目标和外观</span>
                                </div>
                                <div class="sr-settings-grid">
                                    <div class="sr-field-full">
                                        <label for="sr-setting-target">重定向目标</label>
                                        <input id="sr-setting-target" value="${escapeHtml(getTarget())}" placeholder="https://claude.ai">
                                    </div>
                                    <div>
                                        <label for="sr-setting-theme">主题</label>
                                        <select id="sr-setting-theme">
                                            <option value="auto"${themeMode === 'auto' ? ' selected' : ''}>跟随系统</option>
                                            <option value="light"${themeMode === 'light' ? ' selected' : ''}>明亮模式</option>
                                            <option value="dark"${themeMode === 'dark' ? ' selected' : ''}>暗黑模式</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>强制模式</label>
                                        <div class="sr-check-row">
                                            <input id="sr-setting-force" type="checkbox"${isForceModeEnabled() ? ' checked' : ''}>
                                            <span>禁用继续摸鱼</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="sr-section">
                                <div class="sr-section-title">
                                    <h3>规则控制</h3>
                                    <span>白名单优先生效</span>
                                </div>
                                <div class="sr-settings-grid">
                                    <div class="sr-field-full">
                                        <label for="sr-setting-block-rules">拦截规则</label>
                                        <textarea id="sr-setting-block-rules" spellcheck="false">${escapeHtml(blockRules.join('\n'))}</textarea>
                                        <div class="sr-help">每行一条：域名 example.com，路径 youtube.com/shorts*，正则 regex:^https://example\\.com/.*</div>
                                    </div>
                                    <div class="sr-field-full">
                                        <label for="sr-setting-allow-rules">白名单规则</label>
                                        <textarea id="sr-setting-allow-rules" spellcheck="false">${escapeHtml(allowRules.join('\n'))}</textarea>
                                        <div class="sr-help">命中后直接放行，适合 messages、docs、工作区路径。</div>
                                    </div>
                                </div>
                            </div>
                            <div class="sr-section">
                                <div class="sr-section-title">
                                    <h3>配额策略</h3>
                                    <span>默认配额 + 单站点覆盖</span>
                                </div>
                                <div class="sr-settings-grid">
                                    <div>
                                        <label for="sr-setting-quota-minutes">默认每日可访问分钟数</label>
                                        <input id="sr-setting-quota-minutes" type="number" min="0" step="1" value="${getDailyQuotaMinutes()}">
                                        <div class="sr-help">没有单独配置的黑名单站点使用这个默认值，0 表示直接拦截。</div>
                                    </div>
                                    <div>
                                        <label for="sr-setting-quota-visits">每日可访问次数</label>
                                        <input id="sr-setting-quota-visits" type="number" min="0" step="1" value="${getDailyQuotaVisits()}">
                                        <div class="sr-help">访问次数仍是全局限制，0 表示不限制次数。</div>
                                    </div>
                                    <div class="sr-field-full">
                                        <label for="sr-setting-site-quotas">单站点每日分钟数</label>
                                        <textarea id="sr-setting-site-quotas" spellcheck="false" placeholder="bilibili.com 20&#10;douyin.com 10">${escapeHtml(siteQuotaText)}</textarea>
                                        <div class="sr-help">每行一个域名和分钟数，支持空格、冒号或逗号分隔；子域名命中域名规则时共享该站点配额。</div>
                                    </div>
                                </div>
                            </div>
                            <div class="sr-section">
                                <div class="sr-section-title">
                                    <h3>配置备份</h3>
                                    <span>导出或导入 JSON</span>
                                </div>
                                <div class="sr-field-full">
                                    <label for="sr-setting-import-export">导入 / 导出 JSON</label>
                                    <textarea id="sr-setting-import-export" class="sr-import-export" spellcheck="false" placeholder="点击导出生成 JSON，或粘贴 JSON 后点击导入"></textarea>
                                </div>
                            </div>
                        </div>
                        <div class="sr-settings-side">
                            <div class="sr-stat-box"><strong>${stats.todayCount}</strong><span>今日拦截</span></div>
                            <div class="sr-stat-box"><strong>${stats.totalCount}</strong><span>累计拦截</span></div>
                            <div class="sr-stat-box"><strong>${summary.weeklyBlocks}</strong><span>近 7 天拦截</span></div>
                            <div class="sr-stat-box"><strong>${summary.streakDays}</strong><span>连续专注天数</span></div>
                        </div>
                    </div>
                    <div class="sr-actions-row">
                        <button type="button" class="sr-primary" id="sr-settings-save">保存设置</button>
                        <button type="button" id="sr-settings-export">导出配置</button>
                        <button type="button" id="sr-settings-import">导入配置</button>
                        <button type="button" class="sr-danger" id="sr-settings-reset-stats">重置统计</button>
                    </div>
                </div>
            </div>
        `;
    }

    function mountSettingsPanel() {
        if (!document.documentElement) {
            window.setTimeout(mountSettingsPanel, 50);
            return;
        }

        let style = document.getElementById(SETTINGS_STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = SETTINGS_STYLE_ID;
            style.textContent = createSettingsStyles();
            (document.head || document.documentElement).appendChild(style);
        }

        let root = document.getElementById(SETTINGS_ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = SETTINGS_ROOT_ID;
            document.documentElement.appendChild(root);
        }
        root.innerHTML = getSettingsMarkup();
        wireSettingsPanel(root);
    }

    function wireSettingsPanel(root) {
        const close = () => root.remove();
        root.querySelector('#sr-settings-close').addEventListener('click', close);
        root.addEventListener('click', (event) => {
            if (event.target === root) {
                close();
            }
        });

        root.querySelector('#sr-settings-save').addEventListener('click', () => {
            const target = root.querySelector('#sr-setting-target').value.trim();
            try {
                const url = new URL(target);
                GM_setValue(STORAGE.redirectTarget, url.toString());
            } catch (error) {
                alert('重定向目标不是有效 URL');
                return;
            }
            setBlockRules(splitListInput(root.querySelector('#sr-setting-block-rules').value));
            GM_setValue(STORAGE.allowRules, normalizeRuleList(root.querySelector('#sr-setting-allow-rules').value));
            GM_setValue(STORAGE.dailyQuotaMinutes, Math.max(0, parseInt(root.querySelector('#sr-setting-quota-minutes').value, 10) || 0));
            GM_setValue(STORAGE.dailyQuotaVisits, Math.max(0, parseInt(root.querySelector('#sr-setting-quota-visits').value, 10) || 0));
            try {
                setSiteQuotaMinutesMap(parseSiteQuotaInput(root.querySelector('#sr-setting-site-quotas').value));
            } catch (error) {
                alert(error.message);
                return;
            }
            GM_setValue(STORAGE.themeMode, root.querySelector('#sr-setting-theme').value);
            GM_setValue(STORAGE.forceMode, root.querySelector('#sr-setting-force').checked);
            alert('设置已保存，刷新页面后对当前页完全生效');
        });

        root.querySelector('#sr-settings-export').addEventListener('click', () => {
            root.querySelector('#sr-setting-import-export').value = JSON.stringify(getConfigSnapshot(), null, 2);
        });

        root.querySelector('#sr-settings-import').addEventListener('click', () => {
            const raw = root.querySelector('#sr-setting-import-export').value.trim();
            if (!raw) {
                alert('先粘贴要导入的 JSON');
                return;
            }
            try {
                applyConfigSnapshot(JSON.parse(raw));
                root.innerHTML = getSettingsMarkup();
                wireSettingsPanel(root);
                alert('配置已导入');
            } catch (error) {
                alert(`导入失败：${error.message}`);
            }
        });

        root.querySelector('#sr-settings-reset-stats').addEventListener('click', () => {
            if (!confirm('确定要重置累计统计和摸鱼原因记录吗？')) {
                return;
            }
            GM_setValue(STORAGE.blockCount, 0);
            GM_setValue(STORAGE.blockCountBySite, {});
            GM_setValue(STORAGE.bypassReasonLog, []);
            root.innerHTML = getSettingsMarkup();
            wireSettingsPanel(root);
        });
    }

    function registerMenuCommands() {
        if (runtimeState.menuRegistered) {
            return;
        }
        runtimeState.menuRegistered = true;

        GM_registerMenuCommand('⚙️ 打开设置面板', () => {
            mountSettingsPanel();
        });

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
            const rules = getBlockRules();
            alert(`当前拦截规则（${rules.length} 条）：\n\n${rules.join('\n')}`);
        });

        GM_registerMenuCommand('➕ 添加网站到黑名单', () => {
            const input = prompt('请输入要拦截的规则（如 example.com、youtube.com/shorts* 或 regex:...）：', '');
            if (!input || !input.trim()) {
                return;
            }
            const rule = normalizeRule(input);
            const rules = getBlockRules();
            if (rules.includes(rule)) {
                alert(`${rule} 已在拦截规则中`);
                return;
            }
            setBlockRules(rules.concat(rule));
            alert(`已添加 ${rule} 到拦截规则`);
        });

        GM_registerMenuCommand('➖ 从黑名单移除网站', () => {
            const rules = getBlockRules();
            if (rules.length === 0) {
                alert('拦截规则为空');
                return;
            }
            const input = prompt(`当前拦截规则：\n${rules.join('\n')}\n\n请输入要移除的规则：`, '');
            if (!input || !input.trim()) {
                return;
            }
            const rule = normalizeRule(input);
            const next = rules.filter(site => site !== rule);
            if (next.length === rules.length) {
                alert(`${rule} 不在拦截规则中`);
                return;
            }
            setBlockRules(next);
            alert(`已从拦截规则移除 ${rule}`);
        });

        GM_registerMenuCommand('✏️ 编辑完整黑名单', () => {
            const rules = getBlockRules();
            const input = prompt('编辑拦截规则（每行一条，支持域名、路径通配、regex:）：', rules.join('\n'));
            if (input === null) {
                return;
            }
            const next = normalizeRuleList(input);
            setBlockRules(next);
            alert(`拦截规则已更新，共 ${next.length} 条`);
        });

        GM_registerMenuCommand('🔙 重置为默认黑名单', () => {
            if (!confirm(`确定要重置黑名单为默认设置吗？\n\n默认黑名单：\n${DEFAULTS.blacklist.join('\n')}`)) {
                return;
            }
            setBlockRules(DEFAULTS.blacklist.slice());
            GM_setValue(STORAGE.allowRules, []);
            alert('拦截规则已重置为默认设置');
        });

        GM_registerMenuCommand('⏱️ 设置每日配额', () => {
            const minutesInput = prompt('请输入默认每日可访问分钟数（0 表示直接拦截）：', getDailyQuotaMinutes());
            if (minutesInput === null) {
                return;
            }
            const visitsInput = prompt('请输入每日可访问次数（0 表示禁用）：', getDailyQuotaVisits());
            if (visitsInput === null) {
                return;
            }
            const siteQuotaInput = prompt('设置单站点每日分钟数，每行：域名 分钟数\n留空表示不设置单站点覆盖。', formatSiteQuotaInput(getSiteQuotaMinutesMap()));
            if (siteQuotaInput === null) {
                return;
            }
            const minutesValue = Math.max(0, parseInt(minutesInput, 10) || 0);
            const visitsValue = Math.max(0, parseInt(visitsInput, 10) || 0);
            let siteQuotas = {};
            try {
                siteQuotas = parseSiteQuotaInput(siteQuotaInput);
            } catch (error) {
                alert(error.message);
                return;
            }
            GM_setValue(STORAGE.dailyQuotaMinutes, minutesValue);
            GM_setValue(STORAGE.dailyQuotaVisits, visitsValue);
            setSiteQuotaMinutesMap(siteQuotas);
            alert(`每日配额已更新：默认 ${minutesValue} 分钟 / ${visitsValue} 次，单站点 ${Object.keys(siteQuotas).length} 条`);
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
            const siteQuotaCount = Object.keys(getSiteQuotaMinutesMap()).length;
            const quotaText = quotaMinutes || quotaVisits || siteQuotaCount ? `默认 ${quotaMinutes} 分钟 / ${quotaVisits} 次，单站点 ${siteQuotaCount} 条` : '未启用';
            alert(`今日拦截次数：${todayTotal}\n累计拦截次数：${total}\n当前重定向目标：${getTarget()}\n拦截规则数：${getBlockRules().length}\n白名单规则数：${getAllowRules().length}\n每日配额：${quotaText}\n当前主题：${themeLabel}`);
        });

        GM_registerMenuCommand('📈 查看本周趋势', () => {
            const days = [];
            const hourlyTotals = Array(24).fill(0);
            for (let i = 6; i >= 0; i--) {
                const dateStr = getPastDateStr(i);
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
                padding: 28px;
                background: ${theme.bg};
                color: ${theme.text};
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #${ROOT_ID} .sr-container {
                width: min(100%, 1040px);
                display: grid;
                grid-template-columns: minmax(0, 1fr) 280px;
                gap: 18px;
                align-items: stretch;
            }
            #${ROOT_ID} .sr-main {
                min-height: 560px;
                display: grid;
                grid-template-rows: auto 1fr auto;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.06);
                backdrop-filter: blur(18px);
                box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
                overflow: hidden;
            }
            #${ROOT_ID} .sr-topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 18px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.10);
            }
            #${ROOT_ID} .sr-site {
                min-width: 0;
                font-size: 14px;
                font-weight: 700;
                color: ${theme.accent};
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #${ROOT_ID} .sr-mode {
                flex: 0 0 auto;
                border: 1px solid rgba(255, 255, 255, 0.16);
                border-radius: 999px;
                padding: 5px 10px;
                font-size: 14px;
                color: ${theme.textMuted};
            }
            #${ROOT_ID} .sr-focus {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 34px 28px;
            }
            #${ROOT_ID} .sr-icon {
                font-size: 42px;
                margin-bottom: 16px;
            }
            #${ROOT_ID} .sr-title {
                max-width: 720px;
                font-size: 34px;
                font-weight: 760;
                line-height: 1.15;
                margin-bottom: 12px;
                letter-spacing: 0;
            }
            #${ROOT_ID} .sr-subcopy {
                max-width: 620px;
                color: ${theme.textMuted};
                font-size: 15px;
                line-height: 1.7;
                margin-bottom: 30px;
            }
            #${ROOT_ID} .sr-progress {
                --sr-progress: 1;
                position: relative;
                width: 188px;
                height: 188px;
                display: grid;
                place-items: center;
                margin-bottom: 22px;
                border-radius: 50%;
                background:
                    conic-gradient(${theme.accent} calc(var(--sr-progress) * 1turn), rgba(255, 255, 255, 0.12) 0),
                    rgba(255, 255, 255, 0.04);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.10);
            }
            #${ROOT_ID} .sr-progress::after {
                content: "";
                position: absolute;
                inset: 13px;
                border-radius: 50%;
                background: ${theme.bg};
                filter: brightness(0.96);
            }
            #${ROOT_ID} .sr-timer {
                position: relative;
                z-index: 1;
                font-size: 72px;
                font-weight: 700;
                color: ${theme.accent};
                font-variant-numeric: tabular-nums;
                line-height: 1;
            }
            #${ROOT_ID} .sr-hint {
                color: ${theme.textHint};
                font-size: 14px;
            }
            #${ROOT_ID} .sr-actions {
                margin-top: 22px;
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            #${ROOT_ID} .sr-btn {
                padding: 11px 24px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 14px;
                font-weight: 650;
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
                width: min(100%, 560px);
                margin-top: 22px;
            }
            #${ROOT_ID} .sr-choice-title {
                font-size: 17px;
                font-weight: 700;
                margin-bottom: 14px;
                color: ${theme.choiceTitle};
            }
            #${ROOT_ID} .sr-pills {
                display: flex;
                gap: 12px;
                justify-content: center;
                flex-wrap: wrap;
            }
            #${ROOT_ID} .sr-pill {
                padding: 16px 28px;
                border-radius: 8px;
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
                padding: 18px 22px;
                border-top: 1px solid rgba(255, 255, 255, 0.10);
                text-align: center;
            }
            #${ROOT_ID} .sr-quote {
                color: ${theme.quoteText};
                font-size: 14px;
                font-style: italic;
                line-height: 1.6;
            }
            #${ROOT_ID} .sr-quote-source {
                color: ${theme.textHint};
                font-size: 12px;
                margin-top: 10px;
            }
            #${ROOT_ID} .sr-side {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            #${ROOT_ID} .sr-panel {
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.06);
                padding: 16px;
            }
            #${ROOT_ID} .sr-panel-title {
                color: ${theme.textHint};
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                margin-bottom: 12px;
            }
            #${ROOT_ID} .sr-stat-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 10px;
            }
            #${ROOT_ID} .sr-stat strong {
                display: block;
                color: ${theme.text};
                font-size: 24px;
                font-variant-numeric: tabular-nums;
            }
            #${ROOT_ID} .sr-stat span {
                color: ${theme.textHint};
                font-size: 12px;
            }
            #${ROOT_ID} .sr-line {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                padding: 8px 0;
                border-top: 1px solid rgba(255, 255, 255, 0.09);
                color: ${theme.textMuted};
                font-size: 13px;
            }
            #${ROOT_ID} .sr-line:first-of-type {
                border-top: 0;
                padding-top: 0;
            }
            #${ROOT_ID} .sr-line strong {
                color: ${theme.text};
                text-align: right;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #${ROOT_ID} .sr-warning {
                color: ${theme.accent};
                font-size: 13px;
                line-height: 1.55;
            }
            @media (max-width: 880px) {
                #${ROOT_ID} {
                    padding: 16px;
                    align-items: flex-start;
                    overflow: auto;
                }
                #${ROOT_ID} .sr-container {
                    grid-template-columns: 1fr;
                }
                #${ROOT_ID} .sr-main {
                    min-height: auto;
                }
                #${ROOT_ID} .sr-side {
                    order: -1;
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }
            @media (max-width: 640px) {
                #${ROOT_ID} {
                    padding: 10px;
                }
                #${ROOT_ID} .sr-topbar {
                    align-items: flex-start;
                    flex-direction: column;
                }
                #${ROOT_ID} .sr-focus {
                    padding: 28px 16px;
                }
                #${ROOT_ID} .sr-title {
                    font-size: 26px;
                }
                #${ROOT_ID} .sr-progress {
                    width: 156px;
                    height: 156px;
                }
                #${ROOT_ID} .sr-timer {
                    font-size: 58px;
                }
                #${ROOT_ID} .sr-pill {
                    width: 100%;
                    min-width: 0;
                }
                #${ROOT_ID} .sr-side {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }

    function createMarkup(hostname, stats, session, quotaDomain) {
        const streakDays = getFocusStreakDays();
        const summary = getWeeklySummary();
        const topSite = summary.topSites[0] ? summary.topSites[0][0] : '暂无';
        const copy = getCopywriting(stats, streakDays);
        const warningText = [];
        if (isForceModeEnabled()) {
            warningText.push('强制模式：本次不能选择继续摸鱼');
        }
        if (isIncognitoContext()) {
            warningText.push('无痕模式提醒：用户脚本可能受浏览器隐私设置影响');
        }
        const remaining = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
        const progress = Math.max(0, Math.min(1, remaining / DEFAULTS.cooldown));
        return `
            <div class="sr-container">
                <div class="sr-main">
                    <div class="sr-topbar">
                        <div class="sr-site">${escapeHtml(hostname)}</div>
                        <div class="sr-mode">${isForceModeEnabled() ? '强制模式' : '冷静模式'} · ${copy.toneLabel}</div>
                    </div>
                    <div class="sr-focus">
                        <div class="sr-icon" id="sr-emoji">🛑</div>
                        <div class="sr-title">${copy.title}</div>
                        <div class="sr-subcopy">${copy.subtitle}</div>
                        <div class="sr-progress" id="sr-progress" style="--sr-progress: ${progress}">
                            <div class="sr-timer" id="sr-countdown">${remaining}</div>
                        </div>
                        <div class="sr-hint" id="sr-hint">${remaining}秒冷静期后做出你的选择</div>
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
                    </div>
                    <div class="sr-quote-wrap">
                        <div class="sr-quote" id="sr-quote">加载中...</div>
                        <div class="sr-quote-source" id="sr-quote-source"></div>
                    </div>
                </div>
                <div class="sr-side">
                    <div class="sr-panel">
                        <div class="sr-panel-title">拦截统计</div>
                        <div class="sr-stat-grid">
                            <div class="sr-stat"><strong>${stats.todayCount}</strong><span>今日</span></div>
                            <div class="sr-stat"><strong>${stats.totalCount}</strong><span>累计</span></div>
                            <div class="sr-stat"><strong>${summary.weeklyBlocks}</strong><span>近 7 天</span></div>
                            <div class="sr-stat"><strong>${streakDays}</strong><span>连续专注</span></div>
                        </div>
                    </div>
                    <div class="sr-panel">
                        <div class="sr-panel-title">当前判断</div>
                        <div class="sr-line"><span>成就</span><strong>${getAchievementText(stats, streakDays)}</strong></div>
                        <div class="sr-line"><span>今日配额</span><strong>${getQuotaStatusText(quotaDomain)}</strong></div>
                        <div class="sr-line"><span>本周高频站点</span><strong>${topSite}</strong></div>
                        <div class="sr-line"><span>高峰时段</span><strong>${summary.topHour}:00</strong></div>
                    </div>
                    ${warningText.length ? `<div class="sr-panel sr-warning">${warningText.join(' · ')}</div>` : ''}
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

    function mountBlockPage(stats, session, quotaDomain) {
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
            root.innerHTML = createMarkup(location.hostname, stats, session, quotaDomain);
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
        const progressEl = root.querySelector('#sr-progress');
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
            if (progressEl) {
                progressEl.style.setProperty('--sr-progress', String(Math.max(0, Math.min(1, remaining / DEFAULTS.cooldown))));
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
            if (progressEl) {
                progressEl.style.setProperty('--sr-progress', '0');
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

    function evaluateBlocking(trigger) {
        if (runtimeState.blockPageRequested || document.getElementById(ROOT_ID)) {
            return true;
        }
        if (!isBlockedDomain(location.hostname)) {
            logDebug('hostname not blocked', {
                hostname: location.hostname,
                trigger
            });
            return;
        }

        const quotaDomain = getQuotaDomain(location.hostname);
        if (canAccessWithinQuota(quotaDomain)) {
            if (!runtimeState.quotaSessionStarted) {
                runtimeState.quotaSessionStarted = true;
                logDebug('within quota, allow access', {
                    domain: quotaDomain,
                    trigger
                });
                startQuotaSession(quotaDomain);
            }
            return;
        }

        if (isBypassed(location.hostname)) {
            logDebug('bypass active', {
                hostname: location.hostname,
                trigger
            });
            return;
        }

        const existingSession = getBlockSession(normalizedDomain);
        const session = existingSession || startOrRefreshBlockSession(normalizedDomain);
        const stats = existingSession ? getCurrentBlockStats() : incrementBlockStats(normalizedDomain);
        runtimeState.blockPageRequested = true;
        logDebug('block page requested', {
            hostname: location.hostname,
            trigger,
            reusedSession: Boolean(existingSession)
        });
        mountBlockPage(stats, session, quotaDomain);
        return true;
    }

    function installStartupRechecks() {
        if (runtimeState.startupChecksInstalled) {
            return;
        }
        runtimeState.startupChecksInstalled = true;

        const recheck = (trigger) => {
            if (document.visibilityState === 'prerender') {
                return;
            }
            evaluateBlocking(trigger);
        };

        if (document.prerendering) {
            document.addEventListener('prerenderingchange', () => {
                recheck('prerenderingchange');
            }, { once: true });
        }

        [150, 600, 1500].forEach((delay) => {
            window.setTimeout(() => {
                recheck(`startup-timeout:${delay}`);
            }, delay);
        });

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', () => {
                recheck('DOMContentLoaded');
            }, { once: true });
        }

        window.addEventListener('load', () => {
            recheck('load');
        }, { once: true });

        window.addEventListener('pageshow', () => {
            recheck('pageshow');
        });

        window.addEventListener('focus', () => {
            recheck('focus');
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                recheck('visibilitychange');
            }
        });
    }

    function main() {
        registerMenuCommands();
        installStartupRechecks();
        evaluateBlocking('initial');
    }

    main();
})();
