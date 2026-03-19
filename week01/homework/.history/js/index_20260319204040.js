document.addEventListener('DOMContentLoaded', function() {
  // 🔥 1. 本地存储 API Key（后端从.env读取，前端仅做用户输入提示）
  // 注意：完整版后端从.env取Key，前端不用传apiKey，只需提示用户配置.env
  let isApiKeyConfigured = localStorage.getItem('API_KEY_CONFIGURED');
  if (!isApiKeyConfigured) {
    alert("请先在后端 .env 文件中配置 LINGXI_API_KEY！\n配置完成后刷新页面");
    localStorage.setItem('API_KEY_CONFIGURED', 'true');
  }

  // 模式调整 
  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = themeBtn.querySelector("img");
  const transferBtn = document.getElementById("transfer-button");
  const transferIcon = transferBtn.querySelector("img");
  const deleteBtn = document.getElementById("delete-button");
  const deleteIcon = deleteBtn.querySelector("img");
  const chatMessage = document.getElementById("chat-messages"); // 对话容器

  const iconPaths = {
    transfer: {
      dark: "./assets/paperclip.svg",
      light: "./assets/paperclipBlack.svg"
    },
    trash: {
      dark: "./assets/trash.svg",
      light: "./assets/trashBlack.svg"
    },
    theme: {
      dark: "./assets/moon.svg",
      light: "./assets/sun.svg"
    }
  };

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('lightmode');
    themeIcon.src = iconPaths.theme.light;
    transferIcon.src = iconPaths.transfer.light;
    deleteIcon.src = iconPaths.trash.light;
  } else {
    themeIcon.src = iconPaths.theme.dark;
    transferIcon.src = iconPaths.transfer.dark;
    deleteIcon.src = iconPaths.trash.dark;
  }

  themeBtn.onclick = function() {
    const isLightNow = document.body.classList.toggle('lightmode');
    themeIcon.src = isLightNow ? iconPaths.theme.light : iconPaths.theme.dark;
    transferIcon.src = isLightNow ? iconPaths.transfer.light : iconPaths.transfer.dark;
    deleteIcon.src = isLightNow ? iconPaths.trash.light : iconPaths.trash.dark;
    localStorage.setItem('theme', isLightNow ? 'light' : 'dark');
  };

  // 对话框高度调整 
  const textarea = document.querySelector('form textarea');
  const inputArea = document.querySelector('.input-area');
  const fileInput = document.getElementById("image-input");
  const previewContainer = document.getElementById('preview-container');
  const previewImage = document.getElementById('preview-image');
  const submitBtn = document.getElementById("submit-button");
  const imageViewer = document.getElementById('image-viewer');
  const largeImage = document.getElementById('large-image');

  // 调整输入框高度
  function adjustTextareaHeight() {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = parseInt(getComputedStyle(textarea).maxHeight);
    textarea.style.height = (scrollHeight > maxHeight ? maxHeight : scrollHeight) + 'px';
  }

  // 统一更新按钮状态（文字+图片） 
  function updateButtonState() {
    const hasText = textarea.value.trim() !== '';
    const hasFile = fileInput.files.length > 0;
    const hasContent = hasText || hasFile;

    if (hasContent) {
      inputArea.classList.add('has-content');
      if (hasFile) {
        transferBtn.style.display = 'none';
        previewContainer.style.display = 'block'; 
      } else {
        transferBtn.style.display = 'flex';
        previewContainer.style.display = 'none'; 
      }
      submitBtn.style.display = 'flex';
    } else {
      inputArea.classList.remove('has-content');
      transferBtn.style.display = 'flex'; 
      previewContainer.style.display = 'none'; 
      submitBtn.style.display = 'none';
    }
  }

  // 🔥 2. 创建对话气泡（核心功能）
  function createBubble(content, isUser = true, isThinking = false) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`;
    
    if (isUser) {
      bubble.textContent = content;
      return bubble;
    }
    
    bubble.innerHTML = `
      <div class="ai-avatar">
          <img src="./assets/dragon.jpg" alt="AI头像"> 
      </div>
      <div class="ai-content ${isThinking ? 'thinking' : ''}">
          ${isThinking ? '<span class="loading-dots">●●●</span><span>思考中...</span>' : content}
      </div>
    `;
    return bubble;
  }

  // 🔥 3. 发送消息+对接完整版后端（核心适配）
  async function sendMessage() {
    const text = textarea.value.trim();
    if (!text) return;

    // 1. 创建用户气泡
    const userBubble = createBubble(text, true);
    chatMessage.appendChild(userBubble);
    
    // 2. 创建AI思考中气泡
    const aiBubble = createBubble('', false, true);
    chatMessage.appendChild(aiBubble);
    const aiContent = aiBubble.querySelector('.ai-content');
    
    // 3. 滚动到最新消息
    chatMessage.scrollTop = chatMessage.scrollHeight;

    try {
      // 4. 调用完整版后端接口（无需传apiKey，后端从.env读取）
      const response = await fetch(`http://localhost:3001/api/chat?message=${encodeURIComponent(text)}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errData.error || `HTTP错误：${response.status}`);
      }

      // 5. 适配后端的流式+伪流式兜底逻辑
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullAnswer = '';
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n').filter(line => line);

        for (const line of lines) {
          if (line === 'data: [DONE]') continue;

          try {
            // 移除思考中样式（兼容后端首次推送）
            if (isFirstChunk && aiContent.classList.contains('thinking')) {
              aiContent.classList.remove('thinking');
              aiContent.innerHTML = '';
              isFirstChunk = false;
            }

            // 解析后端返回的文字（兼容原生流式+伪流式）
            const prefix = 'data: ';
            if (line.startsWith(prefix)) {
              const data = JSON.parse(line.slice(prefix.length));
              if (data.text) {
                fullAnswer += data.text;
                aiContent.innerHTML = fullAnswer;
                chatMessage.scrollTop = chatMessage.scrollHeight;
              }
            }
          } catch (err) {
            console.error('解析数据失败：', err);
            if (aiContent.innerHTML.indexOf('解析失败') === -1) {
              aiContent.innerHTML = `解析失败：${err.message}`;
            }
          }
        }
      }

    } catch (err) {
      // 适配后端的错误提示
      aiContent.classList.remove('thinking');
      aiContent.innerHTML = `抱歉，生成失败：${err.message}`;
      console.error('发送失败：', err);
    }
  }

  // 🔥 4. 新增：中断生成功能（对接后端/api/stop）
  async function stopGeneration() {
    try {
      await fetch('http://localhost:3001/api/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('已请求中断生成');
    } catch (err) {
      console.error('中断失败：', err);
    }
  }

  // 绑定事件 
  textarea.addEventListener('input', function() {
    adjustTextareaHeight();
    updateButtonState();
  });

  transferBtn.addEventListener("click", function() {
    fileInput.click();
    console.log('按钮被点击了');
  });

  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return; 

    if (!file.type.startsWith('image/')) {
      alert('请选择jpg/png等图片格式！');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      previewImage.src = event.target.result;
      previewContainer.style.display = 'block';
      transferBtn.style.display = 'none';
      updateButtonState();
      largeImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  previewContainer.addEventListener('click', function() {
    imageViewer.style.display = 'flex';
  });

  imageViewer.addEventListener('click', function() {
    imageViewer.style.display = 'none';
  });

  // 提交按钮点击事件
  submitBtn.addEventListener('click', function(e) {
    e.preventDefault();
    if (textarea.value.trim() || fileInput.files[0]) {
      sendMessage(); 
      textarea.value = '';
      fileInput.value = '';
      previewContainer.style.display = 'none';
      adjustTextareaHeight(); 
      updateButtonState();  
      
      const page = document.getElementById('page'); 
    page.classList.remove('isHome');
    }
  });

  // 回车发送
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click();
    }
  });

  // 可选：绑定中断按钮（如果有）
  // const stopBtn = document.getElementById('stop-button');
  // if (stopBtn) stopBtn.addEventListener('click', stopGeneration);

  // 页面初始化 
  adjustTextareaHeight(); 
  updateButtonState();    
});