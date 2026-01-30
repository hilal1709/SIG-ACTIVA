import nodemailer from 'nodemailer';

// Gmail SMTP Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Email sender
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@gmail.com';

export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
  name: string
) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;

  try {
    await transporter.sendMail({
      from: `"SIG ACTIVA" <${EMAIL_FROM}>`,
      to: email,
      subject: 'Verifikasi Email - SIG ACTIVA',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 SIG ACTIVA</h1>
                <p>Sistem Informasi Akuntansi PT Semen Indonesia Grup</p>
              </div>
              <div class="content">
                <h2>Halo ${name},</h2>
                <p>Terima kasih telah mendaftar di SIG ACTIVA!</p>
                <p>Untuk melanjutkan, silakan verifikasi email Anda dengan mengklik tombol di bawah ini:</p>
                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verifikasi Email</a>
                </div>
                <p>Atau copy link berikut ke browser Anda:</p>
                <p style="background: #fff; padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px; word-break: break-all;">
                  ${verificationUrl}
                </p>
                <p><strong>Setelah email terverifikasi</strong>, akun Anda akan menunggu persetujuan dari Admin System sebelum dapat login.</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                  Jika Anda tidak mendaftar di SIG ACTIVA, abaikan email ini.
                </p>
              </div>
              <div class="footer">
                <p>&copy; 2026 PT Semen Indonesia Grup. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error };
  }
}

export async function sendAdminNotification(
  userName: string,
  userEmail: string,
  userId: number
) {
  const adminEmails = process.env.ADMIN_EMAIL?.split(',') || [];
  
  if (adminEmails.length === 0) {
    console.warn('No admin emails configured');
    return { success: false, error: 'No admin emails configured' };
  }

  const approveUrl = `${process.env.NEXT_PUBLIC_APP_URL}/user-management`;

  try {
    await transporter.sendMail({
      from: `"SIG ACTIVA" <${EMAIL_FROM}>`,
      to: adminEmails,
      subject: '🔔 User Baru Memerlukan Persetujuan - SIG ACTIVA',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .user-info { background: white; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0; }
              .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔔 SIG ACTIVA</h1>
                <p>Notifikasi Admin</p>
              </div>
              <div class="content">
                <h2>User Baru Memerlukan Persetujuan</h2>
                <p>User baru telah berhasil memverifikasi email dan menunggu persetujuan Anda:</p>
                
                <div class="user-info">
                  <p><strong>Nama:</strong> ${userName}</p>
                  <p><strong>Email:</strong> ${userEmail}</p>
                  <p><strong>User ID:</strong> #${userId}</p>
                  <p><strong>Status:</strong> ✅ Email Verified, ⏳ Pending Approval</p>
                </div>

                <p>Silakan login ke sistem untuk meninjau dan menyetujui user baru ini:</p>
                
                <div style="text-align: center;">
                  <a href="${approveUrl}" class="button">Kelola User</a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                  User ini tidak dapat login hingga Anda menyetujui akun dan mengatur role yang sesuai.
                </p>
              </div>
              <div class="footer">
                <p>&copy; 2026 PT Semen Indonesia Grup. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending admin notification:', error);
    return { success: false, error };
  }
}
