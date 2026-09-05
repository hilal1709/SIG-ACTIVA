import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNatureSemantic } from './snapshot';

test('production Nature label variants normalize to stable semantics', () => {
  const cases: Array<[string, string]> = [
    ['Umum & Adm. Kantor', 'uua'],
    ['Urusan Umum & Adm. Kantor', 'uua'],
    ['Urusan Umum dan Administrasi Kantor', 'uua'],
    ['Batubara Inbound', 'batubara inbound'],
    ['Batu bara Inbound', 'batubara inbound'],
    ['DPA', 'penyusutan amortisasi'],
    ['Deplesi, Penyusutan & Amortisasi', 'penyusutan amortisasi'],
    ['Pajak & Asuransi', 'pajak asuransi'],
    ['Pajak dan Asuransi', 'pajak asuransi'],
    ['Pajak dan Assuransi', 'pajak asuransi'],
  ];

  for (const [label, expected] of cases) {
    assert.equal(normalizeNatureSemantic(label), expected, label);
  }
});
