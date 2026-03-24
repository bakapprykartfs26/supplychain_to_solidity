import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

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
  @IsString()
  guard?: string;

  @IsOptional()
  @IsArray()
  statements?: (string | object)[];

  @IsOptional()
  @IsIn(['guided', 'code'])
  statementsMode?: 'guided' | 'code';

  @IsOptional()
  @IsString()
  rawStatements?: string;

  @IsOptional()
  @IsBoolean()
  emitEvent?: boolean;
}

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
}

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
}

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
  @ValidateNested()
  @Type(() => FsmPluginsDto)
  plugins?: FsmPluginsDto;
}
