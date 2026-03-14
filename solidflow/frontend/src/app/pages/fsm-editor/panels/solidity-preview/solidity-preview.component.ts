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
import type { FsmDefinition } from '@solidflow/shared';
import { FsmApiService, CompileResult } from '../../../../core/services/fsm-api.service';

@Component({
  selector: 'app-solidity-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="preview-container">
      <div class="preview-header">
        <span class="preview-title">Solidity Preview</span>
        @if (compiling()) {
          <span class="badge compiling">Compiling…</span>
        } @else if (result()?.success) {
          <span class="badge success">✓ Compiled</span>
        } @else if (result() && !result()?.success) {
          <span class="badge error">✗ Errors</span>
        }
      </div>

      @if (result() && !result()?.success) {
        <div class="error-banner">
          @for (err of result()?.errors ?? []; track err) {
            <div class="error-line">{{ err }}</div>
          }
        </div>
      }

      <pre class="source-code">{{ source() }}</pre>
    </div>
  `,
  styles: [`
    .preview-container { display: flex; flex-direction: column; height: 100%; }
    .preview-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; border-bottom: 1px solid #e0e0e0; flex-shrink: 0; }
    .preview-title { font-weight: 600; font-size: 0.875rem; }
    .badge { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 10px; }
    .badge.compiling { background: #fff9c4; color: #f57f17; }
    .badge.success { background: #e8f5e9; color: #2e7d32; }
    .badge.error { background: #ffebee; color: #c62828; }
    .error-banner { background: #ffebee; border-bottom: 1px solid #ffcdd2; padding: 0.75rem 1rem; flex-shrink: 0; }
    .error-line { font-family: monospace; font-size: 0.8rem; color: #c62828; margin-bottom: 0.25rem; }
    .source-code { flex: 1; margin: 0; padding: 1rem; font-family: 'Courier New', monospace; font-size: 0.8rem; line-height: 1.5; overflow: auto; background: #1e1e1e; color: #d4d4d4; white-space: pre; }
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
        switchMap((def) => {
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
    // Generate a client-side preview by calling the compile POST endpoint
    // We'll show a placeholder until the server responds
    const def = this.definition;
    const lines: string[] = [];
    lines.push('// SPDX-License-Identifier: MIT');
    lines.push('pragma solidity ^0.8.0;');
    lines.push('');
    lines.push(`contract ${def.name.replace(/[^a-zA-Z0-9_]/g, '_')} {`);
    lines.push(`    enum State { ${def.states.map((s) => s.replace(/[^a-zA-Z0-9_]/g, '_')).join(', ')} }`);
    lines.push(`    State public currentState = State.${def.initialState.replace(/[^a-zA-Z0-9_]/g, '_')};`);
    for (const t of def.transitions) {
      lines.push(`    function ${t.name.replace(/[^a-zA-Z0-9_]/g, '_')}() public { /* ... */ }`);
    }
    lines.push('}');
    this.source.set(lines.join('\n'));
  }
}
