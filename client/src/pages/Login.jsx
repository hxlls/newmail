import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../services/api';

function Login({ onLogin }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await authAPI.login(values);
      onLogin(res.data.token, res.data.user);
    } catch (error) {
      message.error(error.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <h2>{t('common.app_name')}</h2>
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: t('auth.username_required') }]}
          >
            <Input prefix={<UserOutlined />} placeholder={t('auth.username')} />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: t('auth.password_required') }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {t('auth.login')}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            {t('auth.no_account')} <Link to="/register">{t('auth.register_now')}</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}

export default Login;
