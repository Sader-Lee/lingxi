const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3001;

// 全局中间件
app.use(cors()); // 全局跨域，无需重复设置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 安全读取 API Key
const LINGXI_API_KEY = process.env.LINGXI_API_KEY;
if (!LINGXI_API_KEY) {
  console.error('\x1B[31m❌ 请在 .env 中配置 LINGXI_API_KEY！\x1B[0m');
  process.exit(1);
}

// 存储当前正在生成的请求
let currentAbortController = null;

// 1. 流式对话接口（最终可运行版）
app.get('/api/chat', async (req, res) => {
  try {
    const { message, imageUrl } = req.query;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: '请输入内容' });
    }

    // 设置 SSE 响应头（完善跨域和编码）
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*'); // 兜底跨域
    if (res.flushHeaders) res.flushHeaders(); // 兼容不同 Express 版本

    // 创建中断控制器
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // 🔥 核心修改1：百炼请求体（流式标准配置）
    const requestBody = {
      model: 'qwen-plus',
      input: {
        messages: [{
          role: 'user',
          content: message // 简化为纯文本，确保流式生效
        }]
      },
      parameters: {
        result_format: 'message',
        stream: true, // 强制开启流式
        temperature: 0.7,
        top_p: 0.8,
        incremental_output: true, // 增量输出（逐字返回）
        max_tokens: 1024, // 限制最大长度
        enable_search: false // 关闭搜索，避免干扰流式
      }
    };

    // 支持图片上传（保留，但流式优先纯文本）
    if (imageUrl) {
      requestBody.input.messages[0].content = [{
        type: 'text', text: message
      }, {
        type: 'image_url',
        image_url: { url: imageUrl }
      }];
    }

    console.log(`📤 调用百炼 API，消息：${message.substring(0, 20)}...`); // 调试日志

    // 调用百炼 API
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINGXI_API_KEY}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(requestBody),
      signal,
      timeout: 30000 // 新增：设置超时时间，避免卡死
    });

    if (!response.ok) {
      const errDetail = await response.text().catch(() => '无详情');
      throw new Error(`百炼 API 调用失败：${response.status} ${response.statusText}，详情：${errDetail}`);
    }

    // 处理流式响应（最终修复版：彻底解决只返回第一个字问题）
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let isDoneSent = false; // 新增：标记是否已发送 [DONE]

    // 第一步：尝试原生流式解析
    try {
      while (true) {
        if (signal.aborted) {
          console.log('⚠️ 请求被中断');
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        // 解码并打印原始数据（调试+避免重复解码）
        const rawStr = decoder.decode(value, { stream: true });
        console.log('🔍 百炼原始返回（完整）：', rawStr);
        buffer += rawStr; // 只解码一次，避免重复

        // 按 "data: " 分割（适配百炼流式格式）
        const dataChunks = buffer.split('data: ');
        buffer = dataChunks.pop() || ''; // 保留最后一个不完整的块

        // 逐个处理每个数据块
        for (const chunk of dataChunks) {
          const trimmedChunk = chunk.trim();
          if (!trimmedChunk) continue; // 过滤空块

          console.log(`📥 原始数据块：${trimmedChunk.substring(0, 100)}...`); // 调试日志

          // 处理结束标记（避免重复发送）
          if (trimmedChunk === '[DONE]') {
            if (!isDoneSent) {
              res.write(`data: [DONE]\n\n`);
              isDoneSent = true;
            }
            continue;
          }

          // 解析 JSON（增强容错）
          let data;
          try {
            data = JSON.parse(trimmedChunk);
          } catch (e) {
            console.error(`❌ JSON 解析失败：${e.message}，原始数据：${trimmedChunk}`);
            continue;
          }

          // 精准提取流式文本（delta.content）
          const text = 
            data.output?.choices?.[0]?.delta?.content || // 流式核心路径
            data.output?.choices?.[0]?.message?.content || // 非流式兜底
            data.output?.text || 
            '';

          console.log(`📝 提取到文本：${text || '空'}`); // 调试日志

          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
            // ✅ 强制刷新（兼容所有 Node.js/Express 版本）
            res.socket?.write(''); // 直接操作 socket 强制推送，优先级最高
            res.flush?.(); // 兜底
          }
        }
      }
    } catch (e) {
      console.error('❌ 原生流式解析异常：', e.message);
    }

    // 第二步：强制伪流式兜底（核心修复：解决只返回第一个字）
    if (!isDoneSent && buffer.trim()) {
      try {
        const fullData = JSON.parse(buffer);
        const fullText = fullData.output?.choices?.[0]?.message?.content || '';
        if (fullText && fullText.length > 0) {
          console.log(`📦 触发伪流式兜底，完整文本：${fullText}`);
          
          // 递归逐字推送（确保每个字都能发送，不会中断）
          let index = 0;
          const pushCharRecursive = () => {
            // 检测中断信号
            if (signal.aborted) {
              res.write('data: [DONE]\n\n');
              isDoneSent = true;
              res.end();
              return;
            }

            if (index >= fullText.length) {
              res.write('data: [DONE]\n\n');
              isDoneSent = true;
              res.end();
              currentAbortController = null;
              console.log('✅ 伪流式推送完成');
              return;
            }

            const char = fullText.charAt(index);
            // 确保每个字都能推送到前端
            res.write(`data: ${JSON.stringify({ text: char })}\n\n`);
            res.socket?.write(''); // 强制刷新，不缓存
            index++;
            
            // 80ms 推送一个字，模拟原生流式打字机效果
            setTimeout(pushCharRecursive, 80);
          };

          // 启动逐字推送
          pushCharRecursive();
          // 关键：这里直接 return，避免后续代码提前结束响应
          return;
        }
      } catch (e) {
        console.error('❌ 伪流式兜底失败：', e.message);
      }
    }

    // 第三步：最终发送结束标记（仅伪流式没触发时执行）
    if (!isDoneSent) {
      res.write(`data: [DONE]\n\n`);
    }

    res.end();
    currentAbortController = null;
    console.log('✅ 响应发送完成');

  } catch (err) {
    // 错误处理（增强用户体验）
    currentAbortController = null;
    const errMsg = err.name === 'AbortError' 
      ? '请求已被中断' 
      : `出错了：${err.message}`;
    
    console.error('\x1B[31m❌ 流式调用失败：\x1B[0m', err.message);
    res.write(`data: ${JSON.stringify({ text: `\n${errMsg}` })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

// 2. 中断生成接口
app.post('/api/stop', (req, res) => {
  if (currentAbortController) {
    currentAbortController.abort();
    res.json({ success: true, message: '已中断生成' });
  } else {
    res.json({ success: false, message: '没有正在生成的内容' });
  }
});

// 3. 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '灵犀后端服务运行正常（HTTP 直连版）',
    port: PORT,
    time: new Date().toLocaleString()
  });
});

// 启动服务器（增加错误监听）
app.listen(PORT, () => {
  console.log('\x1B[32m✅ 灵犀后端（HTTP 直连版）启动成功！\x1B[0m');
  console.log(`🔗 对话接口：http://localhost:${PORT}/api/chat`);
  console.log(`🛑 中断接口：http://localhost:${PORT}/api/stop`);
  console.log(`🩺 健康检查：http://localhost:${PORT}/api/health`);
}).on('error', (err) => {
  console.error('\x1B[31m❌ 服务器启动失败：\x1B[0m', err.message);
  process.exit(1);
});