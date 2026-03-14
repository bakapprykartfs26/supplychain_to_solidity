import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FsmTransitionDto, FsmContractVariableDto, FsmCustomTypeDto, FsmPluginsDto } from './create-fsm.dto';

export class UpdateFsmDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  initialState?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FsmTransitionDto)
  transitions?: FsmTransitionDto[];

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
