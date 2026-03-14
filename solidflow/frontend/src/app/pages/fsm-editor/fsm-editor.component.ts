import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import type { FsmDefinition } from '@solidflow/shared';
import { FsmApiService } from '../../core/services/fsm-api.service';
import { FsmCanvasComponent } from './canvas/fsm-canvas.component';
import { StatesPanelComponent } from './panels/states-panel/states-panel.component';
import { TransitionsPanelComponent } from './panels/transitions-panel/transitions-panel.component';
import { VariablesPanelComponent } from './panels/variables-panel/variables-panel.component';
import { PluginsPanelComponent } from './panels/plugins-panel/plugins-panel.component';
import { SolidityPreviewComponent } from './panels/solidity-preview/solidity-preview.component';

const BLANK_DEFINITION: FsmDefinition = {
  name: 'MyContract',
  states: ['Idle', 'Active', 'Done'],
  initialState: 'Idle',
  transitions: [],
};

type Tab = 'states' | 'transitions' | 'variables' | 'plugins';

@Component({
  selector: 'app-fsm-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FsmCanvasComponent,
    StatesPanelComponent,
    TransitionsPanelComponent,
    VariablesPanelComponent,
    PluginsPanelComponent,
    SolidityPreviewComponent,
  ],
  template: `
    <div class="editor-layout">
      <!-- Top bar -->
      <div class="topbar">
        <a routerLink="/" class="back-link">← Back</a>
        <input
          class="name-input"
          [ngModel]="definition().name"
          (ngModelChange)="patchDefinition({ name: $event })"
          placeholder="Contract name"
        />
        <div class="topbar-actions">
          @if (saving()) { <span class="status">Saving…</span> }
          @else if (saved()) { <span class="status ok">Saved</span> }
          <button class="btn-primary" (click)="save()">Save</button>
        </div>
      </div>

      <div class="main-area">
        <!-- Canvas -->
        <div class="canvas-area">
          <app-fsm-canvas
            [definition]="definition()"
            (definitionChange)="onCanvasChange($event)"
          />
        </div>

        <!-- Right panels -->
        <div class="right-panel">
          <div class="tabs">
            @for (tab of tabs; track tab.id) {
              <button
                class="tab-btn"
                [class.active]="activeTab() === tab.id"
                (click)="activeTab.set(tab.id)"
              >{{ tab.label }}</button>
            }
          </div>

          <div class="tab-content">
            @switch (activeTab()) {
              @case ('states') {
                <app-states-panel
                  [definition]="definition()"
                  (definitionChange)="patchDefinition($event)"
                />
              }
              @case ('transitions') {
                <app-transitions-panel
                  [definition]="definition()"
                  (definitionChange)="patchDefinition($event)"
                />
              }
              @case ('variables') {
                <app-variables-panel
                  [definition]="definition()"
                  (definitionChange)="patchDefinition($event)"
                />
              }
              @case ('plugins') {
                <app-plugins-panel
                  [definition]="definition()"
                  (definitionChange)="patchDefinition($event)"
                />
              }
            }
          </div>

          <!-- Solidity preview -->
          <div class="solidity-pane" [class.collapsed]="previewCollapsed()">
            <div class="pane-header" (click)="togglePreview()">
              <span>Solidity Preview</span>
              <span>{{ previewCollapsed() ? '▲' : '▼' }}</span>
            </div>
            @if (!previewCollapsed()) {
              <app-solidity-preview [definition]="definition()" />
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; overflow: hidden; }
    .editor-layout { display: flex; flex-direction: column; height: 100%; }
    .topbar { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem; border-bottom: 1px solid #e0e0e0; background: white; flex-shrink: 0; }
    .back-link { color: #1976d2; text-decoration: none; font-size: 0.875rem; white-space: nowrap; }
    .name-input { flex: 1; font-size: 1rem; font-weight: 600; border: 1px solid transparent; border-radius: 3px; padding: 0.25rem 0.5rem; }
    .name-input:focus { border-color: #1976d2; outline: none; }
    .topbar-actions { display: flex; align-items: center; gap: 0.75rem; }
    .status { font-size: 0.8rem; color: #666; }
    .status.ok { color: #2e7d32; }
    .btn-primary { background: #1976d2; color: white; border: none; padding: 0.5rem 1.25rem; border-radius: 4px; cursor: pointer; font-size: 0.875rem; }
    .main-area { display: flex; flex: 1; overflow: hidden; }
    .canvas-area { flex: 1; overflow: hidden; }
    .right-panel { width: 340px; flex-shrink: 0; border-left: 1px solid #e0e0e0; display: flex; flex-direction: column; background: white; overflow: hidden; }
    .tabs { display: flex; border-bottom: 1px solid #e0e0e0; flex-shrink: 0; }
    .tab-btn { flex: 1; padding: 0.625rem 0.25rem; border: none; background: none; cursor: pointer; font-size: 0.8rem; color: #666; border-bottom: 2px solid transparent; }
    .tab-btn.active { color: #1976d2; border-bottom-color: #1976d2; font-weight: 600; }
    .tab-content { flex: 1; overflow-y: auto; }
    .solidity-pane { flex-shrink: 0; border-top: 1px solid #e0e0e0; display: flex; flex-direction: column; max-height: 40%; }
    .solidity-pane.collapsed { max-height: none; }
    .pane-header { display: flex; justify-content: space-between; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.8rem; font-weight: 600; background: #f5f5f5; flex-shrink: 0; }
    .pane-header:hover { background: #eeeeee; }
    app-solidity-preview { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 200px; }
  `],
})
export class FsmEditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FsmApiService);
  private readonly destroy$ = new Subject<void>();
  private readonly autosave$ = new Subject<FsmDefinition>();

  readonly definition = signal<FsmDefinition>({ ...BLANK_DEFINITION });
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly activeTab = signal<Tab>('states');
  readonly previewCollapsed = signal(false);
  readonly isNew = computed(() => !this.definition().id);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'states', label: 'States' },
    { id: 'transitions', label: 'Transitions' },
    { id: 'variables', label: 'Variables' },
    { id: 'plugins', label: 'Plugins' },
  ];

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['fsm'] as FsmDefinition | undefined;
    if (resolved) {
      this.definition.set(resolved);
    }

    this.autosave$
      .pipe(debounceTime(3000), takeUntil(this.destroy$))
      .subscribe((def) => {
        if (def.id) this.doUpdate(def);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  patchDefinition(partial: Partial<FsmDefinition> | FsmDefinition): void {
    const isFullDef = 'states' in partial && 'transitions' in partial;
    const updated = isFullDef
      ? ({ ...this.definition(), ...(partial as FsmDefinition) } as FsmDefinition)
      : { ...this.definition(), ...partial };
    this.definition.set(updated);
    this.autosave$.next(updated);
  }

  onCanvasChange(updated: FsmDefinition): void {
    this.definition.set(updated);
    this.autosave$.next(updated);
  }

  save(): void {
    const def = this.definition();
    if (this.isNew()) {
      this.doCreate(def);
    } else {
      this.doUpdate(def);
    }
  }

  private doCreate(def: FsmDefinition): void {
    this.saving.set(true);
    this.api.create(def).subscribe({
      next: (created) => {
        this.definition.set(created);
        this.saving.set(false);
        this.flashSaved();
        this.router.navigate(['/editor', created.id], { replaceUrl: true });
      },
      error: () => this.saving.set(false),
    });
  }

  private doUpdate(def: FsmDefinition): void {
    this.saving.set(true);
    this.api.update(def.id!, def).subscribe({
      next: (updated) => {
        this.definition.set(updated);
        this.saving.set(false);
        this.flashSaved();
      },
      error: () => this.saving.set(false),
    });
  }

  togglePreview(): void {
    this.previewCollapsed.update((v) => !v);
  }

  private flashSaved(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
