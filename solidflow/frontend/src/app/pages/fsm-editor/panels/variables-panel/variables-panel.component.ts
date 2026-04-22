import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { SOLIDITY_TYPES } from '../../../../shared/solidity-types';
import { ArrayEditorComponent } from '../../../../shared/array-editor.component';
import { buildTypeString } from '../../../../shared/solidity-types';
import type { FsmDefinition, FsmContractVariable } from '@solidflow/shared';

@Component({
  selector: 'app-variables-panel',
  standalone: true,
  imports: [ArrayEditorComponent, CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatExpansionModule],
  template: `
    <div class="panel">
      <div class="section-header">
        <mat-icon class="section-icon">data_object</mat-icon>
        <span class="section-title">Variables</span>
        <span class="count">{{ (definition.variables ?? []).length }}</span>
      </div>

      @for (v of definition.variables ?? []; track i; let i = $index) {
        <div class="var-card">
          <div class="var-row-top">
            <mat-form-field appearance="fill" class="var-type">
              <mat-label>Type</mat-label>
              <mat-select [ngModel]="v.type" (ngModelChange)="patch(i, { type: $event })">
                @for (type of getAvailableTypes(); track type) {
                  <mat-option [value]="type">{{ type }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <app-array-editor
              [isArray]="v.isArray ?? false"
              [dimensions]="v.dimensions ?? []"
              (isArrayChange)="patch(i, { isArray: $any($event) })"
              (dimensionsChange)="patch(i, { dimensions: $any($event) })"
            />

            <mat-form-field appearance="fill" class="var-name">
              <mat-label>Name</mat-label>
              <input matInput [ngModel]="v.name" (ngModelChange)="patch(i, { name: $event })" spellcheck="false" class="mono" />
            </mat-form-field>

            <button mat-icon-button class="sf-icon-btn-danger" (click)="remove(i)">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="var-row-bot">
            <mat-form-field appearance="fill" class="var-vis">
              <mat-label>Visibility</mat-label>
              <mat-select [ngModel]="v.visibility ?? 'public'" (ngModelChange)="patch(i, { visibility: $event })">
                <mat-option value="public">public</mat-option>
                <mat-option value="private">private</mat-option>
                <mat-option value="internal">internal</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="fill" class="var-init">
              <mat-label>Initial value</mat-label>
              <input matInput [ngModel]="v.initialValue ?? ''" (ngModelChange)="patch(i, { initialValue: $event || undefined })" placeholder="optional" spellcheck="false" class="mono" />
            </mat-form-field>
          </div>
        </div>
      }

      <button mat-stroked-button class="add-btn" (click)="add()">
        <mat-icon>add</mat-icon>
        Add Variable
      </button>

      <div class="section-header structs-header">
        <mat-icon class="section-icon">list_alt</mat-icon>
        <span class="section-title">Structs</span>
        <span class="count">{{ (definition.customTypes ?? []).length }}</span>
      </div>

      <mat-accordion>
        @for (ct of definition.customTypes ?? []; track ct.name; let ci = $index) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <span class="struct-name">struct {{ ct.name }}</span>
                <span class="struct-meta">{{ ct.fields.length }} fields</span>
              </mat-panel-title>
            </mat-expansion-panel-header>

            <div class="struct-body">
              <mat-form-field appearance="fill" class="full-width">
                <mat-label>Struct name</mat-label>
                <input matInput [ngModel]="ct.name" (ngModelChange)="patchType(ci, 'name', $event)" spellcheck="false" class="mono" />
              </mat-form-field>

              @for (field of ct.fields; track field.name; let fi = $index) {
                <div class="field-row">
                  <mat-form-field appearance="fill" class="field-type">
                    <mat-label>Type</mat-label>
                    <mat-select [ngModel]="field.type" (ngModelChange)="patchTypeField(ci, fi, 'type', $event)">
                      @for (type of getAvailableTypes(); track type) {
                        <mat-option [value]="type">{{ type }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="fill" class="field-name">
                    <mat-label>Field name</mat-label>
                    <input matInput [ngModel]="field.name" (ngModelChange)="patchTypeField(ci, fi, 'name', $event)" spellcheck="false" class="mono" />
                  </mat-form-field>

                  <button mat-icon-button class="sf-icon-btn-danger" (click)="removeTypeField(ci, fi)">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              }

              <div class="struct-actions">
                <button mat-button class="add-field-btn" (click)="addTypeField(ci)">
                  <mat-icon>add</mat-icon> Add field
                </button>
                <button mat-button class="rm-struct-btn" (click)="removeType(ci)">
                  <mat-icon>delete_outline</mat-icon> Remove struct
                </button>
              </div>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>

      <button mat-stroked-button class="add-btn" (click)="addType()">
        <mat-icon>add</mat-icon>
        Add Struct
      </button>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    .section-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .structs-header { margin-top: 1.5rem; }
    .section-icon { color: var(--sf-primary); font-size: 18px; width: 18px; height: 18px; }
    .section-title { font-family: var(--sf-brand); font-size: 0.85rem; font-weight: 700; color: var(--sf-text); letter-spacing: 0.05em; text-transform: uppercase; flex: 1; }
    .count { font-family: var(--sf-mono); font-size: 0.72rem; color: var(--sf-text-muted); background: var(--sf-border); padding: 0.1rem 0.5rem; border-radius: 10px; }
    .var-card { background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius); padding: 0.75rem 0.75rem 0.25rem; margin-bottom: 0.5rem; }
    .var-row-top { display: flex; gap: 0.5rem; align-items: flex-start; }
    .var-row-bot { display: flex; gap: 0.5rem; }
    .var-type { flex: 0 0 160px; }
    .var-name { flex: 1; }
    .var-vis { flex: 0 0 110px; }
    .var-init { flex: 1; }
    .sf-icon-btn-danger { margin-top: 4px; }
    .mono { font-family: var(--sf-mono) !important; font-size: 0.82rem !important; }
    .full-width { width: 100%; }
    .add-btn { width: 100%; margin-bottom: 0.5rem; border-color: var(--sf-border) !important; color: var(--sf-text-muted) !important; border-style: dashed !important; }
    .add-btn:hover { border-color: var(--sf-primary) !important; color: var(--sf-primary) !important; }
    .struct-name { font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text); }
    .struct-meta { font-size: 0.75rem; color: var(--sf-text-muted); margin-left: 0.5rem; }
    .struct-body { display: flex; flex-direction: column; gap: 0.5rem; }
    .field-row { display: flex; gap: 0.5rem; align-items: flex-start; }
    .field-type { flex: 0 0 160px; }
    .field-name { flex: 1; }
    .struct-actions { display: flex; justify-content: space-between; margin-top: 0.25rem; }
    .add-field-btn { color: var(--sf-primary) !important; font-size: 0.8rem; }
    .rm-struct-btn { color: var(--sf-error) !important; font-size: 0.8rem; }
  `],
})
export class VariablesPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  readonly solidityTypes = SOLIDITY_TYPES;

  getAvailableTypes(): string[] {
    const customTypeNames = (this.definition.customTypes ?? []).map((ct) => ct.name);
    return [...this.solidityTypes, ...customTypeNames];
  }

  add(): void {
    const v: FsmContractVariable = {
      name: `var${(this.definition.variables ?? []).length + 1}`,
      type: 'uint256',
      visibility: 'public',
    };
    this.definitionChange.emit({ ...this.definition, variables: [...(this.definition.variables ?? []), v] });
  }

  patch(i: number, partial: Partial<FsmContractVariable>): void {
    const variables = (this.definition.variables ?? []).map((v, idx) => idx === i ? { ...v, ...partial } : v);
    this.definitionChange.emit({ ...this.definition, variables });
  }

  remove(i: number): void {
    const variables = (this.definition.variables ?? []).filter((_, idx) => idx !== i);
    this.definitionChange.emit({ ...this.definition, variables });
  }

  addType(): void {
    const customTypes = [...(this.definition.customTypes ?? []), { name: `Struct${(this.definition.customTypes ?? []).length + 1}`, fields: [] }];
    this.definitionChange.emit({ ...this.definition, customTypes });
  }

  patchType(ci: number, key: string, value: string): void {
    const customTypes = (this.definition.customTypes ?? []).map((ct, i) => i === ci ? { ...ct, [key]: value } : ct);
    this.definitionChange.emit({ ...this.definition, customTypes });
  }

  removeType(ci: number): void {
    const customTypes = (this.definition.customTypes ?? []).filter((_, i) => i !== ci);
    this.definitionChange.emit({ ...this.definition, customTypes });
  }

  addTypeField(ci: number): void {
    const customTypes = (this.definition.customTypes ?? []).map((ct, i) =>
      i === ci ? { ...ct, fields: [...ct.fields, { name: `field${ct.fields.length + 1}`, type: 'uint256' }] } : ct);
    this.definitionChange.emit({ ...this.definition, customTypes });
  }

  patchTypeField(ci: number, fi: number, key: string, value: string): void {
    const customTypes = (this.definition.customTypes ?? []).map((ct, i) =>
      i === ci ? { ...ct, fields: ct.fields.map((f, j) => j === fi ? { ...f, [key]: value } : f) } : ct);
    this.definitionChange.emit({ ...this.definition, customTypes });
  }

  removeTypeField(ci: number, fi: number): void {
    const customTypes = (this.definition.customTypes ?? []).map((ct, i) =>
      i === ci ? { ...ct, fields: ct.fields.filter((_, j) => j !== fi) } : ct);
    this.definitionChange.emit({ ...this.definition, customTypes });
  }
}