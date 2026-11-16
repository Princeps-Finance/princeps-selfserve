import { validateConfiguration } from './runtime-config';

describe('runtime configuration', () => {
  it('allows the same backend origin to be used without a trailing slash', () => {
    expect(validateConfiguration('staging', 'https://staging.example.test/').apiBaseUrl).toBe('https://staging.example.test');
  });

  it('fails closed before promoting an unconfigured build or using development in production', () => {
    expect(() => validateConfiguration('unconfigured', 'https://configure.invalid')).toThrow();
    expect(() => validateConfiguration('production', 'https://self-service-apply.princeps.cloud')).toThrow();
    expect(() => validateConfiguration('production', 'http://production.example.test')).toThrow();
  });
});
