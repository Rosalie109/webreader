import { extension_settings, getContext } from '../../../extensions.js';

const EXT_NAME = 'WebLinkReader';

// 初始化设置
if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {
        maxLength: 2500, // 默认抓取前2500个字符，防止Token溢出
        defaultPrompt: '请阅读以下网页内容，并结合我给你的留言进行回复。'
    };
}

$(document).ready(() => {
    // 寻找扩展设置容器并注入UI
    const interval = setInterval(() => {
        const container = document.getElementById('extensions_settings');
        if (container) {
            clearInterval(interval);
            initWebReaderUI(container);
        }
    }, 500);
});

function initWebReaderUI(container) {
    // 移除旧的界面防止重复渲染
    $('#web-reader-extension').remove();

    const html = `
    <div id="web-reader-extension" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🌐 网页链接读取器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display: none; padding: 10px;">
            <div style="margin-bottom: 10px;">
                <label>网页链接:</label>
                <input type="text" id="wr_url" class="text_pole" placeholder="粘贴小红书/微博/新闻链接..." style="width: 100%; margin-top:5px;">
            </div>
            <div style="margin-bottom: 10px;">
                <label>你想对他说的话:</label>
                <textarea id="wr_user_prompt" class="text_pole" style="width: 100%; height: 60px;" placeholder="例如：你看这事你怎么看？"></textarea>
            </div>
            <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                <label>内容长度限制:</label>
                <input type="number" id="wr_max_length" class="text_pole" style="width: 40%;" value="${extension_settings[EXT_NAME].maxLength}">
            </div>
            <button type="button" id="wr_execute" class="menu_button" style="width: 100%; background: #2e5a8e;">读取网页并发送</button>
            <p style="font-size: 0.8em; color: #888; margin-top: 8px;">* 使用 Jina Reader 自动解析，支持绕过部分反爬</p>
        </div>
    </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
// 折叠面板交互逻辑（修复版）
    const drawerToggle = document.querySelector('#web-reader-extension .inline-drawer-toggle');
    if (drawerToggle) {
        drawerToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // 关键：阻止事件冒泡给酒馆核心层
            const icon = this.querySelector('.inline-drawer-icon');
            const content = this.nextElementSibling;
            if (content) {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                if (icon) {
                    isHidden ? icon.classList.replace('down', 'up') : icon.classList.replace('up', 'down');
                }
            }
        });
    }
    // 绑定保存设置事件
    $('#wr_max_length').on('input', function() {
        extension_settings[EXT_NAME].maxLength = Number($(this).val());
        getContext().saveSettingsDebounced();
    });

    // 执行爬取逻辑
    $('#wr_execute').on('click', handleWebRead);
}

async function handleWebRead() {
    const url = $('#wr_url').val().trim();
    const userPrompt = $('#wr_user_prompt').val().trim();
    const maxLength = extension_settings[EXT_NAME].maxLength;

    if (!url) {
        toastr.error("请输入有效的网页链接");
        return;
    }

    if (window.is_generating) {
        toastr.warning("AI 正在思考中，请稍后再试");
        return;
    }

    toastr.info("正在调取 Jina Reader 解析网页...");
    
   try {
        const readerUrl = `https://r.jina.ai/${url}`; // Jina官方推荐直接拼在后面
        
        const response = await fetch(readerUrl, {
            method: 'GET',
            headers: {
                'X-Return-Format': 'markdown', 
                // 'Authorization': 'Bearer 你的JINA_API_KEY' // 如果你有API Key，取消注释这行并填入
            }
        });

        // 【修改1：精准捕获 HTTP 错误状态】
        if (!response.ok) {
            throw new Error(`Jina 返回错误: ${response.status} ${response.statusText}`);
        }

        let webContent = await response.text();
        
        // 【修改2：增加内容为空的校验】
        if (!webContent || webContent.trim() === '') {
            throw new Error("抓取成功但内容为空，可能被目标网站反爬拦截");
        }

        // 1. 防止Token溢出：截取长度
        const cleanContent = webContent.substring(0, maxLength);

        // 2. 构造发送给AI的消息模板
        const finalPrompt = `【系统通知：用户分享了一个网页】\n\n` +
                          `网页原文内容截选：\n---\n${cleanContent}\n---\n\n` +
                          `用户的留言：${userPrompt || "你看今天发生了这事。"}\n\n` +
                          `请结合网页内容和我的留言与我交谈。`;

        // 3. 将消息填入输入框并自动发送
        const textarea = document.getElementById('send_textarea');
        textarea.value = finalPrompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        $('#send_button').trigger('click');
        toastr.success("网页内容已成功发送给 AI");
        $('#wr_url').val(''); // 清空链接框

    } catch (error) {
        // 【修改3：在控制台和UI上显示真实的错误原因】
        console.error("WebReader Error Details:", error);
        toastr.error(`${error.message}`, "网页解析失败");
    }
