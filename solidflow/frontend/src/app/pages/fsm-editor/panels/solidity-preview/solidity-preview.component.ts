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
import { buildTypeString } from '../../../../shared/solidity-types';

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

        @if (hasManualTransitionCode()) {
          <div class="status-row warning">
            <mat-icon>warning_amber</mat-icon>
            <span>
              Security warning: this contract contains manually added transition statements and may be prone to security flaws.
            </span>
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
    .warning { color: #f59e0b; background: rgba(245, 158, 11, 0.12); }
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

  readonly hasManualTransitionCode = signal(false);

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
      this.hasManualTransitionCode.set(
        this.definition.transitions.some((t) =>
          (t.statements?.length ?? 0) > 0 ||
          !!t.rawStatements?.trim()
        )
      );

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

    // Current state + createdAt (always present)
    lines.push(`    State public currentState = State.${this.toIdentifier(def.initialState)};`);
    lines.push('    uint256 public createdAt;');
    lines.push('');

    // Pre-compute cross-cutting concerns needed for declarations and constructor
    const allGuardEntries = [
      ...def.transitions.flatMap(t => t.guardConfig?.guards ?? []),
      ...(def.constructorConfig?.guardConfig?.guards ?? []),
    ];

    const guardTypes = new Set(
      allGuardEntries.map((entry) => entry.guard.type)
    );
    
    const accessControlRoles = new Set(
      def.transitions.flatMap(t =>
        t.guardConfig?.guards
          ?.filter(g => g.guard.type === 'access-control')
          .map(g => (g.guard as import('@solidflow/shared').AccessControlGuard).role) ?? []
      )
    );
    const usesTransitionPause =
      !!def.plugins?.transitionPause &&
      def.transitions.some(t => this.hasPauseGuard(t));
    // owner is needed when accessControl plugin is active OR when transitionPause needs it
    const needsOwner = !!def.plugins?.accessControl || usesTransitionPause;

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

    // Plugin: accessControl — variable + modifier only (no constructor here)
    if (def.plugins?.accessControl) {
      lines.push('    address public owner;');
      lines.push('');
      lines.push('    modifier onlyOwner() {');
      lines.push('        require(msg.sender == owner, "Not owner");');
      lines.push('        _;');
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

    // Plugin: event
    if (def.plugins?.event || def.transitions.some(t => t.emitEvent === true as unknown as string)) {
      lines.push('    event StateChanged(State newState);');
      lines.push('');
    }

    // Custom events
    for (const ev of def.events ?? []) {
      const params = ev.params
        .map(p => `${buildTypeString(p.type, p.isArray ?? false, p.dimensions ?? [])}${p.indexed ? ' indexed' : ''} ${p.name}`)
        .join(', ');
      lines.push(`    event ${this.toIdentifier(ev.name)}(${params});`);
    }
    if ((def.events ?? []).length > 0) lines.push('');

    // access-control guard roles (declarations only, no constructor)
    if (guardTypes.has('access-control') && !def.plugins?.accessControl) {
      for (const role of accessControlRoles) {
        lines.push(`    address public ${role};`);
      }
      if (accessControlRoles.size > 0) lines.push('');
    }

    // transitionPause: paused array + owner/modifier if not already from accessControl plugin
    if (usesTransitionPause) {
      lines.push(`    bool[${def.transitions.length}] public paused;`);
      lines.push('');

      if (!def.plugins?.accessControl) {
        lines.push('    address public owner;');
        lines.push('');
        lines.push('    modifier onlyOwner() {');
        lines.push('        require(msg.sender == owner, "Not owner");');
        lines.push('        _;');
        lines.push('    }');
        lines.push('');
      }

      lines.push('    function setTransitionPaused(uint256 transitionIndex, bool value) public onlyOwner {');
      lines.push(`        require(transitionIndex < ${def.transitions.length}, "Invalid transition index");`);
      lines.push('        paused[transitionIndex] = value;');
      lines.push('    }');
      lines.push('');
    }

    if (guardTypes.has('reentrancy') && !def.plugins?.locking) {
      lines.push('    bool private _locked;');
      lines.push('');
    }
    if (guardTypes.has('timelock') || guardTypes.has('cooldown')) {
      lines.push('    uint256 public lastCall;');
      lines.push('');
    }
    if (guardTypes.has('freshness')) {
      lines.push('    uint256 public lastUpdate;');
      lines.push('');
    }

    // Contract variables
    for (const v of def.variables ?? []) {
      const vis = v.visibility ?? 'public';
      const init = v.initialValue ? ` = ${v.initialValue}` : '';
      const typeStr = buildTypeString(v.type, v.isArray ?? false, v.dimensions ?? []);
      lines.push(`    ${typeStr} ${vis} ${v.name}${init};`);
    }
    if ((def.variables ?? []).length > 0) lines.push('');

    // Mappings
    for (const m of def.mappings ?? []) {
      const vis = m.visibility ?? 'public';
      lines.push(`    mapping(${m.keyType} => ${m.valueType}) ${vis} ${m.name};`);
    }
    if ((def.mappings ?? []).length > 0) lines.push('');

    // ── Unified constructor (always exactly one) ──────────────────────────
    const cfg = def.constructorConfig;
    const ctorParams: string[] = [];
    const ctorBody: string[] = ['        createdAt = block.timestamp;'];

    if (needsOwner) {
      ctorBody.push('        owner = msg.sender;');
    }

    // access-control guard roles initialisation (without plugin)
    if (guardTypes.has('access-control') && !def.plugins?.accessControl) {
      for (const role of accessControlRoles) {
        ctorBody.push(`        ${role} = msg.sender;`);
      }
    }

    for (const name of cfg?.includedVariables ?? []) {
      const v = (def.variables ?? []).find(x => x.name === name && !x.isArray);
      if (v) {
        ctorParams.push(`${v.type} _${v.name}`);
        ctorBody.push(`        ${v.name} = _${v.name};`);
      }
    }
    for (const name of cfg?.includedArrays ?? []) {
      const v = (def.variables ?? []).find(x => x.name === name && x.isArray);
      if (v) {
        ctorParams.push(`${v.type}[] memory _${v.name}`);
        ctorBody.push(`        ${v.name} = _${v.name};`);
      }
    }
    for (const name of cfg?.includedStructs ?? []) {
      const ct = (def.customTypes ?? []).find(x => x.name === name);
      if (ct) {
        ctorParams.push(`${ct.name} memory _${ct.name.toLowerCase()}`);
        ctorBody.push(`        ${ct.name.toLowerCase()} = _${ct.name.toLowerCase()};`);
      }
    }

    const paramStr = ctorParams.length
      ? '\n        ' + ctorParams.join(',\n        ') + '\n    '
      : '';
    lines.push(`    constructor(${paramStr}) {`);

    this.emitGuardRequires(
      lines,
      def.constructorConfig?.guardConfig,
      '        ',
      { skipPause: true }
    );

    for (const stmt of ctorBody) lines.push(stmt);
    lines.push('    }');
    lines.push('');

    // Transition functions
    for (const [transitionIndex, t] of def.transitions.entries()) {
      const fnName = this.toIdentifier(t.name);
      const fromState = `State.${this.toIdentifier(t.from)}`;
      const toState = `State.${this.toIdentifier(t.to)}`;
      const modifiers: string[] = [];
      if (def.plugins?.locking) modifiers.push('noReentrant');
      if (def.plugins?.accessControl) modifiers.push('onlyOwner');
      const modStr = modifiers.length ? ' ' + modifiers.join(' ') : '';

      const payableStr = t.payable ? ' payable' : '';

      const inputParams = (t.inputs ?? [])
        .filter(inp => inp.name)
        .map(inp => `${buildTypeString(inp.type, inp.isArray ?? false, inp.dimensions ?? [])} ${inp.name}`)
        .join(', ');

      lines.push(`    function ${fnName}(${inputParams}) public${payableStr}${modStr} {`);
      
      lines.push(`        require(currentState == ${fromState}, "Invalid state");`);

      if (def.plugins?.transitionPause && this.hasPauseGuard(t)) {
        lines.push(`        require(!paused[${transitionIndex}], "Transition paused");`);
      }

      this.emitGuardRequires(lines, t.guardConfig, '        ', {
        skipPause: true,
      });

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
      if (def.plugins?.event || t.emitEvent === true as unknown as string) {
        lines.push(`        emit StateChanged(${toState});`);
      }

      if (t.emitEvent && t.emitEvent !== '' && t.emitEvent !== 'true') {
        const evDef = (def.events ?? []).find(e => e.name === t.emitEvent);
        if (evDef) {
          const args = evDef.params
            .map((p, idx) => t.emitEventArgs?.[idx] || `0 /* ${p.name} */`)
            .join(', ');
          lines.push(`        emit ${this.toIdentifier(t.emitEvent)}(${args});`);
        }
      }

      lines.push(`        currentState = ${toState};`);
      lines.push('    }');
      lines.push('');
    }

    lines.push('}');
    this.source.set(lines.join('\n'));
  }

  private hasPauseGuard(t: FsmDefinition['transitions'][number]): boolean {
    return !!t.guardConfig?.guards?.some((entry) => entry.guard.type === 'pause');
  }

  private emitGuardRequires(
    lines: string[],
    guardConfig: import('@solidflow/shared').FsmGuardConfig | undefined,
    indent = '        ',
    options?: {
      skipPause?: boolean;
    },
  ): void {
    const guards = guardConfig?.guards ?? [];

    const filteredGuards = options?.skipPause
      ? guards.filter((entry) => entry.guard.type !== 'pause')
      : guards;

    if (filteredGuards.length === 0) {
      return;
    }

    const parts = filteredGuards.map((entry, i) => {
      const expr = `(${this.guardToExpression(entry.guard)})`;

      if (i === filteredGuards.length - 1) {
        return expr;
      }

      const op = entry.operator === 'OR' ? '||' : '&&';
      return `${expr} ${op}`;
    });

    const combinedExpression = parts.join(' ');
    const errMsg =
      filteredGuards.find((entry) => entry.errorMessage?.trim())?.errorMessage?.trim()
      ?? 'Guard condition failed';

    lines.push(`${indent}require(${combinedExpression}, "${errMsg}");`);
  }

  private guardToExpression(guard: import('@solidflow/shared').FsmGuard): string {
    switch (guard.type) {
      case 'access-control':     return `msg.sender == ${guard.role === 'owner' ? 'owner' : guard.role}`;
      case 'input-validation':   return guard.expression;
      case 'state-precondition': return `currentState == State.${guard.state}`;
      case 'pause':              return `true`;
      case 'postcondition':      return guard.expression;
      case 'event-emission':     return `true /* emit ${guard.eventName} */`;
      case 'return-value':       return guard.expression;
      case 'reentrancy':         return `!_locked`;
      case 'deadline':           return `block.timestamp <= ${guard.timestamp}`;
      case 'timelock':           return `block.timestamp >= lastCall + ${guard.delay}`;
      case 'cooldown':           return `block.timestamp >= lastCall + ${guard.interval}`;
      case 'window':             return `block.timestamp >= ${guard.start} && block.timestamp <= ${guard.end}`;
      case 'source-whitelist':   return `msg.sender == ${guard.address}`;
      case 'freshness':          return `block.timestamp - lastUpdate <= ${guard.maxAge}`;
      case 'sanity-bound':       return `value >= ${guard.min} && value <= ${guard.max}`;
    }
  }

  private toIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  }
}