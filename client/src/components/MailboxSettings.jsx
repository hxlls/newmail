import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { mailboxAPI } from '../services/api';

function MailboxSettings({ onMailboxChange }) {
  const { t } = useTranslation();
  const [mailboxes, setMailboxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState(null);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadMailboxes();
    loadProviders();
  }, []);

  const loadMailboxes = async () => {
    setLoading(true);
    try {
      const res = await mailboxAPI.getAll();
      setMailboxes(res.data.mailboxes);
    } catch (error) {
      message.error(t('mailbox.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const res = await mailboxAPI.getProviders();
      setProviders(res.data.providers);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const handleAdd = () => {
    setEditingMailbox(null);
    setSelectedProvider(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingMailbox(record);
    setSelectedProvider(null);
    form.setFieldsValue({
      name: record.name,
      email: record.email,
      imap_host: record.imap_host,
      imap_port: record.imap_port,
      smtp_host: record.smtp_host,
      smtp_port: record.smtp_port
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await mailboxAPI.delete(id);
      message.success(t('mailbox.delete_success'));
      loadMailboxes();
      onMailboxChange?.();
    } catch (error) {
      message.error(t('common.error'));
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await mailboxAPI.setDefault(id);
      message.success(t('common.success'));
      loadMailboxes();
    } catch (error) {
      message.error(t('common.error'));
    }
  };

  const handleProviderChange = (value) => {
    setSelectedProvider(value);
    const provider = providers.find(p => p.key === value);
    if (provider) {
      form.setFieldsValue({
        imap_host: provider.imap?.host,
        imap_port: provider.imap?.port,
        smtp_host: provider.smtp?.host,
        smtp_port: provider.smtp?.port
      });
    }
  };

  const handleTest = async (type) => {
    try {
      const values = await form.validateFields(['email', 'password']);
      setTesting(true);

      const res = await mailboxAPI.test({
        type,
        host: type === 'imap' ? form.getFieldValue('imap_host') : form.getFieldValue('smtp_host'),
        port: type === 'imap' ? form.getFieldValue('imap_port') : form.getFieldValue('smtp_port'),
        secure: true,
        email: values.email,
        password: values.password
      });

      if (res.data.success) {
        message.success(t('mailbox.test_success'));
      } else {
        message.error(t('mailbox.test_error') + ': ' + res.data.message);
      }
    } catch (error) {
      message.error(t('mailbox.test_error') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setTesting(false);
    }
  };

  const onFinish = async (values) => {
    try {
      if (editingMailbox) {
        await mailboxAPI.update(editingMailbox.id, values);
        message.success(t('mailbox.update_success'));
      } else {
        await mailboxAPI.create({
          ...values,
          provider: selectedProvider
        });
        message.success(t('mailbox.add_success'));
      }
      setModalVisible(false);
      loadMailboxes();
      onMailboxChange?.();
    } catch (error) {
      message.error(t('common.error') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const columns = [
    {
      title: t('mailbox.name'),
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: t('mailbox.address'),
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: t('mailbox.imap_server'),
      dataIndex: 'imap_host',
      key: 'imap_host'
    },
    {
      title: t('mailbox.smtp_server'),
      dataIndex: 'smtp_host',
      key: 'smtp_host'
    },
    {
      title: t('ai.status'),
      key: 'status',
      render: (_, record) => (
        record.is_default ? <Tag color="green">{t('mailbox.default')}</Tag> : null
      )
    },
    {
      title: t('common.edit'),
      key: 'action',
      render: (_, record) => (
        <Space>
          {!record.is_default && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSetDefault(record.id)}
            >
              {t('mailbox.set_default')}
            </Button>
          )}
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('mailbox.delete_confirm')}
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
        <h2>{t('mailbox.title')}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          {t('mailbox.add')}
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={mailboxes}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingMailbox ? t('mailbox.edit') : t('mailbox.add')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          {!editingMailbox && (
            <Form.Item label={t('mailbox.provider')}>
              <Select
                placeholder={t('mailbox.provider_placeholder')}
                onChange={handleProviderChange}
                allowClear
              >
                {providers.map(p => (
                  <Select.Option key={p.key} value={p.key}>
                    {t(`providers.${p.key}`)} ({p.domain})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label={t('mailbox.name')}
            rules={[{ required: true, message: t('mailbox.name_placeholder') }]}
          >
            <Input placeholder={t('mailbox.name_placeholder')} />
          </Form.Item>

          <Form.Item
            name="email"
            label={t('mailbox.address')}
            rules={[
              { required: true, message: t('mailbox.address_placeholder') },
              { type: 'email', message: t('auth.email_invalid') }
            ]}
          >
            <Input placeholder={t('mailbox.address_placeholder')} />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingMailbox ? t('mailbox.new_password') : t('mailbox.password')}
            rules={editingMailbox ? [] : [{ required: true, message: t('mailbox.password_placeholder') }]}
          >
            <Input.Password placeholder={t('mailbox.password_placeholder')} />
          </Form.Item>

          <Form.Item label={t('mailbox.imap_server')}>
            <Space>
              <Form.Item name="imap_host" noStyle rules={[{ required: true, message: t('mailbox.imap_server') }]}>
                <Input placeholder="imap.example.com" style={{ width: 250 }} />
              </Form.Item>
              <Form.Item name="imap_port" noStyle initialValue={993}>
                <Input placeholder={t('mailbox.port')} style={{ width: 80 }} />
              </Form.Item>
              <Button onClick={() => handleTest('imap')} loading={testing}>
                {t('mailbox.test_connection')}
              </Button>
            </Space>
          </Form.Item>

          <Form.Item label={t('mailbox.smtp_server')}>
            <Space>
              <Form.Item name="smtp_host" noStyle rules={[{ required: true, message: t('mailbox.smtp_server') }]}>
                <Input placeholder="smtp.example.com" style={{ width: 250 }} />
              </Form.Item>
              <Form.Item name="smtp_port" noStyle initialValue={465}>
                <Input placeholder={t('mailbox.port')} style={{ width: 80 }} />
              </Form.Item>
              <Button onClick={() => handleTest('smtp')} loading={testing}>
                {t('mailbox.test_connection')}
              </Button>
            </Space>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingMailbox ? t('common.save') : t('common.add')}
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

export default MailboxSettings;
