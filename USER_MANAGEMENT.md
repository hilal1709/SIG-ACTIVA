# User Management Scripts

Script-script ini membantu admin untuk mengelola user yang pending approval.

## 📋 List User Pending Approval

Melihat semua user yang menunggu approval:

```bash
npx tsx list-pending-users.ts
```

Output:
- Daftar semua user yang belum di-approve
- Status verifikasi email
- Tanggal registrasi
- Summary total user

## ✅ Approve User

Approve user berdasarkan email:

```bash
npx tsx approve-user.ts <email>
```

Contoh:
```bash
npx tsx approve-user.ts aszra.tjahjaningrat23@student.ui.ac.id
```

Script ini akan:
- Menampilkan informasi user
- Mengecek status verifikasi email
- Approve user jika belum di-approve
- Memberikan konfirmasi status terbaru

## 🔍 Check User Status

Mengecek status detail user:

```bash
npx tsx check-user-status.ts
```

(Edit file untuk mengganti email yang akan dicek)

## 🔄 Flow Registrasi User

1. **User Register** → Akun dibuat dengan status:
   - `emailVerified = false`
   - `isApproved = false`

2. **User Klik Link Verifikasi Email** → Status berubah:
   - `emailVerified = true`
   - `isApproved = false` (masih menunggu)
   - Email notifikasi dikirim ke admin

3. **Admin Approve User** → Status akhir:
   - `emailVerified = true`
   - `isApproved = true`
   - User bisa login ✅

## ⚠️ Troubleshooting Login

Jika user tidak bisa login setelah registrasi:

1. Pastikan user sudah **klik link verifikasi** di email
2. Pastikan admin sudah **approve user** 
3. Cek status user dengan `list-pending-users.ts`
4. Approve user dengan `approve-user.ts <email>`

## 🎯 Tips untuk Admin

- Cek pending users secara berkala dengan `list-pending-users.ts`
- Prioritas approve user yang sudah verifikasi email (✅)
- User yang belum verifikasi email (❌) harus klik link dulu

## 🔗 Related Files

- `/app/api/auth/register/route.ts` - Endpoint registrasi
- `/app/api/auth/verify-email/route.ts` - Endpoint verifikasi email
- `/app/api/auth/login/route.ts` - Endpoint login
- `/app/api/users/[id]/approve/route.ts` - Endpoint approve user (via UI)
