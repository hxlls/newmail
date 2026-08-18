const express = require('express');
const axios = require('axios');
const { getDb } = require('../db/init');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

const router = express.Router();
router.use(authMiddleware);

const AI_PROVIDERS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  },
  custom: {
    baseUrl: '',
    models: []
  }
};

router.get('/configs', (req, res) => {
  try {
    const db = getDb();
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

router.post('/chat', async (req, res) => {
  try {
    const { config_id, messages, email_content } = req.body;
    const db = getDb();

    const aiConfig = db.prepare('SELECT * FROM ai_configs WHERE id = ? AND user_id = ? AND is_active = 1').get(config_id, req.user.userId);

    if (!aiConfig) {
      return res.status(404).json({ error: '未找到有效的AI配置' });
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

    req.body.messages = [{ role: 'user', content: `请用中文简洁地总结这封邮件的主要内容，不超过100字：\n\n${email_content}` }];

    const db = getDb();
    const aiConfig = db.prepare('SELECT * FROM ai_configs WHERE id = ? AND user_id = ? AND is_active = 1').get(config_id, req.user.userId);

    if (!aiConfig) {
      return res.status(404).json({ error: '未找到有效的AI配置' });
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

    const aiConfig = db.prepare('SELECT * FROM ai_configs WHERE id = ? AND user_id = ? AND is_active = 1').get(config_id, req.user.userId);

    if (!aiConfig) {
      return res.status(404).json({ error: '未找到有效的AI配置' });
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
