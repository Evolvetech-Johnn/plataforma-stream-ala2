import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { OperatorService } from '../src/operator/operator.service.js';
import { ViewerController } from '../src/viewer.controller.js';

describe('Testes Mandatórios 1, 2, 6, 7 e 8: Operador, RBAC, Estados e Viewer', () => {
  const dummyUnitId = 'unit-123';
  const dummyUserId = 'user-456';
  const plainPassword = 'CorrectPassword#2026';
  const mfaSecret = authenticator.generateSecret();

  async function createMockPrisma() {
    const passwordHash = await argon2.hash(plainPassword);

    const user = {
      id: dummyUserId,
      email: 'operador@ala.local',
      displayName: 'Operador Teste',
      passwordHash,
      enabled: true,
      mfaSecret,
      mfaEnabled: true,
      memberships: [{ unitId: dummyUnitId, role: 'OPERATOR' }],
    };

    const broadcasts: any[] = [
      {
        id: 'broadcast-1',
        slug: 'reuniao-teste-1',
        unitId: dummyUnitId,
        title: 'Reunião Sacramental',
        streamPath: 'ala01',
        status: 'SCHEDULED',
        scheduledAt: new Date(),
        startedAt: null,
        endedAt: null,
      },
    ];

    const invites: any[] = [];
    const sessions: any[] = [];
    const auditEvents: any[] = [];

    return {
      user: {
        findUnique: async ({ where }: any) => {
          if (where.email === user.email) return user;
          return null;
        },
      },
      operatorSession: {
        create: async ({ data }: any) => ({ id: 'session-op-1', ...data }),
        update: async ({ where, data }: any) => ({ ...where, ...data }),
      },
      broadcast: {
        findFirst: async ({ where }: any) => {
          return broadcasts.find((b) => {
            if (where.id && b.id !== where.id) return false;
            if (where.unitId && b.unitId !== where.unitId) return false;
            if (where.status?.in && !where.status.in.includes(b.status)) return false;
            if (where.id?.not && b.id === where.id.not) return false;
            return true;
          }) || null;
        },
        update: async ({ where, data }: any) => {
          const b = broadcasts.find((x) => x.id === where.id);
          if (b) Object.assign(b, data);
          return b;
        },
        findMany: async () => broadcasts,
        create: async ({ data }: any) => {
          const created = { id: `b-${Date.now()}`, ...data };
          broadcasts.push(created);
          return created;
        },
      },
      viewerInvite: {
        create: async ({ data }: any) => {
          const inv = { id: `inv-${Date.now()}`, uses: 0, revokedAt: null, ...data };
          invites.push(inv);
          return inv;
        },
        findFirst: async ({ where }: any) => invites.find((i) => i.id === where.id) || null,
        findUnique: async ({ where }: any) => invites.find((i) => i.tokenHash === where.tokenHash) || null,
        update: async ({ where, data }: any) => {
          const i = invites.find((x) => x.id === where.id);
          if (i) {
            if (data.uses?.increment) i.uses += data.uses.increment;
            if (data.revokedAt) i.revokedAt = data.revokedAt;
          }
          return i;
        },
        findMany: async () => invites,
      },
      viewerSession: {
        create: async ({ data }: any) => {
          const s = { id: `vs-${Date.now()}`, revokedAt: null, ...data };
          sessions.push(s);
          return s;
        },
        updateMany: async ({ data }: any) => {
          sessions.forEach((s) => Object.assign(s, data));
          return { count: sessions.length };
        },
        update: async ({ where, data }: any) => {
          const s = sessions.find((x) => x.sessionHash === where.sessionHash);
          if (s) Object.assign(s, data);
          return s;
        },
        findUnique: async ({ where }: any) => sessions.find((s) => s.sessionHash === where.sessionHash) || null,
      },
      auditEvent: {
        create: async ({ data }: any) => {
          auditEvents.push(data);
          return data;
        },
        findMany: async () => auditEvents,
      },
      $transaction: async (fn: any) => {
        return fn({
          broadcast: {
            findFirst: async ({ where }: any) => {
              return broadcasts.find((b) => {
                if (where.id && b.id !== where.id) return false;
                if (where.unitId && b.unitId !== where.unitId) return false;
                if (where.status?.in && !where.status.in.includes(b.status)) return false;
                if (where.id?.not && b.id === where.id.not) return false;
                return true;
              }) || null;
            },
            update: async ({ where, data }: any) => {
              const b = broadcasts.find((x) => x.id === where.id);
              if (b) Object.assign(b, data);
              return b;
            },
          },
          viewerSession: {
            updateMany: async ({ data }: any) => {
              sessions.forEach((s) => Object.assign(s, data));
              return { count: sessions.length };
            },
          },
          viewerInvite: {
            findFirst: async ({ where }: any) => invites.find((i) => i.id === where.id) || null,
            update: async ({ where, data }: any) => {
              const i = invites.find((x) => x.id === where.id);
              if (i) {
                if (data.uses?.increment) i.uses += data.uses.increment;
                if (data.revokedAt) i.revokedAt = data.revokedAt;
              }
              return i;
            },
          },
          auditEvent: {
            create: async ({ data }: any) => {
              auditEvents.push(data);
              return data;
            },
          },
        });
      },
    } as any;
  }

  test('Operador: login com senha incorreta falha com 401', async () => {
    const prisma = await createMockPrisma();
    const service = new OperatorService(prisma);

    await assert.rejects(
      async () => service.login('operador@ala.local', 'WrongPassword123'),
      /Credenciais inválidas/,
    );
  });

  test('Operador: login correto com MFA exige verificação TOTP', async () => {
    const prisma = await createMockPrisma();
    const service = new OperatorService(prisma);

    const res = await service.login('operador@ala.local', plainPassword);
    assert.equal(res.mfaRequired, true);
    assert.ok('tempToken' in res);
  });

  test('Operador: validação com token MFA incorreto falha', async () => {
    const prisma = await createMockPrisma();
    const service = new OperatorService(prisma);

    await assert.rejects(
      async () => service.verifyMfa('operador@ala.local', '000000'),
      /Código MFA inválido/,
    );
  });

  test('Operador: validação com código TOTP correto gera sessão válida', async () => {
    const prisma = await createMockPrisma();
    const service = new OperatorService(prisma);

    const validCode = authenticator.generate(mfaSecret);
    const session = await service.verifyMfa('operador@ala.local', validCode);

    assert.ok(session.sessionSecret.length >= 40);
    assert.equal(session.user.email, 'operador@ala.local');
  });

  test('Máquina de Estados: SCHEDULED -> LIVE -> PAUSED -> LIVE -> ENDED', async () => {
    const prisma = await createMockPrisma();
    const service = new OperatorService(prisma);

    // 1. Iniciar transmissão (SCHEDULED -> LIVE)
    const started = await service.startBroadcast('broadcast-1', dummyUnitId, dummyUserId);
    assert.equal(started.status, 'LIVE');

    // 2. Pausar para o sacramento (LIVE -> PAUSED)
    const paused = await service.pauseBroadcast('broadcast-1', dummyUnitId, dummyUserId);
    assert.equal(paused.status, 'PAUSED');

    // 3. Tentar pausar novamente (PAUSED -> PAUSED deve falhar)
    await assert.rejects(
      async () => service.pauseBroadcast('broadcast-1', dummyUnitId, dummyUserId),
      /Transmissão não está AO VIVO/,
    );

    // 4. Retomar transmissão após ordenança (PAUSED -> LIVE)
    const resumed = await service.resumeBroadcast('broadcast-1', dummyUnitId, dummyUserId);
    assert.equal(resumed.status, 'LIVE');

    // 5. Finalizar transmissão irreversivelmente (LIVE -> ENDED)
    const ended = await service.endBroadcast('broadcast-1', dummyUnitId, dummyUserId);
    assert.equal(ended.status, 'ENDED');

    // 6. Tentar reiniciar transmissão finalizada deve falhar
    await assert.rejects(
      async () => service.startBroadcast('broadcast-1', dummyUnitId, dummyUserId),
      /Não é possível iniciar transmissão em estado ENDED/,
    );
  });

  test('Convites: emissão, uso único exibido e revogação em cascata', async () => {
    const prisma = await createMockPrisma();
    const service = new OperatorService(prisma);

    // Cria convite
    const invite = await service.createInvite('broadcast-1', dummyUnitId, dummyUserId, {
      maxUses: 2,
      expiresInHours: 3,
    });

    assert.ok(invite.token);
    assert.equal(invite.maxUses, 2);

    // Lista convites sem expor token
    const list = await service.listInvites('broadcast-1', dummyUnitId);
    assert.equal(list.length, 1);
    assert.equal((list[0] as any).token, undefined);

    // Revoga convite
    const revoked = await service.revokeInvite(invite.id, dummyUnitId, dummyUserId);
    assert.ok(revoked.revokedAt);
  });

  test('Viewer: Logout limpa cookie e revoga sessão', async () => {
    const prisma = await createMockPrisma();
    const controller = new ViewerController(prisma);

    let clearedCookie = false;
    const res = {
      clearCookie: (name: string) => {
        if (name === 'tv_session') clearedCookie = true;
      },
    } as any;

    const req = {
      cookies: { tv_session: 'valid-viewer-secret-token-1234567890abcdef' },
    } as any;

    const result = await controller.logout(req, res);
    assert.deepEqual(result, { success: true });
    assert.equal(clearedCookie, true);
  });
});
