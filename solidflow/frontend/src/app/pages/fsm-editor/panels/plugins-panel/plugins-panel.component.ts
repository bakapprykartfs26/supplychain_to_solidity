import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import type { FsmDefinition, FsmPlugins } from '@solidflow/shared';

interface PluginOption {
  key: keyof FsmPlugins;
  label: string;
  description: string;
  icon: string;
}

const PLUGINS: PluginOption[] = [
  { key: 'locking',           label: 'Reentrancy Lock',     description: 'Adds a noReentrant modifier to all transition functions.',  icon: 'lock' },
  { key: 'accessControl',     label: 'Access Control',      description: 'Restricts transitions to the contract owner.',              icon: 'admin_panel_settings' },
  { key: 'transitionCounter', label: 'Transition Counter',  description: 'Tracks total number of transitions executed.',              icon: 'tag' },
  { key: 'timedTransitions',  label: 'Timed Transitions',   description: 'Records block.timestamp of each transition.',              icon: 'schedule' },
  { key: 'event',             label: 'StateChanged Event',  description: 'Emits a StateChanged event on every transition.',           icon: 'bolt' },
];

@Component({
  selector: 'app-plugins-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSlideToggleModule, MatIconModule],
  template: `
    <div class="panel">
      <div class="section-header">
        <mat-icon class="section-icon">bolt</mat-icon>
        <span class="section-title">Plugins</span>
        <span class="count">{{ enabledCount }} / {{ plugins.length }}</span>
      </div>
      <p class="subtitle">Extend your contract with cross-cutting behaviours.</p>

      @for (plugin of plugins; track plugin.key) {
        <div class="plugin-card" [class.enabled]="isEnabled(plugin.key)">
          <div class="plugin-left">
            <div class="plugin-icon-wrap" [class.active]="isEnabled(plugin.key)">
              <mat-icon class="plugin-icon">{{ plugin.icon }}</mat-icon>
            </div>
            <div class="plugin-info">
              <span class="plugin-name">{{ plugin.label }}</span>
              <span class="plugin-desc">{{ plugin.description }}</span>
            </div>
          </div>
          <mat-slide-toggle
            color="primary"
            [ngModel]="isEnabled(plugin.key)"
            (ngModelChange)="toggle(plugin.key, $event)"
          />
        </div>
      }
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    .section-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
    .section-icon { color: var(--sf-amber); font-size: 18px; width: 18px; height: 18px; }
    .section-title { font-family: var(--sf-brand); font-size: 0.85rem; font-weight: 700; color: var(--sf-text); letter-spacing: 0.05em; text-transform: uppercase; flex: 1; }
    .count { font-family: var(--sf-mono); font-size: 0.72rem; color: var(--sf-text-muted); background: var(--sf-border); padding: 0.1rem 0.5rem; border-radius: 10px; }
    .subtitle { font-size: 0.8rem; color: var(--sf-text-muted); margin: 0 0 1rem; }
    .plugin-card { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius); padding: 0.875rem; margin-bottom: 0.5rem; transition: border-color 0.2s, background 0.2s; }
    .plugin-card.enabled { border-color: var(--sf-primary-dim); background: color-mix(in srgb, var(--sf-primary-dim) 30%, var(--sf-elevated)); }
    .plugin-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
    .plugin-icon-wrap { width: 36px; height: 36px; border-radius: 8px; background: var(--sf-surface); border: 1px solid var(--sf-border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s, border-color 0.2s; }
    .plugin-icon-wrap.active { background: var(--sf-primary-dim); border-color: var(--sf-primary); }
    .plugin-icon { font-size: 18px; width: 18px; height: 18px; color: var(--sf-text-muted); }
    .active .plugin-icon { color: var(--sf-primary); }
    .plugin-info { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .plugin-name { font-family: var(--sf-sans); font-weight: 600; font-size: 0.875rem; color: var(--sf-text); }
    .plugin-desc { font-size: 0.75rem; color: var(--sf-text-muted); line-height: 1.4; }
  `],
})
export class PluginsPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  readonly plugins = PLUGINS;

  get enabledCount(): number {
    return PLUGINS.filter((p) => this.isEnabled(p.key)).length;
  }

  isEnabled(key: keyof FsmPlugins): boolean {
    return !!(this.definition.plugins?.[key]);
  }

  toggle(key: keyof FsmPlugins, value: boolean): void {
    const plugins: FsmPlugins = { ...(this.definition.plugins ?? {}), [key]: value };
    this.definitionChange.emit({ ...this.definition, plugins });
  }
}
