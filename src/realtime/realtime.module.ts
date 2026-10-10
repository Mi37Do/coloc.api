import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeGateway } from './realtime.gateway.js';
import { HouseholdMember } from '../household/entities/household-member.entity.js';

/**
 * Depends on nothing but the DB, so any module (household included) can
 * import it without creating a cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([HouseholdMember]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
