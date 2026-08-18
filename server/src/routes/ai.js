const express = require('express');
const axios = require('axios');
const { getDb } = require('../db/init');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

const router = express.Router();
router.use(authMiddleware);

const AI_PROVIDERS = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner', 'deepseek-v3'],
    name: 'DeepSeek'
  },
  mimo: {
    baseUrl: 'https://api.mimo.com/v1',
    models: ['mimo-v2.5-pro', 'mimo-v2.5-flash', 'mimo-v2-pro'],
    name: '小米 MIMO'
  },
  k3: {
    baseUrl: 'https://api.k3.ai/v1',
    models: ['k3-chat', 'k3-turbo', 'k3-v2'],
    name: 'K3 AI'
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-turbo-latest', 'qwen-plus-latest', 'qwen-max-latest', 'qwen2.5-72b-instruct', 'qwen-vl-max'],
    name: '通义千问'
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4v-plus', 'glm-4-long'],
    name: '智谱GLM'
  },
  baidu: {
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
    models: ['ernie-4.0-turbo-8k', 'ernie-3.5-128k', 'ernie-speed-128k', 'ernie-lite-8k'],
    name: '百度文心'
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    name: '月之暗面'
  },
  minimax: {
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat', 'abab6.5-chat', 'abab6.5g-chat'],
    name: 'MiniMax'
  },
  spark: {
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    models: ['4.0Ultra', 'max-32k', 'pro-128k', 'lite'],
    name: '讯飞星火'
  },
  doubao: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-1.5-pro-256k', 'doubao-1.5-pro-32k', 'doubao-1.5-lite-32k', 'doubao-vision-pro-32k'],
    name: '字节豆包'
  },
  stepfun: {
    baseUrl: 'https://api.stepfun.com/v1',
    models: ['step-2-16k', 'step-2-16k-exp', 'step-1v-8k', 'step-1-flash-8k'],
    name: '阶跃星辰'
  },
  baichuan: {
    baseUrl: 'https://api.baichuan-ai.com/v1',
    models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-Turbo'],
    name: '百川智能'
  },
  yi: {
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    models: ['yi-large', 'yi-medium', 'yi-spark', 'yi-vision'],
    name: '零一万物'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini'],
    name: 'OpenAI'
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-3.5-sonnet-20241022', 'claude-3.5-haiku-20241022'],
    name: 'Claude'
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    name: 'Google Gemini'
  },
  custom: {
    baseUrl: '',
    models: [],
    name: '自定义'
  }
};

router.get('/configs', (req, res) => {
  try {
    const db = getDb();
    
    // 检查表是否存在
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_configs'"
    ).get();
    
    if (!tableExists) {
      // 如果表不存在，创建它
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          provider TEXT NOT NULL,
          api_key_encrypted TEXT NOT NULL,
          model TEXT,
          base_url TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      return res.json({ configs: [] });
    }
    
    const configs = db.prepare(
      'SELECT id, provider, model, base_url, is_active, created_at FROM ai_configs WHERE user_id = ?'
    ).all(req.user.userId);

    res.json({ configs });
  } catch (error) {
    logger.error('获取AI配置失败:', error);
    res.status(500).json({ error: '获取AI配置失败' });
  }
});

router.post('/configs', (req, res) => {
  try {
    const { provider, api_key, model, base_url } = req.body;

    if (!provider || !api_key) {
      return res.status(400).json({ error: '请填写提供商和API密钥' });
    }

    const encryptedKey = encrypt(api_key);
    const db = getDb();

    const result = db.prepare(`
      INSERT INTO ai_configs (user_id, provider, api_key_encrypted, model, base_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.userId, provider, encryptedKey, model, base_url);

    res.status(201).json({ id: result.lastInsertRowid, provider, model });
  } catch (error) {
    logger.error('保存AI配置失败:', error);
    res.status(500).json({ error: '保存AI配置失败' });
  }
});

router.put('/configs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { provider, api_key, model, base_url, is_active } = req.body;
    const db = getDb();

    const config = db.prepare('SELECT * FROM ai_configs WHERE id = ? AND user_id = ?').get(id, req.user.userId);

    if (!config) {
      return res.status(404).json({ error: '配置不存在' });
    }

    const encryptedKey = api_key ? encrypt(api_key) : config.api_key_encrypted;

    db.prepare(`
      UPDATE ai_configs SET provider = ?, api_key_encrypted = ?, model = ?, base_url = ?, is_active = ?
      WHERE id = ? AND user_id = ?
    `).run(
      provider || config.provider,
      encryptedKey,
      model || config.model,
      base_url !== undefined ? base_url : config.base_url,
      is_active !== undefined ? (is_active ? 1 : 0) : config.is_active,
      id,
      req.user.userId
    );

    res.json({ message: 'AI配置更新成功' });
  } catch (error) {
    logger.error('更新AI配置失败:', error);
    res.status(500).json({ error: '更新AI配置失败' });
  }
});

router.delete('/configs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    db.prepare('DELETE FROM ai_configs WHERE id = ? AND user_id = ?').run(id, req.user.userId);

    res.json({ message: 'AI配置删除成功' });
  } catch (error) {
    logger.error('删除AI配置失败:', error);
    res.status(500).json({ error: '删除AI配置失败' });
  }
});

// 测试AI配置
router.post('/test', async (req, res) => {
  try {
    const { provider, api_key, model, base_url } = req.body;

    if (!provider || !api_key) {
      return res.status(400).json({ error: '请填写提供商和API密钥' });
    }

    const providerConfig = AI_PROVIDERS[provider] || AI_PROVIDERS.custom;
    const baseUrl = base_url || providerConfig.baseUrl;
    const testModel = model || providerConfig.models[0] || 'gpt-3.5-turbo';

    if (!baseUrl) {
      return res.status(400).json({ error: '请填写API地址' });
    }

    let response;

    if (provider === 'claude') {
      response = await axios.post(`${baseUrl}/messages`, {
        model: testModel,
        max_tokens: 50,
        messages: [{ role: 'user', content: '你好，请回复"测试成功"' }]
      }, {
        headers: {
          'x-api-key': api_key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 30000
      });

      res.json({ 
        success: true, 
        message: 'API测试成功',
        model: testModel,
        response: response.data.content[0].text
      });
    } else {
      response = await axios.post(`${baseUrl}/chat/completions`, {
        model: testModel,
        messages: [{ role: 'user', content: '你好，请回复"测试成功"' }],
        max_tokens: 50
      }, {
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      res.json({ 
        success: true, 
        message: 'API测试成功',
        model: testModel,
        response: response.data.choices[0].message.content
      });
    }
  } catch (error) {
    logger.error('API测试失败:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message 
      || error.response?.data?.message 
      || error.message;
    res.status(500).json({ 
      success: false, 
      error: `API测试失败: ${errorMsg}` 
    });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { config_id, messages, email_content } = req.body;
    const db = getDb();

    // 如果没有指定config_id，使用用户的第一个活跃配置
    let aiConfig;
    if (config_id) {
      aiConfig = db.prepare('SELECT * FROM ai_configs WHERE id = ? AND user_id = ? AND is_active = 1').get(config_id, req.user.userId);
    } else {
      aiConfig = db.prepare('SELECT * FROM ai_configs WHERE user_id = ? AND is_active = 1 ORDER BY id LIMIT 1').get(req.user.userId);
    }

    if (!aiConfig) {
      return res.status(400).json({ error: '请先在设置中配置AI服务' });
    }

    const apiKey = decrypt(aiConfig.api_key_encrypted);
    const provider = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;
    const baseUrl = aiConfig.base_url || provider.baseUrl;

    let response;

    if (aiConfig.provider === 'claude') {
      response = await axios.post(`${baseUrl}/messages`, {
        model: aiConfig.model || 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: messages || [
          { role: 'user', content: email_content || '你好' }
        ]
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      });

      res.json({ reply: response.data.content[0].text });
    } else {
      const systemPrompt = email_content
        ? `你是一个邮件助手，帮助用户处理邮件。以下是邮件内容：\n\n${email_content}\n\n请根据用户的问题提供帮助。`
        : '你是一个邮件助手，帮助用户处理邮件。';

      response = await axios.post(`${baseUrl}/chat/completions`, {
        model: aiConfig.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages || [])
        ],
        max_tokens: 2000
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      res.json({ reply: response.data.choices[0].message.content });
    }
  } catch (error) {
    logger.error('AI请求失败:', error.response?.data || error.message);
    res.status(500).json({ error: 'AI请求失败: ' + (error.response?.data?.error?.message || error.message) });
  }
});

router.post('/summarize', async (req, res) => {
  try {
    const { config_id, email_content } = req.body;

    if (!email_content) {
      return res.status(400).json({ error: '请提供邮件内容' });
    }

    const db = getDb();
    
    // 如果没有指定config_id，使用用户的第一个活跃配置
    let aiConfig;
    if (config_id) {
      aiConfig = db.prepare('SELECT * FROM ai_configs WHERE id = ? AND user_id = ? AND is_active = 1').get(config_id, req.user.userId);
    } else {
      aiConfig = db.prepare('SELECT * FROM ai_configs WHERE user_id = ? AND is_active = 1 ORDER BY id LIMIT 1').get(req.user.userId);
    }

    if (!aiConfig) {
      return res.status(400).json({ error: '请先在设置中配置AI服务' });
    }

    const apiKey = decrypt(aiConfig.api_key_encrypted);
    const provider = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;
    const baseUrl = aiConfig.base_url || provider.baseUrl;

    let response;

    if (aiConfig.provider === 'claude') {
      response = await axios.post(`${baseUrl}/messages`, {
        model: aiConfig.model || 'claude-3-sonnet-20240229',
        max_tokens: 500,
        messages: [{ role: 'user', content: `请用中文简洁地总结这封邮件的主要内容，不超过100字：\n\n${email_content}` }]
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      });

      res.json({ summary: response.data.content[0].text });
    } else {
      response = await axios.post(`${baseUrl}/chat/completions`, {
        model: aiConfig.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '你是一个邮件助手，帮助用户简洁地总结邮件内容。' },
          { role: 'user', content: `请用中文简洁地总结这封邮件的主要内容，不超过100字：\n\n${email_content}` }
        ],
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      res.json({ summary: response.data.choices[0].message.content });
    }
  } catch (error) {
    logger.error('邮件总结失败:', error.response?.data || error.message);
    res.status(500).json({ error: '邮件总结失败' });
  }
});

router.post('/reply', async (req, res) => {
  try {
    const { config_id, email_content, tone, language } = req.body;
    const db = getDb();

    // 如果没有指定config_id，使用用户的第一个活跃配置
    let aiConfig;
    if (config_id) {
      aiConfig = db.prepare('SELECT * FROM ai_configs WHERE id = ? AND user_id = ? AND is_active = 1').get(config_id, req.user.userId);
    } else {
      aiConfig = db.prepare('SELECT * FROM ai_configs WHERE user_id = ? AND is_active = 1 ORDER BY id LIMIT 1').get(req.user.userId);
    }

    if (!aiConfig) {
      return res.status(400).json({ error: '请先在设置中配置AI服务' });
    }

    const apiKey = decrypt(aiConfig.api_key_encrypted);
    const provider = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;
    const baseUrl = aiConfig.base_url || provider.baseUrl;

    const prompt = `请根据以下邮件内容生成一个回复。
语气：${tone || '正式'}
语言：${language || '中文'}

原邮件内容：
${email_content}

请直接给出回复内容，不需要额外说明。`;

    let response;

    if (aiConfig.provider === 'claude') {
      response = await axios.post(`${baseUrl}/messages`, {
        model: aiConfig.model || 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      });

      res.json({ reply: response.data.content[0].text });
    } else {
      response = await axios.post(`${baseUrl}/chat/completions`, {
        model: aiConfig.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '你是一个专业的邮件助手，帮助用户撰写邮件回复。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      res.json({ reply: response.data.choices[0].message.content });
    }
  } catch (error) {
    logger.error('生成回复失败:', error.response?.data || error.message);
    res.status(500).json({ error: '生成回复失败' });
  }
});

module.exports = router;
