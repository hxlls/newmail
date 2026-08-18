import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../services/api';

function Register({ onLogin }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await authAPI.register(values);
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
        <h2>{t('auth.register_title')}</h2>
        <Form
          name="register"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: t('auth.username_required') },
              { min: 3, message: t('auth.username_min') }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder={t('auth.username')} />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: t('auth.email_required') },
              { type: 'email', message: t('auth.email_invalid') }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={t('auth.email')} />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: t('auth.password_required') },
              { min: 6, message: t('auth.password_min') }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {t('auth.register')}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            {t('auth.has_account')} <Link to="/login">{t('auth.login_now')}</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}

export default Register;
