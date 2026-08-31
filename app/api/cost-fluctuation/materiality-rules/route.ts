import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureAdmin } from '@/lib/cost-structure/auth';
import { prisma } from '@/lib/prisma';
import { createMaterialityRule } from '@/lib/cost-fluctuation/materiality/rules';
export async function GET(request: NextRequest) { const auth = await requireCostStructureAdmin(request); if ('error' in auth) return auth.error; return NextResponse.json({ rules: await prisma.costMaterialityRule.findMany({ include: { company: true, costGroup: true }, orderBy: [{ companyId: 'asc' }, { comparisonType: 'asc' }, { validFrom: 'desc' }] }) }); }
export async function POST(request: NextRequest) { const auth = await requireCostStructureAdmin(request); if ('error' in auth) return auth.error; try { return NextResponse.json({ rule: await createMaterialityRule(await request.json(), Number(auth.user.uid)) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Rule creation failed.' }, { status: 400 }); } }
