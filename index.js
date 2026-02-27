import { extension_settings, getContext, saveSettingsDebounced } from '../../../extensions.js';

const EXT_NAME = 'WebLinkReader';

// 初始化设置
if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {
        maxLength: 2500,
        defaultPrompt: '请阅读以下网页内容，并结合我给你的留言进行回复。'
    };
}

// 这里的监听器改为酒馆标准的模块加载方式
$(document).ready(() => {
    function addSettings() {
        // 检查是否已经存在，避免重复注入
        if ($('#web-reader-extension').length > 0) return;

        const container = $('#extensions_settings');
        if (!container.length) return;

        const html = `
        <div id="web-reader-extension" class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🌐 网页链接读取器</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display: none; padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <label>网页链接:</label>
                    <input type="text" id="wr_url" class="text_pole" placeholder="粘贴链接..." style="width: 100%;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label>留言/指令:</label>
                    <textarea id="wr_user_prompt" class="text_pole" style="width: 100%; height: 60px;" placeholder="例如：总结这篇文章"></textarea>
                </div>
                <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                    <label>长度限制:</label>
                    <input type="number" id="wr_max_length" class="text_pole" style="width: 40%;" value="${extension_settings[EXT_NAME].maxLength}">
                </div>
                <button type="button" id="wr_execute" class="menu_button" style="width: 100%;">读取网页并发送</button>
                <p style="font-size: 0.8em; color: #888; margin-top: 8px;">* 使用 Jina Reader 解析 (r.jina.ai)</p>
            </div>
        </div>
        `;

        container.append(html);

        // 核心修复：手动绑定折叠逻辑
        $('#web-reader-extension .inline-drawer-toggle').on('click', function() {
            const drawer = $(this).closest('.inline-drawer');
            const content = drawer.children('.inline-drawer-content');
            const icon = $(this).find('.inline-drawer-icon');
            
            content.stop(true, true).slideToggle(200);
            icon.toggleClass('down up');
        });

        // 绑定设置保存
        $('#wr_max_length').on('input', function() {
            extension_settings[EXT_NAME].maxLength = Number($(this).val());
            saveSettingsDebounced();
        });

        // 绑定执行按钮
        $('#wr_execute').on('click', handleWebRead);
    }

    // 每隔1秒检查一次，直到容器加载完成（酒馆切页面时可能需要重新检查）
    setInterval(addSettings, 1000);
});

async function handleWebRead() {
    const url = $('#wr_url').val().trim();
    const userPrompt = $('#wr_user_prompt').val().trim() || extension_settings[EXT_NAME].defaultPrompt;
    const maxLength = extension_settings[EXT_NAME].maxLength;

    if (!url) {
        toastr.error("请输入有效的网页链接");
        return;
    }

    // 检查是否正在生成
    if ($('#send_button').is(':hidden')) { 
        toastr.warning("AI 正在思考中，请稍后再试");
        return;
    }

    toastr.info("正在解析网页...");
    
    try {
        const readerUrl = `https://r.jina.ai/${url}`;
        const response = await fetch(readerUrl);

        if (!response.ok) throw new Error("无法访问 Jina Reader");

        let webContent = await response.text();
        const cleanContent = webContent.substring(0, maxLength);

        const finalPrompt = `【系统：网页内容已读取】\n\n` +
                          `内容：\n---\n${cleanContent}\n---\n\n` +
                          `指令：${userPrompt}`;

        // 直接通过酒馆内部函数发送（比模拟点击更稳定）
        const context = getContext();
        await context.setVariable('web_content', cleanContent); // 可选：存入变量
        
        // 模拟填入输入框并发送
        $('#send_textarea').val(finalPrompt).trigger('input');
        $('#send_button').trigger('click');

        toastr.success("已发送至 AI");
        $('#wr_url').val(''); 

    } catch (error) {
        console.error("WebReader Error:", error);
        toastr.error("解析失败，可能是由于网络波动或链接不受支持");
    }
}
