import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard.js';
import { CardsModule } from './cards/cards.module.js';
import { CollectionsModule } from './collections/collections.module.js';
import { RolesGuard } from './common/auth/roles.guard.js';
import { PermissionsGuard } from './common/auth/permissions.guard.js';
import { RequestIdMiddleware } from './common/logging/request-id.middleware.js';
import { ConfigModule } from './config/config.module.js';
import { DecksModule } from './decks/decks.module.js';
import { EconomyModule } from './economy/economy.module.js';
import { HealthModule } from './health/health.module.js';
import { BoostersModule } from './boosters/boosters.module.js';
import { MatchmakingModule } from './matchmaking/matchmaking.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { MissionsModule } from './missions/missions.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { RankingsModule } from './rankings/rankings.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.token',
            ],
            censor: '[REDACTED]',
          },
          autoLogging: true,
        },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    HealthModule,
    ProfilesModule,
    CardsModule,
    CollectionsModule,
    DecksModule,
    BoostersModule,
    EconomyModule,
    MissionsModule,
    MatchesModule,
    MatchmakingModule,
    RankingsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
