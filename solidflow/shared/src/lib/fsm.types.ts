export interface FsmForLoop {
  type: 'for';
  init: string;
  condition: string;
  increment: string;
  body: FsmStatement[];
}

export interface FsmIfStatement {
  type: 'if';
  condition: string;
  body: FsmStatement[];
  elseIfs: { condition: string; body: FsmStatement[] }[];
  elseBranch?: FsmStatement[];
}

export type FsmStatement = string | FsmForLoop | FsmIfStatement;

export interface FsmTransition {
  id: string;
  name: string;
  from: string;
  to: string;
  guard?: string;
  statementsMode?: 'guided' | 'code';
  statements?: FsmStatement[];
  rawStatements?: string;
  emitEvent?: boolean;
}

export interface FsmContractVariable {
  name: string;
  type: string;
  visibility?: 'public' | 'private' | 'internal';
  initialValue?: string;
}

export interface FsmCustomType {
  name: string;
  fields: { name: string; type: string }[];
}

export interface FsmPlugins {
  locking?: boolean;
  accessControl?: boolean;
  transitionCounter?: boolean;
  timedTransitions?: boolean;
  event?: boolean;
}

export interface FsmDefinition {
  id?: string;
  name: string;
  states: string[];
  initialState: string;
  transitions: FsmTransition[];
  variables?: FsmContractVariable[];
  customTypes?: FsmCustomType[];
  plugins?: FsmPlugins;
  createdAt?: string;
  updatedAt?: string;
}
