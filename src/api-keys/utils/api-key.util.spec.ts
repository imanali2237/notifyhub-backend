import { createHash } from 'node:crypto';
import { generateApiKey, hashApiKey } from './api-key.util.js';

describe('generateApiKey', () => {
  it('builds nh_<env>_ + 32 random base64url chars', () => {
    expect(generateApiKey('live').key).toMatch(/^nh_live_[A-Za-z0-9_-]{32}$/);
    expect(generateApiKey('test').key).toMatch(/^nh_test_[A-Za-z0-9_-]{32}$/);
  });

  it('keeps a 16-char display prefix that is the start of the key', () => {
    const { key, prefix } = generateApiKey('live');
    expect(prefix).toHaveLength(16);
    expect(key.startsWith(prefix)).toBe(true);
  });

  it('stores the sha256 of the key, never the key itself', () => {
    const { key, hash } = generateApiKey('live');
    expect(hash).toBe(createHash('sha256').update(key).digest('hex'));
    expect(hash).not.toContain(key);
  });

  it('never generates the same key twice', () => {
    const keys = new Set(
      Array.from({ length: 1000 }, () => generateApiKey('live').key),
    );
    expect(keys.size).toBe(1000);
  });
});

describe('hashApiKey', () => {
  it('is deterministic, so a key can be looked up by its hash', () => {
    expect(hashApiKey('nh_live_abc')).toBe(hashApiKey('nh_live_abc'));
    expect(hashApiKey('nh_live_abc')).not.toBe(hashApiKey('nh_live_abd'));
  });
});
