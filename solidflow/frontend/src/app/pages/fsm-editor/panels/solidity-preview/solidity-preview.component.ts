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
import type { FsmDefinition, FsmForLoop, FsmIfStatement, FsmStatement } from '@solidflow/shared';
import { FsmApiService, CompileResult } from '../../../../core/services/fsm-api.service';

function generateStatements(stmts: FsmStatement[], indent: string): string[] {
  const lines: string[] = [];
  for (const stmt of stmts) {
    if (typeof stmt === 'string') {
      lines.push(`${indent}${stmt}`);
    } else if ((stmt as FsmForLoop).type === 'for') {
      const s = stmt as FsmForLoop;
      lines.push(`${indent}for (${s.init}; ${s.condition}; ${s.increment}) {`);
      lines.push(...generateStatements(s.body, indent + '    '));
      lines.push(`${indent}}`);
    } else if ((stmt as FsmIfStatement).type === 'if') {
      const s = stmt as FsmIfStatement;
      lines.push(`${indent}if (${s.condition}) {`);
      lines.push(...generateStatements(s.body, indent + '    '));
      for (const ei of s.elseIfs) {
        lines.push(`${indent}} else if (${ei.condition}) {`);
        lines.push(...generateStatements(ei.body, indent + '    '));
      }
      if (s.elseBranch) {
        lines.push(`${indent}} else {`);
        lines.push(...generateStatements(s.elseBranch, indent + '    '));
      }
      lines.push(`${indent}}`);
    }
  }
  return lines;
}

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

    // Custom structs
    for (const ct of def.customTypes ?? []) {
      lines.push(`struct ${this.toIdentifier(ct.name)} {`);
      for (const field of ct.fields) {
        lines.push(`    ${field.type} ${field.name};`);
      }
      lines.push('}');
      lines.push('');
    }

    lines.push(`contract ${this.toIdentifier(def.name)} {`);

    // State enum
    lines.push('    enum State {');
    lines.push(def.states.map(s => `        ${this.toIdentifier(s)}`).join(',\n'));
    lines.push('    }');
    lines.push('');

    // Current state
    lines.push(`    State public currentState = State.${this.toIdentifier(def.initialState)};`);
    lines.push('');

    // Plugin: locking
    if (def.plugins?.locking) {
      lines.push('    bool private _locked;');
      lines.push('');
      lines.push('    modifier noReentrant() {');
      lines.push('        require(!_locked, "Reentrant call");');
      lines.push('        _locked = true;');
      lines.push('        _;');
      lines.push('        _locked = false;');
      lines.push('    }');
      lines.push('');
    }

    // Plugin: accessControl
    if (def.plugins?.accessControl) {
      lines.push('    address public owner;');
      lines.push('');
      lines.push('    modifier onlyOwner() {');
      lines.push('        require(msg.sender == owner, "Not owner");');
      lines.push('        _;');
      lines.push('    }');
      lines.push('');
      lines.push('    constructor() {');
      lines.push('        owner = msg.sender;');
      lines.push('    }');
      lines.push('');
    }

    // Plugin: transitionCounter
    if (def.plugins?.transitionCounter) {
      lines.push('    uint256 public transitionCount;');
      lines.push('');
    }

    // Plugin: timedTransitions
    if (def.plugins?.timedTransitions) {
      lines.push('    uint256 public lastTransitionTime;');
      lines.push('');
    }

    // Plugin: event (or any transition with emitEvent)
    if (def.plugins?.event || def.transitions.some(t => t.emitEvent)) {
      lines.push('    event StateChanged(State indexed from, State indexed to, string transitionName);');
      lines.push('');
    }

    // Contract variables
    for (const v of def.variables ?? []) {
      const vis = v.visibility ?? 'public';
      const init = v.initialValue ? ` = ${v.initialValue}` : '';
      lines.push(`    ${v.type} ${vis} ${v.name}${init};`);
    }
    if ((def.variables ?? []).length > 0) lines.push('');

    // Transition functions
    for (const t of def.transitions) {
      const fnName = this.toIdentifier(t.name);
      const fromState = `State.${this.toIdentifier(t.from)}`;
      const toState = `State.${this.toIdentifier(t.to)}`;
      const modifiers: string[] = [];
      if (def.plugins?.locking) modifiers.push('noReentrant');
      if (def.plugins?.accessControl) modifiers.push('onlyOwner');
      const modStr = modifiers.length ? ' ' + modifiers.join(' ') : '';

      lines.push(`    function ${fnName}() public${modStr} {`);
      lines.push(`        require(currentState == ${fromState}, "Invalid state");`);

      if (t.guard) {
        lines.push(`        require(${t.guard}, "Guard condition failed");`);
      }

      if (t.statementsMode === 'code' && t.rawStatements) {
        for (const line of t.rawStatements.split('\n')) {
          lines.push(`        ${line}`);
        }
      } else {
        lines.push(...generateStatements(t.statements ?? [], '        '));
      }

      if (def.plugins?.timedTransitions) {
        lines.push('        lastTransitionTime = block.timestamp;');
      }
      if (def.plugins?.transitionCounter) {
        lines.push('        transitionCount++;');
      }
      if (def.plugins?.event || t.emitEvent) {
        lines.push(`        emit StateChanged(${fromState}, ${toState}, "${t.name}");`);
      }

      lines.push(`        currentState = ${toState};`);
      lines.push('    }');
      lines.push('');
    }

    lines.push('}');
    this.source.set(lines.join('\n'));
  }

  private toIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  }
}
