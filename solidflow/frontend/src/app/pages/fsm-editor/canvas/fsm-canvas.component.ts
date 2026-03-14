import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  afterNextRender,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { FsmDefinition } from '@solidflow/shared';
import { randomUUID } from './uuid';

@Component({
  selector: 'app-fsm-canvas',
  standalone: true,
  template: `<div class="canvas-host" #canvasHost></div>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .canvas-host { width: 100%; height: 100%; background: #fafafa; }
  `],
})
export class FsmCanvasComponent implements OnChanges, OnDestroy {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  private readonly elRef = inject(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private graph: any = null;
  private suppressChange = false;

  constructor() {
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.initGraph();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['definition'] && this.graph && !this.suppressChange) {
      import('./x6-adapter').then(({ definitionToGraph }) => {
        definitionToGraph(this.graph, this.definition);
      });
    }
  }

  ngOnDestroy(): void {
    this.graph?.dispose();
  }

  private async initGraph(): Promise<void> {
    const { Graph } = await import('@antv/x6');
    const host = this.elRef.nativeElement.querySelector('.canvas-host');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.graph = new Graph({
      container: host,
      width: host.offsetWidth || 800,
      height: host.offsetHeight || 600,
      background: { color: '#fafafa' },
      grid: { visible: true, size: 20 },
      connecting: {
        snap: true,
        allowBlank: false,
        highlight: true,
        connector: 'rounded',
        connectionPoint: 'boundary',
        createEdge: () =>
          this.graph.createEdge({
            attrs: { line: { stroke: '#333', targetMarker: { name: 'block', size: 8 } } },
            label: 'transition',
          }),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (this.definition) {
      const { definitionToGraph } = await import('./x6-adapter');
      definitionToGraph(this.graph, this.definition);
    }

    // Double-click on canvas background → add state
    this.graph.on('blank:dblclick', ({ x, y }: { x: number; y: number }) => {
      const name = `State${this.graph.getNodes().length + 1}`;
      this.graph.addNode({
        id: name,
        x,
        y,
        width: 120,
        height: 40,
        label: name,
        attrs: {
          body: { fill: '#f5f5f5', stroke: '#333', rx: 6, ry: 6 },
          label: { fill: '#333', fontSize: 13 },
        },
      });
      this.emitChange();
    });

    // Edge connected → emit change
    this.graph.on('edge:connected', ({ edge }: { edge: unknown }) => {
      const e = edge as { id?: string; setLabels: (l: string[]) => void };
      if (!e.id) (e as { id: string }).id = randomUUID();
      e.setLabels([`transition${this.graph.getEdges().length}`]);
      this.emitChange();
    });

    // Delete key → remove selected cells via DOM keydown
    host.setAttribute('tabindex', '0');
    host.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = this.graph.getSelectedCells?.() ?? [];
        if (selected.length) {
          this.graph.removeCells(selected);
          this.emitChange();
        }
      }
    });

    // Any cell change → emit
    this.graph.on('cell:changed', () => this.emitChange());
    this.graph.on('node:moved', () => this.emitChange());
  }

  private emitChange(): void {
    if (!this.graph) return;
    import('./x6-adapter').then(({ graphToDefinition }) => {
      this.suppressChange = true;
      const updated = graphToDefinition(this.graph, this.definition);
      this.suppressChange = false;
      this.definitionChange.emit(updated);
    });
  }
}
