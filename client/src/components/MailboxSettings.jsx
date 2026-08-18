import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm, Switch, Tooltip, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
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
      imap_secure: record.imap_secure !== 0,
      smtp_host: record.smtp_host,
      smtp_port: record.smtp_port,
      smtp_secure: record.smtp_secure !== 0
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
      // 根据提供商设置默认协议
      const protocol = provider.protocol || 'imap';
      form.setFieldsValue({
        protocol: protocol,
        imap_host: provider.imap?.host,
        imap_port: provider.imap?.port,
        imap_secure: provider.imap?.secure !== false,
        pop3_host: provider.pop3?.host,
        pop3_port: provider.pop3?.port,
        pop3_secure: provider.pop3?.secure !== false,
        smtp_host: provider.smtp?.host,
        smtp_port: provider.smtp?.port,
        smtp_secure: provider.smtp?.secure !== false
      });
    }
  };

  const handleTest = async (type) => {
    try {
      const values = await form.validateFields(['email', 'password']);
      setTesting(true);

      let host, port, secure;
      if (type === 'imap') {
        host = form.getFieldValue('imap_host');
        port = form.getFieldValue('imap_port');
        secure = form.getFieldValue('imap_secure');
      } else if (type === 'pop3') {
        host = form.getFieldValue('pop3_host');
        port = form.getFieldValue('pop3_port');
        secure = form.getFieldValue('pop3_secure');
      } else {
        host = form.getFieldValue('smtp_host');
        port = form.getFieldValue('smtp_port');
        secure = form.getFieldValue('smtp_secure');
      }

      const res = await mailboxAPI.test({
        type,
        host,
        port,
        secure: secure !== false,
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
        // 如果是第一个邮箱，自动设为默认
        const isFirstMailbox = mailboxes.length === 0;
        await mailboxAPI.create({
          ...values,
          provider: selectedProvider,
          is_default: values.is_default || isFirstMailbox
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

          <Form.Item
            name="protocol"
            label="接收协议"
            initialValue="imap"
          >
            <Radio.Group>
              <Radio.Button value="imap">IMAP</Radio.Button>
              <Radio.Button value="pop3">POP3</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.protocol !== currentValues.protocol}
          >
            {({ getFieldValue }) => {
              const protocol = getFieldValue('protocol') || 'imap';
              return protocol === 'imap' ? (
                <Form.Item label="IMAP服务器">
                  <Space>
                    <Form.Item name="imap_host" noStyle>
                      <Input placeholder="imap.example.com" style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item name="imap_port" noStyle initialValue={993}>
                      <Input placeholder="端口" style={{ width: 70 }} />
                    </Form.Item>
                    <Form.Item name="imap_secure" noStyle valuePropName="checked" initialValue={true}>
                      <Switch checkedChildren="SSL" unCheckedChildren="SSL" />
                    </Form.Item>
                    <Button onClick={() => handleTest('imap')} loading={testing}>
                      测试连接
                    </Button>
                  </Space>
                </Form.Item>
              ) : (
                <Form.Item label="POP3服务器">
                  <Space>
                    <Form.Item name="pop3_host" noStyle>
                      <Input placeholder="pop.example.com" style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item name="pop3_port" noStyle initialValue={995}>
                      <Input placeholder="端口" style={{ width: 70 }} />
                    </Form.Item>
                    <Form.Item name="pop3_secure" noStyle valuePropName="checked" initialValue={true}>
                      <Switch checkedChildren="SSL" unCheckedChildren="SSL" />
                    </Form.Item>
                    <Button onClick={() => handleTest('pop3')} loading={testing}>
                      测试连接
                    </Button>
                  </Space>
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item label={t('mailbox.smtp_server')}>
            <Space>
              <Form.Item name="smtp_host" noStyle rules={[{ required: true, message: t('mailbox.smtp_server') }]}>
                <Input placeholder="smtp.example.com" style={{ width: 220 }} />
              </Form.Item>
              <Form.Item name="smtp_port" noStyle initialValue={465}>
                <Input placeholder={t('mailbox.port')} style={{ width: 70 }} />
              </Form.Item>
              <Form.Item name="smtp_secure" noStyle valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="SSL" unCheckedChildren="SSL" />
              </Form.Item>
              <Button onClick={() => handleTest('smtp')} loading={testing}>
                {t('mailbox.test_connection')}
              </Button>
            </Space>
          </Form.Item>

          {!editingMailbox && (
            <Form.Item
              name="is_default"
              valuePropName="checked"
              initialValue={mailboxes.length === 0}
            >
              <Switch checkedChildren="默认邮箱" unCheckedChildren="设为默认" />
            </Form.Item>
          )}

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
