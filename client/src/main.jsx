import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';
import App from './App';
import './i18n';
import './index.css';

const antdLocales = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP
};

const currentLang = localStorage.getItem('i18nextLng') || 'zh-CN';
const antdLocale = antdLocales[currentLang] || zhCN;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={antdLocale}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
