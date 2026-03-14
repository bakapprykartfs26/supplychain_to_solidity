import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import type { FsmDefinition } from '@solidflow/shared';
import { FsmApiService } from '../../core/services/fsm-api.service';

@Component({
  selector: 'app-fsm-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="list-container">
      <div class="list-header">
        <h1>FSM Contracts</h1>
        <button class="btn-primary" routerLink="/editor/new">+ New FSM</button>
      </div>

      @if (loading()) {
        <p>Loading...</p>
      } @else if (fsms().length === 0) {
        <p class="empty-state">No FSMs yet. Create your first one!</p>
      } @else {
        <ul class="fsm-list">
          @for (fsm of fsms(); track fsm.id) {
            <li class="fsm-item">
              <div class="fsm-info">
                <strong>{{ fsm.name }}</strong>
                <span class="fsm-meta">
                  {{ fsm.states.length }} states · {{ fsm.transitions.length }} transitions
                </span>
              </div>
              <div class="fsm-actions">
                <button class="btn-secondary" [routerLink]="['/editor', fsm.id]">Edit</button>
                <button class="btn-danger" (click)="delete(fsm)">Delete</button>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .list-container { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .fsm-list { list-style: none; padding: 0; margin: 0; }
    .fsm-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 0.5rem; }
    .fsm-info { display: flex; flex-direction: column; gap: 0.25rem; }
    .fsm-meta { color: #666; font-size: 0.875rem; }
    .fsm-actions { display: flex; gap: 0.5rem; }
    .btn-primary { background: #1976d2; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    .btn-secondary { background: #f5f5f5; border: 1px solid #ccc; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    .btn-danger { background: #d32f2f; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    .empty-state { color: #666; text-align: center; padding: 3rem; }
  `],
})
export class FsmListComponent implements OnInit {
  private readonly api = inject(FsmApiService);
  private readonly router = inject(Router);

  readonly fsms = signal<FsmDefinition[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.api.list().subscribe({
      next: (list) => { this.fsms.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  delete(fsm: FsmDefinition): void {
    if (!fsm.id) return;
    this.fsms.update((list) => list.filter((f) => f.id !== fsm.id));
    this.api.delete(fsm.id).subscribe({
      error: () => this.fsms.update((list) => [...list, fsm]),
    });
  }
}
