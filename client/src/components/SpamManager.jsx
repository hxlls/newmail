import React, { useState, useEffect } from 'react';
import { Card, Table, Button, message, Space, Tag, Popconfirm, Tooltip } from 'antd';
import { DeleteOutlined, CheckCircleOutlined, WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { emailAPI } from '../services/api';

function SpamManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSpamEmails();
  }, []);

  const loadSpamEmails = async () => {
    setLoading(true);
    try {
      const res = await emailAPI.getAll({ folder: 'Junk', limit: 100 });
      setEmails(res.data.emails);
    } catch (error) {
      message.error('加载垃圾邮件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToInbox = async (id) => {
    try {
      await emailAPI.moveToFolder(id, 'INBOX');
      message.success('已移回收件箱');
      loadSpamEmails();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await emailAPI.delete(id);
      message.success('已删除');
      loadSpamEmails();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const getSpamScoreColor = (score) => {
    if (score >= 8) return 'red';
    if (score >= 5) return 'orange';
    if (score >= 3) return 'gold';
    return 'green';
  };

  const getSpamScoreText = (score) => {
    if (score >= 8) return '高风险';
    if (score >= 5) return '中风险';
    if (score >= 3) return '低风险';
    return '安全';
  };

  const columns = [
    {
      title: '风险等级',
      dataIndex: 'spam_score',
      key: 'spam_score',
      width: 100,
      render: (score) => (
        <Tag color={getSpamScoreColor(score)}>
          {getSpamScoreText(score)}
        </Tag>
      )
    },
    {
      title: '主题',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/email/${record.id}`)}>{text || '(无主题)'}</a>
      )
    },
    {
      title: '发件人',
      dataIndex: 'from_address',
      key: 'from_address',
      width: 200,
      ellipsis: true
    },
    {
      title: '时间',
      dataIndex: 'received_at',
      key: 'received_at',
      width: 150,
      render: (text) => dayjs(text).format('MM-DD HH:mm')
    },
    {
      title: '原因',
      dataIndex: 'spam_reasons',
      key: 'spam_reasons',
      ellipsis: true,
      render: (reasons) => {
        if (!reasons) return '-';
        try {
          const parsed = JSON.parse(reasons);
          return (
            <Tooltip title={parsed.join('\n')}>
              <span>{parsed[0]}...</span>
            </Tooltip>
          );
        } catch {
          return reasons;
        }
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => handleMoveToInbox(record.id)}
          >
            恢复
          </Button>
          <Popconfirm
            title="确定删除此邮件？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2><WarningOutlined /> 垃圾邮件管理</h2>
        <Button icon={<ReloadOutlined />} onClick={loadSpamEmails}>
          刷新
        </Button>
      </div>

      <Card>
        <p style={{ marginBottom: 16, color: '#666' }}>
          系统会自动分析邮件内容，将可疑邮件标记为垃圾邮件。您可以在这里查看和管理。
        </p>
        <Table
          columns={columns}
          dataSource={emails}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}

export default SpamManager;
