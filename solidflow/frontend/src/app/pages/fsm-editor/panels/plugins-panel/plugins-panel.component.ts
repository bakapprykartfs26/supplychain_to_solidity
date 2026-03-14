import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { FsmDefinition, FsmPlugins } from '@solidflow/shared';

interface PluginOption {
  key: keyof FsmPlugins;
  label: string;
  description: string;
}

const PLUGINS: PluginOption[] = [
  { key: 'locking', label: 'Reentrancy Lock', description: 'Adds a noReentrant modifier to all transition functions.' },
  { key: 'accessControl', label: 'Access Control', description: 'Restricts transitions to the contract owner.' },
  { key: 'transitionCounter', label: 'Transition Counter', description: 'Tracks total number of transitions executed.' },
  { key: 'timedTransitions', label: 'Timed Transitions', description: 'Records block.timestamp of each transition.' },
  { key: 'event', label: 'StateChanged Event', description: 'Emits a StateChanged event on every transition.' },
];

@Component({
  selector: 'app-plugins-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel">
      <h3>Plugins</h3>
      <p class="subtitle">Extend generated contract with cross-cutting behaviours.</p>

      @for (plugin of plugins; track plugin.key) {
        <div class="plugin-card" [class.enabled]="isEnabled(plugin.key)">
          <label class="plugin-label">
            <input
              type="checkbox"
              [ngModel]="isEnabled(plugin.key)"
              (ngModelChange)="toggle(plugin.key, $event)"
            />
            <div class="plugin-info">
              <span class="plugin-name">{{ plugin.label }}</span>
              <span class="plugin-desc">{{ plugin.description }}</span>
            </div>
          </label>
        </div>
      }
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    h3 { margin: 0 0 0.25rem; font-size: 1rem; }
    .subtitle { margin: 0 0 1rem; font-size: 0.8rem; color: #666; }
    .plugin-card { border: 1px solid #e0e0e0; border-radius: 4px; padding: 0.75rem; margin-bottom: 0.5rem; transition: border-color 0.15s; }
    .plugin-card.enabled { border-color: #1976d2; background: #e3f2fd; }
    .plugin-label { display: flex; gap: 0.75rem; align-items: flex-start; cursor: pointer; }
    .plugin-label input[type=checkbox] { margin-top: 0.2rem; flex-shrink: 0; }
    .plugin-info { display: flex; flex-direction: column; gap: 0.2rem; }
    .plugin-name { font-weight: 600; font-size: 0.875rem; }
    .plugin-desc { font-size: 0.8rem; color: #555; }
  `],
})
export class PluginsPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  readonly plugins = PLUGINS;

  isEnabled(key: keyof FsmPlugins): boolean {
    return !!(this.definition.plugins?.[key]);
  }

  toggle(key: keyof FsmPlugins, value: boolean): void {
    const plugins: FsmPlugins = { ...(this.definition.plugins ?? {}), [key]: value };
    this.definitionChange.emit({ ...this.definition, plugins });
  }
}
