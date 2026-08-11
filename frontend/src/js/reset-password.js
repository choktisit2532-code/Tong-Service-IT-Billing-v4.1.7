import { request } from './api.js';
const token = new URLSearchParams(location.search).get('token'); const form = document.getElementById('reset-form'); const message = document.getElementById('message'); const input = document.getElementById('new-password');
document.getElementById('new-password-visibility').addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; });
if (!token) { form.classList.add('hidden'); message.textContent = 'ไม่พบลิงก์ตั้งรหัสผ่าน'; message.classList.remove('hidden'); }
form.addEventListener('submit', async (event) => { event.preventDefault(); try { const result = await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: input.value }) }); message.textContent = result.message; message.classList.remove('hidden'); form.classList.add('hidden'); } catch (error) { message.textContent = error.message; message.classList.remove('hidden'); } });
