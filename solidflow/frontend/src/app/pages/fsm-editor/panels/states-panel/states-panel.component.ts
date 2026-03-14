import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { FsmDefinition } from '@solidflow/shared';

@Component({
  selector: 'app-states-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel">
      <h3>States</h3>

      <div class="field-group">
        <label>Initial State</label>
        <select [ngModel]="definition.initialState" (ngModelChange)="patch({ initialState: $event })">
          @for (s of definition.states; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </div>

      <ul class="item-list">
        @for (state of definition.states; track state; let i = $index) {
          <li>
            <input [ngModel]="state" (ngModelChange)="renameState(i, $event)" />
            <button class="btn-icon" (click)="removeState(i)" title="Remove">✕</button>
          </li>
        }
      </ul>

      <div class="add-row">
        <input [(ngModel)]="newStateName" placeholder="New state name" (keyup.enter)="addState()" />
        <button class="btn-sm" (click)="addState()">Add</button>
      </div>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    h3 { margin: 0 0 1rem; font-size: 1rem; }
    .field-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.25rem; }
    label { font-size: 0.8rem; color: #666; }
    select, input { width: 100%; padding: 0.375rem 0.5rem; border: 1px solid #ccc; border-radius: 3px; font-size: 0.875rem; box-sizing: border-box; }
    .item-list { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.375rem; }
    .item-list li { display: flex; gap: 0.5rem; align-items: center; }
    .item-list input { flex: 1; }
    .btn-icon { background: none; border: none; cursor: pointer; color: #999; padding: 0 0.25rem; font-size: 1rem; }
    .btn-icon:hover { color: #d32f2f; }
    .add-row { display: flex; gap: 0.5rem; }
    .btn-sm { background: #1976d2; color: white; border: none; padding: 0.375rem 0.75rem; border-radius: 3px; cursor: pointer; white-space: nowrap; }
  `],
})
export class StatesPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  newStateName = '';

  addState(): void {
    const name = this.newStateName.trim();
    if (!name || this.definition.states.includes(name)) return;
    this.patch({ states: [...this.definition.states, name] });
    this.newStateName = '';
  }

  renameState(index: number, newName: string): void {
    const old = this.definition.states[index];
    const states = [...this.definition.states];
    states[index] = newName;
    const transitions = this.definition.transitions.map((t) => ({
      ...t,
      from: t.from === old ? newName : t.from,
      to: t.to === old ? newName : t.to,
    }));
    const initialState = this.definition.initialState === old ? newName : this.definition.initialState;
    this.patch({ states, transitions, initialState });
  }

  removeState(index: number): void {
    const removed = this.definition.states[index];
    const states = this.definition.states.filter((_, i) => i !== index);
    const transitions = this.definition.transitions.filter(
      (t) => t.from !== removed && t.to !== removed,
    );
    this.patch({ states, transitions });
  }

  patch(partial: Partial<FsmDefinition>): void {
    this.definitionChange.emit({ ...this.definition, ...partial });
  }
}
