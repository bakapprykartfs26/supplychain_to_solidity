import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { FsmDefinition, FsmTransition } from '@solidflow/shared';
import { randomUUID } from '../../canvas/uuid';

@Component({
  selector: 'app-transitions-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel">
      <h3>Transitions</h3>

      @for (t of definition.transitions; track t.id; let i = $index) {
        <div class="transition-card">
          <div class="card-header">
            <input class="name-input" [ngModel]="t.name" (ngModelChange)="patchTransition(i, { name: $event })" placeholder="Name" />
            <button class="btn-icon" (click)="removeTransition(i)">✕</button>
          </div>
          <div class="row2">
            <div class="field">
              <label>From</label>
              <select [ngModel]="t.from" (ngModelChange)="patchTransition(i, { from: $event })">
                @for (s of definition.states; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </div>
            <div class="arrow">→</div>
            <div class="field">
              <label>To</label>
              <select [ngModel]="t.to" (ngModelChange)="patchTransition(i, { to: $event })">
                @for (s of definition.states; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </div>
          </div>
          <div class="field">
            <label>Guard condition (Solidity expression)</label>
            <input [ngModel]="t.guard ?? ''" (ngModelChange)="patchTransition(i, { guard: $event || undefined })" placeholder="e.g. msg.value > 0" />
          </div>
          <div class="check-row">
            <label>
              <input type="checkbox" [ngModel]="t.emitEvent ?? false" (ngModelChange)="patchTransition(i, { emitEvent: $event })" />
              Emit event
            </label>
          </div>
        </div>
      }

      <button class="btn-add" (click)="addTransition()">+ Add Transition</button>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    h3 { margin: 0 0 1rem; font-size: 1rem; }
    .transition-card { border: 1px solid #e0e0e0; border-radius: 4px; padding: 0.75rem; margin-bottom: 0.75rem; }
    .card-header { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
    .name-input { flex: 1; padding: 0.375rem 0.5rem; border: 1px solid #ccc; border-radius: 3px; font-size: 0.875rem; font-weight: 600; }
    .row2 { display: flex; align-items: flex-end; gap: 0.5rem; margin-bottom: 0.5rem; }
    .arrow { padding-bottom: 0.375rem; color: #666; }
    .field { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; }
    label { font-size: 0.75rem; color: #666; }
    select, input[type=text], input:not([type]) { width: 100%; padding: 0.375rem 0.5rem; border: 1px solid #ccc; border-radius: 3px; font-size: 0.875rem; box-sizing: border-box; }
    .check-row { margin-top: 0.5rem; font-size: 0.875rem; display: flex; gap: 0.5rem; align-items: center; }
    .check-row label { display: flex; gap: 0.375rem; align-items: center; cursor: pointer; color: #333; font-size: 0.875rem; }
    .btn-icon { background: none; border: none; cursor: pointer; color: #999; font-size: 1rem; }
    .btn-icon:hover { color: #d32f2f; }
    .btn-add { width: 100%; padding: 0.5rem; background: #f5f5f5; border: 1px dashed #ccc; border-radius: 4px; cursor: pointer; color: #555; }
    .btn-add:hover { background: #eeeeee; }
  `],
})
export class TransitionsPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  addTransition(): void {
    const t: FsmTransition = {
      id: randomUUID(),
      name: `transition${this.definition.transitions.length + 1}`,
      from: this.definition.states[0] ?? '',
      to: this.definition.states[1] ?? this.definition.states[0] ?? '',
    };
    this.definitionChange.emit({
      ...this.definition,
      transitions: [...this.definition.transitions, t],
    });
  }

  patchTransition(index: number, partial: Partial<FsmTransition>): void {
    const transitions = this.definition.transitions.map((t, i) =>
      i === index ? { ...t, ...partial } : t,
    );
    this.definitionChange.emit({ ...this.definition, transitions });
  }

  removeTransition(index: number): void {
    const transitions = this.definition.transitions.filter((_, i) => i !== index);
    this.definitionChange.emit({ ...this.definition, transitions });
  }
}
