import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { List, Card, Button, Space, message, Empty, Spin } from 'antd';
import { ReloadOutlined, StarFilled, StarOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { emailAPI } from '../services/api';

dayjs.extend(relativeTime);

function EmailList() {
  const { t, i18n } = useTranslation();
  const { id: mailboxId, folder } = useParams();
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    dayjs.locale(i18n.language === 'zh-CN' ? 'zh-cn' : i18n.language === 'ja-JP' ? 'ja' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    loadEmails();
  }, [mailboxId, folder, page]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50
      };
      
      if (mailboxId) {
        params.mailbox_id = mailboxId;
      }
      if (folder) {
        params.folder = folder;
      }
      
      const res = await emailAPI.getAll(params);
      setEmails(res.data.emails);
      setTotal(res.data.total);
    } catch (error) {
      message.error(t('email.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await emailAPI.sync({ mailbox_id: mailboxId });
      message.success(t('inbox.sync_success'));
      loadEmails();
    } catch (error) {
      message.error(t('inbox.sync_error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleStar = async (e, emailId, starred) => {
    e.stopPropagation();
    try {
      await emailAPI.markStarred(emailId, !starred);
      loadEmails();
    } catch (error) {
      message.error(t('common.error'));
    }
  };

  const handleDelete = async (e, emailId) => {
    e.stopPropagation();
    try {
      await emailAPI.delete(emailId);
      message.success(t('email.delete_success'));
      loadEmails();
    } catch (error) {
      message.error(t('common.error'));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>{t('inbox.title')}</h2>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleSync}
          loading={syncing}
        >
          {t('inbox.sync')}
        </Button>
      </div>

      <Card>
        <Spin spinning={loading}>
          {emails.length === 0 ? (
            <Empty description={t('inbox.no_emails')} />
          ) : (
            <List
              dataSource={emails}
              pagination={{
                current: page,
                total,
                pageSize: 50,
                onChange: setPage,
                showSizeChanger: false
              }}
              renderItem={(email) => (
                <List.Item
                  className={`email-list-item ${!email.is_read ? 'unread' : ''}`}
                  onClick={() => navigate(`/email/${email.id}`)}
                  style={{ padding: '12px 16px', cursor: 'pointer' }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space direction="vertical" size={4}>
                      <span style={{ fontWeight: email.is_read ? 'normal' : 'bold' }}>
                        {email.from_name || email.from_address}
                      </span>
                      <span style={{ fontWeight: email.is_read ? 'normal' : 'bold', color: '#333' }}>
                        {email.subject}
                      </span>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {email.body_text?.substring(0, 100)}...
                      </span>
                    </Space>
                    <Space>
                      <Button
                        type="text"
                        icon={email.is_starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                        onClick={(e) => handleToggleStar(e, email.id, email.is_starred)}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => handleDelete(e, email.id)}
                      />
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {dayjs(email.received_at).fromNow()}
                      </span>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}

export default EmailList;
