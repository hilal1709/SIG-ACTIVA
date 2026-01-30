# Setup Gmail SMTP untuk Email Verification

## Langkah 1: Enable 2-Step Verification di Gmail

1. Buka https://myaccount.google.com/security
2. Scroll ke bawah, cari **"2-Step Verification"**
3. Klik **"Get Started"** dan ikuti langkah-langkahnya
4. Aktifkan verifikasi 2 langkah (wajib untuk App Password)

## Langkah 2: Generate App Password

1. Setelah 2-Step Verification aktif, buka https://myaccount.google.com/apppasswords
2. Atau cari **"App passwords"** di halaman Security
3. Klik **"Select app"** → pilih **"Other (Custom name)"**
4. Ketik nama: `SIG ACTIVA`
5. Klik **"Generate"**
6. Copy **16-character password** yang muncul (contoh: `abcd efgh ijkl mnop`)

## Langkah 3: Update .env.local

```env
GMAIL_USER="youremail@gmail.com"
GMAIL_APP_PASSWORD="abcdefghijklmnop"  # Tanpa spasi, 16 karakter
EMAIL_FROM="youremail@gmail.com"
ADMIN_EMAIL="admin@semenindonesia.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Langkah 4: Update Environment Variables di Vercel

1. Buka https://vercel.com/dashboard
2. Pilih project **sig-activa**
3. Settings → Environment Variables
4. Tambahkan variabel berikut:

```
GMAIL_USER = youremail@gmail.com
GMAIL_APP_PASSWORD = abcdefghijklmnop
EMAIL_FROM = youremail@gmail.com
ADMIN_EMAIL = admin@semenindonesia.com
NEXT_PUBLIC_APP_URL = https://sig-activa.vercel.app
DATABASE_URL = (your production PostgreSQL URL)
```

5. Apply to: **Production, Preview, Development**
6. Redeploy project

## Langkah 5: Test Email Verification

1. Register user baru di https://sig-activa.vercel.app
2. Cek inbox email yang didaftarkan
3. Klik link verifikasi
4. Admin akan terima email notifikasi
5. Login ke admin → approve user baru

## Troubleshooting

### Email tidak terkirim?
- Pastikan 2-Step Verification sudah aktif
- Pastikan App Password sudah benar (16 karakter tanpa spasi)
- Cek GMAIL_USER menggunakan format lengkap: `youremail@gmail.com`
- Restart aplikasi setelah update .env.local

### "Invalid login" error?
- Pastikan menggunakan **App Password**, bukan password Gmail biasa
- Generate App Password baru jika lupa

### Email masuk ke Spam?
- Normal untuk pertama kali, minta user cek folder Spam
- Setelah beberapa kali, Gmail akan belajar bahwa email ini sah

## Limits

- **Gmail Free**: 500 email/hari
- **Google Workspace**: 2000 email/hari

Untuk production dengan volume tinggi, pertimbangkan:
- Amazon SES (62,000 email/bulan gratis)
- Brevo (300 email/hari gratis)
