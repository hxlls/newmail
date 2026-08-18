import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Card, Tag, Button, Space, message, Empty, Spin } from 'antd';
import { ReloadOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { mailboxAPI, emailAPI } from '../services/api';

dayjs.extend(relativeTime);

function UnifiedInbox({ starredOnly = false }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({ total: 0, unread: 0, starred: 0, mailboxCount: 0 });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    dayjs.locale(i18n.language === 'zh-CN' ? 'zh-cn' : i18n.language === 'ja-JP' ? 'ja' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    loadEmails();
    loadStats();
  }, [page, starredOnly]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const res = await mailboxAPI.getUnified({
        page,
        limit: 50,
        starred_only: starredOnly
      });
      setEmails(res.data.emails);
      setTotal(res.data.total);
    } catch (error) {
      message.error(t('email.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await mailboxAPI.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await emailAPI.sync({});
      message.success(t('inbox.sync_success'));
      loadEmails();
      loadStats();
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

  const getMailboxColor = (name) => {
    const colors = ['blue', 'green', 'orange', 'purple', 'cyan', 'magenta'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div>
      <div className="unified-inbox-header">
        <h2>{starredOnly ? t('inbox.starred_title') : t('inbox.title')}</h2>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleSync}
          loading={syncing}
        >
          {t('inbox.sync')}
        </Button>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="number">{stats.mailboxCount}</div>
          <div className="label">{t('inbox.mailbox_count')}</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.total}</div>
          <div className="label">{t('inbox.total_emails')}</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.unread}</div>
          <div className="label">{t('inbox.unread_emails')}</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.starred}</div>
          <div className="label">{t('inbox.starred_emails')}</div>
        </div>
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
                      <Space>
                        <span style={{ fontWeight: email.is_read ? 'normal' : 'bold' }}>
                          {email.from_name || email.from_address}
                        </span>
                        <Tag color={getMailboxColor(email.mailbox_name)} className="mailbox-tag">
                          {email.mailbox_name}
                        </Tag>
                      </Space>
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

export default UnifiedInbox;
