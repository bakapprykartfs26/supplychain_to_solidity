import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FsmDefinition } from '@solidflow/shared';
import { CreateFsmDto } from './dto/create-fsm.dto';
import { UpdateFsmDto } from './dto/update-fsm.dto';

@Injectable()
export class FsmService implements OnModuleInit {
  private readonly dataDir: string;

  constructor() {
    this.dataDir = process.env['FSM_DATA_DIR'] ?? 'data/fsm';
  }

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async findAll(): Promise<FsmDefinition[]> {
    const files = await fs.readdir(this.dataDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    const results = await Promise.all(
      jsonFiles.map((f) => this.readFile(path.join(this.dataDir, f))),
    );
    return results.filter((r): r is FsmDefinition => r !== null);
  }

  async findOne(id: string): Promise<FsmDefinition> {
    const fsm = await this.readFile(this.filePath(id));
    if (!fsm) throw new NotFoundException(`FSM ${id} not found`);
    return fsm;
  }

  async create(dto: CreateFsmDto): Promise<FsmDefinition> {
    const now = new Date().toISOString();
    const fsm: FsmDefinition = {
      ...(dto as unknown as FsmDefinition),
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await fs.writeFile(this.filePath(fsm.id!), JSON.stringify(fsm, null, 2));
    return fsm;
  }

  async update(id: string, dto: UpdateFsmDto): Promise<FsmDefinition> {
    const existing = await this.findOne(id);
    const updated: FsmDefinition = {
      ...existing,
      ...(dto as unknown as FsmDefinition),
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(this.filePath(id), JSON.stringify(updated, null, 2));
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await fs.unlink(this.filePath(id));
  }

  private filePath(id: string): string {
    return path.join(this.dataDir, `${id}.json`);
  }

  private async readFile(filePath: string): Promise<FsmDefinition | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as FsmDefinition;
    } catch {
      return null;
    }
  }
}
