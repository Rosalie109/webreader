// 1. 修正导入，增加 saveSettingsDebounced 确保设置能保存
import { extension_settings, getContext, saveSettingsDebounced } from '../../../extensions.js';

const EXT_NAME = 'WebLinkReader';

// 初始化设置
if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {
        maxLength: 2500,
        defaultPrompt: '请阅读以下网页内容，并结合我给你的留言进行回复。'
    };
}

// 2. 核心：定义注入 UI 的函数
function injectWebReaderUI() {
    // 如果已经存在则退出，防止重复
    if (document.getElementById('web-reader-extension')) return;

    const container = document.getElementById('extensions_settings');
    if (!container) return;

    const html = `
    <div id="web-reader-extension" class="extension_inline_container">
        <div id="web-reader-toggle" style="cursor: pointer; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
            <b>🌐 网页链接读取器</b>
            <span id="wr-icon" class="fa-solid fa-chevron-down"></span>
        </div>
        
        <div id="web-reader-content" style="display: none; padding: 15px; border: 1px solid rgba(255,255,255,0.1); border-top: none;">
            <div style="margin-bottom: 10px;">
                <label>网页链接:</label>
                <input type="text" id="wr_url" class="text_pole" placeholder="https://..." style="width: 100%;">
            </div>
            <div style="margin-bottom: 10px;">
                <label>你想说的话:</label>
                <textarea id="wr_user_prompt" class="text_pole" style="width: 100%; height: 60px;" placeholder="总结一下这个网页"></textarea>
            </div>
            <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                <label>长度限制:</label>
                <input type="number" id="wr_max_length" class="text_pole" style="width: 80px;" value="${extension_settings[EXT_NAME].maxLength}">
            </div>
            <button type="button" id="wr_execute" class="menu_button" style="width: 100%; background-color: var(--bracket-color);">读取网页并发送</button>
        </div>
    </div>
    `;

    container.insertAdjacentHTML('beforeend', html);

    // 绑定展开/收起事件 (不依赖酒馆自带类名，最稳妥)
    document.getElementById('web-reader-toggle').addEventListener('click', () => {
        const content = document.getElementById('web-reader-content');
        const icon = document.getElementById('wr-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
        } else {
            content.style.display = 'none';
            icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
        }
    });

    // 绑定保存逻辑
    document.getElementById('wr_max_length').addEventListener('input', (e) => {
        extension_settings[EXT_NAME].maxLength = Number(e.target.value);
        saveSettingsDebounced();
    });

    // 绑定执行按钮
    document.getElementById('wr_execute').addEventListener('click', handleWebRead);
}

// 3. 执行网页抓取逻辑
async function handleWebRead() {
    const url = document.getElementById('wr_url').value.trim();
    const userPrompt = document.getElementById('wr_user_prompt').value.trim();
    const maxLength = extension_settings[EXT_NAME].maxLength;

    if (!url) {
        toastr.error("请输入链接");
        return;
    }

    toastr.info("正在调取 Jina Reader 解析...");
    
    try {
        const response = await fetch(`https://r.jina.ai/${url}`);
        if (!response.ok) throw new Error("解析失败");

        let text = await response.text();
        const cleanContent = text.substring(0, maxLength);

        const finalPrompt = `【网页内容】\n${cleanContent}\n\n【用户留言】\n${userPrompt || "请分析以上内容"}`;

        // 模拟填入输入框并发送
        const textarea = document.getElementById('send_textarea');
        textarea.value = finalPrompt;
        // 触发 input 事件让酒馆感知到内容变化
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        document.getElementById('send_button').click();
        
        toastr.success("已发送！");
        document.getElementById('wr_url').value = '';
    } catch (e) {
        toastr.error("解析出错，请检查网络");
    }
}

// 4. 入口点：酒馆加载时执行
$(document).ready(() => {
    // 监听设置面板打开的事件，或者简单地定时检查
    const checkInterval = setInterval(() => {
        if (document.getElementById('extensions_settings')) {
            injectWebReaderUI();
            // 注意：不要清除 interval，因为切角色或切面板时 UI 可能会被销毁重绘
        }
    }, 1000);
});
