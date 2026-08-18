import React, { useState, useEffect } from 'react';
import { Card, Button, Space, message, Statistic, Row, Col, Upload, Modal, Alert, Checkbox, Divider } from 'antd';
import { DownloadOutlined, UploadOutlined, DatabaseOutlined, MailOutlined, StarOutlined, InboxOutlined, SendOutlined, FileOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { backupAPI } from '../services/api';

function BackupSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState(['INBOX', 'Sent', 'Drafts', 'Junk', 'Trash']);

  const folderOptions = [
    { label: '收件箱', value: 'INBOX', icon: <InboxOutlined /> },
    { label: '已发送', value: 'Sent', icon: <SendOutlined /> },
    { label: '草稿箱', value: 'Drafts', icon: <FileOutlined /> },
    { label: '垃圾邮件', value: 'Junk', icon: <ExclamationCircleOutlined /> },
    { label: '已删除', value: 'Trash', icon: <DeleteOutlined /> }
  ];

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await backupAPI.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const handleExport = async () => {
    if (selectedFolders.length === 0) {
      message.warning('请至少选择一个文件夹');
      return;
    }
    
    setLoading(true);
    setExportModalVisible(false);
    try {
      const res = await backupAPI.export(selectedFolders.join(','));
      
      // 创建下载链接
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `newmail-backup-${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('数据导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await backupAPI.import(formData);
      message.success(res.data.message);
      loadStats();
      setImportModalVisible(false);
    } catch (error) {
      message.error('导入失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="数据备份与恢复" style={{ marginBottom: 24 }}>
        <Alert
          message="数据备份说明"
          description="导出的数据包含邮箱配置和邮件内容，但不包含邮箱密码和API密钥。请妥善保管备份文件。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {stats && (
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Statistic
                title="邮箱数量"
                value={stats.mailboxes}
                prefix={<MailOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="邮件总数"
                value={stats.emails}
                prefix={<InboxOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="未读邮件"
                value={stats.unread}
                prefix={<MailOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="星标邮件"
                value={stats.starred}
                prefix={<StarOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="附件数量"
                value={stats.attachments}
                prefix={<DatabaseOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="数据库大小"
                value={formatBytes(stats.db_size)}
                prefix={<DatabaseOutlined />}
              />
            </Col>
          </Row>
        )}

        <Space size="large">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="large"
            loading={loading}
            onClick={() => setExportModalVisible(true)}
          >
            导出备份
          </Button>
          
          <Button
            icon={<UploadOutlined />}
            size="large"
            onClick={() => setImportModalVisible(true)}
          >
            导入备份
          </Button>
        </Space>
      </Card>

      <Card title="备份说明">
        <p style={{ color: '#666' }}>
          建议定期备份数据，以防数据丢失。
        </p>
        <ul style={{ color: '#666' }}>
          <li>导出的数据包含：邮箱配置、邮件内容、附件、星标状态</li>
          <li>不包含：邮箱密码、AI API密钥等敏感信息</li>
          <li>导入时会自动跳过已存在的数据</li>
          <li>邮件会自动导入到对应的文件夹（收件箱、已发送等）</li>
        </ul>
      </Card>

      <Modal
        title="选择导出文件夹"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        onOk={handleExport}
        okText="开始导出"
        cancelText="取消"
      >
        <p>请选择要导出的邮件文件夹：</p>
        <Checkbox.Group
          value={selectedFolders}
          onChange={setSelectedFolders}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {folderOptions.map(opt => (
            <Checkbox key={opt.value} value={opt.value}>
              <Space>
                {opt.icon}
                {opt.label}
              </Space>
            </Checkbox>
          ))}
        </Checkbox.Group>
        <Divider />
        <Space>
          <Button size="small" onClick={() => setSelectedFolders(['INBOX'])}>仅收件箱</Button>
          <Button size="small" onClick={() => setSelectedFolders(['INBOX', 'Sent'])}>收件+已发送</Button>
          <Button size="small" onClick={() => setSelectedFolders(['INBOX', 'Sent', 'Drafts'])}>常用</Button>
          <Button size="small" onClick={() => setSelectedFolders(folderOptions.map(f => f.value))}>全选</Button>
        </Space>
      </Modal>

      <Modal
        title="导入备份"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
      >
        <p>选择之前导出的备份文件进行导入：</p>
        <Upload.Dragger
          accept=".zip,.json"
          showUploadList={false}
          beforeUpload={(file) => {
            handleImport(file);
            return false;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域</p>
          <p className="ant-upload-hint">支持 .zip 和 .json 格式的备份文件</p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
}

export default BackupSettings;
