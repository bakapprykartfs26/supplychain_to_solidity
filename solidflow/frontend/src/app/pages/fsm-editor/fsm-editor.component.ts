import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { DOCUMENT, CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { minimizeFsm } from '@solidflow/shared';
import type { FsmDefinition, FsmMinimizationResult } from '@solidflow/shared';
import { FsmApiService } from '../../core/services/fsm-api.service';
import { FsmCanvasComponent } from './canvas/fsm-canvas.component';
import { StatesPanelComponent } from './panels/states-panel/states-panel.component';
import { TransitionsPanelComponent } from './panels/transitions-panel/transitions-panel.component';
import { ConstructorPanelComponent } from './panels/constructor-panel/constructor-panel.component';
import { VariablesPanelComponent } from './panels/variables-panel/variables-panel.component';
import { PluginsPanelComponent } from './panels/plugins-panel/plugins-panel.component';
import { EventsPanelComponent } from './panels/events-panel/events-panel.component';
import { SolidityPreviewComponent } from './panels/solidity-preview/solidity-preview.component';

const PANEL_WIDTH_KEY = 'sf-panel-width';
const PANEL_MIN = 280;
const PANEL_MAX = 720;
const PANEL_DEFAULT = 360;

const BLANK_DEFINITION: FsmDefinition = {
  name: 'MyContract',
  states: ['Idle', 'Active', 'Done'],
  initialState: 'Idle',
  transitions: [],
};

type TabId = 'states' | 'transitions' | 'constructor' | 'variables' | 'events' | 'plugins';
const TABS: { id: TabId; label: string }[] = [
  { id: 'states',      label: 'States' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'constructor', label: 'Constructor' },
  { id: 'variables',   label: 'Variables' },
  { id: 'events',      label: 'Events' },
  { id: 'plugins',     label: 'Plugins' },
];

@Component({
  selector: 'app-fsm-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, KeyValuePipe,
    MatButtonModule, MatIconModule, MatProgressBarModule,
    FsmCanvasComponent, StatesPanelComponent, TransitionsPanelComponent, ConstructorPanelComponent,
    VariablesPanelComponent, PluginsPanelComponent, EventsPanelComponent, SolidityPreviewComponent,
  ],
  template: `
    <div class="editor-shell">

      <!-- Topbar -->
      <div class="topbar">
        <button class="back-btn" routerLink="/" title="Back to list">←</button>
        <div class="topbar-div"></div>

        <!-- Logo -->
        <div class="logo">
          <div class="logo-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L13 5V11L8 14L3 11V5L8 2Z" fill="white" opacity="0.9"/>
              <path d="M8 5L11 6.5V9.5L8 11L5 9.5V6.5L8 5Z" fill="white" opacity="0.5"/>
            </svg>
          </div>
          <span class="logo-text">Solidflow</span>
        </div>
        <div class="topbar-div"></div>

        <input
          class="name-input"
          [ngModel]="definition().name"
          (ngModelChange)="patchDefinition({ name: $event })"
          placeholder="Contract name"
          spellcheck="false"
        />
        <div class="spacer"></div>

        <div class="status-area">
          @if (saving()) {
            <div class="status-saving">
              <div class="spinner"></div>
              <span>Saving</span>
            </div>
          } @else if (saved()) {
            <span class="status-saved">✓ Saved</span>
          }
        </div>

        <button
          class="minimize-btn"
          (click)="minimize()"
          [disabled]="isNew()"
          title="Minimize FSM (Hopcroft)"
        >
          Minimize
        </button>

        <button class="save-btn" (click)="save()">Save</button>
      </div>

      @if (alreadyMinimalFlash()) {
        <div class="minimize-banner">FSM is already minimal — no changes.</div>
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
          <div class="resize-line"></div>
        </div>

        <!-- Right panel -->
        <div class="right-panel" [style.width.px]="panelWidth()">

          <!-- Custom tabs -->
          <div class="tabs-bar">
            @for (tab of TABS; track tab.id) {
              <button class="tab-btn" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">
                {{ tab.label }}
              </button>
            }
            <div class="tabs-spacer"></div>
            <button class="preview-toggle" [class.active]="previewOpen()" (click)="togglePreview()" title="Solidity Preview">
              &lt;/&gt;
            </button>
          </div>

          <!-- Panel content -->
          <div class="panel-area">
            @switch (activeTab()) {
              @case ('states') {
                <app-states-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              }
              @case ('transitions') {
                <app-transitions-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              }
              @case ('constructor') {
                <app-constructor-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              }
              @case ('variables') {
                <app-variables-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              }
              @case ('events') {
                <app-events-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              }
              @case ('plugins') {
                <app-plugins-panel [definition]="definition()" (definitionChange)="patchDefinition($event)" />
              }
            }
          </div>

          <!-- Solidity preview -->
          @if (previewOpen()) {
            <div class="preview-pane">
              <app-solidity-preview [definition]="definition()" />
            </div>
          }
        </div>
      </div>

      <!-- Minimize confirmation dialog -->
      @if (minimizePreview(); as preview) {
        <div class="dialog-backdrop" (click)="cancelMinimize()">
          <div class="dialog" (click)="$event.stopPropagation()">

            <div class="dialog-header">
              <span class="dialog-title">Optimization Found</span>
              <button class="dialog-close" (click)="cancelMinimize()" title="Cancel">✕</button>
            </div>

            <div class="dialog-body">

              @if (preview.stats.removedUnreachableStates.length > 0) {
                <div class="dialog-section">
                  <div class="dialog-section-label">Unreachable states to remove</div>
                  @for (s of preview.stats.removedUnreachableStates; track s) {
                    <div class="dialog-tag dialog-tag--red">{{ s }}</div>
                  }
                </div>
              }

              @if (preview.stats.removedDeadStates.length > 0) {
                <div class="dialog-section">
                  <div class="dialog-section-label">Dead-end states to remove</div>
                  @for (s of preview.stats.removedDeadStates; track s) {
                    <div class="dialog-tag dialog-tag--orange">{{ s }}</div>
                  }
                </div>
              }

              @if (preview.stats.mergedStates | keyvalue; as merges) {
                @if (merges.length > 0) {
                  <div class="dialog-section">
                    <div class="dialog-section-label">Equivalent states to merge</div>
                    @for (entry of merges; track entry.key) {
                      <div class="dialog-merge-row">
                        <span class="dialog-tag dialog-tag--purple">{{ entry.key }}</span>
                        <span class="dialog-arrow">→</span>
                        <span class="dialog-tag dialog-tag--purple-outline">{{ entry.value }}</span>
                      </div>
                    }
                  </div>
                }
              }

              @if (preview.stats.removedTransitions.length > 0) {
                <div class="dialog-section">
                  <div class="dialog-section-label">Duplicate transitions to remove</div>
                  @for (t of preview.stats.removedTransitions; track t.id) {
                    <div class="dialog-tag dialog-tag--red">{{ t.name }} ({{ t.from }} → {{ t.to }})</div>
                  }
                </div>
              }

              <div class="dialog-summary">
                {{ preview.stats.originalStateCount }} → {{ preview.stats.minimizedStateCount }} states ·
                {{ preview.stats.originalTransitionCount }} → {{ preview.stats.minimizedTransitionCount }} transitions
              </div>

            </div>

            <div class="dialog-footer">
              <button class="dialog-btn-cancel" (click)="cancelMinimize()">Cancel</button>
              <button class="dialog-btn-apply" (click)="applyMinimize()">Apply</button>
            </div>

          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; overflow: hidden; background: var(--sf-bg); }
    .editor-shell { display: flex; flex-direction: column; height: 100%; }

    /* ── Topbar ──────────────────────────────────────────────────────────── */
    .topbar {
      height: 56px; background: var(--sf-surface);
      border-bottom: 1px solid var(--sf-border);
      display: flex; align-items: center; padding: 0 1.25rem; gap: 12px;
      flex-shrink: 0; z-index: 10; box-shadow: 0 1px 0 rgba(0,0,0,0.04);
    }

    .back-btn {
      width: 32px; height: 32px; background: transparent;
      border: 1.5px solid var(--sf-border); border-radius: 8px;
      color: var(--sf-text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; transition: all 0.15s; flex-shrink: 0;
    }
    .back-btn:hover { border-color: rgba(124,92,252,0.5); color: var(--sf-primary); }

    .topbar-div { width: 1px; height: 20px; background: var(--sf-border); flex-shrink: 0; }

    .logo { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .logo-mark {
      width: 28px; height: 28px;
      background: linear-gradient(135deg, #7c5cfc, #a78bfa);
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
    }
    .logo-text { font-family: var(--sf-brand); font-weight: 800; font-size: 1rem; color: var(--sf-text); letter-spacing: -0.01em; }

    .name-input {
      flex: 1; min-width: 0; background: transparent; border: none; outline: none;
      font-family: var(--sf-brand); font-size: 0.95rem; font-weight: 700;
      color: var(--sf-text); letter-spacing: -0.01em;
    }
    .name-input::placeholder { color: var(--sf-text-dim); }

    .spacer { flex: 1; }

    .status-area { display: flex; align-items: center; min-width: 90px; justify-content: flex-end; }
    .status-saving { display: flex; align-items: center; gap: 5px; font-family: var(--sf-sans); font-size: 0.8rem; color: var(--sf-text-muted); }
    .status-saved { font-family: var(--sf-sans); font-size: 0.8rem; color: var(--sf-success); font-weight: 600; }
    .spinner {
      width: 14px; height: 14px;
      border: 2px solid var(--sf-border); border-top-color: var(--sf-primary);
      border-radius: 50%; animation: sf-spin 0.8s linear infinite;
    }

    .minimize-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 0.45rem 0.85rem; background: transparent;
      border: 1.5px solid var(--sf-border); border-radius: 8px;
      color: var(--sf-text-muted); font-family: var(--sf-sans); font-weight: 600; font-size: 0.83rem;
      cursor: pointer; flex-shrink: 0; transition: all 0.15s;
    }
    .minimize-btn:hover:not(:disabled) { border-color: rgba(124,92,252,0.5); color: var(--sf-primary); }
    .minimize-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .save-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 0.45rem 1rem; background: var(--sf-primary); border: none; border-radius: 8px;
      color: white; font-family: var(--sf-sans); font-weight: 700; font-size: 0.83rem;
      cursor: pointer; box-shadow: 0 2px 8px rgba(124,92,252,0.25);
      flex-shrink: 0; transition: background 0.15s;
    }
    .save-btn:hover { background: #6b4edb; }

    /* ── Layout ──────────────────────────────────────────────────────────── */
    .main-area { display: flex; flex: 1; overflow: hidden; }
    .main-area.resizing { cursor: col-resize; user-select: none; }
    .main-area.resizing .canvas-area { pointer-events: none; }

    .canvas-area { flex: 1; overflow: hidden; min-width: 0; }

    /* ── Resize handle ───────────────────────────────────────────────────── */
    .resize-handle {
      width: 5px; flex-shrink: 0; cursor: col-resize;
      display: flex; align-items: center; justify-content: center;
      background: var(--sf-bg); z-index: 10;
    }
    .resize-line {
      width: 1px; height: 100%; background: var(--sf-border);
      transition: background 0.15s;
    }
    .resize-handle:hover .resize-line,
    .resize-handle.active .resize-line {
      background: var(--sf-primary);
    }

    /* ── Right panel ─────────────────────────────────────────────────────── */
    .right-panel {
      flex-shrink: 0; display: flex; flex-direction: column;
      background: var(--sf-surface); overflow: hidden;
      border-left: 1px solid var(--sf-border);
    }

    /* ── Tabs ────────────────────────────────────────────────────────────── */
    .tabs-bar {
      border-bottom: 1px solid var(--sf-border); flex-shrink: 0;
      display: flex; overflow-x: auto; background: var(--sf-surface);
    }
    .tabs-bar::-webkit-scrollbar { display: none; }

    .tab-btn {
      padding: 0.7rem 0.875rem; background: transparent; border: none;
      border-bottom: 2.5px solid transparent;
      color: var(--sf-text-muted); font-family: var(--sf-sans); font-size: 0.8rem;
      font-weight: 500; cursor: pointer; transition: all 0.15s;
      white-space: nowrap; letter-spacing: -0.01em;
    }
    .tab-btn.active { color: var(--sf-primary); border-bottom-color: var(--sf-primary); font-weight: 700; }
    .tab-btn:hover:not(.active) { color: var(--sf-text); }

    .tabs-spacer { flex: 1; }

    .preview-toggle {
      padding: 0.7rem 0.875rem; background: transparent; border: none;
      border-bottom: 2.5px solid transparent;
      color: var(--sf-text-dim); font-family: var(--sf-mono); font-size: 0.75rem;
      font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s;
    }
    .preview-toggle.active { color: var(--sf-success); border-bottom-color: var(--sf-success); }
    .preview-toggle:hover { color: var(--sf-text-muted); }

    /* ── Panel area ──────────────────────────────────────────────────────── */
    .panel-area { flex: 1; overflow-y: auto; min-height: 0; }

    /* ── Preview pane ────────────────────────────────────────────────────── */
    .preview-pane {
      flex: 0 0 45%; border-top: 1px solid var(--sf-border);
      display: flex; flex-direction: column; overflow: hidden; min-height: 0;
      background: var(--sf-elevated);
    }
    app-solidity-preview { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

    /* ── Already-minimal banner ─────────────────────────────────────────── */
    .minimize-banner {
      padding: 0.45rem 1.25rem;
      font-family: var(--sf-sans); font-size: 0.8rem; font-weight: 600;
      background: rgba(100,100,100,0.07); color: var(--sf-text-muted);
      border-bottom: 1px solid var(--sf-border); flex-shrink: 0;
    }

    /* ── Minimize Dialog ─────────────────────────────────────────────────── */
    .dialog-backdrop {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.45); backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center;
    }

    .dialog {
      background: var(--sf-surface); border: 1px solid var(--sf-border);
      border-radius: 14px; width: 420px; max-width: calc(100vw - 2rem);
      box-shadow: 0 24px 64px rgba(0,0,0,0.35);
      display: flex; flex-direction: column; overflow: hidden;
    }

    .dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.1rem 1.25rem 0.75rem; border-bottom: 1px solid var(--sf-border);
    }
    .dialog-title {
      font-family: var(--sf-sans); font-weight: 700; font-size: 0.95rem; color: var(--sf-text);
    }
    .dialog-close {
      background: transparent; border: none; color: var(--sf-text-muted);
      font-size: 1rem; cursor: pointer; padding: 0.2rem; line-height: 1;
      transition: color 0.15s;
    }
    .dialog-close:hover { color: var(--sf-text); }

    .dialog-body {
      padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.85rem;
      max-height: 50vh; overflow-y: auto;
    }

    .dialog-section { display: flex; flex-direction: column; gap: 0.4rem; }
    .dialog-section-label {
      font-family: var(--sf-sans); font-size: 0.75rem; font-weight: 600;
      color: var(--sf-text-muted); text-transform: uppercase; letter-spacing: 0.04em;
    }

    .dialog-tag {
      display: inline-block; padding: 0.2rem 0.6rem;
      border-radius: 6px; font-family: var(--sf-mono); font-size: 0.78rem; font-weight: 600;
      width: fit-content;
    }
    .dialog-tag--red { background: rgba(239,68,68,0.12); color: #ef4444; }
    .dialog-tag--orange { background: rgba(251,146,60,0.12); color: #f97316; }
    .dialog-tag--purple { background: rgba(124,92,252,0.12); color: var(--sf-primary); }
    .dialog-tag--purple-outline {
      background: transparent; color: var(--sf-primary);
      border: 1.5px solid rgba(124,92,252,0.35);
    }

    .dialog-merge-row { display: flex; align-items: center; gap: 0.5rem; }
    .dialog-arrow { color: var(--sf-text-dim); font-size: 0.9rem; }

    .dialog-summary {
      font-family: var(--sf-sans); font-size: 0.8rem; color: var(--sf-text-muted);
      padding-top: 0.25rem; border-top: 1px solid var(--sf-border);
    }

    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 0.6rem;
      padding: 0.85rem 1.25rem; border-top: 1px solid var(--sf-border);
      background: var(--sf-bg);
    }

    .dialog-btn-cancel {
      padding: 0.45rem 1rem; background: transparent;
      border: 1.5px solid var(--sf-border); border-radius: 8px;
      color: var(--sf-text-muted); font-family: var(--sf-sans); font-weight: 600;
      font-size: 0.83rem; cursor: pointer; transition: all 0.15s;
    }
    .dialog-btn-cancel:hover { border-color: var(--sf-text-muted); color: var(--sf-text); }

    .dialog-btn-apply {
      padding: 0.45rem 1.1rem; background: var(--sf-primary); border: none;
      border-radius: 8px; color: white; font-family: var(--sf-sans); font-weight: 700;
      font-size: 0.83rem; cursor: pointer; box-shadow: 0 2px 8px rgba(124,92,252,0.25);
      transition: background 0.15s;
    }
    .dialog-btn-apply:hover { background: #6b4edb; }
  `],
})
export class FsmEditorComponent implements OnInit, OnDestroy {
  readonly TABS = TABS;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(FsmApiService);
  private readonly doc = inject(DOCUMENT);
  private readonly destroy$ = new Subject<void>();
  private readonly autosave$ = new Subject<FsmDefinition>();

  readonly definition = signal<FsmDefinition>({ ...BLANK_DEFINITION });
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly activeTab = signal<TabId>('states');
  readonly previewOpen = signal(true);
  readonly isNew = computed(() => !this.definition().id);

  readonly panelWidth = signal(PANEL_DEFAULT);
  readonly minimizePreview = signal<FsmMinimizationResult | null>(null);
  readonly alreadyMinimalFlash = signal(false);
  private alreadyMinimalTimer?: ReturnType<typeof setTimeout>;
  isResizing = false;

  ngOnInit(): void {
    const resolved = this.route.snapshot.data['fsm'] as FsmDefinition | undefined;
    if (resolved) this.definition.set(resolved);

    try {
      const saved = localStorage.getItem(PANEL_WIDTH_KEY);
      if (saved) this.panelWidth.set(Math.max(PANEL_MIN, Math.min(PANEL_MAX, parseInt(saved, 10))));
    } catch { /* localStorage unavailable */ }

    this.autosave$
      .pipe(debounceTime(3000), takeUntil(this.destroy$))
      .subscribe((def) => { if (def.id) this.doUpdate(def); });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.alreadyMinimalTimer);
  }

  onResizeStart(e: MouseEvent): void {
    e.preventDefault();
    this.isResizing = true;

    const startX = e.clientX;
    const startWidth = this.panelWidth();

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
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

  togglePreview(): void { this.previewOpen.update((v) => !v); }

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

  minimize(): void {
    if (this.isNew()) return;
    const result = minimizeFsm(this.definition());
    if (result.stats.alreadyMinimal) {
      this.alreadyMinimalFlash.set(true);
      clearTimeout(this.alreadyMinimalTimer);
      this.alreadyMinimalTimer = setTimeout(() => this.alreadyMinimalFlash.set(false), 3000);
    } else {
      this.minimizePreview.set(result);
    }
  }

  applyMinimize(): void {
    const preview = this.minimizePreview();
    if (!preview) return;
    this.minimizePreview.set(null);
    this.patchDefinition(preview.minimized);
  }

  cancelMinimize(): void {
    this.minimizePreview.set(null);
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

  private flashSaved(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}