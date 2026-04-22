import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { FsmDefinition, FsmTransition } from '@solidflow/shared';
import { randomUUID } from '../../canvas/uuid';
import { StatementListComponent } from './statement-list.component';
import { GuardSelectorComponent } from './guard-selector.component';
import { SOLIDITY_TYPES } from '../../../../shared/solidity-types';

@Component({
  selector: 'app-transitions-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatExpansionModule, MatButtonToggleModule, MatSlideToggleModule, StatementListComponent, GuardSelectorComponent],
  template: `
    <div class="panel">
      <div class="section-header">
        <mat-icon class="section-icon">arrow_forward</mat-icon>
        <span class="section-title">Transitions</span>
        <span class="count">{{ definition.transitions.length }}</span>
      </div>

      @if (definition.transitions.length === 0) {
        <p class="empty-hint">No transitions yet. Add one below or draw on the canvas.</p>
      }

      <mat-accordion>
        @for (t of definition.transitions; track t.id; let i = $index) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <span class="t-name">{{ t.name || 'Unnamed' }}</span>
                <span class="t-route">{{ t.from }} → {{ t.to }}</span>
              </mat-panel-title>
            </mat-expansion-panel-header>

            <div class="t-body">
              <mat-form-field appearance="fill" class="full-width">
                <mat-label>Function name</mat-label>
                <input matInput [ngModel]="t.name" (ngModelChange)="patchTransition(i, { name: $event })" spellcheck="false" />
              </mat-form-field>

              <div class="route-row">
                <mat-form-field appearance="fill" class="route-field">
                  <mat-label>From</mat-label>
                  <mat-select [ngModel]="t.from" (ngModelChange)="patchTransition(i, { from: $event })">
                    @for (s of definition.states; track s) {
                      <mat-option [value]="s">{{ s }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <span class="route-arrow">→</span>
                <mat-form-field appearance="fill" class="route-field">
                  <mat-label>To</mat-label>
                  <mat-select [ngModel]="t.to" (ngModelChange)="patchTransition(i, { to: $event })">
                    @for (s of definition.states; track s) {
                      <mat-option [value]="s">{{ s }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="payable-row">
                <mat-slide-toggle
                  [checked]="t.payable ?? false"
                  (change)="patchTransition(i, { payable: $event.checked })">
                  Payable
                </mat-slide-toggle>
              </div>

              <div class="inputs-section">
                <div class="inputs-header">
                  <span class="stmt-label">Input Parameters</span>
                  <button mat-icon-button class="add-input-btn" (click)="addInput(i)" matTooltip="Add input parameter">
                    <mat-icon>add</mat-icon>
                  </button>
                </div>
                @for (inp of t.inputs ?? []; track j; let j = $index) {
                  <div class="input-row">
                    <mat-form-field appearance="fill" class="input-type-field">
                      <mat-label>Type</mat-label>
                      <mat-select
                        [ngModel]="inp.type"
                        (ngModelChange)="patchInput(i, j, { type: $event })"
                      >
                        @for (typ of solidityTypes; track typ) {
                          <mat-option [value]="typ">{{ typ }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="fill" class="input-name-field">
                      <mat-label>Name</mat-label>
                      <input matInput
                        [ngModel]="inp.name"
                        (ngModelChange)="patchInput(i, j, { name: $event })"
                        spellcheck="false"
                        class="mono-input"
                        placeholder="paramName" />
                    </mat-form-field>
                    <button mat-icon-button class="remove-input-btn" (click)="removeInput(i, j)">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                }
              </div>

              <app-guard-selector
                [guardConfig]="t.guardConfig"
                [states]="definition.states"
                [enabledPlugins]="definition.plugins"
                (guardConfigChange)="patchTransition(i, { guardConfig: $any($event) })"
              />
              <div class="stmt-section">
                <div class="stmt-mode-row">
                  <span class="stmt-label">Statements</span>
                  <mat-button-toggle-group
                    [value]="t.statementsMode ?? 'guided'"
                    (change)="patchTransition(i, { statementsMode: $event.value })"
                    class="mode-toggle"
                  >
                    <mat-button-toggle value="guided">
                      <mat-icon>tune</mat-icon> Guided
                    </mat-button-toggle>
                    <mat-button-toggle value="code">
                      <mat-icon>code</mat-icon> Code Editor
                    </mat-button-toggle>
                  </mat-button-toggle-group>
                </div>
                @if ((t.statementsMode ?? 'guided') === 'guided') {
                  <app-statement-list
                    [statements]="t.statements ?? []"
                    (statementsChange)="patchTransition(i, { statements: $event.length ? $event : undefined })"
                  />
                } @else {
                  <textarea
                    class="raw-code-editor"
                    [value]="t.rawStatements ?? ''"
                    (input)="patchTransition(i, { rawStatements: $any($event.target).value })"
                    placeholder="// Write Solidity statements here..."
                    spellcheck="false"
                    rows="6"
                  ></textarea>
                }
              </div>

              <div class="event-emit-section">
                <mat-form-field appearance="fill" class="full-width">
                  <mat-label>Emit event</mat-label>
                  <mat-select
                    [ngModel]="t.emitEvent ?? ''"
                    (ngModelChange)="patchTransition(i, { emitEvent: $event || undefined, emitEventArgs: undefined })"
                  >
                    <mat-option value="">None</mat-option>
                    @for (ev of definition.events ?? []; track ev.name) {
                      <mat-option [value]="ev.name">{{ ev.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                @if (getSelectedEvent(t.emitEvent); as ev) {
                  @if (ev.params.length > 0) {
                    <div class="args-label">Arguments for <span class="mono-inline">{{ ev.name }}</span></div>
                    @for (p of ev.params; track p.name; let pi = $index) {
                      <mat-form-field appearance="fill" class="full-width">
                        <mat-label>{{ p.type }}{{ p.indexed ? ' indexed' : '' }} {{ p.name }}</mat-label>
                        <input
                          matInput
                          [ngModel]="t.emitEventArgs?.[pi] ?? ''"
                          (ngModelChange)="patchArg(i, pi, $event)"
                          spellcheck="false"
                          class="mono-input"
                        />
                      </mat-form-field>
                    }
                  }
                }
              </div>

              <button mat-button class="remove-btn" (click)="removeTransition(i)">
                <mat-icon>delete_outline</mat-icon>
                Remove transition
              </button>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>

      <button mat-stroked-button class="add-btn" (click)="addTransition()">
        <mat-icon>add</mat-icon>
        Add Transition
      </button>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    .section-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
    .section-icon { color: var(--sf-amber); font-size: 18px; width: 18px; height: 18px; }
    .section-title { font-family: var(--sf-brand); font-size: 0.85rem; font-weight: 700; color: var(--sf-text); letter-spacing: 0.05em; text-transform: uppercase; flex: 1; }
    .count { font-family: var(--sf-mono); font-size: 0.72rem; color: var(--sf-text-muted); background: var(--sf-border); padding: 0.1rem 0.5rem; border-radius: 10px; }
    .empty-hint { font-size: 0.8rem; color: var(--sf-text-muted); text-align: center; padding: 1rem 0; margin: 0 0 1rem; }
    .t-name { font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text); font-weight: 500; }
    .t-route { font-size: 0.75rem; color: var(--sf-text-muted); margin-left: 0.5rem; }
    .t-body { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.5rem; }
    .full-width { width: 100%; }
    .route-row { display: flex; align-items: center; gap: 0.5rem; }
    .route-field { flex: 1; }
    .route-arrow { color: var(--sf-amber); font-weight: 700; flex-shrink: 0; }
    .mono-input { font-family: var(--sf-mono) !important; font-size: 0.82rem !important; }
    .event-emit-section { display: flex; flex-direction: column; gap: 0.375rem; }
    .args-label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); }
    .mono-inline { font-family: var(--sf-mono); text-transform: none; letter-spacing: 0; }
    .payable-row { display: flex; align-items: center; padding: 0.25rem 0; }
    .remove-btn { color: var(--sf-error) !important; width: 100%; margin-top: 0.25rem; }
    .add-btn { width: 100%; margin-top: 0.75rem; border-color: var(--sf-border) !important; color: var(--sf-text-muted) !important; border-style: dashed !important; }
    .add-btn:hover { border-color: var(--sf-primary) !important; color: var(--sf-primary) !important; }
    .stmt-section { display: flex; flex-direction: column; gap: 0.375rem; }
    .stmt-label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); }
    .stmt-mode-row { display: flex; align-items: center; justify-content: space-between; }
    .mode-toggle { height: 28px; }
    .mode-toggle ::ng-deep .mat-button-toggle { font-size: 0.75rem; height: 28px; }
    .mode-toggle ::ng-deep .mat-button-toggle .mat-button-toggle-button { height: 28px; display: flex; align-items: center; justify-content: center; }
    .mode-toggle ::ng-deep .mat-button-toggle .mat-button-toggle-label-content { display: flex; align-items: center; gap: 4px; line-height: 1; padding: 0 10px; }
    .mode-toggle ::ng-deep .mat-button-toggle mat-icon { font-size: 14px; width: 14px; height: 14px; line-height: 14px; }
    .raw-code-editor { width: 100%; min-height: 120px; resize: vertical; background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius); padding: 0.5rem 0.625rem; font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text); outline: none; transition: border-color 0.15s; box-sizing: border-box; }
    .raw-code-editor:focus { border-color: var(--sf-primary); }
    .inputs-section { display: flex; flex-direction: column; gap: 0.375rem; }
    .inputs-header { display: flex; align-items: center; justify-content: space-between; }
    .add-input-btn { width: 28px; height: 28px; color: var(--sf-primary) !important; }
    .add-input-btn mat-icon { font-size: 18px; }
    .input-row { display: flex; align-items: center; gap: 0.375rem; }
    .input-type-field { width: 130px; flex-shrink: 0; }
    .input-name-field { flex: 1; }
    .remove-input-btn { width: 28px; height: 28px; color: var(--sf-error) !important; flex-shrink: 0; }
    .remove-input-btn mat-icon { font-size: 16px; }
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
    this.definitionChange.emit({ ...this.definition, transitions: [...this.definition.transitions, t] });
  }

  patchTransition(index: number, partial: Partial<FsmTransition>): void {
    const transitions = this.definition.transitions.map((t, i) => i === index ? { ...t, ...partial } : t);
    this.definitionChange.emit({ ...this.definition, transitions });
  }

  removeTransition(index: number): void {
    const transitions = this.definition.transitions.filter((_, i) => i !== index);
    this.definitionChange.emit({ ...this.definition, transitions });
  }

  getSelectedEvent(eventName: string | undefined) {
    if (!eventName) return null;
    return (this.definition.events ?? []).find((e) => e.name === eventName) ?? null;
  }

  patchArg(ti: number, pi: number, value: string): void {
    const args = [...(this.definition.transitions[ti].emitEventArgs ?? [])];
    args[pi] = value;
    this.patchTransition(ti, { emitEventArgs: args });
  }

  readonly solidityTypes = SOLIDITY_TYPES;

  addInput(transitionIndex: number): void {
    const inputs = [...(this.definition.transitions[transitionIndex].inputs ?? []), { type: 'uint256', name: '' }];
    this.patchTransition(transitionIndex, { inputs });
  }

  patchInput(transitionIndex: number, inputIndex: number, partial: Partial<{ type: string; name: string }>): void {
    const inputs = (this.definition.transitions[transitionIndex].inputs ?? []).map((inp, i) =>
      i === inputIndex ? { ...inp, ...partial } : inp
    );
    this.patchTransition(transitionIndex, { inputs });
  }

  removeInput(transitionIndex: number, inputIndex: number): void {
    const inputs = (this.definition.transitions[transitionIndex].inputs ?? []).filter((_, i) => i !== inputIndex);
    this.patchTransition(transitionIndex, { inputs: inputs.length ? inputs : undefined });
  }

}
