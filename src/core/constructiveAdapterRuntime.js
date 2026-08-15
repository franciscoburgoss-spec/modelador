import {
  hasOwn
} from './hasOwn.js';

import {
  isRecord
} from './structuralProposalCommon.js';

export class ConstructiveAdapterRuntimeError
  extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ConstructiveAdapterRuntimeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ConstructiveAdapterRuntimeError(
    code,
    message,
    details
  );
}

export function
attachConstructiveAdapterRuntimeCapabilities(
  runtime,
  {
    generateSolution,
    assertValidSolution
  }
) {
  if (!isRecord(runtime)) {
    fail(
      'INVALID_RUNTIME_BASE',
      'El runtime constructivo base debe ser un objeto simple.'
    );
  }

  if (
    typeof generateSolution !== 'function'
    || typeof assertValidSolution !== 'function'
  ) {
    fail(
      'INVALID_RUNTIME_CAPABILITIES',
      'El runtime constructivo requiere generateSolution y assertValidSolution.'
    );
  }

  if (
    hasOwn(runtime, 'generateSolution')
    || hasOwn(runtime, 'assertValidSolution')
  ) {
    fail(
      'RUNTIME_CAPABILITY_COLLISION',
      'El runtime base no puede declarar capacidades reservadas.'
    );
  }

  Object.defineProperties(
    runtime,
    {
      generateSolution: {
        value: generateSolution,
        enumerable: false,
        writable: false,
        configurable: false
      },

      assertValidSolution: {
        value: assertValidSolution,
        enumerable: false,
        writable: false,
        configurable: false
      }
    }
  );

  return runtime;
}

export function
hasConstructiveAdapterRuntimeCapabilities(
  runtime
) {
  return (
    isRecord(runtime)
    && typeof runtime.generateSolution === 'function'
    && typeof runtime.assertValidSolution === 'function'
  );
}
