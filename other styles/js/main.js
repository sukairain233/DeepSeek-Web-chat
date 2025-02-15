const G = 'xxx'; // 原密钥的Base64编码
const A = atob(G); // 解码得到原始密钥

let currentChatId = null;
let chats = {};
let currentAttachment = null;  // 当前附件


console.log("%c 𝒞𝑜𝓅𝓎𝓇𝒾𝑔𝒽𝓉 𝑀𝒾𝓃𝒹 𝒜𝓁𝓁 𝒿𝓊𝓈𝓉 𝒶 𝒹𝓎𝓃𝒶𝓂𝒾𝒸 𝒹𝑒𝓈𝒾𝑔𝓃 ", "color: #ff69b4; font-family: 'Courier New', Courier, monospace; font-size: 26px; text-shadow: 2px 2px 5px rgba(255, 105, 180, 0.6);");
console.log("%c ✨ 版 权 所 有 ，保 留 一 切 权 利 ✨", "color: #ff1493; font-size: 22px; font-family: 'Arial', sans-serif; background-color: #ffe4e1; padding: 5px; border-radius: 10px; box-shadow: 0 4px 8px rgba(255, 20, 147, 0.3);");
console.log("%c 🚀 访问主站 www.hvhbbs.cc 🚀", "color: #ff69b4; font-size: 20px; font-family: 'Verdana', sans-serif; font-weight: bold; text-decoration: underline;");
console.log("%c 🌐 访问：chat.hvhbbs.cc 🌐", "color: #ffb6c1; font-size: 18px; font-style: italic; text-shadow: 1px 1px 3px rgba(255, 182, 193, 0.6);");
console.log("%c 💡 由 HVHBBS.CC 提供技术支持 💡", "color: #ff1493; background-color: #fff0f5; font-size: 16px; padding: 3px 8px; border-radius: 5px;");
console.log("%c 🌟 所有创作与灵感归属于 HVHBBS.CC ＆ Sukairain 开发组🌟", "color: #ff6347; font-size: 18px; font-family: 'Times New Roman', Times, serif; font-weight: bold; text-transform: uppercase;");
console.log("%c 💬 你所热爱的就是你的生活 💬", "color: #ff69b4; font-size: 16px; font-style: italic; background-color: #ffe4e1; padding: 3px 6px; border-radius: 5px;");


// 初始化marked
marked.setOptions({
    breaks: true,
    highlight: code => hljs.highlightAuto(code).value
});

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
    const lastChatId = localStorage.getItem('lastChatId');
    if (lastChatId && chats[lastChatId]) {
        switchChat(lastChatId);
    } else {
        createNewChat();
    }
});

// 加载历史记录
function loadChatHistory() {
    const history = localStorage.getItem('chatHistory');
    if (history) {
        chats = JSON.parse(history);
        // 为历史记录添加model字段的兼容处理
        Object.keys(chats).forEach(id => {
            if (!chats[id].model) {
                chats[id].model = 'deepseek-chat';
            }
        });
        renderHistoryList();
    }
}

// 渲染历史记录列表
function renderHistoryList() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    Object.keys(chats).forEach(id => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = chats[id].title || '新对话';
        item.onclick = () => switchChat(id);
        if (id === currentChatId) item.classList.add('active');
        historyList.appendChild(item);
    });
}

// 创建新对话
function createNewChat() {
    const chatId = Date.now().toString();
    currentChatId = chatId;
    chats[chatId] = {
        title: '新对话',
        model: 'deepseek-chat', // 新增模型字段
        messages: []
    };
    renderChat();
    renderHistoryList();
    updateModelSelect(chats[chatId].model); // 更新选择框
    saveChatHistory();
}

// 切换对话
function switchChat(chatId) {
    currentChatId = chatId;
    renderChat();
    renderHistoryList();
    updateModelSelect(chats[chatId].model); // 更新选择框
}

// 渲染当前对话
function renderChat() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = '';
    const messages = chats[currentChatId].messages;
    messages.forEach(msg => addMessage(msg.role, msg.content, msg.role === 'assistant'));
}

// 新增：切换联网搜索状态
function toggleWebSearch(checked) {
    const uploadLabel = document.getElementById('upload-label');
    const fileUpload = document.getElementById('file-upload');
    if (checked) {
        uploadLabel.classList.add('disabled');
        fileUpload.disabled = true;
        currentAttachment = null;  // 清除已有附件
    } else {
        uploadLabel.classList.remove('disabled');
        fileUpload.disabled = false;
    }
}

// 新增：处理文件上传
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        currentAttachment = {
            name: file.name,
            content: e.target.result,
            type: file.type
        };
        // 显示附件提示
        addMessage('system', `已附加文件：${file.name} (${(file.size/1024).toFixed(2)}KB)`, false);
    };
    reader.readAsText(file);
}

// 修改后的发送消息函数
async function sendMessage() {
    const message = document.getElementById('user-input').value.trim();
    if (!message && !currentAttachment) return;

    disableInput();
    
    // 构建消息内容
    let fullContent = message;
    if (currentAttachment) {
        fullContent += `\n[附件：${currentAttachment.name}]\n${currentAttachment.content}`;
    }
    if (document.getElementById('web-search').checked) {
        fullContent += '\n（启用联网搜索）';
    }

    addMessage('user', fullContent, false);
    chats[currentChatId].messages.push({ 
        role: 'user',
        content: fullContent,
        meta: {
            attachment: currentAttachment,
            webSearch: document.getElementById('web-search').checked
        }
    });

    try {
        const loadingId = addLoadingIndicator();
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${A}` // 使用解码后的密钥
            },
            body: JSON.stringify({
                model: chats[currentChatId].model,
                messages: chats[currentChatId].messages,
                stream: false,
                web_search: document.getElementById('web-search').checked
            })
        });

        const data = await response.json();
        removeLoadingIndicator(loadingId);

        if (data.choices?.length > 0) {
            const aiResponse = data.choices[0].message.content;
            
            // 在 AI 回复前加上 "AI:"
            const formattedResponse =  aiResponse;
            
            // 添加 AI 回复到聊天界面
            addMessage('assistant', formattedResponse, true);
            
            // 更新当前聊天记录
            chats[currentChatId].messages.push({ 
                role: 'assistant', 
                content: formattedResponse,
                meta: {
                    webSearchUsed: document.getElementById('web-search').checked
                }
            });
            
            // 更新对话标题
            updateChatTitle(message);
        }
        
    } catch (error) {
        console.error('请求出错:', error);
        addMessage('assistant', `请求出错：${error.message}`, false);
    } finally {
        // currentAttachment = null;  // 清空附件
        // document.getElementById('file-upload').value = '';  // 清空文件选择
        enableInput();
        saveChatHistory();
        localStorage.setItem('lastChatId', currentChatId);  // 保存当前对话ID
    }
}


// 添加消息到界面
function addMessage(role, content, isMarkdown) {
    const chatContainer = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    if (role === 'assistant') {
        // 给AI消息添加一个特定的类
        messageDiv.classList.add('ai-message');
    } else if (role === 'user') {
        // 给用户消息添加一个特定的类
        messageDiv.classList.add('user-message');
    }

    if (isMarkdown) {
        messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));
    } else {
        messageDiv.textContent = content;
    }

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}


// 更新对话标题
function updateChatTitle(message) {
    if (!chats[currentChatId].title || chats[currentChatId].title === '新对话') {
        chats[currentChatId].title = message.substring(0, 50);
        renderHistoryList();
    }
}

// 保存聊天记录
function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chats));
    localStorage.setItem('lastChatId', currentChatId);
}

// 添加加载状态
function addLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message loading';
    loadingDiv.id = Date.now();
    loadingDiv.textContent = '正在思考中...';
    document.getElementById('chat-container').appendChild(loadingDiv);
    return loadingDiv.id;
}

// 移除加载状态
function removeLoadingIndicator(id) {
    const element = document.getElementById(id);
    if (element) element.remove();
}

// 禁用输入
function disableInput() {
    document.getElementById('user-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
}

// 启用输入
function enableInput() {
    const input = document.getElementById('user-input');
    input.disabled = false;
    input.value = '';
    input.focus();
    document.getElementById('send-btn').disabled = false;
}

// 新增模型更新函数
function updateModel(model) {
    chats[currentChatId].model = model;
    saveChatHistory();
}

// 新增模型选择框更新函数
function updateModelSelect(selectedModel) {
    const select = document.getElementById('model-select');
    select.value = selectedModel;
}

// 修改后的删除所有对话功能
function deleteAllChats() {
    if (confirm('确定要删除所有对话吗？')) {
        localStorage.removeItem('lastChatId');
        chats = {};
        createNewChat();
        saveChatHistory();
    }
}

function adjustHeight(element) {
    // 重置高度，以便重新计算
    element.style.height = 'auto';

    // 设置新的高度，确保文本内容不会被截断
    element.style.height = (element.scrollHeight) + 'px';

    // 如果高度超过最大值，则应用滚动条
    if (element.scrollHeight > 150) {
        element.style.height = '150px';  // 最大高度
    }
}

