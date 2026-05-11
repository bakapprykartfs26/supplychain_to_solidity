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

      @if (pendingStateDelete; as pending) {
        <div class="dialog-backdrop" (click)="cancelDeleteState()">
          <div class="dialog dialog--danger" (click)="$event.stopPropagation()">
            <div class="dialog-header">
              <span class="dialog-title">Delete state?</span>
              <button class="dialog-close" (click)="cancelDeleteState()">✕</button>
            </div>

            <div class="dialog-body">
              <p class="dialog-text">
                State <strong>{{ pending.state }}</strong> has
                <strong>{{ pending.transitionCount }}</strong> connected transition(s).
                Deleting it will also delete those transitions.
              </p>

              <label class="confirm-label">Type DELETE to confirm</label>
              <input
                class="confirm-input"
                [value]="deleteConfirmation"
                (input)="deleteConfirmation = $any($event.target).value"
                spellcheck="false"
                autofocus
              />
            </div>

            <div class="dialog-footer">
              <button class="dialog-btn-cancel" (click)="cancelDeleteState()">Cancel</button>
              <button
                class="dialog-btn-delete"
                [disabled]="deleteConfirmation !== 'DELETE'"
                (click)="confirmDeleteState()"
              >
                Delete state
              </button>
            </div>
          </div>
        </div>
      }
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

    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dialog {
      background: var(--sf-surface);
      border: 1px solid var(--sf-border);
      border-radius: 14px;
      width: 420px;
      max-width: calc(100vw - 2rem);
      box-shadow: 0 24px 64px rgba(0,0,0,0.35);
      overflow: hidden;
    }

    .dialog-header,
    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--sf-border);
    }

    .dialog-footer {
      justify-content: flex-end;
      gap: 0.6rem;
      border-top: 1px solid var(--sf-border);
      border-bottom: none;
      background: var(--sf-bg);
    }

    .dialog-title {
      font-weight: 700;
      color: var(--sf-text);
    }

    .dialog-close {
      background: transparent;
      border: none;
      color: var(--sf-text-muted);
      cursor: pointer;
    }

    .dialog-body {
      padding: 1rem 1.25rem;
    }

    .dialog-text {
      color: var(--sf-text-muted);
      line-height: 1.6;
      margin: 0 0 1rem;
    }

    .dialog-text strong {
      color: var(--sf-text);
    }

    .confirm-label {
      display: block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--sf-text-muted);
      margin-bottom: 0.4rem;
    }

    .confirm-input {
      width: 100%;
      background: var(--sf-elevated);
      border: 1px solid var(--sf-border);
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      color: var(--sf-text);
      font-family: var(--sf-mono);
      outline: none;
    }

    .confirm-input:focus {
      border-color: #ef4444;
    }

    .dialog-btn-cancel,
    .dialog-btn-delete {
      padding: 0.45rem 1rem;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
    }

    .dialog-btn-cancel {
      background: transparent;
      border: 1.5px solid var(--sf-border);
      color: var(--sf-text-muted);
    }

    .dialog-btn-delete {
      background: #ef4444;
      border: none;
      color: white;
    }

    .dialog-btn-delete:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `],
})
export class StatesPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  pendingStateDelete: {
    index: number;
    state: string;
    transitionCount: number;
  } | null = null;

  deleteConfirmation = '';

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
    const state = this.definition.states[index];

    const transitionCount = this.definition.transitions.filter(
      (t) => t.from === state || t.to === state
    ).length;

    if (transitionCount > 0) {
      this.pendingStateDelete = { index, state, transitionCount };
      this.deleteConfirmation = '';
      return;
    }

    this.deleteState(index);
  }

  cancelDeleteState(): void {
    this.pendingStateDelete = null;
    this.deleteConfirmation = '';
  }

  confirmDeleteState(): void {
    if (!this.pendingStateDelete || this.deleteConfirmation !== 'DELETE') return;

    this.deleteState(this.pendingStateDelete.index);
    this.cancelDeleteState();
  }

  private deleteState(index: number): void {
    const removed = this.definition.states[index];

    this.patch({
      states: this.definition.states.filter((_, i) => i !== index),
      transitions: this.definition.transitions.filter(
        (t) => t.from !== removed && t.to !== removed
      ),
    });
  }

  patch(partial: Partial<FsmDefinition>): void {
    this.definitionChange.emit({ ...this.definition, ...partial });
  }
}
