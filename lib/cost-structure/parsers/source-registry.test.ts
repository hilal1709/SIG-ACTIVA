import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { detectSource, sourceDefinitions } from './source-registry';
describe('source registry',()=>{
  it('normalizes only controlled exact aliases',()=>{assert.equal(detectSource('cc_prod','2000')?.code,'CC_PROD');assert.equal(detectSource('cc_adm','2000')?.code,'CC_ADUM');assert.equal(detectSource('cc pasar','2000')?.code,'CC_PASAR');assert.equal(detectSource('monthly cc prod export','2000'),undefined);});
  it('uses company-specific requirements',()=>{assert.equal(sourceDefinitions('2000').some(x=>x.code==='COAL'),false);assert.equal(sourceDefinitions('7000').find(x=>x.code==='COAL')?.required,true);});
});
