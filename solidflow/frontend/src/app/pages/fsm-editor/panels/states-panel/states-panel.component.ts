import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { FsmDefinition } from '@solidflow/shared';

@Component({
  selector: 'app-states-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
  template: `
    <div class="panel">
      <div class="section-header">
        <mat-icon class="section-icon">hub</mat-icon>
        <span class="section-title">States</span>
        <span class="count">{{ definition.states.length }}</span>
      </div>

      <!-- Custom dropdown -->
      <div class="field-group">
        <span class="field-label">Initial State</span>
        <div class="sf-select" [class.open]="dropdownOpen">
          <button
            type="button"
            class="sf-select-trigger"
            (click)="dropdownOpen = !dropdownOpen; $event.stopPropagation()"
          >
            <span class="sf-select-value">{{ definition.initialState }}</span>
            <mat-icon class="sf-select-chevron">expand_more</mat-icon>
          </button>

          @if (dropdownOpen) {
            <div class="sf-select-backdrop" (click)="dropdownOpen = false"></div>
            <div class="sf-select-panel">
              @for (s of definition.states; track s) {
                <button
                  type="button"
                  class="sf-select-option"
                  [class.selected]="s === definition.initialState"
                  (click)="patch({ initialState: s }); dropdownOpen = false; $event.stopPropagation()"
                >
                  <span class="option-indicator">
                    @if (s === definition.initialState) {
                      <mat-icon class="option-check">check</mat-icon>
                    }
                  </span>
                  <span class="option-label">{{ s }}</span>
                </button>
              }
            </div>
          }
        </div>
      </div>

      <div class="state-list">
        @for (state of definition.states; track i; let i = $index) {
          <div class="state-row" [class.is-initial]="state === definition.initialState">
            <span class="state-indicator">{{ state === definition.initialState ? '●' : '○' }}</span>
            <input
              class="state-name-input"
              [value]="state"
              (input)="renameState(i, $any($event.target).value)"
              spellcheck="false"
            />
            <button mat-icon-button class="sf-icon-btn-danger" (click)="removeState(i)" [disabled]="definition.states.length <= 1">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }
      </div>

      <div class="add-row">
        <input
          class="add-input"
          [(ngModel)]="newStateName"
          (keyup.enter)="addState()"
          placeholder="New state name"
          spellcheck="false"
        />
        <button
          type="button"
          class="add-btn"
          (click)="addState()"
          [disabled]="!newStateName.trim()"
        >
          <mat-icon>add</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }

    /* ── Section header ───────────────────────────────────────────────── */
    .section-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
    .section-icon { color: var(--sf-primary); font-size: 18px; width: 18px; height: 18px; }
    .section-title { font-family: var(--sf-brand); font-size: 0.85rem; font-weight: 700; color: var(--sf-text); letter-spacing: 0.05em; text-transform: uppercase; flex: 1; }
    .count { font-family: var(--sf-mono); font-size: 0.72rem; color: var(--sf-text-muted); background: var(--sf-border); padding: 0.1rem 0.5rem; border-radius: 10px; }

    /* ── Custom select ────────────────────────────────────────────────── */
    .field-group { margin-bottom: 1rem; }
    .field-label {
      display: block;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--sf-text-muted);
      margin-bottom: 0.375rem;
    }

    .sf-select { position: relative; }

    .sf-select-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 0.625rem 0.5rem 0.75rem;
      background: var(--sf-elevated);
      border: 1px solid var(--sf-border);
      border-radius: var(--sf-radius);
      color: var(--sf-text);
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      text-align: left;
    }
    .sf-select-trigger:hover { border-color: var(--sf-text-dim); }
    .sf-select.open .sf-select-trigger {
      border-color: var(--sf-primary);
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      background: color-mix(in srgb, var(--sf-primary-dim) 30%, var(--sf-elevated));
    }

    .sf-select-value {
      flex: 1;
      font-family: var(--sf-mono);
      font-size: 0.85rem;
      color: var(--sf-text);
    }
    .sf-select-chevron {
      font-size: 18px; width: 18px; height: 18px;
      color: var(--sf-text-muted);
      transition: transform 0.2s ease, color 0.15s;
      flex-shrink: 0;
    }
    .sf-select.open .sf-select-chevron {
      transform: rotate(180deg);
      color: var(--sf-primary);
    }

    .sf-select-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99;
    }

    .sf-select-panel {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--sf-elevated);
      border: 1px solid var(--sf-primary);
      border-top: 1px solid var(--sf-border);
      border-radius: 0 0 var(--sf-radius) var(--sf-radius);
      overflow: hidden;
      z-index: 100;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      animation: sf-drop 0.12s ease;
    }
    @keyframes sf-drop {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .sf-select-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: transparent;
      border: none;
      color: var(--sf-text-muted);
      font-family: var(--sf-sans);
      font-size: 0.85rem;
      cursor: pointer;
      text-align: left;
      transition: background 0.1s, color 0.1s;
    }
    .sf-select-option:hover { background: var(--sf-surface); color: var(--sf-text); }
    .sf-select-option.selected { color: var(--sf-primary); }
    .sf-select-option.selected .option-label { font-weight: 600; }

    .option-indicator {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .option-check { font-size: 14px; width: 14px; height: 14px; color: var(--sf-primary); }
    .option-label { font-family: var(--sf-mono); font-size: 0.83rem; }

    /* ── State list ───────────────────────────────────────────────────── */
    .state-list { display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 1rem; }
    .state-row { display: flex; align-items: center; gap: 0.5rem; background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius); padding: 0.375rem 0.5rem; transition: border-color 0.15s; }
    .state-row:hover { border-color: var(--sf-border-soft); }
    .state-row.is-initial { border-color: var(--sf-primary-dim); background: var(--sf-primary-dim); }
    .state-indicator { font-size: 0.7rem; color: var(--sf-text-dim); width: 14px; flex-shrink: 0; }
    .is-initial .state-indicator { color: var(--sf-primary); }
    .state-name-input { flex: 1; background: transparent; border: none; outline: none; font-family: var(--sf-mono); font-size: 0.85rem; color: var(--sf-text); min-width: 0; }
    .is-initial .state-name-input { color: var(--sf-primary); }

    /* ── Add row ──────────────────────────────────────────────────────── */
    .add-row { display: flex; align-items: stretch; gap: 0.375rem; }
    .add-input {
      flex: 1; min-width: 0; height: 38px;
      background: var(--sf-elevated);
      border: 1px solid var(--sf-border);
      border-radius: var(--sf-radius);
      padding: 0 0.75rem;
      font-family: var(--sf-sans); font-size: 0.85rem;
      color: var(--sf-text); outline: none;
      transition: border-color 0.15s, background 0.15s;
    }
    .add-input:focus {
      border-color: var(--sf-primary);
      background: color-mix(in srgb, var(--sf-primary-dim) 50%, var(--sf-elevated));
    }
    .add-input::placeholder { color: var(--sf-text-dim); }
    .add-btn {
      width: 38px; height: 38px; flex-shrink: 0;
      background: var(--sf-elevated);
      border: 1px solid var(--sf-border);
      border-radius: var(--sf-radius);
      color: var(--sf-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      padding: 0;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .add-btn:not(:disabled):hover {
      border-color: var(--sf-primary);
      color: var(--sf-primary);
      background: var(--sf-primary-dim);
    }
    .add-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .add-btn mat-icon { font-size: 18px; width: 18px; height: 18px; pointer-events: none; }
  `],
})
export class StatesPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  newStateName = '';
  dropdownOpen = false;

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
    const transitions = this.definition.transitions.filter((t) => t.from !== removed && t.to !== removed);
    this.patch({ states, transitions });
  }

  patch(partial: Partial<FsmDefinition>): void {
    this.definitionChange.emit({ ...this.definition, ...partial });
  }
}
