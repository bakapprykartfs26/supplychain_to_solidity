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

export interface FsmEventParam {
  name: string;
  type: string;
  indexed?: boolean;
  isArray?: boolean;
  dimensions?: ArrayDimension[];
}

export interface FsmEvent {
  name: string;
  params: FsmEventParam[];
}

export interface FsmConstructorParam {
  variableName: string; // references existing variable/array/struct name
  include: boolean;
}

export interface FsmConstructorConfig {
  includedVariables: string[]; // names of variables to include as params
  includedArrays: string[];    // names of array variables to include
  includedStructs: string[];   // names of struct variables to include
}

export interface FsmTransitionInput {
  name: string;
  type: string;
  isArray?: boolean;
  dimensions?: ArrayDimension[];
}

export interface FsmTransition {
  id: string;
  name: string;
  from: string;
  to: string;
  payable?: boolean;
  guard?: string;
  guardConfig?: FsmGuardConfig;
  inputs?: FsmTransitionInput[];
  statementsMode?: 'guided' | 'code';
  statements?: FsmStatement[];
  rawStatements?: string;
  emitEvent?: string;
  emitEventArgs?: string[];
}

export interface ArrayDimension {
  size: string; // empty = dynamic
}

export interface FsmContractVariable {
  name: string;
  type: string;
  visibility?: 'public' | 'private' | 'internal';
  initialValue?: string;
  isArray?: boolean;
  dimensions?: ArrayDimension[];
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
  transitionPause?: boolean;
}

export interface FsmDefinition {
  id?: string;
  name: string;
  states: string[];
  initialState: string;
  transitions: FsmTransition[];
  variables?: FsmContractVariable[];
  customTypes?: FsmCustomType[];
  events?: FsmEvent[];
  plugins?: FsmPlugins;
  constructorConfig?: FsmConstructorConfig;
  createdAt?: string;
  updatedAt?: string;
}

// Guards

export type GuardOperator = 'AND' | 'OR';

// Entry guards
export interface AccessControlGuard { type: 'access-control'; role: string; }
export interface InputValidationGuard { type: 'input-validation'; expression: string; }
export interface StatePreconditionGuard { type: 'state-precondition'; state: string; }
export interface PauseGuard { type: 'pause'; }

// Exit guards
export interface PostconditionGuard { type: 'postcondition'; expression: string; }
export interface EventEmissionGuard { type: 'event-emission'; eventName: string; }
export interface ReturnValueGuard { type: 'return-value'; expression: string; }
export interface ReentrancyGuard { type: 'reentrancy'; }

// Temporal guards
export interface DeadlineGuard { type: 'deadline'; timestamp: string; }
export interface TimeLockGuard { type: 'timelock'; delay: string; }
export interface CooldownGuard { type: 'cooldown'; interval: string; }
export interface WindowGuard { type: 'window'; start: string; end: string; }

// Oracle guards
export interface SourceWhitelistGuard { type: 'source-whitelist'; address: string; }
export interface FreshnessGuard { type: 'freshness'; maxAge: string; }
export interface SanityBoundGuard { type: 'sanity-bound'; min: string; max: string; }

export type FsmGuard =
  | AccessControlGuard | InputValidationGuard | StatePreconditionGuard | PauseGuard
  | PostconditionGuard | EventEmissionGuard | ReturnValueGuard | ReentrancyGuard
  | DeadlineGuard | TimeLockGuard | CooldownGuard | WindowGuard
  | SourceWhitelistGuard | FreshnessGuard | SanityBoundGuard;

export interface FsmGuardConfig {
  guards: Array<{ guard: FsmGuard; operator: GuardOperator }>;
}