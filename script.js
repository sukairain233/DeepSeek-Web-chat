const encodedAPIKey = ''; //这个地方填你的api，api要base64的，直接填api等着报错吧
        const API_KEY = atob(encodedAPIKey); 

        let currentChatId = null;
        let chats = {};
        let currentAttachment = null;  // 当前附件

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
                        'Authorization': `Bearer ${API_KEY}` // 使用解码后的密钥
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
                    addMessage('assistant', aiResponse, true);
                    chats[currentChatId].messages.push({ 
                        role: 'assistant', 
                        content: aiResponse,
                        meta: {
                            webSearchUsed: document.getElementById('web-search').checked
                        }
                    });
                    updateChatTitle(message);
                }
            } catch (error) {
                console.error('请求出错:', error);
                addMessage('assistant', `请求出错：${error.message}`, false);
            } finally {
                currentAttachment = null;  // 清空附件
                document.getElementById('file-upload').value = '';  // 清空文件选择
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
            loadingDiv.textContent = '正在思考中...(如果你的输入过长，或输出过长,请耐心等待)';
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
