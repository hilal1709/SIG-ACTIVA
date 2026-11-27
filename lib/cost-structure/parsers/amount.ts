/** Locale rule: when both separators occur, the last is decimal; one separator with 1-2 trailing digits is decimal, otherwise it is grouping. */
export function parseAmount(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : null;
  if (typeof value !== 'string') return null;
  let text=value.trim().replace(/\s/g,''); if(!text) return null;
  let negative=false; if(/^\(.*\)$/.test(text)){negative=true;text=text.slice(1,-1);} if(text.endsWith('-')){negative=true;text=text.slice(0,-1);} if(text.startsWith('-')){negative=true;text=text.slice(1);}
  if(!/^\d+(?:[.,]\d+)*$/.test(text)) return null;
  const comma=text.lastIndexOf(','), dot=text.lastIndexOf('.'); let decimal='';
  if(comma>=0&&dot>=0) {
    decimal=comma>dot?',':'.'; const grouping=decimal===','?'.':',';
    if(text.split(decimal).length!==2||text.slice(0,text.lastIndexOf(decimal)).split(grouping).slice(1).some(group=>group.length!==3)) return null;
  } else { const sep=comma>=0?',':dot>=0?'.':''; if(sep){const trailing=text.length-text.lastIndexOf(sep)-1; const count=text.split(sep).length-1; if(count===1&&trailing<=2) decimal=sep; else if(text.split(sep).slice(1).some(group=>group.length!==3)) return null;} }
  let canonical: string; if(decimal){const pos=text.lastIndexOf(decimal); canonical=text.slice(0,pos).replace(/[.,]/g,'')+'.'+text.slice(pos+1);} else canonical=text.replace(/[.,]/g,'');
  canonical=canonical.replace(/^0+(?=\d)/,''); if(!/^\d+(?:\.\d+)?$/.test(canonical)) return null; return `${negative?'-':''}${canonical}`;
}
