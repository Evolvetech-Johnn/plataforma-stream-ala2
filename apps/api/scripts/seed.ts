import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env') });

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, createHash } from 'node:crypto';
import * as argon2 from 'argon2';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definido');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const unit = await prisma.unit.upsert({
    where: { slug: 'ala-piloto' },
    update: {},
    create: { slug: 'ala-piloto', name: 'Ala Piloto', type: 'WARD' },
  });

  // Seed do usuário Operador com Argon2id
  const operatorEmail = process.env.SEED_OPERATOR_EMAIL || 'operador@ala.local';
  const operatorPassword = process.env.SEED_OPERATOR_PASSWORD || 'AlaPiloto#2026TestOnly';
  const passwordHash = await argon2.hash(operatorPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const operatorUser = await prisma.user.upsert({
    where: { email: operatorEmail },
    update: {},
    create: {
      email: operatorEmail,
      displayName: 'Operador Piloto',
      passwordHash,
      enabled: true,
      mfaEnabled: false,
    },
  });

  await prisma.unitMembership.upsert({
    where: {
      userId_unitId_role: {
        userId: operatorUser.id,
        unitId: unit.id,
        role: 'ADMIN',
      },
    },
    update: {},
    create: {
      userId: operatorUser.id,
      unitId: unit.id,
      role: 'ADMIN',
    },
  });

  const upcoming = new Date();
  upcoming.setUTCDate(upcoming.getUTCDate() + ((7 - upcoming.getUTCDay()) % 7 || 7));
  upcoming.setUTCHours(13, 0, 0, 0);
  const slug = `reuniao-${upcoming.toISOString().slice(0, 10)}`;

  const broadcast = await prisma.broadcast.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      unitId: unit.id,
      title: 'Transmissão de Teste da Ala',
      streamPath: 'ala01',
      status: 'SCHEDULED',
      scheduledAt: upcoming,
    },
  });

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await prisma.viewerInvite.create({
    data: {
      broadcastId: broadcast.id,
      tokenHash,
      maxUses: 2,
      expiresAt: new Date(upcoming.getTime() + 3 * 60 * 60 * 1000),
      createdById: operatorUser.id,
    },
  });

  console.log('✅ Seed executado com sucesso.');
  console.log('Unidade:', unit.slug);
  console.log('Operador configurado:', operatorEmail);
  console.log('Reunião SCHEDULED:', broadcast.id);
  console.log('Convite TESTE gerado (token de uso único em dev):', token);
}

main().finally(async () => prisma.$disconnect());
