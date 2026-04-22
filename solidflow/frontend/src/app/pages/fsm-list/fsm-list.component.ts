import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { FsmDefinition } from '@solidflow/shared';
import { FsmApiService } from '../../core/services/fsm-api.service';

const CARD_COLORS = ['#7c5cfc', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

@Component({
  selector: 'app-fsm-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="shell">

      <!-- Nav -->
      <nav class="nav">
        <div class="logo">
          <div class="logo-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L13 5V11L8 14L3 11V5L8 2Z" fill="white" opacity="0.9"/>
              <path d="M8 5L11 6.5V9.5L8 11L5 9.5V6.5L8 5Z" fill="white" opacity="0.5"/>
            </svg>
          </div>
          <span class="logo-text">Solidflow</span>
        </div>
        <div class="nav-spacer"></div>
        <div class="search-wrap">
          <span class="search-icon">⌕</span>
          <input class="search-input" [(ngModel)]="searchQuery" placeholder="Search contracts…" />
        </div>
        <button class="new-btn" routerLink="/editor/new">
          <span class="new-btn-plus">+</span> New Contract
        </button>
      </nav>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" class="loader" />
      }

      <main class="content">
        <!-- Hero -->
        <div class="hero">
          <h1 class="hero-title">Your Contracts</h1>
          <p class="hero-sub">
            {{ fsms().length }} contract{{ fsms().length !== 1 ? 's' : '' }} · Design finite state machines, export to Solidity
          </p>
        </div>

        <!-- Empty state -->
        @if (!loading() && fsms().length === 0) {
          <div class="empty">
            <div class="empty-icon">◎</div>
            <p class="empty-title">No contracts yet</p>
            <p class="empty-sub">Create your first contract to get started</p>
            <button class="new-btn" routerLink="/editor/new">Create Contract</button>
          </div>
        }

        <!-- Grid -->
        @if (!loading() && filtered().length > 0) {
          <div class="grid">
            @for (fsm of filtered(); track fsm.id; let i = $index) {
              <div class="card"
                [style.--card-color]="getColor(i)"
                (click)="navigate(fsm)"
                (mouseenter)="hoveredId.set(fsm.id ?? null)"
                (mouseleave)="hoveredId.set(null)"
                [class.hovered]="hoveredId() === fsm.id">
                <div class="card-bar"></div>
                <div class="card-body">
                  <div class="card-head">
                    <div class="card-icon">◈</div>
                    <div class="card-meta">
                      <h2 class="card-name">{{ fsm.name }}</h2>
                      <p class="card-sub">Smart contract · Solidity</p>
                    </div>
                  </div>
                  <div class="stats-row">
                    <div class="stat">
                      <div class="stat-num" style="color: var(--card-color)">{{ fsm.states.length }}</div>
                      <div class="stat-label">States</div>
                    </div>
                    <div class="stat">
                      <div class="stat-num amber">{{ fsm.transitions.length }}</div>
                      <div class="stat-label">Transitions</div>
                    </div>
                    <div class="stat">
                      <div class="stat-num green">{{ (fsm.variables ?? []).length }}</div>
                      <div class="stat-label">Variables</div>
                    </div>
                  </div>
                  <div class="chips">
                    @for (s of fsm.states.slice(0, 5); track s) {
                      <span class="chip" [class.chip-initial]="s === fsm.initialState"
                        [style.color]="s === fsm.initialState ? getColor(i) : null"
                        [style.background]="s === fsm.initialState ? getColor(i) + '15' : null"
                        [style.border-color]="s === fsm.initialState ? getColor(i) + '44' : null">
                        {{ s }}
                      </span>
                    }
                    @if (fsm.states.length > 5) {
                      <span class="chip chip-more">+{{ fsm.states.length - 5 }}</span>
                    }
                  </div>
                </div>
                <div class="card-footer">
                  <div class="plugin-badges">
                    @for (entry of activePlugins(fsm).slice(0, 3); track entry) {
                      <span class="plugin-badge">{{ entry }}</span>
                    }
                  </div>
                  <div class="card-actions">
                    <button class="action-btn" title="Edit" (click)="$event.stopPropagation(); navigate(fsm)">✎</button>
                    <button class="action-btn action-btn-del" title="Delete" (click)="$event.stopPropagation(); confirmDelete.set(fsm)">⊗</button>
                  </div>
                </div>
              </div>
            }
          </div>
        }

        @if (!loading() && filtered().length === 0 && fsms().length > 0) {
          <div class="no-results">No contracts match "{{ searchQuery }}"</div>
        }
      </main>

      <!-- Delete confirmation modal -->
      @if (confirmDelete()) {
        <div class="modal-backdrop" (click)="confirmDelete.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3 class="modal-title">Delete contract?</h3>
            <p class="modal-body">
              <strong>{{ confirmDelete()!.name }}</strong> will be permanently removed.
            </p>
            <div class="modal-actions">
              <button class="modal-cancel" (click)="confirmDelete.set(null)">Cancel</button>
              <button class="modal-delete" (click)="doDelete()">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--sf-bg); }

    /* ── Nav ─────────────────────────────────────────────────────────────── */
    .nav {
      height: 60px; background: var(--sf-surface);
      border-bottom: 1px solid var(--sf-border);
      display: flex; align-items: center; padding: 0 2rem; gap: 1rem;
      position: sticky; top: 0; z-index: 10;
      box-shadow: 0 1px 0 rgba(0,0,0,0.05);
    }
    .logo { display: flex; align-items: center; gap: 8px; }
    .logo-mark {
      width: 28px; height: 28px;
      background: linear-gradient(135deg, #7c5cfc, #a78bfa);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .logo-text { font-family: var(--sf-brand); font-weight: 800; font-size: 1rem; color: var(--sf-text); letter-spacing: -0.01em; }
    .nav-spacer { flex: 1; }

    .search-wrap { position: relative; width: 240px; }
    .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--sf-text-dim); font-size: 14px; pointer-events: none; }
    .search-input {
      width: 100%; padding: 0.45rem 0.75rem 0.45rem 2rem;
      background: var(--sf-elevated); border: 1.5px solid var(--sf-border); border-radius: 8px;
      font-family: var(--sf-sans); font-size: 0.875rem; color: var(--sf-text); outline: none;
      transition: border-color 0.15s;
    }
    .search-input:focus { border-color: var(--sf-primary); }
    .search-input::placeholder { color: var(--sf-text-dim); }

    .new-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 0.5rem 1.125rem;
      background: var(--sf-primary); border: none; border-radius: 8px;
      color: white; font-family: var(--sf-sans); font-weight: 700; font-size: 0.875rem;
      cursor: pointer; letter-spacing: -0.01em;
      box-shadow: 0 2px 8px rgba(124,92,252,0.25); transition: all 0.15s;
      text-decoration: none;
    }
    .new-btn:hover { background: #6b4edb; transform: translateY(-1px); }
    .new-btn-plus { font-size: 18px; line-height: 1; font-weight: 300; }

    .loader { position: fixed; top: 60px; left: 0; right: 0; z-index: 10; }

    /* ── Content ─────────────────────────────────────────────────────────── */
    .content { max-width: 1100px; margin: 0 auto; padding: 3rem 2rem; }

    .hero { margin-bottom: 2.5rem; animation: sf-fade-in 0.3s ease; }
    .hero-title { font-family: var(--sf-brand); font-weight: 800; font-size: 2rem; color: var(--sf-text); margin: 0 0 6px; letter-spacing: -0.03em; }
    .hero-sub { font-family: var(--sf-sans); font-size: 0.9rem; color: var(--sf-text-muted); margin: 0; }

    /* ── Empty ───────────────────────────────────────────────────────────── */
    .empty { text-align: center; padding: 6rem 2rem; animation: sf-fade-in 0.4s ease; }
    .empty-icon { width: 80px; height: 80px; background: var(--sf-primary-dim); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem; color: var(--sf-primary); }
    .empty-title { font-family: var(--sf-brand); font-weight: 700; font-size: 1.25rem; color: var(--sf-text); margin: 0 0 8px; }
    .empty-sub { font-family: var(--sf-sans); font-size: 0.875rem; color: var(--sf-text-muted); margin: 0 0 28px; }

    /* ── Grid ────────────────────────────────────────────────────────────── */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; animation: sf-fade-in 0.3s ease; }
    .no-results { text-align: center; padding: 4rem; color: var(--sf-text-muted); font-family: var(--sf-sans); }

    /* ── Card ────────────────────────────────────────────────────────────── */
    .card {
      background: var(--sf-surface);
      border: 1.5px solid var(--sf-border);
      border-radius: 14px; cursor: pointer;
      display: flex; flex-direction: column; overflow: hidden;
      transition: all 0.2s;
      box-shadow: var(--sf-shadow);
    }
    .card.hovered {
      border-color: color-mix(in srgb, var(--card-color) 40%, transparent);
      transform: translateY(-3px);
      box-shadow: 0 16px 48px rgba(0,0,0,0.1), 0 0 0 1px color-mix(in srgb, var(--card-color) 13%, transparent);
    }
    .card-bar {
      height: 4px;
      background: linear-gradient(90deg, var(--card-color), color-mix(in srgb, var(--card-color) 55%, transparent));
      flex-shrink: 0;
    }
    .card-body { padding: 1.25rem; flex: 1; }

    .card-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 1rem; }
    .card-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: color-mix(in srgb, var(--card-color) 10%, transparent);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 18px; color: var(--card-color);
    }
    .card-meta { flex: 1; min-width: 0; }
    .card-name { font-family: var(--sf-brand); font-weight: 800; font-size: 1rem; color: var(--sf-text); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
    .card-sub { font-family: var(--sf-sans); font-size: 0.75rem; color: var(--sf-text-muted); margin: 2px 0 0; }

    .stats-row { display: flex; gap: 8px; margin-bottom: 1rem; }
    .stat { flex: 1; background: var(--sf-elevated); border-radius: 8px; padding: 0.5rem 0.75rem; text-align: center; }
    .stat-num { font-family: var(--sf-brand); font-weight: 800; font-size: 1.25rem; color: var(--sf-primary); line-height: 1; }
    .stat-num.amber { color: var(--sf-amber); }
    .stat-num.green { color: var(--sf-success); }
    .stat-label { font-family: var(--sf-sans); font-size: 0.7rem; color: var(--sf-text-muted); margin-top: 2px; }

    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .chip {
      font-family: var(--sf-sans); font-size: 0.72rem; font-weight: 600;
      color: var(--sf-text-muted); background: var(--sf-elevated);
      border: 1px solid var(--sf-border); padding: 3px 9px; border-radius: 20px;
    }
    .chip-more { color: var(--sf-text-dim); }

    .card-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 1.25rem; border-top: 1px solid var(--sf-border);
    }
    .plugin-badges { display: flex; gap: 4px; }
    .plugin-badge {
      font-family: var(--sf-sans); font-size: 0.68rem; color: var(--sf-text-muted);
      background: var(--sf-elevated); padding: 2px 7px; border-radius: 20px;
      border: 1px solid var(--sf-border);
    }
    .card-actions { display: flex; gap: 4px; }
    .action-btn {
      width: 28px; height: 28px; background: transparent;
      border: 1px solid transparent; border-radius: 6px;
      color: var(--sf-text-dim); cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .action-btn:hover { color: var(--sf-primary); background: var(--sf-primary-dim); border-color: rgba(124,92,252,0.3); }
    .action-btn-del:hover { color: var(--sf-error); background: var(--sf-error-dim); border-color: rgba(239,68,68,0.3); }

    /* ── Delete modal ────────────────────────────────────────────────────── */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(15,14,23,0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 999; backdrop-filter: blur(4px);
    }
    .modal {
      background: var(--sf-surface); border-radius: 16px; padding: 2rem;
      max-width: 380px; width: 90%; box-shadow: var(--sf-shadow-lg);
      animation: sf-slide-up 0.18s ease;
    }
    .modal-title { font-family: var(--sf-brand); font-weight: 800; font-size: 1.1rem; color: var(--sf-text); margin: 0 0 8px; }
    .modal-body { font-family: var(--sf-sans); font-size: 0.875rem; color: var(--sf-text-muted); margin: 0 0 24px; line-height: 1.6; }
    .modal-body strong { color: var(--sf-text); }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .modal-cancel {
      padding: 0.5rem 1.125rem; background: var(--sf-surface);
      border: 1.5px solid var(--sf-border); border-radius: 8px;
      color: var(--sf-text-muted); font-family: var(--sf-sans); font-weight: 600; cursor: pointer;
    }
    .modal-delete {
      padding: 0.5rem 1.125rem; background: var(--sf-error-dim);
      border: 1.5px solid rgba(239,68,68,0.33); border-radius: 8px;
      color: var(--sf-error); font-family: var(--sf-sans); font-weight: 700; cursor: pointer;
    }
  `],
})
export class FsmListComponent implements OnInit {
  private readonly api = inject(FsmApiService);
  private readonly router = inject(Router);

  readonly fsms = signal<FsmDefinition[]>([]);
  readonly loading = signal(true);
  readonly hoveredId = signal<string | null>(null);
  readonly confirmDelete = signal<FsmDefinition | null>(null);

  searchQuery = '';

  ngOnInit(): void {
    this.api.list().subscribe({
      next: (list) => { this.fsms.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  filtered() {
    const q = this.searchQuery.toLowerCase();
    return q ? this.fsms().filter((f) => f.name.toLowerCase().includes(q)) : this.fsms();
  }

  navigate(fsm: FsmDefinition): void {
    this.router.navigate(['/editor', fsm.id]);
  }

  getColor(index: number): string {
    return CARD_COLORS[index % CARD_COLORS.length];
  }

  activePlugins(fsm: FsmDefinition): string[] {
    return Object.entries(fsm.plugins ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  doDelete(): void {
    const fsm = this.confirmDelete();
    if (!fsm?.id) return;
    this.confirmDelete.set(null);
    this.fsms.update((list) => list.filter((f) => f.id !== fsm.id));
    this.api.delete(fsm.id).subscribe({
      error: () => this.fsms.update((list) => [...list, fsm]),
    });
  }
}
