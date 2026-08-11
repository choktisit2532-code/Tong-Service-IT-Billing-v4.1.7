import { request, setToken, getToken } from './api.js';
import { initTheme } from './theme.js';

initTheme();

async function loadPublicBranding() {
  const logo = document.getElementById('login-logo');
  const shopName = document.getElementById('login-shop-name');
  const shopSubtitle = document.getElementById('login-shop-subtitle');

  try {
    const result = await request('/settings/public-branding');
    const branding = result.data;
    if (!branding) return;

    if (branding.logo_url) {
      logo.src = branding.logo_url;
      logo.onerror = () => {
        logo.onerror = null;
        logo.src = './assets/logo-placeholder.svg';
      };
    }

    if (branding.shop_name_th) {
      shopName.textContent = branding.shop_name_th;
      document.title = `เข้าสู่ระบบ | ${branding.shop_name_th}`;
    }

    if (branding.shop_name_en) {
      shopSubtitle.textContent = branding.shop_name_en;
    }
  } catch (error) {
    console.warn('ไม่สามารถโหลดข้อมูลแบรนด์ได้:', error.message);
  }
}

loadPublicBranding();

if (getToken()) {
  request('/auth/me').then(() => location.replace('./app.html')).catch(() => {});
}

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const button = document.getElementById('login-button');
const passwordInput = document.getElementById('password');
document.getElementById('password-visibility').addEventListener('click', (event) => {
  const visible = passwordInput.type === 'text'; passwordInput.type = visible ? 'password' : 'text'; event.currentTarget.textContent = visible ? '👁' : '🙈';
});
document.getElementById('forgot-password').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim() || prompt('กรอกอีเมลที่ใช้เข้าสู่ระบบ');
  if (!email) return;
  try { await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); errorBox.textContent = 'หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว'; errorBox.classList.remove('hidden'); }
  catch (error) { errorBox.textContent = error.message; errorBox.classList.remove('hidden'); }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.classList.add('hidden');
  button.disabled = true;
  button.textContent = 'กำลังเข้าสู่ระบบ...';
  try {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      })
    });
    setToken(result.token);
    location.replace('./app.html');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = 'เข้าสู่ระบบ';
  }
});
