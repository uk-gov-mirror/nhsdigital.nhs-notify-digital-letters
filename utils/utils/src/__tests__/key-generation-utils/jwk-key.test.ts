import { Key } from '../../key-generation-utils/jwk-key';

const testPrivateKeyPem = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIEpVnqrylY4xEsQdQgJhGFUFKGTGtl5cnKsIq2uNWa56oAoGCCqGSM49
AwEHoUQDQgAEqoc8zybajz/NEoUzP5G7lchuuD7dej7vKlWConh1mvI9gvmyRheT
0vrkuPszvyLXTYusKKgiLZkqz3SHOjVhDw==
-----END EC PRIVATE KEY-----
`;

describe('Key', () => {
  describe('fromPEM', () => {
    it('creates a Key from a valid PEM string', async () => {
      const key = await Key.fromPEM(testPrivateKeyPem);
      expect(key).toBeInstanceOf(Key);
    });

    it('throws an error for an invalid PEM string', async () => {
      await expect(Key.fromPEM('not-a-valid-pem')).rejects.toThrow(
        'Invalid PEM formatted message.',
      );
    });
  });

  describe('fromJWK', () => {
    it('creates a Key from a public JWK object', () => {
      const jwk = { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' };
      const key = Key.fromJWK(jwk);
      expect(key).toBeInstanceOf(Key);
    });
  });

  describe('toJSON', () => {
    it('returns only public JWK fields (strips private key material)', async () => {
      const key = await Key.fromPEM(testPrivateKeyPem);
      const jwk = key.toJSON();

      // Private fields must not be present
      expect(jwk).not.toHaveProperty('d');
      expect(jwk).not.toHaveProperty('p');
      expect(jwk).not.toHaveProperty('q');
      expect(jwk).not.toHaveProperty('dp');
      expect(jwk).not.toHaveProperty('dq');
      expect(jwk).not.toHaveProperty('qi');
      expect(jwk).not.toHaveProperty('k');

      // Public fields should be present
      expect(jwk).toHaveProperty('kty');
      expect(jwk).toHaveProperty('x');
      expect(jwk).toHaveProperty('y');
    });

    it('returns all fields when constructed from a public-only JWK', () => {
      const jwk = { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' };
      const key = Key.fromJWK(jwk);
      expect(key.toJSON()).toEqual(jwk);
    });
  });

  describe('toPEM', () => {
    it('returns the original PEM string when one was provided', async () => {
      const key = await Key.fromPEM(testPrivateKeyPem);
      expect(key.toPEM()).toBe(testPrivateKeyPem);
    });

    it('throws when no private PEM is available (key created from public JWK)', () => {
      const jwk = { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' };
      const key = Key.fromJWK(jwk);
      expect(() => key.toPEM()).toThrow(
        'No private key PEM available on this Key instance.',
      );
    });
  });
});
