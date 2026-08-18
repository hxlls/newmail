import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, message, Tag, Divider, Spin, Modal } from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  ForwardOutlined,
  DeleteOutlined,
  StarFilled,
  StarOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { emailAPI, aiAPI } from '../services/api';

function EmailDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiAction, setAiAction] = useState('');

  useEffect(() => {
    loadEmail();
  }, [id]);

  const loadEmail = async () => {
    setLoading(true);
    try {
      const res = await emailAPI.getById(id);
      setEmail(res.data.email);
    } catch (error) {
      message.error(t('email.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStar = async () => {
    try {
      await emailAPI.markStarred(id, !email.is_starred);
      setEmail({ ...email, is_starred: !email.is_starred });
    } catch (error) {
      message.error(t('common.error'));
    }
  };

  const handleDelete = async () => {
    try {
      await emailAPI.delete(id);
      message.success(t('email.delete_success'));
      navigate(-1);
    } catch (error) {
      message.error(t('common.error'));
    }
  };

  const handleAISummarize = async () => {
    setAiAction('summarize');
    setAiLoading(true);
    setAiModalVisible(true);
    setAiResult('');

    try {
      const res = await aiAPI.summarize({
        email_content: email.body_text || email.body_html
      });
      setAiResult(res.data.summary);
    } catch (error) {
      setAiResult(t('common.error') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIReply = async () => {
    setAiAction('reply');
    setAiLoading(true);
    setAiModalVisible(true);
    setAiResult('');

    try {
      const res = await aiAPI.generateReply({
        email_content: email.body_text || email.body_html,
        tone: '正式',
        language: '中文'
      });
      setAiResult(res.data.reply);
    } catch (error) {
      setAiResult(t('compose.ai_generate_error') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyAIResult = () => {
    navigator.clipboard.writeText(aiResult);
    message.success(t('ai.copy_success'));
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!email) {
    return <div>{t('email.no_subject')}</div>;
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        {t('common.back')}
      </Button>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{email.subject}</h2>
          <Space>
            <Button
              icon={email.is_starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={handleToggleStar}
            />
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete} />
          </Space>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Space>
            <span><strong>{t('email.from')}:</strong> {email.from_name} &lt;{email.from_address}&gt;</span>
            <Tag>{email.mailbox_email}</Tag>
          </Space>
          <div><strong>{t('email.to')}:</strong> {email.to_address}</div>
          <div><strong>{t('email.date')}:</strong> {dayjs(email.received_at).format('YYYY-MM-DD HH:mm:ss')}</div>
        </div>

        <Divider />

        <div
          className="email-content"
          dangerouslySetInnerHTML={{ __html: email.body_html || email.body_text?.replace(/\n/g, '<br/>') }}
        />

        <Divider />

        <Space>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => navigate('/compose', {
              state: {
                replyTo: email,
                mailbox_id: email.mailbox_id
              }
            })}
          >
            {t('email.reply')}
          </Button>
          <Button
            icon={<ForwardOutlined />}
            onClick={() => navigate('/compose', {
              state: {
                forward: email
              }
            })}
          >
            {t('email.forward')}
          </Button>
          <Button
            icon={<RobotOutlined />}
            onClick={handleAISummarize}
          >
            {t('ai.summarize')}
          </Button>
          <Button
            icon={<RobotOutlined />}
            onClick={handleAIReply}
          >
            {t('ai.ai_reply')}
          </Button>
        </Space>
      </Card>

      <Modal
        title={aiAction === 'summarize' ? t('ai.summarize_title') : t('ai.ai_reply_title')}
        open={aiModalVisible}
        onCancel={() => setAiModalVisible(false)}
        footer={[
          <Button key="copy" onClick={handleCopyAIResult}>
            {t('ai.copy')}
          </Button>,
          <Button key="close" type="primary" onClick={() => setAiModalVisible(false)}>
            {t('ai.close')}
          </Button>
        ]}
        width={600}
      >
        <Spin spinning={aiLoading}>
          <div style={{ whiteSpace: 'pre-wrap', minHeight: 100 }}>
            {aiResult || t('ai.generating')}
          </div>
        </Spin>
      </Modal>
    </div>
  );
}

export default EmailDetail;
