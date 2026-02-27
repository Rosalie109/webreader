import { extension_settings, getContext } from '/scripts/extensions.js';

const EXT_NAME = 'WebReader';

// 初始化设置 [cite: 2]
if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {
        lastUrl: '',
        lastPrompt: '',
        maxContentLength: 3000 // 限制抓取长度防止Token溢出
    };
}

$(document).ready(() => {
    // 注入UI到扩展设置面板 [cite: 3, 4]
    const interval = setInterval(() => {
        const container = document.getElementById('extensions_settings');
        if (container) {
            clearInterval(interval);
            initWebReaderUI(container);
        }
    }, 500);
});

function initWebReaderUI(container) {
    const html = `
    <div id="web-reader-extension" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌐 网页内容读取器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display: none; padding: 10px;">
            <div style="margin-bottom: 10px;">
                <label>网页链接 (支持小红书/新闻/微博):</label>
                <input type="text" id="wr_url" class="text_pole" placeholder="https://..." style="width: 100%;" value="${extension_settings[EXT_NAME].lastUrl}">
            </div>
            <div style="margin-bottom: 10px;">
                <label>你的话 (提示词):</label>
                <textarea id="wr_prompt" class="text_pole" style="width: 100%; height: 60px;" placeholder="例如：你看这个新闻怎么看？">${extension_settings[EXT_NAME].lastPrompt}</textarea>
            </div>
            <button type="button" id="wr_process" class="menu_button" style="width: 100%;">发送给角色阅读</button>
        </div>
    </div>
    `;
    container.insertAdjacentHTML('beforeend', html);

    // 折叠面板逻辑 [cite: 23, 24, 25]
    $('#web-reader-extension .inline-drawer-toggle').on('click', function() {
        const content = $(this).next();
        content.slideToggle();
        $(this).find('.inline-drawer-icon').toggleClass('down up');
    });

    // 绑定发送事件
    $('#wr_process').on('click', async () => {
        const url = $('#wr_url').val().trim();
        const userPrompt = $('#wr_prompt').val().trim();

        if (!url) return toastr.error("请输入链接");
        
        // 保存设置 [cite: 39]
        extension_settings[EXT_NAME].lastUrl = url;
        extension_settings[EXT_NAME].lastPrompt = userPrompt;
        const ctx = getContext();
        ctx.saveSettingsDebounced();

        await processWebReading(url, userPrompt);
    });
}

async function processWebReading(url, userPrompt) {
    if (window.is_generating) return toastr.warning("AI正在生成中..."); [cite: 44]

    toastr.info("正在抓取网页内容并解析...", "网页读取");
    
    try {
        // 使用 r.jina.ai 作为爬虫代理，解决小红书反爬问题 
        const jinaUrl = `https://r.jina.ai/${url}`;
        const response = await fetch(jinaUrl, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error("网页抓取失败");
        const data = await response.json();
        
        // 提取正文并限制字数防止溢出 [cite: 60, 62]
        let webContent = data.data.content || "无法提取正文";
        webContent = webContent.substring(0, extension_settings[EXT_NAME].maxContentLength);

        // 构造发送给AI的静默Prompt [cite: 49, 51]
        const finalPrompt = `
[系统通知：用户分享了一个网页内容给你。
--- 网页摘要 ---
${webContent}
--- 网页结束 ---
用户对你说：${userPrompt || "你看这个内容了吗？"}]
请结合以上网页内容，以你的角色身份进行回复。`;

        toastr.success("网页抓取成功，等待角色回应...", "网页读取");

        // 调用酒馆接口生成回复 [cite: 40, 41]
        const ctx = getContext();
        await ctx.generateQuietPrompt({ quietPrompt: finalPrompt, skipWIAN: false });

    } catch (error) {
        console.error(error);
        toastr.error("抓取失败，可能是该链接有强力防火墙");
    }
}
