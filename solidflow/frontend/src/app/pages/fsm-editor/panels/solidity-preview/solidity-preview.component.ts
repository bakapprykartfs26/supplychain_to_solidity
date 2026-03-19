import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import type { FsmDefinition } from '@solidflow/shared';
import { FsmApiService, CompileResult } from '../../../../core/services/fsm-api.service';

@Component({
  selector: 'app-solidity-preview',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule, MatIconModule],
  template: `
    <div class="preview-wrap">
      <div class="preview-status">
        @if (compiling()) {
          <mat-progress-bar mode="indeterminate" class="compile-bar" />
        } @else if (result()?.success) {
          <div class="status-row success">
            <mat-icon>check_circle</mat-icon>
            <span>Compiled successfully</span>
          </div>
        } @else if (result() && !result()?.success) {
          <div class="status-row error">
            <mat-icon>error_outline</mat-icon>
            <span>Compilation errors</span>
          </div>
          <div class="error-list">
            @for (err of result()?.errors ?? []; track err) {
              <div class="error-line">{{ err }}</div>
            }
          </div>
        }
      </div>
      <pre class="source-code">{{ source() }}</pre>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .preview-wrap { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .preview-status { flex-shrink: 0; }
    .compile-bar { height: 2px; }
    .status-row { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.875rem; font-size: 0.75rem; font-weight: 600; }
    .status-row mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .success { color: var(--sf-success); background: var(--sf-success-dim); }
    .error { color: var(--sf-error); background: var(--sf-error-dim); }
    .error-list { background: var(--sf-error-dim); border-top: 1px solid rgba(248,113,113,0.2); padding: 0.375rem 0.875rem 0.5rem; max-height: 80px; overflow-y: auto; }
    .error-line { font-family: var(--sf-mono); font-size: 0.72rem; color: var(--sf-error); margin-bottom: 0.2rem; line-height: 1.4; }
    .source-code { flex: 1; margin: 0; padding: 0.875rem; font-family: var(--sf-mono); font-size: 0.78rem; line-height: 1.6; overflow: auto; background: #030c17; color: #a8d4f5; white-space: pre; border: none; }
  `],
})
export class SolidityPreviewComponent implements OnChanges {
  @Input() definition!: FsmDefinition;

  private readonly api = inject(FsmApiService);
  private readonly change$ = new Subject<FsmDefinition>();

  readonly source = signal('');
  readonly result = signal<CompileResult | null>(null);
  readonly compiling = signal(false);

  constructor() {
    this.change$
      .pipe(
        debounceTime(1500),
        switchMap(() => {
          this.compiling.set(true);
          return this.api.compileSource(this.source());
        }),
      )
      .subscribe({
        next: (res) => { this.result.set(res); this.compiling.set(false); },
        error: () => { this.compiling.set(false); },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['definition'] && this.definition) {
      this.generateSource();
      this.change$.next(this.definition);
    }
  }

  private generateSource(): void {
    const def = this.definition;
    const lines: string[] = [];
    lines.push('// SPDX-License-Identifier: MIT');
    lines.push('pragma solidity ^0.8.0;');
    lines.push('');
    lines.push(`contract ${def.name.replace(/[^a-zA-Z0-9_]/g, '_')} {`);
    lines.push(`    enum State { ${def.states.map((s) => s.replace(/[^a-zA-Z0-9_]/g, '_')).join(', ')} }`);
    lines.push(`    State public currentState = State.${def.initialState.replace(/[^a-zA-Z0-9_]/g, '_')};`);

    for (const t of def.transitions) {
      const fnName = t.name.replace(/[^a-zA-Z0-9_]/g, '_');
      const fromState = t.from.replace(/[^a-zA-Z0-9_]/g, '_');
      const toState = t.to.replace(/[^a-zA-Z0-9_]/g, '_');

      lines.push(`    function ${fnName}() public {`);
      lines.push(`        require(currentState == State.${fromState}, "Invalid state");`);
      if (t.guard) {
        lines.push(`        require(${t.guard}, "Guard condition failed");`);
      }
      if (t.statements && t.statements.length > 0) {
        for (const stmt of t.statements) {
          lines.push(`        ${stmt};`);
        }
      }
      lines.push(`        currentState = State.${toState};`);
      lines.push(`    }`);
    }

    lines.push('}');
    this.source.set(lines.join('\n'));
  }
}
