import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionCookieName } from '@/lib/session';
import { verifyCostStructureReadSession } from '@/lib/cost-structure/auth';

export default async function CostFluctuationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const user = await verifyCostStructureReadSession(
    cookieStore.get(getSessionCookieName())?.value
  );

  if (!user) redirect('/login');

  return children;
}
