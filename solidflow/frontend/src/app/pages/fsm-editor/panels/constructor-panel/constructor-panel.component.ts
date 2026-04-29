import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import type { FsmDefinition, FsmConstructorConfig } from '@solidflow/shared';

@Component({
  selector: 'app-constructor-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCheckboxModule, MatIconModule],
  template: `
    <div class="panel">
      <div class="section-header">
        <mat-icon class="section-icon">construction</mat-icon>
        <span class="section-title">Constructor</span>
      </div>

      <div class="info-box">
        <mat-icon class="info-icon">info_outline</mat-icon>
        <span>The constructor always includes the contract creation timestamp. Select which variables, arrays and structs should be passed as parameters and initialized.</span>
      </div>

      <!-- Always included -->
      <div class="always-section">
        <div class="always-header">Always included</div>
        <div class="always-item">
          <mat-icon class="always-icon">schedule</mat-icon>
          <span class="always-label"><code>createdAt</code> — block.timestamp on deployment</span>
        </div>
      </div>

      <!-- Variables -->
      @if ((definition.variables ?? []).length > 0) {
        <div class="check-section">
          <div class="check-section-title">Variables</div>
          @for (v of definition.variables ?? []; track v.name) {
            @if (!v.isArray) {
              <div class="check-row">
                <mat-checkbox
                  color="primary"
                  [ngModel]="isIncluded('variables', v.name)"
                  (ngModelChange)="toggle('variables', v.name, $event)"
                >
                  <span class="check-label">
                    <code>{{ v.type }} {{ v.name }}</code>
                    <span class="check-vis">{{ v.visibility ?? 'public' }}</span>
                  </span>
                </mat-checkbox>
              </div>
            }
          }
        </div>
      }

      <!-- Arrays -->
      @if (hasArrays()) {
        <div class="check-section">
          <div class="check-section-title">Arrays</div>
          @for (v of definition.variables ?? []; track v.name) {
            @if (v.isArray) {
              <div class="check-row">
                <mat-checkbox
                  color="primary"
                  [ngModel]="isIncluded('arrays', v.name)"
                  (ngModelChange)="toggle('arrays', v.name, $event)"
                >
                  <span class="check-label">
                    <code>{{ v.type }}[] {{ v.name }}</code>
                    <span class="check-vis">{{ v.visibility ?? 'public' }}</span>
                  </span>
                </mat-checkbox>
              </div>
            }
          }
        </div>
      }

      <!-- Structs -->
      @if ((definition.customTypes ?? []).length > 0) {
        <div class="check-section">
          <div class="check-section-title">Structs</div>
          @for (ct of definition.customTypes ?? []; track ct.name) {
            <div class="check-row">
              <mat-checkbox
                color="primary"
                [ngModel]="isIncluded('structs', ct.name)"
                (ngModelChange)="toggle('structs', ct.name, $event)"
              >
                <span class="check-label">
                  <code>{{ ct.name }}</code>
                  <span class="check-meta">{{ ct.fields.length }} fields</span>
                </span>
              </mat-checkbox>
            </div>
          }
        </div>
      }

      @if ((definition.variables ?? []).length === 0 && (definition.customTypes ?? []).length === 0) {
        <p class="empty-hint">No variables or structs defined yet. Add them in the Variables tab.</p>
      }

      <!-- Preview -->
      <div class="preview-section">
        <div class="preview-header">Constructor preview</div>
        <pre class="preview-code">{{ constructorPreview() }}</pre>
      </div>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
    .section-header { display: flex; align-items: center; gap: 0.5rem; }
    .section-icon { color: var(--sf-primary); font-size: 18px; width: 18px; height: 18px; }
    .section-title { font-family: var(--sf-brand); font-size: 0.85rem; font-weight: 700; color: var(--sf-text); letter-spacing: 0.05em; text-transform: uppercase; flex: 1; }
    .info-box { display: flex; gap: 0.5rem; background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius); padding: 0.625rem 0.75rem; font-size: 0.78rem; color: var(--sf-text-muted); line-height: 1.5; }
    .info-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; color: var(--sf-primary); margin-top: 1px; }
    .always-section { display: flex; flex-direction: column; gap: 0.375rem; }
    .always-header { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); }
    .always-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.625rem; background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius); }
    .always-icon { font-size: 15px; width: 15px; height: 15px; color: var(--sf-success); }
    .always-label { font-size: 0.78rem; color: var(--sf-text-muted); }
    .always-label code { font-family: var(--sf-mono); color: var(--sf-text); font-size: 0.78rem; }
    .check-section { display: flex; flex-direction: column; gap: 0.25rem; }
    .check-section-title { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); margin-bottom: 0.25rem; }
    .check-row { padding: 0.375rem 0.5rem; border-radius: var(--sf-radius); transition: background 0.1s; }
    .check-row:hover { background: var(--sf-elevated); }
    .check-label { display: flex; align-items: center; gap: 0.5rem; }
    .check-label code { font-family: var(--sf-mono); font-size: 0.78rem; color: var(--sf-text); }
    .check-vis { font-size: 0.68rem; color: var(--sf-text-muted); background: var(--sf-border); padding: 0.1rem 0.4rem; border-radius: 4px; }
    .check-meta { font-size: 0.68rem; color: var(--sf-text-muted); }
    .empty-hint { font-size: 0.8rem; color: var(--sf-text-muted); text-align: center; padding: 1rem 0; margin: 0; }
    .preview-section { display: flex; flex-direction: column; gap: 0.375rem; }
    .preview-header { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); }
    .preview-code { font-family: var(--sf-mono); font-size: 0.75rem; color: #a8d4f5; background: #030c17; border-radius: var(--sf-radius); padding: 0.75rem; margin: 0; white-space: pre-wrap; line-height: 1.6; }
  `],
})
export class ConstructorPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  hasArrays(): boolean {
    return (this.definition.variables ?? []).some(v => v.isArray);
  }

  isIncluded(category: 'variables' | 'arrays' | 'structs', name: string): boolean {
    const cfg = this.definition.constructorConfig;
    if (!cfg) return false;
    if (category === 'variables') return cfg.includedVariables.includes(name);
    if (category === 'arrays') return cfg.includedArrays.includes(name);
    return cfg.includedStructs.includes(name);
  }

  toggle(category: 'variables' | 'arrays' | 'structs', name: string, checked: boolean): void {
    const cfg: FsmConstructorConfig = {
      includedVariables: [...(this.definition.constructorConfig?.includedVariables ?? [])],
      includedArrays: [...(this.definition.constructorConfig?.includedArrays ?? [])],
      includedStructs: [...(this.definition.constructorConfig?.includedStructs ?? [])],
      includedMappings: [...(this.definition.constructorConfig?.includedMappings ?? [])],
    };
    const list = category === 'variables' ? cfg.includedVariables
                : category === 'arrays'   ? cfg.includedArrays
                :                           cfg.includedStructs;
    if (checked && !list.includes(name)) list.push(name);
    if (!checked) { const idx = list.indexOf(name); if (idx >= 0) list.splice(idx, 1); }
    this.definitionChange.emit({ ...this.definition, constructorConfig: cfg });
  }

  constructorPreview(): string {
    const cfg = this.definition.constructorConfig;
    const params: string[] = [];
    const assigns: string[] = [];

    // Variables
    for (const name of cfg?.includedVariables ?? []) {
      const v = (this.definition.variables ?? []).find(x => x.name === name && !x.isArray);
      if (v) { params.push(`${v.type} _${v.name}`); assigns.push(`        ${v.name} = _${v.name};`); }
    }

    // Arrays
    for (const name of cfg?.includedArrays ?? []) {
      const v = (this.definition.variables ?? []).find(x => x.name === name && x.isArray);
      if (v) { params.push(`${v.type}[] memory _${v.name}`); assigns.push(`        ${v.name} = _${v.name};`); }
    }

    // Structs
    for (const name of cfg?.includedStructs ?? []) {
      const ct = (this.definition.customTypes ?? []).find(x => x.name === name);
      if (ct) { params.push(`${ct.name} memory _${ct.name.toLowerCase()}`); assigns.push(`        ${ct.name.toLowerCase()} = _${ct.name.toLowerCase()};`); }
    }


    const paramStr = params.join(',\n        ');
    const lines = [
      `constructor(${params.length ? '\n        ' + paramStr + '\n    ' : ''}) {`,
      `        createdAt = block.timestamp;`,
      ...assigns,
      `    }`,
    ];
    return lines.join('\n');
  }
}