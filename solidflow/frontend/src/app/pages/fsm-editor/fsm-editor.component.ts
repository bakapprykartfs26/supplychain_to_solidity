import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { FsmDefinition } from '@solidflow/shared';
import { FsmApiService } from '../../core/services/fsm-api.service';
import { FsmCanvasComponent } from './canvas/fsm-canvas.component';
import { StatesPanelComponent } from './panels/states-panel/states-panel.component';
import { TransitionsPanelComponent } from './panels/transitions-panel/transitions-panel.component';
import { VariablesPanelComponent } from './panels/variables-panel/variables-panel.component';
import { PluginsPanelComponent } from './panels/plugins-panel/plugins-panel.component';
import { EventsPanelComponent } from './panels/events-panel/events-panel.component';
import { SolidityPreviewComponent } from './panels/solidity-preview/solidity-preview.component';

const PANEL_WIDTH_KEY = 'sf-panel-width';
const PANEL_MIN = 240;
const PANEL_MAX = 720;
const PANEL_DEFAULT = 340;

const BLANK_DEFINITION: FsmDefinition = {
  name: 'MyContract',
  states: ['Idle', 'Active', 'Done'],
  initialState: 'Idle',
  transitions: [],
};

@Component({
  selector: 'app-fsm-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatTabsModule, MatProgressBarModule,
    FsmCanvasComponent, StatesPanelComponent, TransitionsPanelComponent,
    VariablesPanelComponent, PluginsPanelComponent, EventsPanelComponent, SolidityPreviewComponent,
  ],
  template: `
    <div class="editor-shell">
      <!-- Topbar -->
      <mat-toolbar class="topbar">
        <a routerLink="/" class="back-link" title="Back to list">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <span class="brand-sep">|</span>
        <input
          class="name-input"
          [ngModel]="definition().name"
          (ngModelChange)="patchDefinition({ name: $event })"
          placeholder="Contract name"
          spellcheck="false"
        />
        <span class="spacer"></span>
        <div class="status-area">
          @if (saving()) {
            <span class="status-saving">
              <mat-icon class="spin">autorenew</mat-icon>
              Saving
            </span>
          } @else if (saved()) {
            <span class="status-saved">
              <mat-icon>check_circle</mat-icon>
              Saved
            </span>
          }
        </div>
        <button mat-flat-button color="primary" (click)="save()" class="save-btn">
          <mat-icon>save</mat-icon>
          Save
        </button>
      </mat-toolbar>

      @if (saving()) {
        <mat-progress-bar mode="indeterminate" class="save-bar" />
      }

      <div class="main-area" [class.resizing]="isResizing">
        <!-- Canvas -->
        <div class="canvas-area">
          <app-fsm-canvas
            [definition]="definition()"
            (definitionChange)="onCanvasChange($event)"
          />
        </div>

        <!-- Resize handle -->
        <div
          class="resize-handle"
          [class.active]="isResizing"
          (mousedown)="onResizeStart($event)"
          title="Drag to resize panel"
        >
          <div class="handle-track">
            <div class="handle-grip"></div>
          </div>
        </div>

        <!-- Right panel -->
        <div class="right-panel" [style.width.px]="panelWidth()">
          <mat-tab-group class="panel-tabs" animationDuration="150ms">
            <mat-tab label="States">
              <div class="tab-scroll">
                <app-states-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              </div>
            </mat-tab>
            <mat-tab label="Transitions">
              <div class="tab-scroll">
                <app-transitions-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              </div>
            </mat-tab>
            <mat-tab label="Variables">
              <div class="tab-scroll">
                <app-variables-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              </div>
            </mat-tab>
            <mat-tab label="Events">
              <div class="tab-scroll">
                <app-events-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              </div>
            </mat-tab>
            <mat-tab label="Plugins">
              <div class="tab-scroll">
                <app-plugins-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              </div>
            </mat-tab>
          </mat-tab-group>

          <!-- Solidity preview drawer -->
          <div class="preview-drawer" [class.collapsed]="previewCollapsed()">
            <button class="drawer-toggle" (click)="togglePreview()">
              <span class="drawer-label">
                <mat-icon class="drawer-icon">code</mat-icon>
                Solidity Preview
              </span>
              <mat-icon>{{ previewCollapsed() ? 'expand_less' : 'expand_more' }}</mat-icon>
            </button>
            @if (!previewCollapsed()) {
              <app-solidity-preview [definition]="definition()" />
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; overflow: hidden; background: var(--sf-bg); }
    .editor-shell { display: flex; flex-direction: column; height: 100%; }

    .topbar { height: 52px; padding: 0 1rem; gap: 0.75rem; flex-shrink: 0; }
    .back-link { color: var(--sf-text-muted); display: flex; align-items: center; text-decoration: none; transition: color 0.15s; }
    .back-link:hover { color: var(--sf-primary); }
    .brand-sep { color: var(--sf-border); font-size: 1.25rem; font-weight: 100; }
    .name-input { flex: 1; background: transparent; border: none; outline: none; font-family: var(--sf-brand); font-size: 1rem; font-weight: 700; color: var(--sf-text); letter-spacing: -0.01em; min-width: 0; }
    .name-input::placeholder { color: var(--sf-text-dim); }
    .spacer { flex: 1; }
    .status-area { display: flex; align-items: center; min-width: 100px; justify-content: flex-end; }
    .status-saving, .status-saved { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8rem; }
    .status-saving { color: var(--sf-text-muted); }
    .status-saved { color: var(--sf-success); }
    .status-saving mat-icon, .status-saved mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .save-btn { border-radius: 6px !important; font-family: var(--sf-sans) !important; font-weight: 600 !important; }
    .save-bar { position: absolute; top: 52px; left: 0; right: 0; z-index: 5; }

    /* ── Layout ─────────────────────────────────────────────────────────── */
    .main-area { display: flex; flex: 1; overflow: hidden; }
    .main-area.resizing { cursor: col-resize; user-select: none; }
    .main-area.resizing .canvas-area { pointer-events: none; }

    .canvas-area { flex: 1; overflow: hidden; background: var(--sf-bg); min-width: 0; }

    /* ── Resize handle ──────────────────────────────────────────────────── */
    .resize-handle {
      width: 8px;
      flex-shrink: 0;
      cursor: col-resize;
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .handle-track {
      width: 2px;
      height: 100%;
      background: var(--sf-border);
      transition: background 0.15s, box-shadow 0.15s, width 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
    }
    .handle-grip {
      width: 4px;
      height: 32px;
      border-radius: 4px;
      background: var(--sf-border);
      transition: background 0.15s, box-shadow 0.15s;
      position: relative;
    }
    .handle-grip::before,
    .handle-grip::after {
      content: '';
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 2px;
      height: 2px;
      border-radius: 50%;
      background: var(--sf-text-dim);
    }
    .handle-grip::before { top: 8px; box-shadow: 0 6px 0 var(--sf-text-dim), 0 12px 0 var(--sf-text-dim); }
    .handle-grip::after  { display: none; }

    .resize-handle:hover .handle-track,
    .resize-handle.active .handle-track {
      width: 2px;
      background: var(--sf-primary);
      box-shadow: 0 0 8px var(--sf-primary);
    }
    .resize-handle:hover .handle-grip,
    .resize-handle.active .handle-grip {
      background: var(--sf-primary);
      box-shadow: 0 0 6px var(--sf-primary);
    }
    .resize-handle:hover .handle-grip::before,
    .resize-handle.active .handle-grip::before {
      background: var(--sf-primary);
      box-shadow: 0 6px 0 var(--sf-primary), 0 12px 0 var(--sf-primary);
    }

    /* ── Right panel ────────────────────────────────────────────────────── */
    .right-panel { flex-shrink: 0; display: flex; flex-direction: column; background: var(--sf-surface); overflow: hidden; min-width: ${PANEL_MIN}px; max-width: ${PANEL_MAX}px; }

    .panel-tabs { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
    ::ng-deep .panel-tabs .mat-mdc-tab-body-wrapper { flex: 1; overflow: hidden; }
    ::ng-deep .panel-tabs .mat-mdc-tab-body { height: 100%; }
    ::ng-deep .panel-tabs .mat-mdc-tab-body-content { height: 100%; overflow: hidden; }
    .tab-scroll { height: 100%; overflow-y: auto; }

    .preview-drawer { flex-shrink: 0; border-top: 1px solid var(--sf-border); display: flex; flex-direction: column; max-height: 45%; }
    .preview-drawer.collapsed { max-height: 44px; }
    .drawer-toggle { display: flex; justify-content: space-between; align-items: center; padding: 0.625rem 1rem; background: var(--sf-elevated); border: none; cursor: pointer; color: var(--sf-text-muted); width: 100%; flex-shrink: 0; transition: background 0.15s; }
    .drawer-toggle:hover { background: var(--sf-border-soft); }
    .drawer-label { display: flex; align-items: center; gap: 0.5rem; font-family: var(--sf-sans); font-size: 0.8rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .drawer-icon { font-size: 16px; width: 16px; height: 16px; color: var(--sf-primary); }
    app-solidity-preview { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 220px; }
  `],
})
export class FsmEditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FsmApiService);
  private readonly doc = inject(DOCUMENT);
  private readonly destroy$ = new Subject<void>();
  private readonly autosave$ = new Subject<FsmDefinition>();

  readonly definition = signal<FsmDefinition>({ ...BLANK_DEFINITION });
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly previewCollapsed = signal(false);
  readonly isNew = computed(() => !this.definition().id);

  readonly panelWidth = signal(PANEL_DEFAULT);
  isResizing = false;

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['fsm'] as FsmDefinition | undefined;
    if (resolved) this.definition.set(resolved);

    // Restore saved panel width
    try {
      const saved = localStorage.getItem(PANEL_WIDTH_KEY);
      if (saved) this.panelWidth.set(Math.max(PANEL_MIN, Math.min(PANEL_MAX, parseInt(saved, 10))));
    } catch { /* localStorage unavailable in SSR */ }

    this.autosave$
      .pipe(debounceTime(3000), takeUntil(this.destroy$))
      .subscribe((def) => { if (def.id) this.doUpdate(def); });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  onResizeStart(e: MouseEvent): void {
    e.preventDefault();
    this.isResizing = true;

    const startX = e.clientX;
    const startWidth = this.panelWidth();

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX; // moving left = larger panel
      this.panelWidth.set(Math.max(PANEL_MIN, Math.min(PANEL_MAX, startWidth + delta)));
    };

    const onUp = () => {
      this.isResizing = false;
      this.doc.body.style.cursor = '';
      this.doc.body.style.userSelect = '';
      try { localStorage.setItem(PANEL_WIDTH_KEY, String(this.panelWidth())); } catch { /* noop */ }
      this.doc.removeEventListener('mousemove', onMove);
      this.doc.removeEventListener('mouseup', onUp);
    };

    this.doc.body.style.cursor = 'col-resize';
    this.doc.body.style.userSelect = 'none';
    this.doc.addEventListener('mousemove', onMove);
    this.doc.addEventListener('mouseup', onUp);
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
    this.isNew() ? this.doCreate(this.definition()) : this.doUpdate(this.definition());
  }

  private doCreate(def: FsmDefinition): void {
    this.saving.set(true);
    this.api.create(def).subscribe({
      next: (created) => {
        this.definition.set(created); this.saving.set(false); this.flashSaved();
        this.router.navigate(['/editor', created.id], { replaceUrl: true });
      },
      error: () => this.saving.set(false),
    });
  }

  private doUpdate(def: FsmDefinition): void {
    this.saving.set(true);
    this.api.update(def.id!, def).subscribe({
      next: (updated) => { this.definition.set(updated); this.saving.set(false); this.flashSaved(); },
      error: () => this.saving.set(false),
    });
  }

  togglePreview(): void { this.previewCollapsed.update((v) => !v); }

  private flashSaved(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
