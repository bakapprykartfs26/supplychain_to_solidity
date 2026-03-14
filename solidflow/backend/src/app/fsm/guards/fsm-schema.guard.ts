import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import Ajv from 'ajv';
import { FSM_JSON_SCHEMA } from '@solidflow/shared';
import type { Request } from 'express';

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(FSM_JSON_SCHEMA);

@Injectable()
export class FsmSchemaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body;

    const valid = validate(body);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath || '/'} ${e.message}`,
      );
      throw new BadRequestException({ message: 'Schema validation failed', errors });
    }
    return true;
  }
}
