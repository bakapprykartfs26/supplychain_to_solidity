import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';
import type { FsmDefinition } from '@solidflow/shared';
import { FsmApiService } from '../../core/services/fsm-api.service';

export const fsmResolver: ResolveFn<FsmDefinition> = (route) => {
  const api = inject(FsmApiService);
  const router = inject(Router);
  const id = route.paramMap.get('id')!;

  return api.get(id).pipe(
    catchError(() => {
      router.navigate(['/']);
      return EMPTY;
    }),
  );
};
