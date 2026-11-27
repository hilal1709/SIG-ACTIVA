import CostStructureShell from '@/app/components/CostStructureShell';
import { getCostFluctuationReadiness } from '@/lib/cost-fluctuation/readiness';
import ReadinessWorkspace from './readiness-workspace';

export const dynamic = 'force-dynamic';

export default async function CostFluctuationReadinessPage() {
  const readiness = await getCostFluctuationReadiness();
  return (
    <CostStructureShell
      title="Kesiapan Perbandingan Historis"
      purpose="Periksa periode Cost Structure yang tersedia dan dependensi MoM, YoY, serta YTD sebelum menjalankan analisis fluktuasi."
    >
      <ReadinessWorkspace data={readiness} />
    </CostStructureShell>
  );
}
