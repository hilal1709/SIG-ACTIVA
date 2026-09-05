import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from './amount';

describe('parseAmount', () => {
  for (const [input, expected] of [
    ['1500000','1500000'],['1,500,000','1500000'],['1.500.000','1500000'],
    ['(1,500,000)','-1500000'],['1,500,000-','-1500000'],['-1500000','-1500000'],
    ['1,234.56','1234.56'],['1.234,56','1234.56'],
  ]) it(`parses ${input} exactly`, () => assert.equal(parseAmount(input),expected));
  for(const input of ['', 'abc', '1,2,3.4.5']) it(`rejects ${input}`,()=>assert.equal(parseAmount(input),null));
});
