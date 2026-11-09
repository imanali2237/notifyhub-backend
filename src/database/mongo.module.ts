import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { Env } from '../config/env.js';

/** MongoDB connection (notification logs, later the in-app feed). Shared by API + worker. */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGO_URI'),
      }),
    }),
  ],
})
export class MongoModule {}
