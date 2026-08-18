import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm, Tooltip, Alert, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, QuestionCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { aiAPI } from '../services/api';

function AISettings() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [form] = Form.useForm();
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [customModel, setCustomModel] = useState('');

  const providers = [
    { 
      value: 'deepseek', 
      label: 'DeepSeek', 
      models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner', 'deepseek-v3'],
      baseUrl: 'https://api.deepseek.com/v1'
    },
    { 
      value: 'mimo', 
      label: '小米 MIMO', 
      models: ['mimo-v2.5-pro', 'mimo-v2.5-flash', 'mimo-v2-pro'],
      baseUrl: 'https://api.mimo.com/v1'
    },
    { 
      value: 'k3', 
      label: 'K3 AI', 
      models: ['k3-chat', 'k3-turbo', 'k3-v2'],
      baseUrl: 'https://api.k3.ai/v1'
    },
    { 
      value: 'qwen', 
      label: '通义千问 (Qwen)', 
      models: ['qwen-turbo-latest', 'qwen-plus-latest', 'qwen-max-latest', 'qwen2.5-72b-instruct', 'qwen-vl-max'],
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    },
    { 
      value: 'zhipu', 
      label: '智谱 (GLM)', 
      models: ['glm-4-plus', 'glm-4-flash', 'glm-4v-plus', 'glm-4-long'],
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
    },
    { 
      value: 'baidu', 
      label: '百度文心', 
      models: ['ernie-4.0-turbo-8k', 'ernie-3.5-128k', 'ernie-speed-128k', 'ernie-lite-8k'],
      baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop'
    },
    { 
      value: 'moonshot', 
      label: '月之暗面 (Kimi)', 
      models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
      baseUrl: 'https://api.moonshot.cn/v1'
    },
    { 
      value: 'minimax', 
      label: 'MiniMax', 
      models: ['abab6.5s-chat', 'abab6.5-chat', 'abab6.5g-chat'],
      baseUrl: 'https://api.minimax.chat/v1'
    },
    { 
      value: 'spark', 
      label: '讯飞星火', 
      models: ['4.0Ultra', 'max-32k', 'pro-128k', 'lite'],
      baseUrl: 'https://spark-api-open.xf-yun.com/v1'
    },
    { 
      value: 'doubao', 
      label: '字节豆包', 
      models: ['doubao-1.5-pro-256k', 'doubao-1.5-pro-32k', 'doubao-1.5-lite-32k', 'doubao-vision-pro-32k'],
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
    },
    { 
      value: 'stepfun', 
      label: '阶跃星辰', 
      models: ['step-2-16k', 'step-2-16k-exp', 'step-1v-8k', 'step-1-flash-8k'],
      baseUrl: 'https://api.stepfun.com/v1'
    },
    { 
      value: 'baichuan', 
      label: '百川智能', 
      models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-Turbo'],
      baseUrl: 'https://api.baichuan-ai.com/v1'
    },
    { 
      value: 'yi', 
      label: '零一万物', 
      models: ['yi-large', 'yi-medium', 'yi-spark', 'yi-vision'],
      baseUrl: 'https://api.lingyiwanwu.com/v1'
    },
    { 
      value: 'openai', 
      label: 'OpenAI', 
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini'],
      baseUrl: 'https://api.openai.com/v1'
    },
    { 
      value: 'claude', 
      label: 'Claude', 
      models: ['claude-sonnet-4-20250514', 'claude-3.5-sonnet-20241022', 'claude-3.5-haiku-20241022'],
      baseUrl: 'https://api.anthropic.com/v1'
    },
    { 
      value: 'gemini', 
      label: 'Google Gemini', 
      models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
    },
    { 
      value: 'custom', 
      label: t('ai_providers.custom'), 
      models: [] 
    }
  ];

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleProviderChange = (value) => {
    setSelectedProvider(value);
    setTestResult(null);
    const provider = providers.find(p => p.value === value);
    if (provider && provider.baseUrl) {
      form.setFieldsValue({ base_url: provider.baseUrl });
    }
    if (provider && provider.models.length > 0) {
      form.setFieldsValue({ model: provider.models[0] });
    }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setTestResult(null);
      
      const res = await aiAPI.testConfig(values);
      setTestResult({
        success: true,
        message: res.data.message,
        model: res.data.model,
        response: res.data.response
      });
      message.success('API测试成功');
    } catch (error) {
      setTestResult({
        success: false,
        error: error.response?.data?.error || error.message
      });
      message.error('API测试失败');
    } finally {
      setTesting(false);
    }
  };

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await aiAPI.getConfigs();
      setConfigs(res.data.configs);
    } catch (error) {
      message.error(t('ai.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingConfig(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingConfig(record);
    form.setFieldsValue({
      provider: record.provider,
      model: record.model,
      base_url: record.base_url
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await aiAPI.deleteConfig(id);
      message.success(t('ai.delete_success'));
      loadConfigs();
    } catch (error) {
      message.error(t('common.error'));
    }
  };

  const onFinish = async (values) => {
    try {
      if (editingConfig) {
        await aiAPI.updateConfig(editingConfig.id, values);
        message.success(t('ai.update_success'));
      } else {
        await aiAPI.createConfig(values);
        message.success(t('ai.add_success'));
      }
      setModalVisible(false);
      loadConfigs();
    } catch (error) {
      message.error(t('common.error') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const columns = [
    {
      title: t('ai.provider'),
      dataIndex: 'provider',
      key: 'provider',
      render: (text) => {
        const provider = providers.find(p => p.value === text);
        return provider ? provider.label : text;
      }
    },
    {
      title: t('ai.model'),
      dataIndex: 'model',
      key: 'model'
    },
    {
      title: t('ai.status'),
      key: 'status',
      render: (_, record) => (
        record.is_active ? <Tag color="green">{t('ai.active')}</Tag> : <Tag color="red">{t('ai.inactive')}</Tag>
      )
    },
    {
      title: t('common.edit'),
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('ai.delete_confirm')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>{t('ai.title')}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          {t('ai.add')}
        </Button>
      </div>

      <Card>
        <p style={{ marginBottom: 16, color: '#666' }}>
          {t('ai.description')}
        </p>
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingConfig ? t('ai.edit') : t('ai.add')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            name="provider"
            label={t('ai.provider')}
            rules={[{ required: true, message: t('ai.provider_placeholder') }]}
          >
            <Select 
              placeholder={t('ai.provider_placeholder')}
              onChange={handleProviderChange}
            >
              {providers.map(p => (
                <Select.Option key={p.value} value={p.value}>
                  {p.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="api_key"
            label={editingConfig ? t('ai.new_api_key') : t('ai.api_key')}
            rules={editingConfig ? [] : [{ required: true, message: t('ai.api_key_placeholder') }]}
          >
            <Input.Password placeholder={t('ai.api_key_placeholder')} />
          </Form.Item>

          <Form.Item
            name="model"
            label={t('ai.model')}
          >
            <Select 
              placeholder={t('ai.model_placeholder')}
              showSearch
              allowClear
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="输入自定义模型名称"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      style={{ width: 200 }}
                    />
                    <Button 
                      type="text" 
                      icon={<PlusOutlined />}
                      onClick={() => {
                        if (customModel) {
                          form.setFieldsValue({ model: customModel });
                          setCustomModel('');
                        }
                      }}
                    >
                      使用
                    </Button>
                  </Space>
                </>
              )}
            >
              {selectedProvider && providers.find(p => p.value === selectedProvider)?.models.map(m => (
                <Select.Option key={m} value={m}>{m}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="base_url"
            label={
              <span>
                {t('ai.base_url')}
                <Tooltip title="API地址，选择提供商后会自动填充">
                  <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              </span>
            }
          >
            <Input placeholder={t('ai.base_url_placeholder')} />
          </Form.Item>

          {testResult && (
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.success ? '测试成功' : '测试失败'}
              description={
                testResult.success 
                  ? `模型: ${testResult.model}\n回复: ${testResult.response}`
                  : testResult.error
              }
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingConfig ? t('common.save') : t('common.add')}
              </Button>
              <Button 
                icon={<ThunderboltOutlined />}
                loading={testing}
                onClick={handleTest}
              >
                测试API
              </Button>
              <Button onClick={() => { setModalVisible(false); setTestResult(null); }}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AISettings;
