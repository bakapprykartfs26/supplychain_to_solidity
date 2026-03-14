import { Route } from '@angular/router';
import { fsmResolver } from './pages/fsm-editor/fsm.resolver';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/fsm-list/fsm-list.component').then(
        (m) => m.FsmListComponent,
      ),
  },
  {
    path: 'editor/new',
    loadComponent: () =>
      import('./pages/fsm-editor/fsm-editor.component').then(
        (m) => m.FsmEditorComponent,
      ),
  },
  {
    path: 'editor/:id',
    resolve: { fsm: fsmResolver },
    loadComponent: () =>
      import('./pages/fsm-editor/fsm-editor.component').then(
        (m) => m.FsmEditorComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
