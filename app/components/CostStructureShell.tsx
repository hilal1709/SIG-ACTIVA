'use client';

import { Construction, Layers3 } from 'lucide-react';
import type { ReactNode } from 'react';
import CostModuleFrame from '@/app/components/CostModuleFrame';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

type CostStructureShellProps = {
  title: string;
  purpose: string;
  children?: ReactNode;
};

export default function CostStructureShell({ title, purpose, children }: CostStructureShellProps) {
  return (
    <CostModuleFrame title={title} contentClassName="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div data-cost-motion className="space-y-2">
          <Badge variant="secondary">Cost Structure & Fluktuasi Biaya</Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{purpose}</p>
        </div>

        {children ?? <Card data-cost-motion data-cost-hover className="border-dashed transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Layers3 className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-lg">Module workspace</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
              <Construction className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Pengembangan bertahap</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Halaman ini telah memakai navigasi, autentikasi, dan motion system yang sama dengan modul SIG ACTIVA lainnya.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>}
      </div>
    </CostModuleFrame>
  );
}
