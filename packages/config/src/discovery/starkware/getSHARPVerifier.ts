import { assert, type EthereumAddress } from '@l2beat/shared-pure'

import type { ScalingProjectPermission } from '../../types'
import { delayDescriptionFromSeconds } from '../../utils/delayDescription'
import { ProjectDiscovery } from '../ProjectDiscovery'
import { getProxyGovernance } from './getProxyGovernance'

// NOTE(radomski): The way SHARPVerifier works after the upgrade is the
// following: Everything goes through SHARPVerifierProxy which calls CallProxy
// as a fallback. CallProxy then calls the new SHARPVerifier that still
// references the old SHARPVerifier. When verifying a proof the new
// SHARPVerifier checks if a fact is valid. Since the old fact registry has
// proved many facts it still wants to use them. If first checks its own fact
// registry, in case of failure it checks the old fact registry. Stuff like
// FrilessVerifiers and CairoBootloaderPrograms are separate and new ones where
// deployed for the new SHARPVerifier.
//
//                                ┌─────────────────────┐
//                                │                     │          ┌─────────────┐
//                                │ SHARPVerifierProxy  │─────────▶│  CallProxy  │────────────┐
//                                │                     │          └─────────────┘            │
//                                └─────────────────────┘                                     │
// ┌─────────────────────────────────────────────────────────┬────────────────────┐           │
// │  ┌───────────────────┐                                  │ Old Verifier code  │           │                 ┌─────────────────┐
// │  │Old FrilessVerifier│◀─┐                               └────────────────────┤           ▼              ┌─▶│ FrilessVerifier │
// │  └───────────────────┘  │    ┌─────────────────────┐                         │ ┌───────────────────┐    │  └─────────────────┘
// │  ┌───────────────────┐  │    │                     │                         │ │                   │    │  ┌─────────────────┐
// │  │Old FrilessVerifier│◀─┼────│  Old SHARPVerifier  │◀──referenceFactRegistry─┼─│   SHARPVerifier   │────┼─▶│ FrilessVerifier │
// │  └───────────────────┘  │    │                     │                         │ │                   │    │  └─────────────────┘
// │  ┌───────────────────┐  │    └─────────────────────┘                         │ └───────────────────┘    │  ┌─────────────────┐
// │  │Old FrilessVerifier│◀─┘               │                                    │           │              └─▶│ FrilessVerifier │
// │  └───────────────────┘                  │                                    │           │                 └─────────────────┘
// │                                         ▼                                    │           ▼
// │                              ┌─────────────────────┐                         │ ┌───────────────────┐
// │                              │  Old FactRegistry   │                         │ │   FactRegistry    │
// │                              └─────────────────────┘                         │ └───────────────────┘
// └──────────────────────────────────────────────────────────────────────────────┘
//

const discovery = new ProjectDiscovery('shared-sharp-verifier')

const SHARP_VERIFIER_PROXY = discovery.getContractDetails(
  'SHARPVerifierProxy',
  'CallProxy for GpsStatementVerifier.',
)

const SHARP_VERIFIER = discovery.getContractDetails(
  'SHARPVerifier',
  'Starkware SHARP verifier used collectively by Starknet, Sorare, ImmutableX, Apex, Myria, rhino.fi and Canvas Connect. It receives STARK proofs from the Prover attesting to the integrity of the Execution Trace of these Programs including correctly computed state root which is part of the Program Output.',
)

const CAIRO_BOOTLOADER_PROGRAM = discovery.getContractDetails(
  'CairoBootloaderProgram',
  'Part of STARK Verifier.',
)

const MEMORY_FACT_REGISTRY = discovery.getContractDetails(
  'MemoryPageFactRegistry',
  'MemoryPageFactRegistry is one of the many contracts used by SHARP verifier. This one is important as it registers all necessary onchain data.',
)

const OLD_MEMORY_FACT_REGISTRY = discovery.getContractDetails(
  'OldMemoryPageFactRegistry',
  'Same as MemoryPageFactRegistry but stores facts proved by the old SHARP Verifier, used as a fallback.',
)

const FRI_STATEMENT_CONTRACT = discovery.getContractDetails(
  'FriStatementContract',
  'Part of STARK Verifier.',
)

const MERKLE_STATEMENT_CONTRACT = discovery.getContractDetails(
  'MerkleStatementContract',
  'Part of STARK Verifier.',
)

const upgradeDelay = discovery.getContractValue<number>(
  'SHARPVerifierProxy',
  'StarkWareProxy_upgradeDelay',
)

const SHARP_VERIFIER_CONTRACTS = [
  SHARP_VERIFIER_PROXY,
  SHARP_VERIFIER,
  FRI_STATEMENT_CONTRACT,
  MERKLE_STATEMENT_CONTRACT,
  CAIRO_BOOTLOADER_PROGRAM,
  MEMORY_FACT_REGISTRY,
  OLD_MEMORY_FACT_REGISTRY,
]

export function getSHARPVerifierContracts(
  projectDiscovery: ProjectDiscovery,
  verifierAddress: EthereumAddress,
) {
  assert(
    verifierAddress === SHARP_VERIFIER_PROXY.address,
    `SHARPVerifierProxy address mismatch. This project probably uses a different SHARP verifier (${projectDiscovery.projectName})`,
  )

  return SHARP_VERIFIER_CONTRACTS
}

export function getSHARPVerifierGovernors(
  projectDiscovery: ProjectDiscovery,
  verifierAddress: EthereumAddress,
): ScalingProjectPermission[] {
  assert(
    verifierAddress === SHARP_VERIFIER_PROXY.address,
    `SHARPVerifierProxy address mismatch. This project probably uses a different SHARP verifier (${projectDiscovery.projectName})`,
  )

  return [
    {
      name: 'SHARP Verifier Governors',
      accounts: getProxyGovernance(discovery, 'SHARPVerifierProxy'),
      description:
        'Can upgrade implementation of SHARP Verifier, potentially with code approving fraudulent state. ' +
        delayDescriptionFromSeconds(upgradeDelay),
    },
    ...discovery.getMultisigPermission(
      'SHARPVerifierGovernorMultisig',
      'SHARP Verifier Governor.',
    ),
  ]
}

export function getSHARPVerifierUpgradeDelay() {
  return upgradeDelay
}
