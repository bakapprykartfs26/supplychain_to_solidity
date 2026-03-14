import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FsmModule } from './fsm/fsm.module';

@Module({
  imports: [FsmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
