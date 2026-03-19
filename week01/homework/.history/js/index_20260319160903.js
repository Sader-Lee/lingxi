document.addEventListener('DOMContentLoaded', function() {
  // 🔥 1. 本地存储 API Key（老师要求的本地存储功能）
  let API_KEY = localStorage.getItem('LINGXI_API_KEY');
  if (!API_KEY) {
    const userKey = prompt("请输入你的通义千问 API Key（将本地存储）：");
    if (userKey) {
      localStorage.setItem('LINGXI_API_KEY', userKey);
      API_KEY = userKey;
    } else {
      alert("请填写 API Key 后使用！");
    }
  }

  // 模式调整 
  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = themeBtn.querySelector("img");
  const transferBtn = document.getElementById("transfer-button");
  const transferIcon = transferBtn.querySelector("img");
  const deleteBtn = document.getElementById("delete-button");
  const deleteIcon = deleteBtn.querySelector("img");
  const chatMessage = document.getElementById("chat-messages"); // 新增：对话容器

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
    // 区分用户/AI气泡样式
    bubble.className = `message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`;
    
    if (isUser) {
      // 用户气泡：只显示文字
      bubble.textContent = content;
      return bubble;
    }
    
    // AI气泡：带头像+思考中/文字
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

  // 🔥 3. 发送消息+对接后端（核心功能）
  async function sendMessage() {
    const text = textarea.value.trim();
    
    // 校验：API Key和内容不能为空
    if (!API_KEY) {
      alert("请先填写 API Key！");
      return;
    }
    if (!text) return;

    // 1. 创建用户气泡并添加到对话区
    const userBubble = createBubble(text, true);
    chatMessage.appendChild(userBubble);
    
    // 2. 创建AI思考中气泡
    const aiBubble = createBubble('', false, true);
    chatMessage.appendChild(aiBubble);
    const aiContent = aiBubble.querySelector('.ai-content');
    
    // 3. 滚动到最新消息
    chatMessage.scrollTop = chatMessage.scrollHeight;

    try {
      // 4. 调用后端接口（对接极简后端）
      const response = await fetch(`http://localhost:3001/api/chat?message=${encodeURIComponent(text)}&apiKey=${encodeURIComponent(API_KEY)}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      if (!response.ok) throw new Error(`请求失败：${response.status}（检查后端是否启动/API Key是否正确）`);

      // 5. 流式读取后端返回的内容
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
            // 移除思考中样式（只执行一次）
            if (isFirstChunk && aiContent.classList.contains('thinking')) {
              aiContent.classList.remove('thinking');
              aiContent.innerHTML = '';
              isFirstChunk = false;
            }

            // 解析后端返回的文字
            const prefix = 'data: ';
            if (line.startsWith(prefix)) {
              const data = JSON.parse(line.slice(prefix.length));
              if (data.text) {
                fullAnswer += data.text;
                aiContent.innerHTML = fullAnswer;
                chatMessage.scrollTop = chatMessage.scrollHeight; // 实时滚动
              }
            }
          } catch (err) {
            console.error('解析失败：', err);
            aiContent.innerHTML = `解析失败：${err.message}`;
          }
        }
      }

    } catch (err) {
      // 错误提示
      aiContent.classList.remove('thinking');
      aiContent.innerHTML = `抱歉，生成失败：${err.message}`;
      console.error('发送失败：', err);
    }
  }

  // 绑定事件 
  // 文字输入：调整高度+更新按钮
  textarea.addEventListener('input', function() {
    adjustTextareaHeight();
    updateButtonState();
  });

  // 触发文件选择
  transferBtn.addEventListener("click", function() {
    fileInput.click();
    console.log('按钮被点击了');
  });

  // 文件选择
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

  // 查看全图
  previewContainer.addEventListener('click', function() {
    imageViewer.style.display = 'flex';
  });

  // 关闭大图
  imageViewer.addEventListener('click', function() {
    imageViewer.style.display = 'none';
  });

  // 提交按钮点击事件
  submitBtn.addEventListener('click', function(e) { // 修复：加 e 参数
    e.preventDefault();
    if (textarea.value.trim() || fileInput.files[0]) {
      sendMessage(); // 调用发送消息函数
      // 清空输入框和文件
      textarea.value = '';
      fileInput.value = '';
      previewContainer.style.display = 'none';
      adjustTextareaHeight(); 
      updateButtonState();    
    }
  });

  // 回车发送（Shift+回车换行）
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click(); // 触发提交按钮
    }
  });

  // 页面初始化 
  adjustTextareaHeight(); 
  updateButtonState();    
});