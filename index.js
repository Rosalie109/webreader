import { extension_settings, getContext } from '../../../extensions.js';

const EXT_NAME = 'WebLinkReader';

// 初始化基础配置 [cite: 2]
if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {
        maxLength: 2500,
        defaultPrompt: ''
    };
}

// 确保在酒馆 DOM 加载后注入 UI 
$(document).ready(() => {
    const interval = setInterval(() => {
        const container = document.getElementById('extensions_settings');
        if (container) {
            clearInterval(interval);
            initWebReaderUI(container);
        }
    }, 500);
});

function initWebReaderUI(container) {
    $('#web-reader-extension').remove();

    // 使用与微信插件一致的 inline-drawer 结构确保兼容性 [cite: 8]
    const html = `
    <div id="web-reader-extension" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌐 网页链接读取器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display: none;">
            <div style="padding: 10px;">
                <div style="margin-bottom: 15px;">
                    <label>网页链接:</label>
                    <input type="text" id="wr_url" class="text_pole" placeholder="小红书/微博/新闻链接..." style="width: 100%;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>提示词 (想对TA说的话):</label>
                    <textarea id="wr_user_prompt" class="text_pole" style="width: 100%; height: 60px;" placeholder="你看今天发生了这事..."></textarea>
                </div>
                <div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
                    <label>字数上限:</label>
                    <input type="number" id="wr_max_length" class="text_pole" style="width: 50%;" value="${extension_settings[EXT_NAME].maxLength}">
                </div>
                <button type="button" id="wr_execute" class="menu_button" style="width: 100%;">读取并发送</button>
            </div>
        </div>
    </div>
    `;

    container.insertAdjacentHTML('beforeend', html);

    // 修复无法展开的问题：使用与微信插件一致的事件委派或直接绑定 [cite: 23, 24, 25]
    const drawerToggle = document.querySelector('#web-reader-extension .inline-drawer-toggle');
    if (drawerToggle) {
        drawerToggle.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            const icon = this.querySelector('.inline-drawer-icon');
            if (icon) {
                isHidden ? icon.classList.replace('down', 'up') : icon.classList.replace('up', 'down');
            }
        });
    }

    // 保存设置逻辑 [cite: 27, 39]
    $('#wr_max_length').on('input', function() {
        extension_settings[EXT_NAME].maxLength = Number($(this).val());
        const ctx = getContext();
        ctx.saveSettingsDebounced();
    });

    // 绑定执行按钮
    $('#wr_execute').on('click', handleWebRead);
}

async function handleWebRead() {
    const url = $('#wr_url').val().trim();
    const userPrompt = $('#wr_user_prompt').val().trim();
    const maxLength = extension_settings[EXT_NAME].maxLength;

    if (!url) return toastr.error("请输入链接");
    if (window.is_generating) return toastr.warning("AI 正在生成中...");

    toastr.info("正在通过 Jina Reader 爬取网页...");

    try {
        const response = await fetch(`https://r.jina.ai/${url}`);
        if (!response.ok) throw new Error("网络请求失败");
        
        let webContent = await response.text();
        const cleanContent = webContent.substring(0, maxLength); // 截断防止溢出

        // 构造最终发送给 AI 的指令
        const finalPrompt = `[系统指令：用户分享了一个网页内容如下：\n\n${cleanContent}\n\n用户留言：${userPrompt || "你看这事你怎么看？"}]`;

        // 模拟输入并发送
        const textarea = document.getElementById('send_textarea');
        textarea.value = finalPrompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        $('#send_button').trigger('click');

        toastr.success("内容已解析并发送");
        $('#wr_url').val(''); 
    } catch (error) {
        toastr.error("爬取出错，请检查链接或网络");
    }
}
