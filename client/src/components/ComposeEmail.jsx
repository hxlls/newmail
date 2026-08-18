import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Select, Card, message, Space } from 'antd';
import { SendOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { emailAPI, aiAPI } from '../services/api';

const { TextArea } = Input;

function ComposeEmail({ mailboxes }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const replyTo = location.state?.replyTo;
  const forward = location.state?.forward;
  const defaultMailboxId = location.state?.mailbox_id;

  useEffect(() => {
    if (replyTo) {
      form.setFieldsValue({
        to: replyTo.from_address,
        subject: `Re: ${replyTo.subject}`,
        body: `\n\n------ 原始邮件 ------\n发件人: ${replyTo.from_name} <${replyTo.from_address}>\n时间: ${replyTo.received_at}\n主题: ${replyTo.subject}\n\n${replyTo.body_text}`
      });
    } else if (forward) {
      form.setFieldsValue({
        subject: `Fwd: ${forward.subject}`,
        body: `\n\n------ 转发邮件 ------\n发件人: ${forward.from_name} <${forward.from_address}>\n时间: ${forward.received_at}\n主题: ${forward.subject}\n\n${forward.body_text}`
      });
    }

    if (defaultMailboxId) {
      form.setFieldsValue({ mailbox_id: defaultMailboxId });
    } else if (mailboxes.length > 0) {
      const defaultMailbox = mailboxes.find(m => m.is_default) || mailboxes[0];
      form.setFieldsValue({ mailbox_id: defaultMailbox.id });
    }
  }, [replyTo, forward, defaultMailboxId, mailboxes]);

  const onFinish = async (values) => {
    setSending(true);
    try {
      await emailAPI.send({
        mailbox_id: values.mailbox_id,
        to: values.to,
        cc: values.cc,
        bcc: values.bcc,
        subject: values.subject,
        text: values.body,
        html: values.body.replace(/\n/g, '<br/>')
      });
      message.success(t('email.send_success'));
      navigate(-1);
    } catch (error) {
      message.error(t('email.send_error') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setSending(false);
    }
  };

  const handleAIGenerate = async () => {
    setAiLoading(true);
    try {
      const res = await aiAPI.generateReply({
        email_content: replyTo?.body_text || forward?.body_text || '',
        tone: '正式',
        language: '中文'
      });
      form.setFieldsValue({ body: res.data.reply });
      message.success(t('compose.ai_generate_success'));
    } catch (error) {
      message.error(t('compose.ai_generate_error') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        {t('common.back')}
      </Button>

      <Card title={replyTo ? t('compose.reply_title') : forward ? t('compose.forward_title') : t('compose.title')}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            name="mailbox_id"
            label={t('compose.select_mailbox')}
            rules={[{ required: true, message: t('compose.select_mailbox_placeholder') }]}
          >
            <Select placeholder={t('compose.select_mailbox_placeholder')}>
              {mailboxes.map(m => (
                <Select.Option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="to"
            label={t('email.to')}
            rules={[{ required: true, message: t('compose.to_placeholder') }]}
          >
            <Input placeholder={t('compose.to_placeholder')} />
          </Form.Item>

          <Form.Item name="cc" label={t('email.cc')}>
            <Input placeholder={t('compose.cc_placeholder')} />
          </Form.Item>

          <Form.Item name="bcc" label={t('email.bcc')}>
            <Input placeholder={t('compose.bcc_placeholder')} />
          </Form.Item>

          <Form.Item
            name="subject"
            label={t('email.subject')}
            rules={[{ required: true, message: t('compose.subject_placeholder') }]}
          >
            <Input placeholder={t('compose.subject_placeholder')} />
          </Form.Item>

          <Form.Item
            name="body"
            label={t('email.content')}
            rules={[{ required: true, message: t('compose.body_placeholder') }]}
          >
            <TextArea rows={12} placeholder={t('compose.body_placeholder')} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SendOutlined />}
                htmlType="submit"
                loading={sending}
              >
                {t('compose.send')}
              </Button>
              {(replyTo || forward) && (
                <Button
                  loading={aiLoading}
                  onClick={handleAIGenerate}
                >
                  {t('compose.ai_generate')}
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default ComposeEmail;
