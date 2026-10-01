'use strict';
// Fragment stays in this browser; do not send credentials to analytics or APIs.
const credential = location.hash.slice(1);
const isCode = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/.test(credential);
const isLegacy = /^[A-Za-z0-9_-]{32,128}$/.test(credential);
if (isCode || isLegacy) {
  document.getElementById('intro').textContent = 'Откройте приложение, чтобы получить доступ к материалам и подключениям к занятиям.';
  document.getElementById('invitation').hidden = false;
  document.getElementById('open-app').href = 'quietpractice://invite#' + credential;
  document.getElementById('code').textContent = isCode ? credential.match(/.{4}/g).join('-') : credential;
  document.getElementById('copy').addEventListener('click', async () => {
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(credential);
      status.textContent = 'Код скопирован. Вставьте его в Дейчи → Вики.';
    } catch {
      status.textContent = 'Выделите код выше и скопируйте его вручную.';
    }
  });
} else {
  document.getElementById('intro').textContent = 'В этой ссылке нет корректного приглашения. Попросите организатора прислать новую ссылку или код.';
}
