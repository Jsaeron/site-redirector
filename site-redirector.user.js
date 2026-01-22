// ==UserScript==
// @name         Site Redirector Pro
// @name:zh-CN   网站重定向助手
// @namespace    https://github.com/Jsaeron/site-redirector
// @version      1.1.0
// @description  Block distracting websites with a cooldown timer and redirect to productive sites
// @description:zh-CN  拦截分心网站，冷静倒计时后重定向到指定网站，帮助你保持专注
// @author       Daniel
// @license      MIT
// @homepage     https://github.com/Jsaeron/site-redirector
// @supportURL   https://github.com/Jsaeron/site-redirector/issues
// @match        *://*.bilibili.com/*
// @match        *://*.douyin.com/*
// @match        *://*.weibo.com/*
// @match        *://x.com/*
// @match        *://*.x.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      v1.hitokoto.cn
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ============ 配置区域 ============
    const DEFAULT_TARGET = 'https://claude.ai';
    const CONFIG = {
        target: GM_getValue('redirectTarget', DEFAULT_TARGET),  // 重定向目标（可通过菜单修改）
        cooldown: 30,                  // 冷静期秒数
    };
    // =================================

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

    // 注册菜单命令：重置计数
    GM_registerMenuCommand('🔄 重置拦截计数', () => {
        GM_setValue('blockCount', 0);
        alert('拦截计数已重置！');
    });

    // 注册菜单命令：查看统计
    GM_registerMenuCommand('📊 查看拦截统计', () => {
        const count = GM_getValue('blockCount', 0);
        const target = GM_getValue('redirectTarget', DEFAULT_TARGET);
        alert(`累计拦截次数：${count}\n当前重定向目标：${target}`);
    });

    // 更新拦截计数
    const count = GM_getValue('blockCount', 0) + 1;
    GM_setValue('blockCount', count);

    // 阻止原页面加载
    document.documentElement.innerHTML = '';
    document.head.innerHTML = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #fff;
            }
            .container { text-align: center; padding: 20px; }
            .icon { font-size: 64px; margin-bottom: 20px; }
            .title { font-size: 28px; font-weight: 600; margin-bottom: 10px; }
            .subtitle { color: #e94560; margin-bottom: 8px; font-size: 14px; }
            .count { color: #888; margin-bottom: 40px; }
            .timer {
                font-size: 72px;
                font-weight: 700;
                color: #e94560;
                margin-bottom: 20px;
                font-variant-numeric: tabular-nums;
            }
            .hint { color: #666; font-size: 14px; }
            .quote-container { margin-top: 40px; padding: 20px; max-width: 500px; }
            .quote-text { color: #aaa; font-size: 16px; font-style: italic; line-height: 1.6; }
            .quote-source { color: #666; font-size: 12px; margin-top: 10px; }
            .actions { margin-top: 30px; display: flex; gap: 12px; justify-content: center; }
            .btn {
                padding: 10px 24px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 14px;
            }
            .btn-primary {
                background: #e94560;
                border: none;
                color: #fff;
            }
            .btn-primary:hover { background: #d63850; }
            .btn-secondary {
                background: transparent;
                border: 1px solid #444;
                color: #666;
            }
            .btn-secondary:hover { border-color: #888; color: #aaa; }
        </style>
    `;

    document.body.innerHTML = `
        <div class="container">
            <div class="icon">🛑</div>
            <div class="title">你确定要摸鱼吗？</div>
            <div class="subtitle">${location.hostname}</div>
            <div class="count">这是你第 <strong>${count}</strong> 次被拦截</div>
            <div class="timer" id="countdown">${CONFIG.cooldown}</div>
            <div class="hint">${CONFIG.cooldown}秒后跳转到工作页面</div>
            <div class="actions">
                <button class="btn btn-secondary" id="skip">算了，回去干活</button>
            </div>
            <div class="quote-container">
                <div class="quote-text" id="quote">加载中...</div>
                <div class="quote-source" id="quote-source"></div>
            </div>
        </div>
    `;

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
            window.location.replace(CONFIG.target);
        }
    }, 1000);

    // 直接跳转按钮
    document.getElementById('skip').addEventListener('click', () => {
        clearInterval(timer);
        window.location.replace(CONFIG.target);
    });
})();
