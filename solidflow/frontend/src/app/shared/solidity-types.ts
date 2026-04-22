export const SOLIDITY_TYPES = [
    'uint256', 'int256', 'string', 'bool', 'address', 'bytes',
    'uint8', 'uint16', 'uint32', 'uint64', 'uint128', 
    'int8', 'int16', 'int32', 'int64', 'int128', 
    'bytes8', 'bytes16', 'bytes32',
] as const;

export type SolidityType = typeof SOLIDITY_TYPES[number];