import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module.js';
import { MatchmakingGateway } from './matchmaking.gateway.js';
import { InMemoryMatchmakingQueue, MATCHMAKING_QUEUE } from './matchmaking-queue.js';

@Module({
  imports: [MatchesModule],
  providers: [
    MatchmakingGateway,
    { provide: MATCHMAKING_QUEUE, useClass: InMemoryMatchmakingQueue },
  ],
})
export class MatchmakingModule {}
