import { Module } from '@nestjs/common';
import { FsmController } from './fsm.controller';
import { FsmService } from './fsm.service';
import { FsmSchemaGuard } from './guards/fsm-schema.guard';
import { SolidityGenService } from './solidity/solidity-gen.service';
import { SolidityCompileService } from './solidity/solidity-compile.service';

@Module({
  controllers: [FsmController],
  providers: [FsmService, FsmSchemaGuard, SolidityGenService, SolidityCompileService],
})
export class FsmModule {}
