import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionCookieName } from '@/lib/session';
import { verifyCostStructurePrepareSession } from '@/lib/cost-structure/auth';

export default async function CostStructureUploadLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const user = await verifyCostStructurePrepareSession(
    cookieStore.get(getSessionCookieName())?.value
  );

  if (!user) redirect('/cost-structure');

  return children;
}
