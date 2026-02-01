import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password harus diisi' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    console.log('Login attempt:', {
      email: user.email,
      emailVerified: user.emailVerified,
      isApproved: user.isApproved,
      role: user.role,
    });

    // Auto-verify dan approve admin yang sudah ada sebelumnya
    if (user.role === 'ADMIN_SYSTEM' && (!user.emailVerified || !user.isApproved)) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          isApproved: true,
          verificationToken: null,
        },
      });
      user.emailVerified = true;
      user.isApproved = true;
    }

    // Check if email is verified (skip for admin yang baru di-update)
    if (!user.emailVerified) {
      console.log('❌ Email not verified for:', user.email);
      return NextResponse.json(
        { error: 'Email Anda belum diverifikasi. Silakan cek email untuk link verifikasi.' },
        { status: 403 }
      );
    }

    // Check if user is approved (skip for admin yang baru di-update)
    if (!user.isApproved) {
      console.log('❌ User not approved:', user.email);
      return NextResponse.json(
        { error: 'Akun Anda belum disetujui oleh Admin System. Silakan hubungi administrator.' },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    // Return user data (excluding password)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
