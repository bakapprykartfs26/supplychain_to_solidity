import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const solc = require('solc');

export interface CompileResult {
  success: boolean;
  abi?: unknown[];
  bytecode?: string;
  errors?: string[];
}

@Injectable()
export class SolidityCompileService {
  compile(source: string, contractName: string): CompileResult {
    const input = {
      language: 'Solidity',
      sources: {
        'contract.sol': { content: source },
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode'],
          },
        },
      },
    };

    let output: {
      errors?: { severity: string; formattedMessage: string }[];
      contracts?: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
    };
    try {
      output = JSON.parse(solc.compile(JSON.stringify(input)));
    } catch (e: unknown) {
      return {
        success: false,
        errors: [e instanceof Error ? e.message : String(e)],
      };
    }

    const errors = (output.errors ?? [])
      .filter((e) => e.severity === 'error')
      .map((e) => e.formattedMessage);

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const contracts = output.contracts?.['contract.sol'];
    const name = contractName.replace(/[^a-zA-Z0-9_]/g, '_');
    const contract = contracts?.[name] ?? Object.values(contracts ?? {})[0];

    if (!contract) {
      return { success: false, errors: ['No contract found in output'] };
    }

    return {
      success: true,
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object,
    };
  }
}
