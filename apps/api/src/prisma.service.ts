import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não definido');
    super({ adapter: new PrismaPg({ connectionString: url }) });
  }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
