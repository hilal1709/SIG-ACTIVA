# Setup Email Verification

Sistem email verification telah ditambahkan dengan fitur:
1. **Email Verification** - User mendapat email konfirmasi dengan link verifikasi
2. **Admin Notification** - Admin mendapat email notifikasi saat ada user baru yang sudah verified

## Setup Resend (Email Service)

1. **Daftar Resend**
   - Kunjungi https://resend.com/
   - Sign up dengan GitHub atau email
   - Free tier: 100 emails/day, 3,000 emails/month

2. **Dapatkan API Key**
   - Login ke dashboard Resend
   - Klik "API Keys" di sidebar
   - Klik "Create API Key"
   - Copy API key yang dibuat

3. **Verifikasi Domain** (Optional, untuk production)
   - Klik "Domains" di sidebar  
   - Tambah domain Anda
   - Ikuti instruksi untuk setup DNS records
   - Untuk development, gunakan sandbox mode (emails only sent to verified addresses)

4. **Update .env.local**
   ```env
   RESEND_API_KEY="re_xxxxxxxxxxxxx"
   ADMIN_EMAIL="admin@semenindonesia.com"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

5. **Install Dependencies**
   ```bash
   npm install
   ```

6. **Test Email**
   - Register user baru
   - Cek console log untuk email yang terkirim
   - Cek inbox untuk email verifikasi

## Flow Lengkap

1. **User Register** 
   → System create user dengan `emailVerified: false` dan `isApproved: false`
   → System kirim email verifikasi ke user

2. **User Klik Link Verifikasi**
   → System set `emailVerified: true`
   → System kirim email notifikasi ke admin

3. **Admin Approve User**
   → System set `isApproved: true` dan assign role
   
4. **User Login**
   → System cek `emailVerified` (harus true)
   → System cek `isApproved` (harus true)
   → Login berhasil

## Development Mode

Untuk testing tanpa setup email:
1. Comment out `sendVerificationEmail()` di `app/api/auth/register/route.ts`
2. Manually set `emailVerified: true` di database
3. Skip verification step

## Production Checklist

- [ ] Setup custom domain di Resend
- [ ] Update RESEND_API_KEY dengan production key
- [ ] Update ADMIN_EMAIL dengan email admin yang benar
- [ ] Update NEXT_PUBLIC_APP_URL dengan URL production
- [ ] Test email flow end-to-end
- [ ] Monitor email delivery rate di Resend dashboard
