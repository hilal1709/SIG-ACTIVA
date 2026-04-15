function clearResult(resultDiv) {
  resultDiv.replaceChildren();
}

function createStatusItem(icon, label, value) {
  const item = document.createElement('div');
  item.className = 'status-item';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'status-icon';
  iconDiv.textContent = icon;

  const info = document.createElement('div');
  info.className = 'status-info';

  const labelDiv = document.createElement('div');
  labelDiv.className = 'status-label';
  labelDiv.textContent = label;

  const valueDiv = document.createElement('div');
  valueDiv.className = 'status-value';
  valueDiv.textContent = value;

  info.append(labelDiv, valueDiv);
  item.append(iconDiv, info);
  return item;
}

function createSteps(title, paragraphs, items) {
  const steps = document.createElement('div');
  steps.className = 'steps';

  const heading = document.createElement('h4');
  heading.textContent = title;
  steps.appendChild(heading);

  for (const paragraphText of paragraphs) {
    const paragraph = document.createElement('p');
    paragraph.textContent = paragraphText;
    steps.appendChild(paragraph);
  }

  if (items.length > 0) {
    const list = document.createElement('ol');
    for (const itemText of items) {
      const item = document.createElement('li');
      item.textContent = itemText;
      list.appendChild(item);
    }
    steps.appendChild(list);
  }

  return steps;
}

function createPrimaryButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-secondary';
  button.style.width = '100%';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

async function forceVerify() {
  const email = document.getElementById('email').value.trim();
  const resultDiv = document.getElementById('result');
  const btn = document.getElementById('verifyBtn');

  if (!email) {
    resultDiv.className = 'result error show';
    clearResult(resultDiv);
    const title = document.createElement('h3');
    title.textContent = '❌ Error';
    const message = document.createElement('p');
    message.textContent = 'Email tidak boleh kosong';
    resultDiv.append(title, message);
    return;
  }

  if (!confirm(`Anda yakin ingin force verify email:\n${email}?\n\nIni akan mengubah status emailVerified menjadi true.`)) {
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memverifikasi...';
  resultDiv.className = 'result';
  clearResult(resultDiv);

  try {
    const response = await fetch('/api/users/force-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      resultDiv.className = 'result error show';
      clearResult(resultDiv);

      const title = document.createElement('h3');
      title.textContent = '❌ Gagal Memverifikasi';
      const message = document.createElement('p');
      message.textContent = data.error || 'Terjadi kesalahan';
      resultDiv.append(title, message);
      return;
    }

    const user = data.user || {};
    const canLogin = Boolean(user.emailVerified && user.isApproved);

    resultDiv.className = 'result success show';
    clearResult(resultDiv);

    const title = document.createElement('h3');
    title.textContent = '✅ Email Berhasil Di-verify!';
    resultDiv.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'status-grid';
    grid.append(
      createStatusItem('✅', 'Verifikasi Email', 'Sudah terverifikasi (force)'),
      createStatusItem(user.isApproved ? '✅' : '⏳', 'Approval Admin', user.isApproved ? 'Sudah di-approve' : 'Menunggu approval')
    );
    resultDiv.appendChild(grid);

    if (canLogin) {
      resultDiv.appendChild(createSteps(
        '🎉 User Sekarang Bisa Login!',
        ['Instruksi untuk user:'],
        [
          'Buka halaman login',
          `Masukkan email: ${user.email}`,
          'Masukkan password yang sudah dibuat',
          'Klik tombol "Masuk"',
        ]
      ));
    } else {
      resultDiv.appendChild(createSteps(
        '⏳ Email Sudah Terverifikasi',
        ['Tapi user masih perlu di-approve admin untuk bisa login.', 'Silakan approve user di halaman User Management atau gunakan tool approve-user.'],
        []
      ));
    }

    resultDiv.appendChild(createPrimaryButton('Verify User Lain', () => location.reload()));
  } catch (error) {
    resultDiv.className = 'result error show';
    clearResult(resultDiv);

    const title = document.createElement('h3');
    title.textContent = '❌ Error';
    const message = document.createElement('p');
    message.textContent = error.message;
    resultDiv.append(title, message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Force Verify Email';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('verifyBtn').addEventListener('click', forceVerify);
  document.getElementById('email').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') forceVerify();
  });
});