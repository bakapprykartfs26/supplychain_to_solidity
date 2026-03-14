import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { FsmDefinition, FsmContractVariable } from '@solidflow/shared';

@Component({
  selector: 'app-variables-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel">
      <h3>Contract Variables</h3>

      @for (v of definition.variables ?? []; track v.name; let i = $index) {
        <div class="var-row">
          <input [ngModel]="v.type" (ngModelChange)="patch(i, { type: $event })" placeholder="Type (e.g. uint256)" />
          <input [ngModel]="v.name" (ngModelChange)="patch(i, { name: $event })" placeholder="Name" />
          <select [ngModel]="v.visibility ?? 'public'" (ngModelChange)="patch(i, { visibility: $event })">
            <option value="public">public</option>
            <option value="private">private</option>
            <option value="internal">internal</option>
          </select>
          <input [ngModel]="v.initialValue ?? ''" (ngModelChange)="patch(i, { initialValue: $event || undefined })" placeholder="Initial value" />
          <button class="btn-icon" (click)="remove(i)">✕</button>
        </div>
      }

      <button class="btn-add" (click)="add()">+ Add Variable</button>

      <h3 style="margin-top: 1.5rem">Custom Structs</h3>
      @for (ct of definition.customTypes ?? []; track ct.name; let ci = $index) {
        <div class="struct-card">
          <div class="card-header">
            <input [ngModel]="ct.name" (ngModelChange)="patchType(ci, 'name', $event)" placeholder="Struct name" />
            <button class="btn-icon" (click)="removeType(ci)">✕</button>
          </div>
          @for (field of ct.fields; track field.name; let fi = $index) {
            <div class="field-row">
              <input [ngModel]="field.type" (ngModelChange)="patchTypeField(ci, fi, 'type', $event)" placeholder="Type" />
              <input [ngModel]="field.name" (ngModelChange)="patchTypeField(ci, fi, 'name', $event)" placeholder="Field name" />
              <button class="btn-icon" (click)="removeTypeField(ci, fi)">✕</button>
            </div>
          }
          <button class="btn-sm" (click)="addTypeField(ci)">+ Field</button>
        </div>
      }
      <button class="btn-add" (click)="addType()">+ Add Struct</button>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    h3 { margin: 0 0 0.75rem; font-size: 1rem; }
    .var-row { display: grid; grid-template-columns: 1fr 1fr auto 1fr auto; gap: 0.375rem; align-items: center; margin-bottom: 0.375rem; }
    input, select { padding: 0.375rem 0.5rem; border: 1px solid #ccc; border-radius: 3px; font-size: 0.8rem; width: 100%; box-sizing: border-box; }
    .btn-icon { background: none; border: none; cursor: pointer; color: #999; font-size: 1rem; padding: 0 0.2rem; }
    .btn-icon:hover { color: #d32f2f; }
    .btn-add { width: 100%; margin-top: 0.5rem; padding: 0.5rem; background: #f5f5f5; border: 1px dashed #ccc; border-radius: 4px; cursor: pointer; color: #555; }
    .struct-card { border: 1px solid #e0e0e0; border-radius: 4px; padding: 0.75rem; margin-bottom: 0.75rem; }
    .card-header { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
    .card-header input { flex: 1; font-weight: 600; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.375rem; align-items: center; margin-bottom: 0.375rem; }
    .btn-sm { background: #f0f0f0; border: 1px solid #ccc; padding: 0.25rem 0.75rem; border-radius: 3px; cursor: pointer; font-size: 0.8rem; }
  `],
})
export class VariablesPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  add(): void {
    const v: FsmContractVariable = { name: `var${(this.definition.variables ?? []).length + 1}`, type: 'uint256', visibility: 'public' };
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
      i === ci ? { ...ct, fields: [...ct.fields, { name: `field${ct.fields.length + 1}`, type: 'uint256' }] } : ct,
    );
    this.definitionChange.emit({ ...this.definition, customTypes });
  }

  patchTypeField(ci: number, fi: number, key: string, value: string): void {
    const customTypes = (this.definition.customTypes ?? []).map((ct, i) =>
      i === ci ? { ...ct, fields: ct.fields.map((f, j) => j === fi ? { ...f, [key]: value } : f) } : ct,
    );
    this.definitionChange.emit({ ...this.definition, customTypes });
  }

  removeTypeField(ci: number, fi: number): void {
    const customTypes = (this.definition.customTypes ?? []).map((ct, i) =>
      i === ci ? { ...ct, fields: ct.fields.filter((_, j) => j !== fi) } : ct,
    );
    this.definitionChange.emit({ ...this.definition, customTypes });
  }
}
