import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import type { FsmDefinition, FsmTransition } from '@solidflow/shared';
import { randomUUID } from '../../canvas/uuid';

@Component({
  selector: 'app-transitions-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatSlideToggleModule, MatExpansionModule],
  template: `
    <div class="panel">
      <div class="section-header">
        <mat-icon class="section-icon">arrow_forward</mat-icon>
        <span class="section-title">Transitions</span>
        <span class="count">{{ definition.transitions.length }}</span>
      </div>

      @if (definition.transitions.length === 0) {
        <p class="empty-hint">No transitions yet. Add one below or draw on the canvas.</p>
      }

      <mat-accordion>
        @for (t of definition.transitions; track t.id; let i = $index) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <span class="t-name">{{ t.name || 'Unnamed' }}</span>
                <span class="t-route">{{ t.from }} → {{ t.to }}</span>
              </mat-panel-title>
            </mat-expansion-panel-header>

            <div class="t-body">
              <mat-form-field appearance="fill" class="full-width">
                <mat-label>Function name</mat-label>
                <input matInput [ngModel]="t.name" (ngModelChange)="patchTransition(i, { name: $event })" spellcheck="false" />
              </mat-form-field>

              <div class="route-row">
                <mat-form-field appearance="fill" class="route-field">
                  <mat-label>From</mat-label>
                  <mat-select [ngModel]="t.from" (ngModelChange)="patchTransition(i, { from: $event })">
                    @for (s of definition.states; track s) {
                      <mat-option [value]="s">{{ s }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <span class="route-arrow">→</span>
                <mat-form-field appearance="fill" class="route-field">
                  <mat-label>To</mat-label>
                  <mat-select [ngModel]="t.to" (ngModelChange)="patchTransition(i, { to: $event })">
                    @for (s of definition.states; track s) {
                      <mat-option [value]="s">{{ s }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field appearance="fill" class="full-width">
                <mat-label>Guard condition</mat-label>
                <input matInput [ngModel]="t.guard ?? ''" (ngModelChange)="patchTransition(i, { guard: $event || undefined })" placeholder="e.g. msg.value > 0" spellcheck="false" class="mono-input" />
                <mat-hint>Solidity boolean expression</mat-hint>
              </mat-form-field>
              <div class="stmt-section">                                                                                                                                                 
              <span class="stmt-label">Statements</span>                                                                                                                                 
                                                                                                                                                                                      
              @for (stmt of (t.statements ?? []); track si; let si = $index) {
                <div class="stmt-row">
                  <input                                                                                                                                                                 
                    class="stmt-input"
                    [value]="stmt"                                                                                                                                                       
                    (input)="updateStatement(i, si, $any($event.target).value)"                                                                                                        
                    placeholder="e.g. balance[msg.sender] += 1;"
                    spellcheck="false"                                                                                                                                                   
                  />
                  <button mat-icon-button class="stmt-del-btn" (click)="removeStatement(i, si)">                                                                                         
                    <mat-icon>close</mat-icon>                                                                                                                                         
                  </button>
                </div>
              }                                                                                                                                                                          
            
              <button type="button" class="stmt-add-btn" (click)="addStatement(i)">                                                                                                      
                <mat-icon>add</mat-icon>                                                                                                                                               
                Add statement
              </button>
            </div>

              <div class="toggle-row">
                <mat-slide-toggle
                  [ngModel]="t.emitEvent ?? false"
                  (ngModelChange)="patchTransition(i, { emitEvent: $event })"
                  color="primary"
                >
                  Emit StateChanged event
                </mat-slide-toggle>
              </div>

              <button mat-button class="remove-btn" (click)="removeTransition(i)">
                <mat-icon>delete_outline</mat-icon>
                Remove transition
              </button>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>

      <button mat-stroked-button class="add-btn" (click)="addTransition()">
        <mat-icon>add</mat-icon>
        Add Transition
      </button>
    </div>
  `,
  styles: [`
    .panel { padding: 1rem; }
    .section-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
    .section-icon { color: var(--sf-amber); font-size: 18px; width: 18px; height: 18px; }
    .section-title { font-family: var(--sf-brand); font-size: 0.85rem; font-weight: 700; color: var(--sf-text); letter-spacing: 0.05em; text-transform: uppercase; flex: 1; }
    .count { font-family: var(--sf-mono); font-size: 0.72rem; color: var(--sf-text-muted); background: var(--sf-border); padding: 0.1rem 0.5rem; border-radius: 10px; }
    .empty-hint { font-size: 0.8rem; color: var(--sf-text-muted); text-align: center; padding: 1rem 0; margin: 0 0 1rem; }
    .t-name { font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text); font-weight: 500; }
    .t-route { font-size: 0.75rem; color: var(--sf-text-muted); margin-left: 0.5rem; }
    .t-body { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.5rem; }
    .full-width { width: 100%; }
    .route-row { display: flex; align-items: center; gap: 0.5rem; }
    .route-field { flex: 1; }
    .route-arrow { color: var(--sf-amber); font-weight: 700; flex-shrink: 0; }
    .mono-input { font-family: var(--sf-mono) !important; font-size: 0.82rem !important; }
    .toggle-row { padding: 0.25rem 0; }
    .remove-btn { color: var(--sf-error) !important; width: 100%; margin-top: 0.25rem; }
    .add-btn { width: 100%; margin-top: 0.75rem; border-color: var(--sf-border) !important; color: var(--sf-text-muted) !important; border-style: dashed !important; }
    .add-btn:hover { border-color: var(--sf-primary) !important; color: var(--sf-primary) !important; }
    .stmt-section { display: flex; flex-direction: column; gap: 0.375rem; }
    .stmt-label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-muted); }                                         
    .stmt-row { display: flex; align-items: center; gap: 0.375rem; }                                                                                                             
    .stmt-input { flex: 1; min-width: 0; height: 34px; background: var(--sf-elevated); border: 1px solid var(--sf-border); border-radius: var(--sf-radius); padding: 0 0.625rem; 
    font-family: var(--sf-mono); font-size: 0.82rem; color: var(--sf-text); outline: none; transition: border-color 0.15s; }                                                     
    .stmt-input:focus { border-color: var(--sf-primary); }                                                                                                                     
    .stmt-del-btn { color: var(--sf-error) !important; width: 28px; height: 28px; flex-shrink: 0; display: flex !important; align-items: center; justify-content: center; padding: 0 !important; line-height: 1; }                                                                              
    .stmt-add-btn { display: flex; align-items: center; gap: 0.25rem; background: transparent; border: 1px dashed var(--sf-border); border-radius: var(--sf-radius); padding:    
    0.25rem 0.5rem; color: var(--sf-text-muted); font-size: 0.78rem; cursor: pointer; width: 100%; transition: border-color 0.15s, color 0.15s; }                                
    .stmt-add-btn:hover { border-color: var(--sf-primary); color: var(--sf-primary); }                                                                                           
    .stmt-add-btn mat-icon { font-size: 14px; width: 14px; height: 14px; }
  `],
})
export class TransitionsPanelComponent {
  @Input() definition!: FsmDefinition;
  @Output() definitionChange = new EventEmitter<FsmDefinition>();

  addTransition(): void {
    const t: FsmTransition = {
      id: randomUUID(),
      name: `transition${this.definition.transitions.length + 1}`,
      from: this.definition.states[0] ?? '',
      to: this.definition.states[1] ?? this.definition.states[0] ?? '',
    };
    this.definitionChange.emit({ ...this.definition, transitions: [...this.definition.transitions, t] });
  }

  patchTransition(index: number, partial: Partial<FsmTransition>): void {
    const transitions = this.definition.transitions.map((t, i) => i === index ? { ...t, ...partial } : t);
    this.definitionChange.emit({ ...this.definition, transitions });
  }

  removeTransition(index: number): void {
    const transitions = this.definition.transitions.filter((_, i) => i !== index);
    this.definitionChange.emit({ ...this.definition, transitions });
  }

  addStatement(tIndex: number): void {
    const t = this.definition.transitions[tIndex];                                                                                                                             
    this.patchTransition(tIndex, { statements: [...(t.statements ?? []), ''] });
  }

  updateStatement(tIndex: number, stmtIndex: number, value: string): void {                                                                                                    
    const t = this.definition.transitions[tIndex];
    const statements = (t.statements ?? []).map((s, i) => i === stmtIndex ? value : s);                                                                                        
    this.patchTransition(tIndex, { statements });                                                                                                                            
  }

  removeStatement(tIndex: number, stmtIndex: number): void {                                                                                                                   
    const t = this.definition.transitions[tIndex];
    const statements = (t.statements ?? []).filter((_, i) => i !== stmtIndex);                                                                                                 
    this.patchTransition(tIndex, { statements: statements.length ? statements : undefined });                                                                                
  }
}
