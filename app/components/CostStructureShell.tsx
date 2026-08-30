'use client';

import { useState } from 'react';
import { Construction, Layers3 } from 'lucide-react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

type CostStructureShellProps = {
  title: string;
  purpose: string;
};

export default function CostStructureShell({ title, purpose }: CostStructureShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar />
      </aside>

      {isMobileSidebarOpen && (
        <>
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar isOpen onClose={() => setIsMobileSidebarOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <Header
          title={title}
          subtitle="Cost Structure & Fluktuasi Biaya"
          onMenuClick={() => setIsMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-2">
              <Badge variant="secondary">Phase A</Badge>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
                {purpose}
              </p>
            </div>

            <Card className="border-dashed">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Layers3 className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">Module under development</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                  <Construction className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">Foundation / Shell — Phase A</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Halaman ini telah terintegrasi dengan navigasi dan autentikasi SIG ACTIVA.
                      Fitur pengolahan data akan tersedia pada fase pengembangan berikutnya.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
