import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateNested,
} from 'class-validator';
import { FsmStatement } from '@solidflow/shared';

// ── Array dimension ───────────────────────────────────────────────────────────
export class ArrayDimensionDto {
  @IsString()
  size!: string;
}

// ── Guard ─────────────────────────────────────────────────────────────────────
export class FsmGuardEntryDto {
  @IsOptional()
  guard?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['AND', 'OR'])
  operator?: 'AND' | 'OR';

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class FsmGuardConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmGuardEntryDto)
  guards!: FsmGuardEntryDto[];
}

// ── Transition input ──────────────────────────────────────────────────────────
export class FsmTransitionInputDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsOptional()
  @IsBoolean()
  isArray?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArrayDimensionDto)
  dimensions?: ArrayDimensionDto[];
}

// ── Transition ────────────────────────────────────────────────────────────────
export class FsmTransitionDto {
  @IsString()
  id!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  from!: string;

  @IsString()
  @MinLength(1)
  to!: string;

  @IsOptional()
  @IsBoolean()
  payable?: boolean;

  @IsOptional()
  @IsString()
  guard?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FsmGuardConfigDto)
  guardConfig?: FsmGuardConfigDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmTransitionInputDto)
  inputs?: FsmTransitionInputDto[];

  @IsOptional()
  @IsArray()
  statements?: FsmStatement[];

  @IsOptional()
  @IsIn(['guided', 'code'])
  statementsMode?: 'guided' | 'code';

  @IsOptional()
  @IsString()
  rawStatements?: string;

  @IsOptional()
  @IsString()
  emitEvent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emitEventArgs?: string[];
}

// ── Variable ──────────────────────────────────────────────────────────────────
export class FsmContractVariableDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsOptional()
  @IsIn(['public', 'private', 'internal'])
  visibility?: 'public' | 'private' | 'internal';

  @IsOptional()
  @IsString()
  initialValue?: string;

  @IsOptional()
  @IsBoolean()
  isArray?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArrayDimensionDto)
  dimensions?: ArrayDimensionDto[];
}

// ── Mapping ───────────────────────────────────────────────────────────────────
export class FsmMappingDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  keyType!: string;

  @IsString()
  @MinLength(1)
  valueType!: string;

  @IsOptional()
  @IsIn(['public', 'private', 'internal'])
  visibility?: 'public' | 'private' | 'internal';
}

// ── Custom type ───────────────────────────────────────────────────────────────
export class FsmCustomTypeFieldDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  type!: string;
}

export class FsmCustomTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmCustomTypeFieldDto)
  fields!: FsmCustomTypeFieldDto[];
}

// ── Event param ───────────────────────────────────────────────────────────────
export class FsmEventParamDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsOptional()
  @IsBoolean()
  indexed?: boolean;

  @IsOptional()
  @IsBoolean()
  isArray?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArrayDimensionDto)
  dimensions?: ArrayDimensionDto[];
}

export class FsmEventDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmEventParamDto)
  params!: FsmEventParamDto[];
}

// ── Plugins ───────────────────────────────────────────────────────────────────
export class FsmPluginsDto {
  @IsOptional()
  @IsBoolean()
  locking?: boolean;

  @IsOptional()
  @IsBoolean()
  accessControl?: boolean;

  @IsOptional()
  @IsBoolean()
  transitionCounter?: boolean;

  @IsOptional()
  @IsBoolean()
  timedTransitions?: boolean;

  @IsOptional()
  @IsBoolean()
  event?: boolean;

  @IsOptional()
  @IsBoolean()
  transitionPause?: boolean;
}

// ── Constructor config ────────────────────────────────────────────────────────
export class FsmConstructorConfigDto {
  @IsArray()
  @IsString({ each: true })
  includedVariables!: string[];

  @IsArray()
  @IsString({ each: true })
  includedArrays!: string[];

  @IsArray()
  @IsString({ each: true })
  includedStructs!: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FsmGuardConfigDto)
  guardConfig?: FsmGuardConfigDto;
}

// ── Create ────────────────────────────────────────────────────────────────────
export class CreateFsmDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  states!: string[];

  @IsString()
  @MinLength(1)
  initialState!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmTransitionDto)
  transitions!: FsmTransitionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmContractVariableDto)
  variables?: FsmContractVariableDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmCustomTypeDto)
  customTypes?: FsmCustomTypeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmMappingDto)
  mappings?: FsmMappingDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmEventDto)
  events?: FsmEventDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FsmPluginsDto)
  plugins?: FsmPluginsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FsmConstructorConfigDto)
  constructorConfig?: FsmConstructorConfigDto;
}