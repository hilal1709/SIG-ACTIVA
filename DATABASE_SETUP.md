# Setup PostgreSQL Database untuk SIG Activa

## Langkah-langkah Setup:

### 1. Install PostgreSQL
Pastikan PostgreSQL sudah terinstall di komputer Anda.
Download dari: https://www.postgresql.org/download/

### 2. Buat Database
Buka PostgreSQL (pgAdmin atau terminal), lalu jalankan:

```sql
CREATE DATABASE sig_activa;
```

### 3. Update Konfigurasi Database
Edit file `.env` di root project dan sesuaikan dengan konfigurasi PostgreSQL Anda:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
```

Contoh:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/sig_activa"
```

Ganti:
- `postgres` dengan username PostgreSQL Anda
- `password` dengan password PostgreSQL Anda
- `localhost` dengan host database (biasanya localhost)
- `5432` dengan port PostgreSQL (default 5432)
- `sig_activa` dengan nama database yang Anda buat

### 4. Generate Prisma Client
```bash
pnpm exec prisma generate
```

### 5. Jalankan Migration
```bash
pnpm exec prisma migrate dev --name init
```

### 6. Seed Database (Opsional - Membuat User Admin)
```bash
pnpm exec prisma db seed
```

Ini akan membuat user admin dengan kredensial:
- Username: `admin`
- Password: `admin123`

### 7. Jalankan Aplikasi
```bash
pnpm run dev
```

## Perintah Prisma Berguna:

- **Lihat Database**: `pnpm exec prisma studio`
- **Reset Database**: `pnpm exec prisma migrate reset`
- **Generate Client**: `pnpm exec prisma generate`
- **Create Migration**: `pnpm exec prisma migrate dev --name nama_migration`

## Troubleshooting:

Jika ada error koneksi database:
1. Pastikan PostgreSQL service sedang berjalan
2. Cek kredensial di file `.env`
3. Pastikan database `sig_activa` sudah dibuat
4. Cek firewall/port yang digunakan PostgreSQL
