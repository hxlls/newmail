import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, Badge, message, Select } from 'antd';
import {
  MailOutlined,
  InboxOutlined,
  SettingOutlined,
  RobotOutlined,
  LogoutOutlined,
  UserOutlined,
  PlusOutlined,
  DatabaseOutlined,
  SendOutlined,
  FileOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import UnifiedInbox from './UnifiedInbox';
import EmailList from './EmailList';
import EmailDetail from './EmailDetail';
import ComposeEmail from './ComposeEmail';
import MailboxSettings from './MailboxSettings';
import AISettings from './AISettings';
import BackupSettings from './BackupSettings';
import SpamManager from './SpamManager';
import { mailboxAPI } from '../services/api';

const { Header, Sider, Content } = Layout;

function MainLayout({ user, onLogout }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [socket, setSocket] = useState(null);
  const [mailboxes, setMailboxes] = useState([]);
  const [stats, setStats] = useState({ total: 0, unread: 0, starred: 0 });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const newSocket = io(window.location.origin, {
      auth: { token }
    });

    newSocket.on('new-emails', (data) => {
      message.info(t('inbox.new_email_count', { count: data.count }));
      loadStats();
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [t]);

  useEffect(() => {
    loadMailboxes();
    loadStats();
  }, []);

  const loadMailboxes = async () => {
    try {
      const res = await mailboxAPI.getAll();
      setMailboxes(res.data.mailboxes);
    } catch (error) {
      console.error('Failed to load mailboxes:', error);
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

  const handleLanguageChange = (value) => {
    i18n.changeLanguage(value);
    window.location.reload();
  };

  const menuItems = [
    {
      key: '/',
      icon: <InboxOutlined />,
      label: (
        <span>
          {t('nav.unified_inbox')}
          {stats.unread > 0 && <Badge count={stats.unread} size="small" style={{ marginLeft: 8 }} />}
        </span>
      )
    },
    {
      key: '/starred',
      icon: <span>⭐</span>,
      label: t('nav.starred')
    },
    {
      type: 'divider'
    },
    {
      key: 'folders',
      icon: <MailOutlined />,
      label: '邮件文件夹',
      children: [
        {
          key: '/folder/INBOX',
          icon: <InboxOutlined />,
          label: '收件箱'
        },
        {
          key: '/folder/Sent',
          icon: <SendOutlined />,
          label: '已发送'
        },
        {
          key: '/folder/Drafts',
          icon: <FileOutlined />,
          label: '草稿'
        },
        {
          key: '/folder/Junk',
          icon: <ExclamationCircleOutlined />,
          label: '垃圾邮件'
        },
        {
          key: '/folder/Trash',
          icon: <DeleteOutlined />,
          label: '已删除'
        }
      ]
    },
    {
      type: 'divider'
    },
    {
      key: 'mailboxes',
      icon: <MailOutlined />,
      label: t('nav.my_mailboxes'),
      children: mailboxes.map(m => ({
        key: `/mailbox/${m.id}`,
        label: (
          <span>
            {m.name}
            <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>{m.email}</span>
          </span>
        )
      }))
    },
    {
      type: 'divider'
    },
    {
      key: '/compose',
      icon: <PlusOutlined />,
      label: t('nav.compose')
    },
    {
      key: '/settings/mailboxes',
      icon: <SettingOutlined />,
      label: t('nav.mailbox_manage')
    },
    {
      key: '/settings/ai',
      icon: <RobotOutlined />,
      label: t('nav.ai_settings')
    },
    {
      key: '/settings/backup',
      icon: <DatabaseOutlined />,
      label: '数据备份'
    },
    {
      key: '/settings/spam',
      icon: <ExclamationCircleOutlined />,
      label: '垃圾邮件'
    }
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: user.username
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('auth.logout'),
      onClick: onLogout
    }
  ];

  const selectedKeys = [location.pathname];
  const APP_VERSION = '1.8.6';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', fontWeight: 'bold', fontSize: 18 }}>
          📧 NewMail
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none', flex: 1 }}
        />
        <div style={{ 
          padding: '12px 24px', 
          borderTop: '1px solid #f0f0f0',
          fontSize: 12,
          color: '#999',
          textAlign: 'center'
        }}>
          v{APP_VERSION}
        </div>
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Select
            value={i18n.language}
            onChange={handleLanguageChange}
            style={{ width: 120 }}
            options={[
              { value: 'zh-CN', label: '中文' },
              { value: 'en-US', label: 'English' },
              { value: 'ja-JP', label: '日本語' }
            ]}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {user.username}
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Routes>
            <Route path="/" element={<UnifiedInbox />} />
            <Route path="/starred" element={<UnifiedInbox starredOnly />} />
            <Route path="/folder/:folder" element={<EmailList />} />
            <Route path="/mailbox/:id" element={<EmailList />} />
            <Route path="/email/:id" element={<EmailDetail />} />
            <Route path="/compose" element={<ComposeEmail mailboxes={mailboxes} />} />
            <Route path="/settings/mailboxes" element={<MailboxSettings onMailboxChange={loadMailboxes} />} />
            <Route path="/settings/ai" element={<AISettings />} />
            <Route path="/settings/backup" element={<BackupSettings />} />
            <Route path="/settings/spam" element={<SpamManager />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
