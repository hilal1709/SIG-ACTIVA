'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { LoaderCircle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import styles from './dashboard.module.css';

export function useHppReveal<T extends HTMLElement>(ref:RefObject<T|null>, phase:string|number|boolean){
  useEffect(()=>{
    const root=ref.current;
    if(!root||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const ctx=gsap.context(()=>{
      const nodes=root.querySelectorAll<HTMLElement>('[data-hpp-reveal]');
      if(nodes.length)gsap.fromTo(nodes,{opacity:0,y:18},{opacity:1,y:0,duration:.5,stagger:.065,ease:'power3.out',clearProps:'opacity,transform'});
    },root);
    return()=>ctx.revert();
  },[ref,phase]);
}

export function AnimatedCount({value,className}:{value:number;className?:string}){
  const ref=useRef<HTMLSpanElement>(null);
  const previous=useRef<number|null>(null);
  useEffect(()=>{
    const node=ref.current;
    if(!node)return;
    const format=(n:number)=>Math.round(n).toLocaleString('id-ID');
    const from=previous.current??0;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||from===value){
      node.textContent=format(value);previous.current=value;return;
    }
    const proxy={n:from};
    const tween=gsap.to(proxy,{n:value,duration:.55,ease:'power2.out',onUpdate:()=>{node.textContent=format(proxy.n);},onComplete:()=>{node.textContent=format(value);previous.current=value;}});
    return()=>{tween.kill();previous.current=proxy.n;};
  },[value]);
  return <span className={className}><span className="sr-only">{value.toLocaleString('id-ID')}</span><span ref={ref} aria-hidden="true">{value.toLocaleString('id-ID')}</span></span>;
}

export function HppLoadingBar({active,label='Memuat data HPP'}:{active:boolean;label?:string}){
  if(!active)return null;
  return <div role="status" aria-label={label} className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden"><div className="h-full bg-primary animate-[loadingBar_1.2s_ease-in-out_infinite] motion-reduce:animate-none"/><span className="sr-only">{label}</span></div>;
}

export function HppSkeleton({kind='dashboard',label='Memuat data HPP…'}:{kind?:'dashboard'|'table';label?:string}){
  return <div role="status" aria-label={label} className={styles.skeletonGroup+' relative space-y-3'}>
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none"/>{label}</div>
    <div aria-hidden="true" className="space-y-3">
      {kind==='dashboard'&&<div className={styles.kpis}>{Array.from({length:5},(_,i)=><Card key={i} className="min-w-0"><CardContent className="space-y-3 p-4"><Skeleton className="h-3 w-3/4"/><Skeleton className="h-7 w-1/2"/><Skeleton className="h-3 w-full"/></CardContent></Card>)}</div>}
      <div className={kind==='dashboard'?'grid gap-3 xl:grid-cols-2':'grid gap-3'}>{Array.from({length:kind==='dashboard'?2:1},(_,i)=><Card key={i}><CardContent className="space-y-3 p-4"><Skeleton className="mb-4 h-5 w-40 max-w-full"/>{Array.from({length:5},(_,j)=><div key={j} className="flex items-center gap-3"><Skeleton className="h-3 w-1/4"/><Skeleton className="h-5 flex-1"/><Skeleton className="h-3 w-12"/></div>)}</CardContent></Card>)}</div>
    </div>
  </div>;
}
