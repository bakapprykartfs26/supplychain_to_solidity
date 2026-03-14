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
      lines.push(`    constructor() {`);
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

    // Plugin: event
    if (def.plugins?.event) {
      lines.push(
        '    event StateChanged(State indexed from, State indexed to, string transitionName);',
      );
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
      const modifiers: string[] = [];
      if (def.plugins?.locking) modifiers.push('noReentrant');
      if (def.plugins?.accessControl) modifiers.push('onlyOwner');
      const modStr = modifiers.length ? ' ' + modifiers.join(' ') : '';

      lines.push(`    function ${fnName}() public${modStr} {`);
      lines.push(
        `        require(currentState == State.${this.toIdentifier(t.from)}, "Invalid state");`,
      );

      if (t.guard) {
        lines.push(`        require(${t.guard}, "Guard condition failed");`);
      }

      for (const stmt of t.statements ?? []) {
        lines.push(`        ${stmt}`);
      }

      const fromState = `State.${this.toIdentifier(t.from)}`;
      const toState = `State.${this.toIdentifier(t.to)}`;

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

    return lines.join('\n');
  }

  private toIdentifier(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^([0-9])/, '_$1');
  }
}
