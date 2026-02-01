import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAdminNotification } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    console.log('🔍 Verify email request - Token:', token);

    if (!token) {
      return NextResponse.json(
        { error: 'Token verifikasi diperlukan' },
        { status: 400 }
      );
    }

    // Find user by verification token
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    console.log('🔍 User found:', user ? `${user.email} (ID: ${user.id})` : 'NOT FOUND');

    if (!user) {
      return NextResponse.json(
        { error: 'Token verifikasi tidak valid atau sudah kadaluarsa' },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      console.log('⚠️ Email already verified for:', user.email);
      return NextResponse.json(
        { success: true, message: 'Email sudah diverifikasi sebelumnya' },
        { status: 200 }
      );
    }

    // Update user to verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null, // Clear token after verification
      },
    });

    console.log('✅ Email verified successfully:', {
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
      isApproved: updatedUser.isApproved,
    });

    // Send notification to admin
    try {
      await sendAdminNotification(user.name, user.email, user.id);
      console.log('✅ Admin notification sent');
    } catch (emailError) {
      console.error('⚠️ Failed to send admin notification:', emailError);
      // Don't fail verification if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Email berhasil diverifikasi! Akun Anda menunggu persetujuan dari Admin System.',
    });
  } catch (error) {
    console.error('❌ Email verification error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
