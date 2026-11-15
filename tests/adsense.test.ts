import {describe,expect,it} from 'vitest';
import {isAdSenseClient} from '../src/adsense';

describe('AdSense publisher ID validation',()=>{
 it('accepts the official client shape',()=>expect(isAdSenseClient('ca-pub-1234567890123456')).toBe(true));
 it('rejects blank, demo and malformed IDs',()=>{
  expect(isAdSenseClient('')).toBe(false);
  expect(isAdSenseClient('ca-pub-demo')).toBe(false);
  expect(isAdSenseClient('pub-1234567890123456')).toBe(false);
 });
});
