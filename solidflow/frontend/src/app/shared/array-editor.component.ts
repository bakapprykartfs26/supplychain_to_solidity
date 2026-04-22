import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import type { ArrayDimension } from '@solidflow/shared';

@Component({
  selector: 'app-array-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCheckboxModule, MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule],
  template: `
    <div class="array-root">
      <mat-checkbox
        color="primary"
        [ngModel]="isArray"
        (ngModelChange)="isArrayChange.emit($event)"
        class="array-check"
      >Array</mat-checkbox>

      @if (isArray) {
        <div class="dimensions">
          @for (dim of dimensions; track j; let j = $index) {
            <div class="dim-row">
              <mat-form-field appearance="fill" class="dim-field">
                <mat-label>Size [{{ j }}]</mat-label>
                <input matInput class="mono"
                  [ngModel]="dim.size"
                  (ngModelChange)="patchDimension(j, $event)"
                  placeholder="dynamic" />
              </mat-form-field>
              <button mat-icon-button class="dim-remove" (click)="removeDimension(j)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          <button mat-button class="add-dim-btn" (click)="addDimension()">
            <mat-icon>add</mat-icon> Add dimension
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .array-root { display: flex; flex-direction: column; gap: 0.25rem; }
    .array-check { font-size: 0.8rem; }
    .dimensions { display: flex; flex-direction: column; gap: 0.25rem; padding-left: 0.5rem; border-left: 2px solid var(--sf-primary); margin-left: 0.25rem; }
    .dim-row { display: flex; align-items: center; gap: 0.375rem; }
    .dim-field { flex: 1; }
    .dim-remove { width: 28px; height: 28px; color: var(--sf-error) !important; flex-shrink: 0; }
    .dim-remove mat-icon { font-size: 16px; }
    .add-dim-btn { font-size: 0.75rem; color: var(--sf-primary) !important; height: 28px; }
    .mono { font-family: var(--sf-mono) !important; font-size: 0.82rem !important; }
  `],
})
export class ArrayEditorComponent {
  @Input() isArray: boolean = false;
  @Input() dimensions: ArrayDimension[] = [];
  @Output() isArrayChange = new EventEmitter<boolean>();
  @Output() dimensionsChange = new EventEmitter<ArrayDimension[]>();

  addDimension(): void {
    this.dimensionsChange.emit([...this.dimensions, { size: '' }]);
  }

  removeDimension(index: number): void {
    this.dimensionsChange.emit(this.dimensions.filter((_, i) => i !== index));
  }

  patchDimension(index: number, size: string): void {
    this.dimensionsChange.emit(this.dimensions.map((d, i) => i === index ? { size } : d));
  }
}