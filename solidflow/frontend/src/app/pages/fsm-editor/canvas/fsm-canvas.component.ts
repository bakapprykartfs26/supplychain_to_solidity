import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import type { FsmDefinition, FsmTransition } from '@solidflow/shared';

// ── Constants ──────────────────────────────────────────────────────────────────
const NODE_R = 36;
const SVG_W = 760;
const SVG_H = 480;
const NODE_COLORS = ['#4eb7f9', '#7c5cfc', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

// ── Types ──────────────────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number; }

interface DragState {
  kind: 'node' | 'bend';
  id: string;
  ox?: number;
  oy?: number;
}

export interface EdgeGeom {
  id: string;
  name: string;
  fromId: string;
  toId: string;
  path: string;
  labelPos: Vec2;
  mid: Vec2;
  handlePos: Vec2 | null;
  isSelf: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(v: number): string { return v.toFixed(1); }

function autoLayout(states: string[]): Record<string, Vec2> {
  const n = states.length;
  const result: Record<string, Vec2> = {};

  states.forEach((s, i) => {
    if (n === 1) {
      result[s] = { x: SVG_W / 2, y: SVG_H / 2 };
    } else {
      const spacing = Math.min(240, SVG_W / Math.max(n, 2));
      const startX = SVG_W / 2 - ((n - 1) * spacing) / 2;

      result[s] = {
        x: startX + i * spacing,
        y: SVG_H / 2,
      };
    }
  });

  return result;
}

@Component({
  selector: 'app-fsm-canvas',
  standalone: true,
  template: `
    <div
      class="canvas-host"
      [style.cursor]="dragging || panning ? 'grabbing' : 'default'"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp()"
      (mouseleave)="onMouseUp()"
    >
      <!-- Fixed background grid -->
      <svg class="grid-svg" width="100%" height="100%">
        <defs>
          <pattern id="sf-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sf-grid)"/>
      </svg>

      <!-- Main pannable SVG -->
      <svg
        #mainSvg
        class="main-svg"
        [attr.width]="SVG_W"
        [attr.height]="SVG_H"
        [style.transform]="svgTransform()"
        [style.cursor]="dragging?.kind === 'node' ? 'grabbing' : 'grab'"
        (mousedown)="onSvgMouseDown($event)"
        (dblclick)="onSvgDblClick($event)"
      >
        <defs>
          <!-- Arrowhead markers -->
          <marker id="sf-arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#b4b4c8"/>
          </marker>
          <marker id="sf-arr-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#7c5cfc"/>
          </marker>
          <marker id="sf-arr-hov" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#7c5cfc" opacity="0.6"/>
          </marker>
          <!-- Drop shadow (normal) -->
          <filter id="sf-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.10)"/>
          </filter>
          <!-- Drop shadow (selected) -->
          <filter id="sf-shadow-sel" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="rgba(124,92,252,0.22)"/>
          </filter>
        </defs>

        <!-- ── Edges ── -->
        @for (geom of edgeGeometries; track geom.id) {
          <g
            (mouseenter)="hoveredEdge = geom.id"
            (mouseleave)="hoveredEdge = null"
            (click)="selectEdge(geom.id, $event)"
          >
            <!-- Wide invisible hit area for easy hover/click -->
            <path [attr.d]="geom.path" fill="none" stroke="transparent" stroke-width="14" style="cursor:pointer"/>
            <!-- Visible edge line -->
            <path
              [attr.d]="geom.path"
              fill="none"
              [attr.stroke]="edgeStroke(geom)"
              [attr.stroke-width]="edgeStrokeWidth(geom)"
              [attr.stroke-opacity]="edgeStrokeOpacity(geom)"
              [attr.marker-end]="edgeMarker(geom)"
              style="transition: stroke 0.15s, stroke-opacity 0.15s"
            />
            <!-- Label -->
            <text
              [attr.x]="geom.labelPos.x"
              [attr.y]="geom.labelPos.y"
              text-anchor="middle"
              dominant-baseline="central"
              style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; pointer-events: none; user-select: none; transition: fill 0.15s"
              [attr.fill]="edgeLabelFill(geom)"
            >{{ geom.name }}</text>
            <!-- Bend handle (shown on hover or drag) -->
            @if (geom.handlePos) {
              <g
                (mousedown)="onBendMouseDown($event, geom.id)"
                (dblclick)="resetBend(geom.id, $event)"
                (click)="$event.stopPropagation()"
                style="cursor: move"
              >
                <circle
                  [attr.cx]="geom.handlePos.x"
                  [attr.cy]="geom.handlePos.y"
                  r="8"
                  fill="white"
                  stroke="#7c5cfc"
                  stroke-width="1.5"
                  style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                />
                <circle
                  [attr.cx]="geom.handlePos.x"
                  [attr.cy]="geom.handlePos.y"
                  r="3"
                  fill="#7c5cfc"
                />
              </g>
            }
          </g>
        }

        <!-- ── Nodes ── -->
        @for (state of definition.states; track state; let idx = $index) {
          @if (nodePos(state); as pos) {
            <g
              [attr.transform]="'translate(' + pos.x + ',' + pos.y + ')'"
              style="cursor: grab"
              (mousedown)="onNodeMouseDown($event, state)"
            >
              <!-- Glow / shadow ring -->
              <circle
                [attr.r]="NODE_R + 2"
                [attr.fill]="selected === state ? nodeColor(idx) + '22' : 'rgba(255,255,255,0.5)'"
                [attr.filter]="selected === state ? 'url(#sf-shadow-sel)' : 'url(#sf-shadow)'"
                style="transition: all 0.2s"
              />
              <!-- Main circle -->
              <circle
                [attr.r]="NODE_R"
                fill="white"
                [attr.stroke]="nodeStroke(state, idx)"
                [attr.stroke-width]="nodeStrokeWidth(state)"
                style="transition: all 0.15s"
              />
              <!-- Color top stripe (clipped) -->
              <clipPath [attr.id]="clipId(state)">
                <circle [attr.r]="NODE_R"/>
              </clipPath>
              <rect
                [attr.x]="-NODE_R"
                [attr.y]="-NODE_R"
                [attr.width]="NODE_R * 2"
                [attr.height]="NODE_R * 0.42"
                [attr.fill]="nodeColor(idx)"
                opacity="0.15"
                [attr.clip-path]="'url(#' + clipId(state) + ')'"
              />
              <!-- State name label -->
              <text
                text-anchor="middle"
                [attr.dy]="definition.initialState === state ? '0em' : '0.35em'"
                style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 700; pointer-events: none; user-select: none; transition: fill 0.15s"
                [attr.fill]="selected === state ? nodeColor(idx) : '#0f0e17'"
              >{{ truncate(state) }}</text>
              <!-- "initial" badge -->
              @if (state === definition.initialState) {
                <text
                  text-anchor="middle"
                  dy="1.5em"
                  style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 8px; font-weight: 600; pointer-events: none; user-select: none; opacity: 0.8"
                  [attr.fill]="nodeColor(idx)"
                >initial</text>
              }
            </g>
          }
        }
      </svg>

      <!-- Hint bar -->
      @if (definition.states.length) {
        <div class="hint-bar">
          <span class="hint-stats">{{ definition.states.length }} states · {{ definition.transitions.length }} transitions</span>
          <div class="hint-sep"></div>
          <span class="hint-tip">Drag nodes · Hover edge to bend · Double-click handle to reset · Del to remove</span>
        </div>
      }

      <!-- Empty-state prompt -->
      @if (!definition.states.length) {
        <div class="canvas-hint">
          <div class="hint-glyph">◎</div>
          <p class="hint-primary">Double-click to place a state</p>
          <p class="hint-secondary">Add transitions via the Transitions panel</p>
        </div>
      }

      @if (pendingStateDelete; as pending) {
        <div class="dialog-backdrop" (click)="cancelDeleteState()">
          <div class="dialog" (click)="$event.stopPropagation()">
            <div class="dialog-header">
              <span class="dialog-title">Delete state?</span>
              <button class="dialog-close" (click)="cancelDeleteState()">✕</button>
            </div>

            <div class="dialog-body">
              <p>
                State <strong>{{ pending.state }}</strong> has
                <strong>{{ pending.transitionCount }}</strong> connected transition(s).
                Deleting it will also delete those transitions.
              </p>

              <label>Type DELETE to confirm</label>
              <input
                [value]="deleteConfirmation"
                (input)="deleteConfirmation = $any($event.target).value"
                spellcheck="false"
              />
            </div>

            <div class="dialog-footer">
              <button (click)="cancelDeleteState()">Cancel</button>
              <button
                class="danger"
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
    :host { display: block; width: 100%; height: 100%; position: relative; }

    .canvas-host {
      width: 100%; height: 100%;
      background: #f5f4f8;
      position: relative;
      overflow: hidden;
    }

    .grid-svg {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .main-svg {
      position: absolute;
      top: 50%;
      left: 50%;
      overflow: visible;
    }

    .hint-bar {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 20px;
      padding: 4px 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05);
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
      pointer-events: none;
    }
    .hint-stats {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 11px;
      color: #6b6b85;
      font-weight: 600;
    }
    .hint-sep { width: 1px; height: 12px; background: rgba(0,0,0,0.08); }
    .hint-tip {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 11px;
      color: #b4b4c8;
    }

    .canvas-hint {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      pointer-events: none; gap: 0.25rem;
    }
    .hint-glyph { font-size: 3rem; color: #c8c4d8; line-height: 1; margin-bottom: 0.5rem; }
    .hint-primary { margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9rem; color: #b4b4c8; font-weight: 500; }
    .hint-secondary { margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.75rem; color: #c8c4d8; }

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
export class FsmCanvasComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();
  @ViewChild('mainSvg') mainSvgRef!: ElementRef<SVGSVGElement>;

  // Expose constant to template
  readonly NODE_R = NODE_R;
  readonly SVG_W = SVG_W;
  readonly SVG_H = SVG_H;

  // Canvas state
  positions: Record<string, Vec2> = {};
  dragging: DragState | null = null;
  selected: string | null = null;
  hoveredEdge: string | null = null;
  pan: Vec2 = { x: 0, y: 0 };
  panning: { startX: number; startY: number } | null = null;
  userBends: Record<string, number> = {};
  pendingStateDelete: { state: string; transitionCount: number } | null = null;
  deleteConfirmation = '';

  private readonly keydownListener = (e: KeyboardEvent) => this.onKeydown(e);

  ngAfterViewInit(): void {
    document.addEventListener('keydown', this.keydownListener);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['definition']) return;

    const prev: FsmDefinition | undefined = changes['definition'].previousValue;
    const next: FsmDefinition = changes['definition'].currentValue;
    const newStatesSet = new Set(next.states);

    // Handle renames: same index, different name → transfer position
    if (prev && prev.states.length === next.states.length) {
      for (let i = 0; i < next.states.length; i++) {
        const ps = prev.states[i], ns = next.states[i];
        if (ps !== ns && this.positions[ps] && !this.positions[ns]) {
          this.positions[ns] = this.positions[ps];
          delete this.positions[ps];
        }
      }
    }

    // Remove positions for deleted states
    for (const key of Object.keys(this.positions)) {
      if (!newStatesSet.has(key)) delete this.positions[key];
    }

    // Add positions for new states
    const toAdd = next.states.filter(s => !this.positions[s]);
    if (toAdd.length) {
      const layout = autoLayout(next.states);
      toAdd.forEach(s => { this.positions[s] = layout[s]; });
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.keydownListener);
  }

  // ── Computed edge geometry ─────────────────────────────────────────────────

  get edgeGeometries(): EdgeGeom[] {
    const selfGroups: Record<string, FsmTransition[]> = {};
    const normalGroups: Record<string, FsmTransition[]> = {};

    this.definition.transitions.forEach(tr => {
      if (tr.from === tr.to) {
        (selfGroups[tr.from] ??= []).push(tr);
      } else {
        const key = [tr.from, tr.to].sort().join('||');
        (normalGroups[key] ??= []).push(tr);
      }
    });

    return this.definition.transitions.map(tr => {
      if (tr.from === tr.to) {
        const group = selfGroups[tr.from] ?? [];
        const idx = group.indexOf(tr);
        const total = group.length;
        const path = this.selfLoopPath(tr.from, idx, total);
        const labelPos = this.selfLoopLabelPos(tr.from, idx, total);
        return { id: tr.id, name: tr.name ?? '', fromId: tr.from, toId: tr.to, isSelf: true, path, labelPos, mid: labelPos, handlePos: null };
      }

      const key = [tr.from, tr.to].sort().join('||');
      const group = normalGroups[key] ?? [];
      const idx = group.indexOf(tr);
      const total = group.length;
      const basePerp =
        total === 1
          ? 58
          : (idx - (total - 1) / 2) * 200;
      const flip = tr.from > tr.to ? -1 : 1;
      const autoPerp = basePerp * flip;

      const { path, mid } = this.normalEdgePath(tr, autoPerp);
      const f = this.positions[tr.from], t = this.positions[tr.to];
      let labelPos = mid;
      if (f && t) {
        const dx = t.x - f.x, dy = t.y - f.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        labelPos = { x: mid.x + (-dy / len) * 14, y: mid.y + (dx / len) * 14 };
      }

      const showHandle = this.hoveredEdge === tr.id || this.dragging?.id === tr.id;
      return { id: tr.id, name: tr.name ?? '', fromId: tr.from, toId: tr.to, isSelf: false, path, labelPos, mid, handlePos: showHandle ? mid : null };
    });
  }

  private selfLoopPath(state: string, loopIndex: number, totalLoops: number): string {
    const pos = this.positions[state];
    if (!pos) return '';
    const baseAngle = -Math.PI / 2;
    const angle = baseAngle + (loopIndex - (totalLoops - 1) / 2) * (Math.PI / 3);
    const a1 = angle - 0.35, a2 = angle + 0.35;
    const sx = pos.x + NODE_R * Math.cos(a1), sy = pos.y + NODE_R * Math.sin(a1);
    const ex = pos.x + NODE_R * Math.cos(a2), ey = pos.y + NODE_R * Math.sin(a2);
    const dist = 70 + loopIndex * 10;
    const cx1 = pos.x + (NODE_R + dist) * Math.cos(a1), cy1 = pos.y + (NODE_R + dist) * Math.sin(a1);
    const cx2 = pos.x + (NODE_R + dist) * Math.cos(a2), cy2 = pos.y + (NODE_R + dist) * Math.sin(a2);
    return `M ${fmt(sx)} ${fmt(sy)} C ${fmt(cx1)} ${fmt(cy1)} ${fmt(cx2)} ${fmt(cy2)} ${fmt(ex)} ${fmt(ey)}`;
  }

  private selfLoopLabelPos(state: string, loopIndex: number, totalLoops: number): Vec2 {
    const pos = this.positions[state];
    if (!pos) return { x: 0, y: 0 };
    const angle = -Math.PI / 2 + (loopIndex - (totalLoops - 1) / 2) * (Math.PI / 3);
    const dist = 95 + loopIndex * 12;
    return { x: pos.x + dist * Math.cos(angle), y: pos.y + dist * Math.sin(angle) };
  }

  private normalEdgePath(tr: FsmTransition, autoPerp: number): { path: string; mid: Vec2 } {
    const f = this.positions[tr.from], t = this.positions[tr.to];
    if (!f || !t) return { path: '', mid: { x: 0, y: 0 } };

    const dx = t.x - f.x, dy = t.y - f.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const px = -uy, py = ux;

    const totalPerp = autoPerp + (this.userBends[tr.id] ?? 0);
    const ctrl = {
      x: (f.x + t.x) / 2 + px * totalPerp,
      y: (f.y + t.y) / 2 + py * totalPerp,
    };

    const sx = f.x + ux * NODE_R, sy = f.y + uy * NODE_R;
    const tdx = t.x - ctrl.x, tdy = t.y - ctrl.y;
    const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const ex = t.x - (tdx / tlen) * NODE_R, ey = t.y - (tdy / tlen) * NODE_R;

    // Visual midpoint of quadratic bezier at t=0.5
    const mid = {
      x: 0.25 * sx + 0.5 * ctrl.x + 0.25 * ex,
      y: 0.25 * sy + 0.5 * ctrl.y + 0.25 * ey,
    };

    return {
      path: `M ${fmt(sx)} ${fmt(sy)} Q ${fmt(ctrl.x)} ${fmt(ctrl.y)} ${fmt(ex)} ${fmt(ey)}`,
      mid,
    };
  }

  // ── Template helpers ───────────────────────────────────────────────────────

  svgTransform(): string {
    return `translate(calc(-50% + ${this.pan.x}px), calc(-50% + ${this.pan.y}px))`;
  }

  nodePos(state: string): Vec2 | null {
    return this.positions[state] ?? null;
  }

  nodeColor(idx: number): string {
    return NODE_COLORS[idx % NODE_COLORS.length];
  }

  clipId(state: string): string {
    return 'sf-clip-' + state.replace(/\W/g, '_');
  }

  truncate(s: string): string {
    return s.length > 10 ? s.slice(0, 9) + '…' : s;
  }

  nodeStroke(state: string, idx: number): string {
    if (this.selected === state) return this.nodeColor(idx);
    if (state === this.definition.initialState) return this.nodeColor(idx);
    return 'rgba(0,0,0,0.13)';
  }

  nodeStrokeWidth(state: string): string {
    if (this.selected === state) return '2.5';
    if (state === this.definition.initialState) return '2';
    return '1.5';
  }

  edgeStroke(geom: EdgeGeom): string {
    const via = this.selected === geom.fromId || this.selected === geom.toId;
    const direct = this.selected === geom.id;
    return (via || direct || this.hoveredEdge === geom.id) ? '#7c5cfc' : '#b4b4c8';
  }

  edgeStrokeWidth(geom: EdgeGeom): number {
    return (this.selected === geom.fromId || this.selected === geom.toId || this.selected === geom.id) ? 2 : 1.5;
  }

  edgeStrokeOpacity(geom: EdgeGeom): number {
    const via = this.selected === geom.fromId || this.selected === geom.toId;
    const direct = this.selected === geom.id;
    if (via || direct) return 1;
    if (this.hoveredEdge === geom.id) return 0.75;
    return 0.5;
  }

  edgeMarker(geom: EdgeGeom): string {
    const via = this.selected === geom.fromId || this.selected === geom.toId;
    const direct = this.selected === geom.id;
    if (via || direct) return 'url(#sf-arr-sel)';
    if (this.hoveredEdge === geom.id) return 'url(#sf-arr-hov)';
    return 'url(#sf-arr)';
  }

  edgeLabelFill(geom: EdgeGeom): string {
    const via = this.selected === geom.fromId || this.selected === geom.toId;
    const direct = this.selected === geom.id;
    return (via || direct || this.hoveredEdge === geom.id) ? '#7c5cfc' : '#6b6b85';
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  private getSVGPoint(e: MouseEvent): Vec2 {
    const rect = this.mainSvgRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onNodeMouseDown(e: MouseEvent, stateId: string): void {
    e.stopPropagation();
    const pt = this.getSVGPoint(e);
    const pos = this.positions[stateId] ?? { x: 0, y: 0 };
    this.dragging = { kind: 'node', id: stateId, ox: pt.x - pos.x, oy: pt.y - pos.y };
    this.selected = stateId;
  }

  onBendMouseDown(e: MouseEvent, trId: string): void {
    e.stopPropagation();
    this.dragging = { kind: 'bend', id: trId };
  }

  onSvgMouseDown(e: MouseEvent): void {
    this.selected = null;
    this.panning = { startX: e.clientX - this.pan.x, startY: e.clientY - this.pan.y };
  }

  onSvgDblClick(e: MouseEvent): void {
    const pt = this.getSVGPoint(e);
    const name = `State${this.definition.states.length + 1}`;
    this.positions[name] = { x: pt.x, y: pt.y };
    this.definitionChange.emit({
      ...this.definition,
      states: [...this.definition.states, name],
    });
  }

  onMouseMove(e: MouseEvent): void {
    if (this.dragging?.kind === 'node') {
      const pt = this.getSVGPoint(e);
      this.positions = {
        ...this.positions,
        [this.dragging.id]: {
          x: Math.max(NODE_R + 4, Math.min(SVG_W - NODE_R - 4, pt.x - (this.dragging.ox ?? 0))),
          y: Math.max(NODE_R + 4, Math.min(SVG_H - NODE_R - 4, pt.y - (this.dragging.oy ?? 0))),
        },
      };
    } else if (this.dragging?.kind === 'bend') {
      const tr = this.definition.transitions.find(t => t.id === this.dragging!.id);
      if (!tr || tr.from === tr.to) return;
      const f = this.positions[tr.from], t = this.positions[tr.to];
      if (!f || !t) return;
      const pt = this.getSVGPoint(e);
      const dx = t.x - f.x, dy = t.y - f.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const px = -dy / len, py = dx / len;
      const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
      const proj = (pt.x - mx) * px + (pt.y - my) * py;
      this.userBends = { ...this.userBends, [this.dragging.id]: proj };
    } else if (this.panning) {
      this.pan = { x: e.clientX - this.panning.startX, y: e.clientY - this.panning.startY };
    }
  }

  onMouseUp(): void {
    this.dragging = null;
    this.panning = null;
  }

  selectEdge(trId: string, e: MouseEvent): void {
    e.stopPropagation();
    this.selected = trId;
  }

  resetBend(trId: string, e: MouseEvent): void {
    e.stopPropagation();
    const { [trId]: _removed, ...rest } = this.userBends;
    this.userBends = rest;
  }

  private onKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (!this.selected) return;

    // Prevent browser back navigation on Backspace
    e.preventDefault();

    if (this.definition.states.includes(this.selected)) {
      const state = this.selected;

      const transitionCount = this.definition.transitions.filter(
        t => t.from === state || t.to === state
      ).length;

      if (transitionCount > 0) {
        this.pendingStateDelete = { state, transitionCount };
        this.deleteConfirmation = '';
        return;
      }

      this.deleteStateFromCanvas(state);
    }
  }

  cancelDeleteState(): void {
    this.pendingStateDelete = null;
    this.deleteConfirmation = '';
  }

  confirmDeleteState(): void {
    if (!this.pendingStateDelete || this.deleteConfirmation !== 'DELETE') return;

    this.deleteStateFromCanvas(this.pendingStateDelete.state);
    this.cancelDeleteState();
  }

  private deleteStateFromCanvas(state: string): void {
    this.selected = null;
    delete this.positions[state];

    this.definitionChange.emit({
      ...this.definition,
      states: this.definition.states.filter(s => s !== state),
      transitions: this.definition.transitions.filter(
        t => t.from !== state && t.to !== state
      ),
    });
  }
}
