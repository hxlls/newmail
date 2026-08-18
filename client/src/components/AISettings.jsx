import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { aiAPI } from '../services/api';

function AISettings() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [form] = Form.useForm();

  const providers = [
    { value: 'openai', label: t('ai_providers.openai'), models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { value: 'claude', label: t('ai_providers.claude'), models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'] },
    { value: 'custom', label: t('ai_providers.custom'), models: [] }
  ];

  useEffect(() => {
    loadConfigs();
  }, []);

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
            <Select placeholder={t('ai.provider_placeholder')}>
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
            <Input placeholder={t('ai.model_placeholder')} />
          </Form.Item>

          <Form.Item
            name="base_url"
            label={t('ai.base_url')}
          >
            <Input placeholder={t('ai.base_url_placeholder')} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingConfig ? t('common.save') : t('common.add')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
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
