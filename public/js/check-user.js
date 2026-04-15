function clearResult(resultDiv) {
  resultDiv.replaceChildren();
}

function createStatusRow(icon, label, value) {
  const row = document.createElement('div');
  row.className = 'status-row';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'status-icon';
  iconDiv.textContent = icon;

  const textWrap = document.createElement('div');
  textWrap.className = 'status-text';

  const labelDiv = document.createElement('div');
  labelDiv.className = 'status-label';
  labelDiv.textContent = label;

  const valueDiv = document.createElement('div');
  valueDiv.className = 'status-value';
  valueDiv.textContent = value;

  textWrap.append(labelDiv, valueDiv);
  row.append(iconDiv, textWrap);
  return row;
}

function createDiagnosis(title, lines) {
  const diagnosis = document.createElement('div');
  diagnosis.className = 'diagnosis';

  const heading = document.createElement('h3');
  heading.textContent = title;
  diagnosis.appendChild(heading);

  if (lines.length > 0) {
    const list = document.createElement('ul');
    for (const line of lines) {
      const item = document.createElement('li');
      item.textContent = line;
      list.appendChild(item);
    }
    diagnosis.appendChild(list);
  }

  return diagnosis;
}

function createCodeBlock(text) {
  const pre = document.createElement('pre');
  pre.textContent = text;
  return pre;
}

async function checkUser() {
  const email = document.getElementById('email').value.trim();
  const resultDiv = document.getElementById('result');
  const btn = document.getElementById('checkBtn');

  if (!email) {
    resultDiv.className = 'result error show';
    clearResult(resultDiv);
    const message = document.createElement('p');
    message.textContent = '❌ Email tidak boleh kosong';
    resultDiv.appendChild(message);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memeriksa...';
  resultDiv.className = 'result';
  clearResult(resultDiv);

  try {
    const response = await fetch('/api/users/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      resultDiv.className = 'result error show';
      clearResult(resultDiv);
      const message = document.createElement('p');
      message.textContent = `❌ ${data.error || 'User tidak ditemukan'}`;
      resultDiv.appendChild(message);
      return;
    }

    const user = data.user || {};
    const canLogin = Boolean(user.emailVerified && user.isApproved);
    resultDiv.className = `result ${canLogin ? 'success' : 'warning'} show`;
    clearResult(resultDiv);

    const title = document.createElement('h2');
    title.style.marginBottom = '16px';
    title.style.color = canLogin ? '#16a34a' : '#f59e0b';
    title.textContent = canLogin ? '✅ User Bisa Login!' : '⚠️ User Tidak Bisa Login';
    resultDiv.appendChild(title);

    resultDiv.appendChild(
      createStatusRow(user.emailVerified ? '✅' : '❌', 'Verifikasi Email', user.emailVerified ? 'Sudah terverifikasi' : 'Belum terverifikasi')
    );

    resultDiv.appendChild(
      createStatusRow(user.isApproved ? '✅' : '⏳', 'Approval Admin', user.isApproved ? 'Sudah di-approve' : 'Menunggu approval')
    );

    resultDiv.appendChild(document.createElement('div')).className = 'divider';

    resultDiv.appendChild(createStatusRow('✉️', 'Email yang diperiksa', email));

    if (!canLogin) {
      const lines = [];
      if (!user.emailVerified) lines.push('User harus klik link verifikasi di email');
      if (!user.isApproved) lines.push('Admin harus approve user di User Management');
      resultDiv.appendChild(createDiagnosis('💡 Yang Harus Dilakukan:', lines));
    } else {
      const diagnosis = document.createElement('div');
      diagnosis.className = 'diagnosis';

      const heading = document.createElement('h3');
      heading.textContent = '✅ Semua Persyaratan Terpenuhi';
      diagnosis.appendChild(heading);

      const paragraph = document.createElement('p');
      paragraph.style.color = '#6b7280';
      paragraph.style.marginTop = '8px';
      paragraph.textContent = 'Jika user masih tidak bisa login, pastikan password benar, coba clear cache browser, coba incognito/private mode, dan cek console browser untuk error.';
      diagnosis.appendChild(paragraph);
      resultDiv.appendChild(diagnosis);
    }

    resultDiv.appendChild(createCodeBlock(JSON.stringify(data, null, 2)));
  } catch (error) {
    resultDiv.className = 'result error show';
    clearResult(resultDiv);
    const message = document.createElement('p');
    message.textContent = `❌ Error: ${error.message}`;
    resultDiv.appendChild(message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cek Status';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('checkBtn').addEventListener('click', checkUser);
  document.getElementById('email').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkUser();
  });

  const email = document.getElementById('email').value;
  if (email) checkUser();
});