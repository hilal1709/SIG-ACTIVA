'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import HppDataManagement from './HppDataManagement';

const Header=dynamic(()=>import('../../components/Header'),{ssr:false});
const Sidebar=dynamic(()=>import('../../components/Sidebar'),{ssr:false});

export default function DataManagementPage(){
  const [open,setOpen]=useState(false);
  return <div className="flex min-h-screen overflow-x-hidden bg-background">
    {open&&<button type="button" aria-label="Tutup menu" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={()=>setOpen(false)}/>}
    <div className={'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 '+(open?'translate-x-0':'-translate-x-full lg:translate-x-0')}><Sidebar onClose={()=>setOpen(false)}/></div>
    <div className="min-w-0 flex-1 lg:ml-64"><Header title="HPP | Data Management" subtitle="Validasi dan publikasi histori biaya produksi" onMenuClick={()=>setOpen(v=>!v)}/>
      <main className="min-w-0 p-4 sm:p-6 md:p-8"><div className="mb-4"><Link href="/hpp-cost-intelligence" className="text-xs font-semibold text-muted-foreground hover:text-foreground">← Kembali ke Cost Intelligence</Link></div><HppDataManagement/></main>
    </div>
  </div>;
}
