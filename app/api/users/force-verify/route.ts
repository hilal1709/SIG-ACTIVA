import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email diperlukan' },
        { status: 400 }
      );
    }

    // Force verify user by email
    const user = await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        emailVerified: true,
        isApproved: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User berhasil di-verify manual',
      user,
    });
  } catch (error: any) {
    console.error('Force verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify user' },
      { status: 500 }
    );
  }
}
