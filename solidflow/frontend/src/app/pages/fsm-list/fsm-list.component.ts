import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { FsmDefinition } from '@solidflow/shared';
import { FsmApiService } from '../../core/services/fsm-api.service';

@Component({
  selector: 'app-fsm-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatRippleModule, MatProgressBarModule],
  template: `
    <div class="shell">
      <mat-toolbar class="topbar">
        <span class="brand">
          <span class="brand-mark">⬡</span>
          <span class="brand-name">SOLIDFLOW</span>
        </span>
        <span class="spacer"></span>
        <button mat-flat-button color="primary" routerLink="/editor/new" class="new-btn">
          <mat-icon>add</mat-icon>
          New Contract
        </button>
      </mat-toolbar>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" class="loader" />
      }

      <main class="content">
        <div class="hero">
          <h1 class="hero-title">FSM Contracts</h1>
          <p class="hero-sub">Finite state machines compiled to Solidity</p>
        </div>

        @if (!loading() && fsms().length === 0) {
          <div class="empty">
            <div class="empty-icon">⬡</div>
            <p class="empty-title">No contracts yet</p>
            <p class="empty-sub">Create your first finite state machine to get started.</p>
            <button mat-flat-button color="primary" routerLink="/editor/new">
              <mat-icon>add</mat-icon>
              Create Contract
            </button>
          </div>
        }

        @if (!loading() && fsms().length > 0) {
          <div class="grid">
            @for (fsm of fsms(); track fsm.id) {
              <div class="card" matRipple [routerLink]="['/editor', fsm.id]">
                <div class="card-accent"></div>
                <div class="card-body">
                  <div class="card-header">
                    <span class="contract-icon">◈</span>
                    <h2 class="contract-name">{{ fsm.name }}</h2>
                  </div>
                  <div class="badges">
                    <span class="badge badge-states">
                      <span class="badge-dot"></span>
                      {{ fsm.states.length }} states
                    </span>
                    <span class="badge badge-trans">
                      <span class="badge-dot"></span>
                      {{ fsm.transitions.length }} transitions
                    </span>
                  </div>
                  <div class="states-preview">
                    @for (s of fsm.states.slice(0, 4); track s) {
                      <span class="state-chip" [class.initial]="s === fsm.initialState">{{ s }}</span>
                    }
                    @if (fsm.states.length > 4) {
                      <span class="state-chip more">+{{ fsm.states.length - 4 }}</span>
                    }
                  </div>
                </div>
                <div class="card-footer">
                  <button mat-icon-button class="edit-btn" (click)="$event.stopPropagation()" [routerLink]="['/editor', fsm.id]" title="Edit">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button class="del-btn" (click)="$event.stopPropagation(); delete(fsm)" title="Delete">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--sf-bg); }
    .topbar { height: 56px; padding: 0 1.5rem; }
    .brand { display: flex; align-items: center; gap: 0.5rem; }
    .brand-mark { color: var(--sf-primary); font-size: 1.25rem; }
    .brand-name { font-family: var(--sf-brand); font-weight: 800; font-size: 0.95rem; letter-spacing: 0.15em; color: var(--sf-text); }
    .spacer { flex: 1; }
    .new-btn { border-radius: 6px !important; }
    .loader { position: fixed; top: 56px; left: 0; right: 0; z-index: 10; }
    .content { max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem; }
    .hero { margin-bottom: 2.5rem; }
    .hero-title { font-family: var(--sf-brand); font-size: 2.25rem; font-weight: 800; color: var(--sf-text); margin: 0 0 0.375rem; letter-spacing: -0.02em; }
    .hero-sub { font-size: 0.9rem; color: var(--sf-text-muted); margin: 0; }
    .empty { text-align: center; padding: 5rem 2rem; }
    .empty-icon { font-size: 4rem; color: var(--sf-border); margin-bottom: 1.5rem; }
    .empty-title { font-family: var(--sf-brand); font-size: 1.5rem; font-weight: 700; color: var(--sf-text); margin: 0 0 0.5rem; }
    .empty-sub { color: var(--sf-text-muted); font-size: 0.9rem; margin: 0 0 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .card { position: relative; overflow: hidden; background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius-lg); cursor: pointer; transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s; display: flex; flex-direction: column; }
    .card:hover { border-color: var(--sf-primary); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(41,182,246,0.1); }
    .card-accent { height: 3px; background: linear-gradient(90deg, var(--sf-primary), var(--sf-amber)); flex-shrink: 0; }
    .card-body { padding: 1.25rem 1.25rem 0.75rem; flex: 1; }
    .card-header { display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.875rem; }
    .contract-icon { color: var(--sf-primary); font-size: 1.1rem; }
    .contract-name { font-family: var(--sf-brand); font-size: 1.1rem; font-weight: 700; color: var(--sf-text); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .badges { display: flex; gap: 0.5rem; margin-bottom: 0.875rem; }
    .badge { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; font-family: var(--sf-mono); color: var(--sf-text-muted); background: var(--sf-surface); border: 1px solid var(--sf-border); padding: 0.2rem 0.6rem; border-radius: 20px; }
    .badge-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sf-primary); }
    .badge-trans .badge-dot { background: var(--sf-amber); }
    .states-preview { display: flex; flex-wrap: wrap; gap: 0.375rem; }
    .state-chip { font-size: 0.7rem; font-family: var(--sf-mono); color: var(--sf-text-dim); background: var(--sf-surface); border: 1px solid var(--sf-border-soft); padding: 0.15rem 0.5rem; border-radius: 4px; }
    .state-chip.initial { color: var(--sf-primary); border-color: var(--sf-primary-dim); background: var(--sf-primary-dim); }
    .state-chip.more { color: var(--sf-text-muted); }
    .card-footer { display: flex; justify-content: flex-end; gap: 0.25rem; padding: 0.5rem 0.75rem; border-top: 1px solid var(--sf-border-soft); }
    .edit-btn { color: var(--sf-text-muted) !important; }
    .edit-btn:hover { color: var(--sf-primary) !important; }
    .del-btn { color: var(--sf-text-muted) !important; }
    .del-btn:hover { color: var(--sf-error) !important; }
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
