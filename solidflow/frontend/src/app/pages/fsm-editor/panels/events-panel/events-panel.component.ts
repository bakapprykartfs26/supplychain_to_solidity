import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import type { FsmDefinition, FsmEvent, FsmEventParam } from '@solidflow/shared';

@Component({
  selector: 'app-events-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatExpansionModule, MatCheckboxModule],
  template: `
    <div class="panel">
      <div class="section-header">
        <mat-icon class="section-icon">bolt</mat-icon>
        <span class="section-title">Events</span>
        <span class="count">{{ (definition.events ?? []).length }}</span>
      </div>

      @if ((definition.events ?? []).length === 0) {
        <p class="empty-hint">No events defined. Add one below.</p>
      }

      <mat-accordion>
        @for (ev of definition.events ?? []; track i; let i = $index) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <span class="ev-name">event {{ ev.name }}</span>
                <span class="ev-meta">{{ ev.params.length }} params</span>
              </mat-panel-title>
            </mat-expansion-panel-header>

            <div class="ev-body">
              <mat-form-field appearance="fill" class="full-width">
                <mat-label>Event name</mat-label>
                <input matInput [ngModel]="ev.name" (ngModelChange)="patchEvent(i, { name: $event })" spellcheck="false" class="mono" />
              </mat-form-field>

              <div class="params-header">
                <span class="params-label">Parameters</span>
              </div>

              @for (p of ev.params; track pi; let pi = $index) {
                <div class="param-row">
                  <mat-form-field appearance="fill" class="param-type">
                    <mat-label>Type</mat-label>
                    <input matInput [ngModel]="p.type" (ngModelChange)="patchParam(i, pi, { type: $event })" spellcheck="false" class="mono" placeholder="uint256" />
                  </mat-form-field>
                  <mat-form-field appearance="fill" class="param-name">
                    <mat-label>Name</mat-label>
                    <input matInput [ngModel]="p.name" (ngModelChange)="patchParam(i, pi, { name: $event })" spellcheck="false" class="mono" />
                  </mat-form-field>
                  <mat-checkbox
                    class="indexed-check"
                    [ngModel]="p.indexed ?? false"
                    (ngModelChange)="patchParam(i, pi, { indexed: $event })"
                    color="primary"
                  >indexed</mat-checkbox>
                  <button mat-icon-button class="sf-icon-btn-danger" (click)="removeParam(i, pi)" title="Remove parameter">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              }

              <div class="ev-actions">
                <button mat-button class="add-param-btn" (click)="addParam(i)">
                  <mat-icon>add</mat-icon> Add parameter
                </button>
                <button mat-button class="rm-event-btn" (click)="removeEvent(i)">
                  <mat-icon>delete_outline</mat-icon> Remove event
                </button>
              </div>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>

      <button mat-stroked-button class="add-btn" (click)="addEvent()">
        <mat-icon>add</mat-icon>
        Add Event
      </button>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    .section-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .section-icon { color: var(--sf-primary); font-size: 18px; width: 18px; height: 18px; }
    .section-title { font-family: var(--sf-brand); font-size: 0.85rem; font-weight: 700; color: var(--sf-text); letter-spacing: 0.05em; text-transform: uppercase; flex: 1; }
    .count { font-family: var(--sf-mono); font-size: 0.72rem; color: var(--sf-text-muted); background: var(--sf-border); padding: 0.1rem 0.5rem; border-radius: 10px; }
    .empty-hint { font-size: 0.8rem; color: var(--sf-text-muted); text-align: center; padding: 1rem 0; margin: 0 0 0.5rem; }
    .ev-name { font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text); font-weight: 500; }
    .ev-meta { font-size: 0.75rem; color: var(--sf-text-muted); margin-left: 0.5rem; }
    .ev-body { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.25rem; }
    .full-width { width: 100%; }
    .mono { font-family: var(--sf-mono) !important; font-size: 0.82rem !important; }
    .params-header { display: flex; align-items: center; margin-top: 0.25rem; }
    .params-label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); }
    .param-row { display: flex; gap: 0.5rem; align-items: center; }
    .param-type { flex: 0 0 110px; }
    .param-name { flex: 1; }
    .indexed-check { flex-shrink: 0; font-size: 0.75rem; white-space: nowrap; }
    .ev-actions { display: flex; justify-content: space-between; margin-top: 0.25rem; }
    .add-param-btn { color: var(--sf-primary) !important; font-size: 0.8rem; }
    .rm-event-btn { color: var(--sf-error) !important; font-size: 0.8rem; }
    .add-btn { width: 100%; margin-top: 0.5rem; border-color: var(--sf-border) !important; color: var(--sf-text-muted) !important; border-style: dashed !important; }
    .add-btn:hover { border-color: var(--sf-primary) !important; color: var(--sf-primary) !important; }
  `],
})
export class EventsPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  addEvent(): void {
    const n = (this.definition.events ?? []).length + 1;
    const ev: FsmEvent = { name: `Event${n}`, params: [] };
    this.definitionChange.emit({ ...this.definition, events: [...(this.definition.events ?? []), ev] });
  }

  patchEvent(i: number, partial: Partial<FsmEvent>): void {
    const events = (this.definition.events ?? []).map((ev, idx) => idx === i ? { ...ev, ...partial } : ev);
    this.definitionChange.emit({ ...this.definition, events });
  }

  removeEvent(i: number): void {
    const removed = (this.definition.events ?? [])[i]?.name;
    const events = (this.definition.events ?? []).filter((_, idx) => idx !== i);
    const transitions = this.definition.transitions.map((t) =>
      t.emitEvent === removed ? { ...t, emitEvent: undefined, emitEventArgs: undefined } : t
    );
    this.definitionChange.emit({ ...this.definition, events, transitions });
  }

  addParam(ei: number): void {
    const events = (this.definition.events ?? []).map((ev, i) => {
      if (i !== ei) return ev;
      const n = ev.params.length + 1;
      return { ...ev, params: [...ev.params, { name: `param${n}`, type: 'uint256' } as FsmEventParam] };
    });
    this.definitionChange.emit({ ...this.definition, events });
  }

  patchParam(ei: number, pi: number, partial: Partial<FsmEventParam>): void {
    const events = (this.definition.events ?? []).map((ev, i) =>
      i !== ei ? ev : { ...ev, params: ev.params.map((p, j) => j === pi ? { ...p, ...partial } : p) }
    );
    this.definitionChange.emit({ ...this.definition, events });
  }

  removeParam(ei: number, pi: number): void {
    const events = (this.definition.events ?? []).map((ev, i) =>
      i !== ei ? ev : { ...ev, params: ev.params.filter((_, j) => j !== pi) }
    );
    this.definitionChange.emit({ ...this.definition, events });
  }
}
