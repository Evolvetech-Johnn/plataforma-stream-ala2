import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { InternalController } from '../src/internal.controller.js';

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex');
}

describe('Testes Mandatórios 3, 4 e 5: Proteção e Autorização HLS (Fail-Closed)', () => {
  const secret = 'valid-session-secret-token-abcdef1234567890';
  const sessionHash = sha256(secret);

  function createMockPrisma(sessionData: any = null, shouldThrow = false) {
    return {
      viewerSession: {
        findUnique: async () => {
          if (shouldThrow) throw new Error('Database connection failure');
          return sessionData;
        },
      },
    } as any;
  }

  function createMockResponse() {
    let statusCode = 200;
    return {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send() {
        return { statusCode };
      },
      getStatusCode() {
        return statusCode;
      },
    };
  }

  test('HLS sem cookie de sessão retorna 403', async () => {
    const controller = new InternalController(createMockPrisma());
    const req = {
      cookies: {},
      header: () => '/hls/ala01/index.m3u8',
      url: '/internal/hls-authorize',
    } as any;
    const res = createMockResponse();

    await controller.authorize(req, res as any);
    assert.equal(res.getStatusCode(), 403);
  });

  test('HLS com cookie malformado retorna 403', async () => {
    const controller = new InternalController(createMockPrisma());
    const req = {
      cookies: { tv_session: 'short' },
      header: () => '/hls/ala01/index.m3u8',
      url: '/internal/hls-authorize',
    } as any;
    const res = createMockResponse();

    await controller.authorize(req, res as any);
    assert.equal(res.getStatusCode(), 403);
  });

  test('HLS com caminho/arquivo inválido (não .m3u8, .ts, .m4s) retorna 403', async () => {
    const controller = new InternalController(createMockPrisma());
    const req = {
      cookies: { tv_session: secret },
      header: () => '/hls/ala01/secret.key',
      url: '/internal/hls-authorize',
    } as any;
    const res = createMockResponse();

    await controller.authorize(req, res as any);
    assert.equal(res.getStatusCode(), 403);
  });

  test('HLS com sessão revogada retorna 403', async () => {
    const sessionData = {
      sessionHash,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: new Date(),
      invite: {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        broadcast: { streamPath: 'ala01', status: 'LIVE' },
      },
    };
    const controller = new InternalController(createMockPrisma(sessionData));
    const req = {
      cookies: { tv_session: secret },
      header: () => '/hls/ala01/index.m3u8',
      url: '/internal/hls-authorize',
    } as any;
    const res = createMockResponse();

    await controller.authorize(req, res as any);
    assert.equal(res.getStatusCode(), 403);
  });

  test('HLS com sessão expirada retorna 403', async () => {
    const sessionData = {
      sessionHash,
      expiresAt: new Date(Date.now() - 1000), // Expirou no passado
      revokedAt: null,
      invite: {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        broadcast: { streamPath: 'ala01', status: 'LIVE' },
      },
    };
    const controller = new InternalController(createMockPrisma(sessionData));
    const req = {
      cookies: { tv_session: secret },
      header: () => '/hls/ala01/index.m3u8',
      url: '/internal/hls-authorize',
    } as any;
    const res = createMockResponse();

    await controller.authorize(req, res as any);
    assert.equal(res.getStatusCode(), 403);
  });

  test('HLS com estados não LIVE (SCHEDULED, READY, PAUSED, ENDED, FAILED) retorna 403', async () => {
    const nonLiveStatuses = ['SCHEDULED', 'READY', 'PAUSED', 'ENDED', 'FAILED'];

    for (const st of nonLiveStatuses) {
      const sessionData = {
        sessionHash,
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        invite: {
          revokedAt: null,
          expiresAt: new Date(Date.now() + 3600000),
          broadcast: { streamPath: 'ala01', status: st },
        },
      };
      const controller = new InternalController(createMockPrisma(sessionData));
      const req = {
        cookies: { tv_session: secret },
        header: () => '/hls/ala01/segment0001.ts',
        url: '/internal/hls-authorize',
      } as any;
      const res = createMockResponse();

      await controller.authorize(req, res as any);
      assert.equal(res.getStatusCode(), 403, `Estado ${st} deveria retornar 403`);
    }
  });

  test('HLS com sessão de transmissão anterior em mesmo streamPath retorna 403', async () => {
    // Reunião anterior finalizada (ENDED)
    const sessionData = {
      sessionHash,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      invite: {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        broadcast: { streamPath: 'ala01', status: 'ENDED' },
      },
    };
    const controller = new InternalController(createMockPrisma(sessionData));
    const req = {
      cookies: { tv_session: secret },
      header: () => '/hls/ala01/index.m3u8',
      url: '/internal/hls-authorize',
    } as any;
    const res = createMockResponse();

    await controller.authorize(req, res as any);
    assert.equal(res.getStatusCode(), 403);
  });

  test('HLS com divergência de streamPath retorna 403', async () => {
    const sessionData = {
      sessionHash,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      invite: {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        broadcast: { streamPath: 'ala01', status: 'LIVE' },
      },
    };
    const controller = new InternalController(createMockPrisma(sessionData));
    const req = {
      cookies: { tv_session: secret },
      header: () => '/hls/ala02/index.m3u8', // Tentativa em ala02
      url: '/internal/hls-authorize',
    } as any;
    const res = createMockResponse();

    await controller.authorize(req, res as any);
    assert.equal(res.getStatusCode(), 403);
  });

  test('HLS sob falha de banco (erro 5xx/queda) resulta em Fail-Closed (403)', async () => {
    const controller = new InternalController(createMockPrisma(null, true));
    const req = {
      cookies: { tv_session: secret },
      header: () => '/hls/ala01/segment0001.ts',
      url: '/internal/hls-authorize',
    } as any;
    const res = createMockResponse();

    await controller.authorize(req, res as any);
    assert.equal(res.getStatusCode(), 403);
  });

  test('HLS com sessão ativa, convite válido e reunião LIVE autoriza com 204', async () => {
    const sessionData = {
      sessionHash,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      invite: {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        broadcast: { streamPath: 'ala01', status: 'LIVE' },
      },
    };
    const controller = new InternalController(createMockPrisma(sessionData));

    // Testa playlist .m3u8
    const req1 = {
      cookies: { tv_session: secret },
      header: () => '/hls/ala01/index.m3u8',
      url: '/internal/hls-authorize',
    } as any;
    const res1 = createMockResponse();
    await controller.authorize(req1, res1 as any);
    assert.equal(res1.getStatusCode(), 204);

    // Testa segmento .ts
    const req2 = {
      cookies: { tv_session: secret },
      header: () => '/hls/ala01/segment_001.ts',
      url: '/internal/hls-authorize',
    } as any;
    const res2 = createMockResponse();
    await controller.authorize(req2, res2 as any);
    assert.equal(res2.getStatusCode(), 204);
  });
});
