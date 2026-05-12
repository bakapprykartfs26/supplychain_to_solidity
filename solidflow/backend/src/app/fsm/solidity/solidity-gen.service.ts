import { Injectable } from '@nestjs/common';
import type { FsmDefinition } from '@solidflow/shared';

@Injectable()
export class SolidityGenService {
  generate(def: FsmDefinition): string {
    const contractName = this.toIdentifier(def.name);
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

    lines.push(`contract ${contractName} {`);

    // State enum
    lines.push('    enum State {');
    lines.push(
      def.states.map((s) => `        ${this.toIdentifier(s)}`).join(',\n'),
    );
    lines.push('    }');
    lines.push('');

    // Current state variable
    lines.push(
      `    State public currentState = State.${this.toIdentifier(def.initialState)};`,
    );
    lines.push('    uint256 public createdAt;');
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

    // Plugin: event (or any transition with legacy boolean emitEvent)
    if (def.plugins?.event || def.transitions.some((t) => t.emitEvent === true as unknown as string)) {
      lines.push(
        '    event StateChanged(State newState);',
      );
      lines.push('');
    }

    // Custom events
    for (const ev of def.events ?? []) {
      const params = ev.params
        .map((p) => `${p.type}${p.indexed ? ' indexed' : ''} ${p.name}`)
        .join(', ');
      lines.push(`    event ${this.toIdentifier(ev.name)}(${params});`);
    }
    if ((def.events ?? []).length > 0) lines.push('');

    // Contract variables
    for (const v of def.variables ?? []) {
      const vis = v.visibility ?? 'public';
      const init = v.initialValue ? ` = ${v.initialValue}` : '';
      lines.push(`    ${v.type} ${vis} ${v.name}${init};`);
    }
    if ((def.variables ?? []).length > 0) lines.push('');

    // Mappings
    for (const m of def.mappings ?? []) {
      const vis = m.visibility ?? 'public';
      lines.push(`    mapping(${m.keyType} => ${m.valueType}) ${vis} ${m.name};`);
    }
    if ((def.mappings ?? []).length > 0) lines.push('');

    // Unified constructor
    const ctorParams: string[] = [];
    const ctorBody: string[] = ['        createdAt = block.timestamp;'];

    if (def.plugins?.accessControl) {
      ctorBody.push('        owner = msg.sender;');
    }

    for (const name of def.constructorConfig?.includedVariables ?? []) {
      const v = (def.variables ?? []).find((x) => x.name === name && !x.isArray);
      if (v) {
        ctorParams.push(`${v.type} _${v.name}`);
        ctorBody.push(`        ${v.name} = _${v.name};`);
      }
    }

    for (const name of def.constructorConfig?.includedArrays ?? []) {
      const v = (def.variables ?? []).find((x) => x.name === name && x.isArray);
      if (v) {
        ctorParams.push(`${v.type}[] memory _${v.name}`);
        ctorBody.push(`        ${v.name} = _${v.name};`);
      }
    }

    for (const name of def.constructorConfig?.includedStructs ?? []) {
      const ct = (def.customTypes ?? []).find((x) => x.name === name);
      if (ct) {
        const ident = this.toIdentifier(ct.name);
        ctorParams.push(`${ident} memory _${ct.name.toLowerCase()}`);
        ctorBody.push(`        ${ct.name.toLowerCase()} = _${ct.name.toLowerCase()};`);
      }
    }

    const paramStr = ctorParams.length
      ? '\n        ' + ctorParams.join(',\n        ') + '\n    '
      : '';
    lines.push(`    constructor(${paramStr}) {`);
    for (const stmt of ctorBody) lines.push(stmt);
    lines.push('    }');
    lines.push('');

    // Transition functions
    for (const t of def.transitions) {
      const fnName = this.toIdentifier(t.name);
      const modifiers: string[] = [];
      if (def.plugins?.locking) modifiers.push('noReentrant');
      if (def.plugins?.accessControl) modifiers.push('onlyOwner');
      const modStr = modifiers.length ? ' ' + modifiers.join(' ') : '';

      const payableStr = t.payable ? ' payable' : '';
      lines.push(`    function ${fnName}() public${payableStr}${modStr} {`);
      lines.push(
        `        require(currentState == State.${this.toIdentifier(t.from)}, "Invalid state");`,
      );

      if (t.guard) {
        lines.push(`        require(${t.guard}, "Guard condition failed");`);
      }

      this.emitGuardRequires(lines, t.guardConfig, '        ', {
        entryOnly: true,
      });

      if (t.statementsMode === 'code' && t.rawStatements) {
        for (const line of t.rawStatements.split('\n')) {
          lines.push(`        ${line}`);
        }
      } else {
        lines.push(...this.generateStatements(t.statements ?? [], '        '));
      }

      this.emitGuardRequires(lines, t.guardConfig, '        ', {
        exitOnly: true,
      });

      const fromState = `State.${this.toIdentifier(t.from)}`;
      const toState = `State.${this.toIdentifier(t.to)}`;

      if (def.plugins?.timedTransitions) {
        lines.push('        lastTransitionTime = block.timestamp;');
      }
      if (def.plugins?.transitionCounter) {
        lines.push('        transitionCount++;');
      }

      if (def.plugins?.event || t.emitEvent === true as unknown as string) {
        lines.push(`        emit StateChanged(${toState});`);
      }

      lines.push(`        currentState = ${toState};`);

      if (t.emitEvent && t.emitEvent !== '' && t.emitEvent !== 'true') {
        const evDef = (def.events ?? []).find((e) => e.name === t.emitEvent);
        if (evDef) {
          const args = evDef.params
            .map((p, idx) => t.emitEventArgs?.[idx] || `0 /* ${p.name} */`)
            .join(', ');
          lines.push(`        emit ${this.toIdentifier(t.emitEvent)}(${args});`);
        }
      }

      lines.push('    }');
      lines.push('');
    }

    lines.push('}');

    return lines.join('\n');
  }

  private generateStatements(stmts: import('@solidflow/shared').FsmStatement[], indent: string): string[] {
    const lines: string[] = [];
    for (const stmt of stmts) {
      if (typeof stmt === 'string') {
        lines.push(`${indent}${stmt}`);
      } else if (stmt.type === 'for') {
        lines.push(`${indent}for (${stmt.init}; ${stmt.condition}; ${stmt.increment}) {`);
        lines.push(...this.generateStatements(stmt.body, indent + '    '));
        lines.push(`${indent}}`);
      } else if (stmt.type === 'if') {
        lines.push(`${indent}if (${stmt.condition}) {`);
        lines.push(...this.generateStatements(stmt.body, indent + '    '));
        for (const ei of stmt.elseIfs) {
          lines.push(`${indent}} else if (${ei.condition}) {`);
          lines.push(...this.generateStatements(ei.body, indent + '    '));
        }
        if (stmt.elseBranch) {
          lines.push(`${indent}} else {`);
          lines.push(...this.generateStatements(stmt.elseBranch, indent + '    '));
        }
        lines.push(`${indent}}`);
      }
    }
    return lines;
  }

  private isExitGuard(entry: import('@solidflow/shared').FsmGuardConfig['guards'][number]): boolean {
    return entry.guard.type === 'postcondition';
  }

  private emitGuardRequires(
    lines: string[],
    guardConfig: import('@solidflow/shared').FsmGuardConfig | undefined,
    indent: string,
    options?: {
      entryOnly?: boolean;
      exitOnly?: boolean;
    },
  ): void {
    let guards = guardConfig?.guards ?? [];

    if (options?.entryOnly) {
      guards = guards.filter((entry) => !this.isExitGuard(entry));
    }

    if (options?.exitOnly) {
      guards = guards.filter((entry) => this.isExitGuard(entry));
    }

    for (const entry of guards) {
      const expression = this.guardExpression(entry.guard);

      if (!expression) continue;

      lines.push(
        `${indent}require(${expression}, "${entry.errorMessage || 'Guard condition failed'}");`,
      );
    }
  }

  private guardExpression(guard: import('@solidflow/shared').FsmGuard): string | null {
    switch (guard.type) {
      case 'access-control':
        return `msg.sender == ${guard.role === 'owner' ? 'owner' : guard.role}`;

      case 'input-validation':
        return guard.expression;

      case 'pause':
        return 'true';

      case 'postcondition':
        return guard.expression;

      case 'timelock':
        return `block.timestamp >= lastCall + ${guard.delay}`;

      case 'cooldown':
        return `block.timestamp >= lastCall + ${guard.interval}`;

      case 'window':
        return `block.timestamp >= ${guard.start} && block.timestamp <= ${guard.end}`;

      case 'source-whitelist':
        return `msg.sender == ${guard.address}`;

      case 'freshness':
        return `block.timestamp - lastUpdate <= ${guard.maxAge}`;

      case 'sanity-bound':
        return `value >= ${guard.min} && value <= ${guard.max}`;

      default:
        return null;
    }
  }

  private toIdentifier(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^([0-9])/, '_$1');
  }
}