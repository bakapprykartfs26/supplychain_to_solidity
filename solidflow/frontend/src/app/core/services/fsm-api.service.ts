import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { FsmDefinition } from '@solidflow/shared';

export interface CompileResult {
  success: boolean;
  abi?: unknown[];
  bytecode?: string;
  errors?: string[];
}

@Injectable({ providedIn: 'root' })
export class FsmApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/fsm';

  list(): Observable<FsmDefinition[]> {
    return this.http.get<FsmDefinition[]>(this.base);
  }

  get(id: string): Observable<FsmDefinition> {
    return this.http.get<FsmDefinition>(`${this.base}/${id}`);
  }

  create(def: Omit<FsmDefinition, 'id' | 'createdAt' | 'updatedAt'>): Observable<FsmDefinition> {
    return this.http.post<FsmDefinition>(this.base, def);
  }

  update(id: string, def: Partial<FsmDefinition>): Observable<FsmDefinition> {
    return this.http.put<FsmDefinition>(`${this.base}/${id}`, def);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  compileById(id: string): Observable<CompileResult> {
    return this.http.get<CompileResult>(`${this.base}/${id}/compile`);
  }

  compileSource(source: string): Observable<CompileResult> {
    return this.http.post<CompileResult>(`${this.base}/compile`, { source });
  }
}
