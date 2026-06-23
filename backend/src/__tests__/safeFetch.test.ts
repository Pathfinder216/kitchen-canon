import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DNS resolution so safeFetch's lookup is deterministic.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

import { lookup } from 'node:dns/promises';
import { isPrivateAddress, safeFetch } from '../utils/safeFetch.js';

const mockedLookup = vi.mocked(lookup);

/** Make the next dns.lookup resolve to the given public/private addresses. */
function resolveTo(...addresses: string[]) {
  mockedLookup.mockResolvedValue(addresses.map((address) => ({ address, family: 0 })) as never);
}

describe('isPrivateAddress', () => {
  const blocked = [
    // IPv4 boundaries / representatives for every blocked range
    '0.0.0.0',
    '10.0.0.0',
    '10.255.255.255',
    '100.64.0.0',
    '100.127.255.255',
    '127.0.0.1',
    '169.254.169.254', // cloud metadata
    '172.16.0.0',
    '172.31.255.255',
    '192.168.0.0',
    '192.168.1.1',
    '198.18.0.0',
    '198.19.255.255',
    '224.0.0.1', // multicast
    '255.255.255.255',
    // IPv6
    '::',
    '::1',
    'fc00::1', // ULA
    'fd12:3456::1', // ULA
    'fe80::1', // link-local
    'fec0::1', // deprecated site-local
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:192.168.0.1', // IPv4-mapped private
    '64:ff9b::7f00:1', // NAT64 embedding 127.0.0.1
    '64:ff9b::c0a8:1', // NAT64 embedding 192.168.0.1
    '2002:7f00:1::', // 6to4 embedding 127.0.0.1
    '2002:c0a8:1::', // 6to4 embedding 192.168.0.1
  ];

  const allowed = [
    '9.255.255.255', // just below 10/8
    '11.0.0.0',
    '100.63.255.255', // just below CGNAT
    '100.128.0.0', // just above CGNAT
    '128.0.0.1',
    '169.253.255.255', // just below link-local
    '169.255.0.0', // just above link-local
    '172.15.255.255', // just below 172.16/12
    '172.32.0.0', // just above 172.16/12
    '192.167.255.255', // just below 192.168/16
    '192.169.0.0', // just above 192.168/16
    '198.17.255.255', // just below 198.18/15
    '198.20.0.0', // just above 198.18/15
    '8.8.8.8',
    '1.1.1.1',
    '223.255.255.255', // just below multicast
    '2606:4700:4700::1111', // Cloudflare DNS (public IPv6)
    '::ffff:8.8.8.8', // IPv4-mapped public
    '64:ff9b::808:808', // NAT64 embedding public 8.8.8.8
    '2002:808:808::', // 6to4 embedding public 8.8.8.8
    'fbff::1', // just below fc00::/7
  ];

  it.each(blocked)('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(allowed)('allows %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it('fails closed on non-IP input', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});

describe('safeFetch', () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(...responses: Response[]) {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  function htmlResponse(body: string, status = 200) {
    return new Response(body, { status, headers: { 'content-type': 'text/html' } });
  }

  it('fetches a normal public URL', async () => {
    resolveTo('93.184.216.34');
    stubFetch(htmlResponse('<html>ok</html>'));
    const result = await safeFetch('https://example.com/recipe');
    expect(result.body).toBe('<html>ok</html>');
  });

  it('rejects non-http(s) schemes', async () => {
    stubFetch();
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow('URL not allowed');
    await expect(safeFetch('ftp://example.com/x')).rejects.toThrow('URL not allowed');
  });

  it('rejects embedded credentials', async () => {
    stubFetch();
    await expect(safeFetch('http://user:pass@example.com/')).rejects.toThrow('URL not allowed');
  });

  it('rejects localhost and single-label hostnames', async () => {
    stubFetch();
    await expect(safeFetch('http://localhost:8080/')).rejects.toThrow('URL not allowed');
    await expect(safeFetch('http://router/')).rejects.toThrow('URL not allowed');
    await expect(safeFetch('http://printer.local/')).rejects.toThrow('URL not allowed');
  });

  it('rejects literal private IPs without resolving', async () => {
    const fetchFn = stubFetch();
    await expect(safeFetch('http://192.168.1.1/')).rejects.toThrow('URL not allowed');
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      'URL not allowed',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects a public hostname that resolves to a private address', async () => {
    resolveTo('127.0.0.1');
    const fetchFn = stubFetch();
    // Same generic "could not be fetched" as NXDOMAIN — no split-horizon oracle.
    await expect(safeFetch('http://evil.example.com/')).rejects.toThrow('URL could not be fetched');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects when any resolved address is private', async () => {
    resolveTo('8.8.8.8', '10.0.0.5');
    stubFetch();
    await expect(safeFetch('http://mixed.example.com/')).rejects.toThrow('URL could not be fetched');
  });

  it('rejects an exotic-encoded literal IPv4 (hex/octal/decimal/dotless)', async () => {
    // The WHATWG URL parser normalizes all of these to 127.0.0.1, which the
    // literal-IP check then blocks — verify the normalization is relied upon.
    const fetchFn = stubFetch();
    for (const raw of [
      'http://0x7f000001/',
      'http://2130706433/',
      'http://0177.0.0.1/',
      'http://127.1/',
    ]) {
      await expect(safeFetch(raw)).rejects.toThrow('URL not allowed');
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects bracketed literal IPv6 URLs', async () => {
    const fetchFn = stubFetch();
    for (const raw of [
      'http://[::1]/',
      'http://[fe80::1]/',
      'http://[::ffff:169.254.169.254]/',
    ]) {
      await expect(safeFetch(raw)).rejects.toThrow('URL not allowed');
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects a redirect to a hostname that resolves private', async () => {
    mockedLookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
      .mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }] as never);
    stubFetch(
      new Response(null, { status: 302, headers: { location: 'http://internal.example.com/' } }),
      htmlResponse('<html>should not reach</html>'),
    );
    await expect(safeFetch('https://example.com/start')).rejects.toThrow('URL could not be fetched');
  });

  it('accepts a body exactly at the cap', async () => {
    resolveTo('93.184.216.34');
    const atCap = 'a'.repeat(2 * 1024 * 1024); // exactly 2 MB
    stubFetch(htmlResponse(atCap));
    const result = await safeFetch('https://example.com/exact');
    expect(result.body.length).toBe(2 * 1024 * 1024);
  });

  it('accepts text/html with a charset and application/ld+json', async () => {
    resolveTo('93.184.216.34');
    stubFetch(
      new Response('<html>x</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );
    await expect(safeFetch('https://example.com/a')).resolves.toMatchObject({ body: '<html>x</html>' });

    resolveTo('93.184.216.34');
    stubFetch(
      new Response('{"@type":"Recipe"}', {
        status: 200,
        headers: { 'content-type': 'application/ld+json' },
      }),
    );
    await expect(safeFetch('https://example.com/b')).resolves.toMatchObject({
      body: '{"@type":"Recipe"}',
    });
  });

  it('rejects a 3xx with no Location header', async () => {
    resolveTo('93.184.216.34');
    stubFetch(new Response(null, { status: 302 }));
    await expect(safeFetch('https://example.com/start')).rejects.toThrow('URL could not be fetched');
  });

  it('surfaces a mid-body read error as a generic 400', async () => {
    resolveTo('93.184.216.34');
    const failingStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('partial'));
        controller.error(new Error('connection reset'));
      },
    });
    stubFetch(
      new Response(failingStream, { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    await expect(safeFetch('https://example.com/flaky')).rejects.toThrow('URL could not be fetched');
  });

  it('follows a redirect to a public URL', async () => {
    resolveTo('93.184.216.34');
    stubFetch(
      new Response(null, { status: 302, headers: { location: 'https://example.com/final' } }),
      htmlResponse('<html>final</html>'),
    );
    const result = await safeFetch('https://example.com/start');
    expect(result.body).toBe('<html>final</html>');
    expect(result.finalUrl).toBe('https://example.com/final');
  });

  it('rejects a redirect to a private address', async () => {
    mockedLookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never);
    stubFetch(
      new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }),
    );
    await expect(safeFetch('https://example.com/start')).rejects.toThrow('URL not allowed');
  });

  it('rejects a redirect that downgrades to a non-http scheme', async () => {
    resolveTo('93.184.216.34');
    stubFetch(
      new Response(null, { status: 302, headers: { location: 'file:///etc/passwd' } }),
    );
    await expect(safeFetch('https://example.com/start')).rejects.toThrow('URL not allowed');
  });

  it('rejects after exceeding the redirect cap', async () => {
    resolveTo('93.184.216.34');
    const redirect = () =>
      new Response(null, { status: 302, headers: { location: 'https://example.com/next' } });
    stubFetch(redirect(), redirect(), redirect(), redirect(), redirect());
    await expect(safeFetch('https://example.com/start')).rejects.toThrow('URL could not be fetched');
  });

  it('rejects a disallowed content-type', async () => {
    resolveTo('93.184.216.34');
    stubFetch(
      new Response('binary', { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
    );
    await expect(safeFetch('https://example.com/file.bin')).rejects.toThrow('URL not allowed');
  });

  it('aborts a body larger than the cap', async () => {
    resolveTo('93.184.216.34');
    const huge = 'a'.repeat(3 * 1024 * 1024); // 3 MB > 2 MB cap
    stubFetch(htmlResponse(huge));
    await expect(safeFetch('https://example.com/big')).rejects.toThrow('URL not allowed');
  });

  it('rejects a non-ok response with a status-specific, actionable message', async () => {
    resolveTo('93.184.216.34');
    stubFetch(htmlResponse('not found', 404));
    await expect(safeFetch('https://example.com/missing')).rejects.toThrow(
      /returned an error \(HTTP 404\).*Import from File/s,
    );
  });

  it('explains a bot-wall (403) and points the user to file import', async () => {
    resolveTo('93.184.216.34');
    stubFetch(htmlResponse('forbidden', 403));
    await expect(safeFetch('https://example.com/blocked')).rejects.toThrow(
      /blocked this request \(HTTP 403\).*Import from File/s,
    );
  });

  it('rejects when the fetch itself throws', async () => {
    resolveTo('93.184.216.34');
    const fn = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fn);
    await expect(safeFetch('https://example.com/')).rejects.toThrow('URL could not be fetched');
  });
});
