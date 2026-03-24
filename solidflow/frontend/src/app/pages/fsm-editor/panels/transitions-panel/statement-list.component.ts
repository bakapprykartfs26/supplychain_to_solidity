import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import type { FsmForLoop, FsmIfStatement, FsmStatement } from '@solidflow/shared';

@Component({
  selector: 'app-statement-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, DragDropModule],
  template: `
    <div cdkDropList class="stmt-drop-list" (cdkDropListDropped)="onDrop($event)">
    @for (stmt of statements; track si; let si = $index) {
      @if (isString(stmt)) {
        <div class="stmt-row" cdkDrag>
          <input
            class="stmt-input"
            [value]="stmt"
            (input)="updateStatement(si, $any($event.target).value)"
            placeholder="e.g. counter++"
            spellcheck="false"
          />
          <button mat-icon-button class="stmt-drag-handle" cdkDragHandle>
            <mat-icon>drag_indicator</mat-icon>
          </button>
          <button mat-icon-button class="stmt-del-btn" (click)="removeStatement(si)">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      } @else if (isForLoop(stmt)) {
        <div class="for-card" cdkDrag>
          <div class="for-header">
            <span class="for-kw">for</span>
            <span class="for-paren">(</span>
            <input class="for-input" [value]="asForLoop(stmt).init"
                   (input)="patchForLoop(si, 'init', $any($event.target).value)"
                   placeholder="uint i = 0" spellcheck="false" />
            <span class="for-sep">;</span>
            <input class="for-input" [value]="asForLoop(stmt).condition"
                   (input)="patchForLoop(si, 'condition', $any($event.target).value)"
                   placeholder="i &lt; arr.length" spellcheck="false" />
            <span class="for-sep">;</span>
            <input class="for-input" [value]="asForLoop(stmt).increment"
                   (input)="patchForLoop(si, 'increment', $any($event.target).value)"
                   placeholder="i++" spellcheck="false" />
            <span class="for-paren">)</span>
            <button mat-icon-button class="stmt-drag-handle" cdkDragHandle>
              <mat-icon>drag_indicator</mat-icon>
            </button>
            <button mat-icon-button class="stmt-del-btn" (click)="removeStatement(si)">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="for-body">
            <app-statement-list
              [statements]="asForLoop(stmt).body"
              (statementsChange)="updateForBody(si, $event)"
            />
          </div>
        </div>
      } @else {
        <div class="if-card" cdkDrag>
          <div class="if-header">
            <span class="if-kw">if</span>
            <span class="for-paren">(</span>
            <input class="for-input" [value]="asIfStatement(stmt).condition"
                   (input)="patchIfCond(si, $any($event.target).value)"
                   placeholder="x > 0" spellcheck="false" />
            <span class="for-paren">)</span>
            <button mat-icon-button class="stmt-drag-handle" cdkDragHandle>
              <mat-icon>drag_indicator</mat-icon>
            </button>
            <button mat-icon-button class="stmt-del-btn" (click)="removeStatement(si)">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="if-branch-body">
            <app-statement-list
              [statements]="asIfStatement(stmt).body"
              (statementsChange)="updateIfBody(si, $event)"
            />
          </div>

          @for (ei of asIfStatement(stmt).elseIfs; track eiI; let eiI = $index) {
            <div class="if-elseif-header">
              <span class="if-kw">else if</span>
              <span class="for-paren">(</span>
              <input class="for-input" [value]="ei.condition"
                     (input)="patchElseIfCond(si, eiI, $any($event.target).value)"
                     placeholder="x == 0" spellcheck="false" />
              <span class="for-paren">)</span>
              <button mat-icon-button class="stmt-del-btn" (click)="removeElseIf(si, eiI)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="if-branch-body">
              <app-statement-list
                [statements]="ei.body"
                (statementsChange)="updateElseIfBody(si, eiI, $event)"
              />
            </div>
          }

          @if (asIfStatement(stmt).elseBranch !== undefined) {
            <div class="if-else-header">
              <span class="if-kw">else</span>
              <button mat-icon-button class="stmt-del-btn" (click)="removeElse(si)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="if-branch-body">
              <app-statement-list
                [statements]="asIfStatement(stmt).elseBranch!"
                (statementsChange)="updateElseBody(si, $event)"
              />
            </div>
          }

          <div class="if-footer">
            <button type="button" class="stmt-add-btn" (click)="addElseIf(si)">
              <mat-icon>add</mat-icon> Add else if
            </button>
            @if (asIfStatement(stmt).elseBranch === undefined) {
              <button type="button" class="stmt-add-btn" (click)="addElse(si)">
                <mat-icon>add</mat-icon> Add else
              </button>
            }
          </div>
        </div>
      }
    }
    </div>

    <div class="stmt-actions">
      <button type="button" class="stmt-add-btn" (click)="addStatement()">
        <mat-icon>add</mat-icon>
        Add statement
      </button>
      <button type="button" class="stmt-add-btn for-loop-btn" (click)="addForLoop()">
        <mat-icon>loop</mat-icon>
        Add for loop
      </button>
      <button type="button" class="stmt-add-btn if-stmt-btn" (click)="addIfStatement()">
        <mat-icon>device_hub</mat-icon>
        Add if
      </button>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; }
    .stmt-drop-list { display: flex; flex-direction: column; gap: 0.375rem; }
    .stmt-drag-handle { color: var(--sf-text-muted) !important; cursor: grab; width: 28px; height: 28px; flex-shrink: 0; display: flex !important; align-items: center; justify-content: center; padding: 0 !important; }
    .stmt-drag-handle:active { cursor: grabbing; }
    .cdk-drag-preview { background: var(--sf-elevated); border: 1px solid var(--sf-primary); border-radius: var(--sf-radius); box-shadow: 0 4px 16px rgba(0,0,0,0.25); opacity: 0.95; }
    .cdk-drag-placeholder { opacity: 0.3; border: 1px dashed var(--sf-border); border-radius: var(--sf-radius); background: transparent; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0, 0, 0.2, 1); }
    .stmt-drop-list.cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) { transition: transform 200ms cubic-bezier(0, 0, 0.2, 1); }
    .stmt-row { display: flex; align-items: center; gap: 0.375rem; }
    .stmt-input { flex: 1; min-width: 0; height: 34px; background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius); padding: 0 0.625rem; font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text); outline: none; transition: border-color 0.15s; }
    .stmt-input:focus { border-color: var(--sf-primary); }
    .stmt-del-btn { color: var(--sf-error) !important; width: 28px; height: 28px; flex-shrink: 0; display: flex !important; align-items: center; justify-content: center; padding: 0 !important; line-height: 1; }
    .stmt-add-btn { display: flex; align-items: center; gap: 0.25rem; background: transparent; border: 1px dashed var(--sf-border); border-radius: var(--sf-radius); padding: 0.25rem 0.5rem; color: var(--sf-text-muted); font-size: 0.78rem; cursor: pointer; width: 100%; transition: border-color 0.15s, color 0.15s; }
    .stmt-add-btn:hover { border-color: var(--sf-primary); color: var(--sf-primary); }
    .stmt-add-btn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .stmt-actions { display: flex; gap: 0.375rem; }
    .stmt-actions .stmt-add-btn { flex: 1; }
    .for-loop-btn { border-color: var(--sf-amber) !important; color: var(--sf-amber) !important; }
    .for-loop-btn:hover { background: color-mix(in srgb, var(--sf-amber) 10%, transparent) !important; }
    .for-card { border: 1px solid var(--sf-amber); border-radius: var(--sf-radius); overflow: hidden; }
    .for-header { display: flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.5rem; background: color-mix(in srgb, var(--sf-amber) 8%, var(--sf-elevated)); flex-wrap: wrap; }
    .for-kw { font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-amber); font-weight: 600; flex-shrink: 0; }
    .for-paren { font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text-muted); flex-shrink: 0; }
    .for-sep { font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text-muted); flex-shrink: 0; }
    .for-input { flex: 1; min-width: 60px; height: 28px; background: var(--sf-surface); border: 1px solid var(--sf-border); border-radius: 4px; padding: 0 0.4rem; font-family: var(--sf-mono); font-size: 0.78rem; color: var(--sf-text); outline: none; transition: border-color 0.15s; }
    .for-input:focus { border-color: var(--sf-amber); }
    .for-body { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.375rem 0.5rem; border-top: 1px solid color-mix(in srgb, var(--sf-amber) 25%, transparent); background: var(--sf-surface); }
    .if-card { border: 1px solid var(--sf-primary); border-radius: var(--sf-radius); overflow: hidden; }
    .if-header { display: flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.5rem; background: color-mix(in srgb, var(--sf-primary) 8%, var(--sf-elevated)); flex-wrap: wrap; }
    .if-elseif-header { display: flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.5rem; background: color-mix(in srgb, var(--sf-primary) 5%, var(--sf-elevated)); border-top: 1px solid color-mix(in srgb, var(--sf-primary) 20%, transparent); flex-wrap: wrap; }
    .if-else-header { display: flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.5rem; background: color-mix(in srgb, var(--sf-primary) 5%, var(--sf-elevated)); border-top: 1px solid color-mix(in srgb, var(--sf-primary) 20%, transparent); }
    .if-kw { font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-primary); font-weight: 600; flex-shrink: 0; }
    .if-branch-body { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.375rem 0.5rem; background: var(--sf-surface); border-top: 1px solid color-mix(in srgb, var(--sf-primary) 15%, transparent); }
    .if-footer { display: flex; gap: 0.375rem; padding: 0.375rem 0.5rem; background: var(--sf-elevated); border-top: 1px solid color-mix(in srgb, var(--sf-primary) 20%, transparent); }
    .if-footer .stmt-add-btn { flex: 1; }
    .if-stmt-btn { border-color: var(--sf-primary) !important; color: var(--sf-primary) !important; }
    .if-stmt-btn:hover { background: color-mix(in srgb, var(--sf-primary) 10%, transparent) !important; }
  `],
})
export class StatementListComponent {
  @Input() statements: FsmStatement[] = [];
  @Output() statementsChange = new EventEmitter<FsmStatement[]>();

  // type guards / casts
  isString(s: FsmStatement): s is string         { return typeof s === 'string'; }
  isForLoop(s: FsmStatement): s is FsmForLoop    { return typeof s === 'object' && (s as FsmForLoop).type === 'for'; }
  asForLoop(s: FsmStatement): FsmForLoop         { return s as FsmForLoop; }
  asIfStatement(s: FsmStatement): FsmIfStatement { return s as FsmIfStatement; }

  onDrop(event: CdkDragDrop<FsmStatement[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const updated = [...this.statements];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.statementsChange.emit(updated);
  }

  private emit(stmts: FsmStatement[]): void { this.statementsChange.emit(stmts); }
  private patch(i: number, fn: (s: FsmStatement) => FsmStatement): void {
    this.emit(this.statements.map((s, idx) => idx === i ? fn(s) : s));
  }

  // string statements
  addStatement(): void                          { this.emit([...this.statements, '']); }
  updateStatement(i: number, v: string): void   { this.patch(i, () => v); }
  removeStatement(i: number): void              { this.emit(this.statements.filter((_, idx) => idx !== i)); }

  // for-loop
  addForLoop(): void {
    this.emit([...this.statements, { type: 'for', init: '', condition: '', increment: '', body: [] }]);
  }
  patchForLoop(i: number, field: 'init' | 'condition' | 'increment', v: string): void {
    this.patch(i, s => ({ ...(s as FsmForLoop), [field]: v }));
  }
  updateForBody(i: number, body: FsmStatement[]): void {
    this.patch(i, s => ({ ...(s as FsmForLoop), body }));
  }

  // if-statement
  addIfStatement(): void {
    this.emit([...this.statements, { type: 'if', condition: '', body: [], elseIfs: [] }]);
  }
  patchIfCond(i: number, v: string): void {
    this.patch(i, s => ({ ...(s as FsmIfStatement), condition: v }));
  }
  updateIfBody(i: number, body: FsmStatement[]): void {
    this.patch(i, s => ({ ...(s as FsmIfStatement), body }));
  }
  addElseIf(i: number): void {
    this.patch(i, s => ({ ...(s as FsmIfStatement), elseIfs: [...(s as FsmIfStatement).elseIfs, { condition: '', body: [] }] }));
  }
  removeElseIf(i: number, eiI: number): void {
    this.patch(i, s => ({ ...(s as FsmIfStatement), elseIfs: (s as FsmIfStatement).elseIfs.filter((_, j) => j !== eiI) }));
  }
  patchElseIfCond(i: number, eiI: number, v: string): void {
    this.patch(i, s => ({
      ...(s as FsmIfStatement),
      elseIfs: (s as FsmIfStatement).elseIfs.map((ei, j) => j === eiI ? { ...ei, condition: v } : ei),
    }));
  }
  updateElseIfBody(i: number, eiI: number, body: FsmStatement[]): void {
    this.patch(i, s => ({
      ...(s as FsmIfStatement),
      elseIfs: (s as FsmIfStatement).elseIfs.map((ei, j) => j === eiI ? { ...ei, body } : ei),
    }));
  }
  addElse(i: number): void {
    this.patch(i, s => ({ ...(s as FsmIfStatement), elseBranch: [] }));
  }
  removeElse(i: number): void {
    this.patch(i, s => { const { elseBranch: _, ...rest } = s as FsmIfStatement; return rest as FsmIfStatement; });
  }
  updateElseBody(i: number, body: FsmStatement[]): void {
    this.patch(i, s => ({ ...(s as FsmIfStatement), elseBranch: body }));
  }
}
