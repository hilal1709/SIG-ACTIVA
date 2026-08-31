import CostStructureShell from '@/app/components/CostStructureShell';
import FluctuationWorkflow from './workflow';

export default function CostFluctuationPage() {
  return (
    <CostStructureShell title="Analisis Fluktuasi" purpose="Analisis MoM, YoY, dan YTD berdasarkan Cost Structure yang telah difinalisasi.">
      <FluctuationWorkflow />
    </CostStructureShell>
  );
}
