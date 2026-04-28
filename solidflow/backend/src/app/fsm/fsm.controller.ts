import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { FsmDefinition, minimizeFsm, FsmMinimizationResult } from '@solidflow/shared';
import { CreateFsmDto } from './dto/create-fsm.dto';
import { UpdateFsmDto } from './dto/update-fsm.dto';
import { FsmSchemaGuard } from './guards/fsm-schema.guard';
import { FsmService } from './fsm.service';
import { SolidityCompileService } from './solidity/solidity-compile.service';
import { SolidityGenService } from './solidity/solidity-gen.service';

@Controller('fsm')
export class FsmController {
  constructor(
    private readonly fsmService: FsmService,
    private readonly solidityGenService: SolidityGenService,
    private readonly solidityCompileService: SolidityCompileService,
  ) {}

  @Get()
  findAll(): Promise<FsmDefinition[]> {
    return this.fsmService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<FsmDefinition> {
    return this.fsmService.findOne(id);
  }

  @Post()
  @UseGuards(FsmSchemaGuard)
  create(@Body() dto: CreateFsmDto): Promise<FsmDefinition> {
    return this.fsmService.create(dto);
  }

  @Put(':id')
  @UseGuards(FsmSchemaGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFsmDto,
  ): Promise<FsmDefinition> {
    return this.fsmService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.fsmService.remove(id);
  }

  @Get(':id/minimize')
  async minimizeById(@Param('id') id: string): Promise<FsmMinimizationResult> {
    const fsm = await this.fsmService.findOne(id);
    return minimizeFsm(fsm);
  }

  @Get(':id/compile')
  async compileById(
    @Param('id') id: string,
  ): Promise<{ success: boolean; abi?: unknown[]; bytecode?: string; errors?: string[] }> {
    const fsm = await this.fsmService.findOne(id);
    const source = this.solidityGenService.generate(fsm);
    return this.solidityCompileService.compile(source, fsm.name);
  }

  @Post('compile')
  compileRaw(
    @Body('source') source: string,
  ): { success: boolean; abi?: unknown[]; bytecode?: string; errors?: string[] } {
    return this.solidityCompileService.compile(source, 'Contract');
  }
}
