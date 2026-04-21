// Plain AJV JSON schema for FsmDefinition — avoids strictNullChecks requirement of JSONSchemaType
export const FSM_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    states: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
    },
    initialState: { type: 'string', minLength: 1 },
    transitions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', minLength: 1 },
          from: { type: 'string', minLength: 1 },
          to: { type: 'string', minLength: 1 },
          guard: { type: 'string' },
          statementsMode: { type: 'string', enum: ['guided', 'code'] },
          rawStatements: { type: 'string' },
          statements: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    type:      { type: 'string', const: 'for' },
                    init:      { type: 'string' },
                    condition: { type: 'string' },
                    increment: { type: 'string' },
                    body:      { type: 'array' },
                  },
                  required: ['type', 'init', 'condition', 'increment', 'body'],
                  additionalProperties: false,
                },
                {
                  type: 'object',
                  properties: {
                    type:      { type: 'string', const: 'if' },
                    condition: { type: 'string' },
                    body:      { type: 'array' },
                    elseIfs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          condition: { type: 'string' },
                          body: { type: 'array' },
                        },
                        required: ['condition', 'body'],
                        additionalProperties: false,
                      },
                    },
                    elseBranch: { type: 'array' },
                  },
                  required: ['type', 'condition', 'body', 'elseIfs'],
                  additionalProperties: false,
                },
              ],
            },
          },
          payable: { type: 'boolean' },
          emitEvent: { oneOf: [{ type: 'boolean' }, { type: 'string' }] },
          emitEventArgs: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'name', 'from', 'to'],
        additionalProperties: false,
      },
    },
    variables: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          type: { type: 'string', minLength: 1 },
          visibility: { type: 'string', enum: ['public', 'private', 'internal'] },
          initialValue: { type: 'string' },
        },
        required: ['name', 'type'],
        additionalProperties: false,
      },
    },
    customTypes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 1 },
                type: { type: 'string', minLength: 1 },
              },
              required: ['name', 'type'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'fields'],
        additionalProperties: false,
      },
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          params: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name:    { type: 'string', minLength: 1 },
                type:    { type: 'string', minLength: 1 },
                indexed: { type: 'boolean' },
              },
              required: ['name', 'type'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'params'],
        additionalProperties: false,
      },
    },
    plugins: {
      type: 'object',
      properties: {
        locking: { type: 'boolean' },
        accessControl: { type: 'boolean' },
        transitionCounter: { type: 'boolean' },
        timedTransitions: { type: 'boolean' },
        event: { type: 'boolean' },
        transitionPause: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['name', 'states', 'initialState', 'transitions'],
  additionalProperties: false,
} as const;
