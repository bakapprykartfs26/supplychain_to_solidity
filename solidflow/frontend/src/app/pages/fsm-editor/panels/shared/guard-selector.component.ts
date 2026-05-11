import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import type {
  FsmGuard, FsmGuardConfig, GuardOperator, FsmPlugins,
  AccessControlGuard, InputValidationGuard,
  PostconditionGuard, ReturnValueGuard,
  TimeLockGuard, CooldownGuard, WindowGuard,
  SourceWhitelistGuard, FreshnessGuard, SanityBoundGuard,
} from '@solidflow/shared';

interface GuardMeta {
  type: FsmGuard['type'];
  label: string;
  category: 'Entry' | 'Exit' | 'Temporal' | 'Oracle';
  icon: string;
  description: string;
}

const GUARD_CATALOG: GuardMeta[] = [
  { type: 'access-control',     category: 'Entry',    icon: 'lock',               label: 'Access Control',       description: 'onlyRole / onlyOwner' },
  { type: 'input-validation',   category: 'Entry',    icon: 'rule',               label: 'Input Validation',     description: 'nonzero, range checks' },
  { type: 'pause',              category: 'Entry',    icon: 'pause_circle',       label: 'Pause Guard',          description: 'whenNotPaused' },
  { type: 'postcondition',      category: 'Exit',     icon: 'verified',           label: 'Postcondition Assert', description: 'invariants after effects' },
  { type: 'return-value',       category: 'Exit',     icon: 'output',             label: 'Return Value Check',   description: 'verify ERC-20 returns' },
  { type: 'timelock',           category: 'Temporal', icon: 'hourglass_top',      label: 'Time-lock',            description: 'min delay before exec' },
  { type: 'cooldown',           category: 'Temporal', icon: 'av_timer',           label: 'Cooldown Guard',       description: 'lastCall + interval' },
  { type: 'window',             category: 'Temporal', icon: 'calendar_today',     label: 'Window Guard',         description: 'valid time range only' },
  { type: 'source-whitelist',   category: 'Oracle',   icon: 'playlist_add_check', label: 'Source Whitelist',     description: 'only trusted oracle addr' },
  { type: 'freshness',          category: 'Oracle',   icon: 'update',             label: 'Freshness Check',      description: 'reject stale data' },
  { type: 'sanity-bound',       category: 'Oracle',   icon: 'straighten',         label: 'Sanity Bound',         description: 'value within plausible range' },
];

const CATEGORY_COLORS: Record<string, string> = {
  Entry:    '#2563eb',
  Exit:     '#059669',
  Temporal: '#b45309',
  Oracle:   '#16a34a',
};

function defaultGuard(type: FsmGuard['type']): FsmGuard {
  switch (type) {
    case 'access-control':     return { type, role: 'owner' } as AccessControlGuard;
    case 'input-validation':   return { type, expression: 'msg.value > 0' } as InputValidationGuard;
    case 'pause':              return { type };
    case 'postcondition':      return { type, expression: '' } as PostconditionGuard;
    case 'return-value':       return { type, expression: '' } as ReturnValueGuard;
    case 'timelock':           return { type, delay: '1 days' } as TimeLockGuard;
    case 'cooldown':           return { type, interval: '1 hours' } as CooldownGuard;
    case 'window':             return { type, start: 'block.timestamp', end: 'block.timestamp + 1 days' } as WindowGuard;
    case 'source-whitelist':   return { type, address: '' } as SourceWhitelistGuard;
    case 'freshness':          return { type, maxAge: '1 hours' } as FreshnessGuard;
    case 'sanity-bound':       return { type, min: '0', max: '1000' } as SanityBoundGuard;
  }
}

@Component({
  selector: 'app-guard-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSelectModule, MatInputModule, MatFormFieldModule, MatTooltipModule],
  template: `
    <div class="guard-root">
      <div class="guard-header">
        <span class="guard-label">GUARD CONDITIONS</span>
      </div>

      <!-- Catalog grid -->
      <div class="catalog">
        @for (cat of categories; track cat) {
          <div class="cat-group">
            <button class="cat-title-btn" (click)="toggleCategory(cat)">
              <span class="cat-title" [style.color]="categoryColor(cat)">{{ cat }}</span>
              <div class="cat-title-right">
                @if (activeCountByCategory(cat) > 0) {
                  <span class="cat-badge" [style.background]="categoryColor(cat)">
                    {{ activeCountByCategory(cat) }}
                  </span>
                }
                <mat-icon class="cat-chevron" [class.rotated]="!isCategoryCollapsed(cat)">
                  chevron_right
                </mat-icon>
              </div>
            </button>
            @if (!isCategoryCollapsed(cat)) {
              <div class="cat-grid">
                @for (g of guardsByCategory(cat); track g.type) {
                  <button
                    class="guard-chip"
                    [style.--chip-color]="categoryColor(cat)"
                    [matTooltip]="g.description"
                    (click)="addGuard(g.type)"
                  >
                    <mat-icon class="chip-icon">{{ g.icon }}</mat-icon>
                    <span class="chip-label">{{ g.label }}</span>
                    <mat-icon class="chip-add">add</mat-icon>
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Active guards config -->
      @if (activeGuards.length) {
        <div class="active-list">
          <div class="active-header">Active Guards</div>
          @for (entry of activeGuards; track $index; let i = $index) {
            <div class="active-item">
              <div class="active-item-header">
                <div class="active-item-title">
                  <mat-icon class="active-icon" [style.color]="categoryColor(categoryOf(entry.guard.type))">
                    {{ iconOf(entry.guard.type) }}
                  </mat-icon>
                  <span>{{ labelOf(entry.guard.type) }}</span>
                </div>
                <div class="active-item-actions">
                  @if (i < activeGuards.length - 1) {
                    <mat-form-field appearance="outline" class="op-select">
                      <mat-select [ngModel]="entry.operator" (ngModelChange)="setOperator(i, $event)">
                        <mat-option value="AND">AND</mat-option>
                        <mat-option value="OR">OR</mat-option>
                      </mat-select>
                    </mat-form-field>
                  }
                  <button mat-icon-button class="remove-guard-btn" (click)="removeGuard(i)">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>
              <div class="active-item-fields">
                @if (entry.guard.type === 'access-control') {
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Role</mat-label>
                    <input matInput class="mono"
                      [ngModel]="asAccessControl(entry.guard).role"
                      (ngModelChange)="patchGuard(i, { role: $event })"
                      placeholder="owner / MINTER_ROLE" />
                  </mat-form-field>
                }
                @if (entry.guard.type === 'input-validation') {
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Expression</mat-label>
                    <input matInput class="mono"
                      [ngModel]="asInputValidation(entry.guard).expression"
                      (ngModelChange)="patchGuard(i, { expression: $event })"
                      placeholder="msg.value > 0" />
                  </mat-form-field>
                }
                @if (entry.guard.type === 'pause') {
                  <p class="no-fields">Adds a per-transition pause check — no config needed.</p>
                }
                @if (entry.guard.type === 'postcondition') {
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Assert Expression</mat-label>
                    <input matInput class="mono"
                      [ngModel]="asPostcondition(entry.guard).expression"
                      (ngModelChange)="patchGuard(i, { expression: $event })"
                      placeholder="balance >= minBalance" />
                  </mat-form-field>
                }
                @if (entry.guard.type === 'return-value') {
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Return Expression</mat-label>
                    <input matInput class="mono"
                      [ngModel]="asReturnValue(entry.guard).expression"
                      (ngModelChange)="patchGuard(i, { expression: $event })"
                      placeholder="token.transfer(to, amount)" />
                  </mat-form-field>
                }
                @if (entry.guard.type === 'timelock') {
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Min Delay</mat-label>
                    <input matInput class="mono"
                      [ngModel]="asTimelock(entry.guard).delay"
                      (ngModelChange)="patchGuard(i, { delay: $event })"
                      placeholder="1 days" />
                  </mat-form-field>
                }
                @if (entry.guard.type === 'cooldown') {
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Cooldown Interval</mat-label>
                    <input matInput class="mono"
                      [ngModel]="asCooldown(entry.guard).interval"
                      (ngModelChange)="patchGuard(i, { interval: $event })"
                      placeholder="1 hours" />
                  </mat-form-field>
                }
                @if (entry.guard.type === 'window') {
                  <div class="two-col">
                    <mat-form-field appearance="fill" class="full-width">
                      <mat-label>Window Start</mat-label>
                      <input matInput class="mono"
                        [ngModel]="asWindow(entry.guard).start"
                        (ngModelChange)="patchGuard(i, { start: $event })"
                        placeholder="block.timestamp" />
                    </mat-form-field>
                    <mat-form-field appearance="fill" class="full-width">
                      <mat-label>Window End</mat-label>
                      <input matInput class="mono"
                        [ngModel]="asWindow(entry.guard).end"
                        (ngModelChange)="patchGuard(i, { end: $event })"
                        placeholder="block.timestamp + 1 days" />
                    </mat-form-field>
                  </div>
                }
                @if (entry.guard.type === 'source-whitelist') {
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Oracle Address</mat-label>
                    <input matInput class="mono"
                      [ngModel]="asSourceWhitelist(entry.guard).address"
                      (ngModelChange)="patchGuard(i, { address: $event })"
                      placeholder="0x..." />
                  </mat-form-field>
                }
                @if (entry.guard.type === 'freshness') {
                  <mat-form-field appearance="fill" class="full-width">
                    <mat-label>Max Age</mat-label>
                    <input matInput class="mono"
                      [ngModel]="asFreshness(entry.guard).maxAge"
                      (ngModelChange)="patchGuard(i, { maxAge: $event })"
                      placeholder="1 hours" />
                  </mat-form-field>
                }
                @if (entry.guard.type === 'sanity-bound') {
                  <div class="two-col">
                    <mat-form-field appearance="fill" class="full-width">
                      <mat-label>Min Value</mat-label>
                      <input matInput class="mono"
                        [ngModel]="asSanityBound(entry.guard).min"
                        (ngModelChange)="patchGuard(i, { min: $event })"
                        placeholder="0" />
                    </mat-form-field>
                    <mat-form-field appearance="fill" class="full-width">
                      <mat-label>Max Value</mat-label>
                      <input matInput class="mono"
                        [ngModel]="asSanityBound(entry.guard).max"
                        (ngModelChange)="patchGuard(i, { max: $event })"
                        placeholder="1000" />
                    </mat-form-field>
                  </div>
                }
                <mat-form-field appearance="fill" class="full-width">
                  <mat-label>Error message</mat-label>
                  <input
                    matInput
                    class="mono"
                    [ngModel]="entry.errorMessage ?? ''"
                    (ngModelChange)="setErrorMessage(i, $event)"
                    placeholder="Guard condition failed"
                  />
                </mat-form-field>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .guard-root { display: flex; flex-direction: column; gap: 0.75rem; }
    .guard-header { display: flex; align-items: center; justify-content: space-between; }
    .guard-label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); }
    .catalog { display: flex; flex-direction: column; gap: 0.375rem; }
    .cat-group { display: flex; flex-direction: column; gap: 0.375rem; }
    .cat-title-btn { display: flex; align-items: center; justify-content: space-between; width: 100%; background: none; border: none; cursor: pointer; padding: 0.375rem 0.5rem; border-radius: 6px; transition: background 0.15s; }
    .cat-title-btn:hover { background: var(--sf-elevated); }
    .cat-title { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .cat-title-right { display: flex; align-items: center; gap: 0.375rem; }
    .cat-badge { font-size: 0.65rem; font-weight: 700; color: white; padding: 0.1rem 0.4rem; border-radius: 10px; line-height: 1.4; }
    .cat-chevron { font-size: 16px; width: 16px; height: 16px; color: var(--sf-text-muted); transition: transform 0.2s; }
    .cat-chevron.rotated { transform: rotate(90deg); }
    .cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; padding: 0 0.25rem; }
    .guard-chip { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.5rem; border-radius: 6px; cursor: pointer; border: 1px solid var(--sf-border); background: var(--sf-elevated); color: var(--sf-text-muted); transition: all 0.15s; text-align: left; }
    .guard-chip:hover { border-color: var(--chip-color); color: var(--chip-color); }
    .guard-chip.active { border-color: var(--chip-color); background: color-mix(in srgb, var(--chip-color) 15%, transparent); color: var(--chip-color); }
    .chip-icon { font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; }
    .chip-label { font-size: 0.72rem; font-weight: 500; flex: 1; line-height: 1.2; }
    .chip-check { font-size: 12px; width: 12px; height: 12px; flex-shrink: 0; }
    .active-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .active-header { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); padding-top: 0.25rem; border-top: 1px solid var(--sf-border); }
    .active-item { border: 1px solid var(--sf-border); border-radius: 8px; overflow: hidden; background: var(--sf-elevated); }
    .active-item-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.625rem; background: var(--sf-surface); }
    .active-item-title { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8rem; font-weight: 600; color: var(--sf-text); }
    .active-icon { font-size: 15px; width: 15px; height: 15px; }
    .active-item-actions { display: flex; align-items: center; gap: 0.25rem; }
    .active-item-fields { padding: 0.5rem 0.625rem; display: flex; flex-direction: column; gap: 0.375rem; }
    .op-select { width: 80px; }
    .op-select ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .op-select ::ng-deep .mat-mdc-text-field-wrapper { padding: 0 8px; }
    .remove-guard-btn { width: 28px; height: 28px; line-height: 28px; color: var(--sf-error) !important; }
    .remove-guard-btn mat-icon { font-size: 16px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .no-fields { font-size: 0.75rem; color: var(--sf-text-muted); margin: 0; font-style: italic; }
    .no-fields code { font-family: var(--sf-mono); color: var(--sf-primary); }
    .mono { font-family: var(--sf-mono) !important; font-size: 0.82rem !important; }
  `],
})
export class GuardSelectorComponent {
  @Input() guardConfig?: FsmGuardConfig;
  @Input() states: string[] = [];
  @Input() enabledPlugins?: FsmPlugins;
  @Output() guardConfigChange = new EventEmitter<FsmGuardConfig | undefined>();

  readonly categories = ['Entry', 'Exit', 'Temporal', 'Oracle'] as const;
  readonly collapsedCategories = new Set<string>(['Entry', 'Exit', 'Temporal', 'Oracle']);

  get activeGuards(): FsmGuardConfig['guards'] {
    return this.guardConfig?.guards ?? [];
  }

  toggleCategory(cat: string): void {
    if (this.collapsedCategories.has(cat)) {
      this.collapsedCategories.delete(cat);
    } else {
      this.collapsedCategories.add(cat);
    }
  }

  isCategoryCollapsed(cat: string): boolean {
    return this.collapsedCategories.has(cat);
  }

  activeCountByCategory(cat: string): number {
    return this.activeGuards.filter((entry) =>
      this.categoryOf(entry.guard.type) === cat
    ).length;
  }

  guardsByCategory(cat: string): GuardMeta[] {
    return GUARD_CATALOG.filter((g) => {
      if (g.category !== cat) return false;
      if (g.type === 'pause' && !this.enabledPlugins?.transitionPause) return false;
      return true;
    });
  }

  categoryColor(cat: string): string {
    return CATEGORY_COLORS[cat] ?? '#888';
  }

  categoryOf(type: FsmGuard['type']): string {
    return GUARD_CATALOG.find((g) => g.type === type)?.category ?? '';
  }

  iconOf(type: FsmGuard['type']): string {
    return GUARD_CATALOG.find((g) => g.type === type)?.icon ?? 'shield';
  }

  labelOf(type: FsmGuard['type']): string {
    return GUARD_CATALOG.find((g) => g.type === type)?.label ?? type;
  }

  isAdded(type: FsmGuard['type']): boolean {
    return this.activeGuards.some((e) => e.guard.type === type);
  }

  addGuard(type: FsmGuard['type']): void {
    if (type === 'pause' && !this.enabledPlugins?.transitionPause) {
      return;
    }

    const guards: FsmGuardConfig['guards'] = [
      ...this.activeGuards,
      {
        guard: defaultGuard(type),
        operator: 'AND',
        errorMessage: '',
      },
    ];

    this.emit(guards);
  }

  setOperator(index: number, operator: GuardOperator): void {
    const guards = this.activeGuards.map((e, i) => i === index ? { ...e, operator } : e);
    this.emit(guards);
  }

  setErrorMessage(index: number, errorMessage: string): void {
    const guards = this.activeGuards.map((e, i) =>
      i === index ? { ...e, errorMessage } : e
    );
    this.emit(guards);
  }

  removeGuard(index: number): void {
    const guards = this.activeGuards.filter((_, i) => i !== index);
    this.emit(guards);
  }

  patchGuard(index: number, patch: Partial<FsmGuard>): void {
    const guards = this.activeGuards.map((e, i) =>
      i === index ? { ...e, guard: { ...e.guard, ...patch } as FsmGuard } : e
    );
    this.emit(guards);
  }

  private emit(guards: FsmGuardConfig['guards']): void {
    this.guardConfigChange.emit(guards.length ? { guards } : undefined);
  }

  asAccessControl(g: FsmGuard)     { return g as AccessControlGuard; }
  asInputValidation(g: FsmGuard)   { return g as InputValidationGuard; }
  asPostcondition(g: FsmGuard)     { return g as PostconditionGuard; }
  asReturnValue(g: FsmGuard)       { return g as ReturnValueGuard; }
  asTimelock(g: FsmGuard)          { return g as TimeLockGuard; }
  asCooldown(g: FsmGuard)          { return g as CooldownGuard; }
  asWindow(g: FsmGuard)            { return g as WindowGuard; }
  asSourceWhitelist(g: FsmGuard)   { return g as SourceWhitelistGuard; }
  asFreshness(g: FsmGuard)         { return g as FreshnessGuard; }
  asSanityBound(g: FsmGuard)       { return g as SanityBoundGuard; }
}