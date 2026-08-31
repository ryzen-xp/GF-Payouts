import type { Escrow, WalletRole } from "./types.ts"

export function walletRolesForEscrow(
  escrow: Escrow,
  wallet: string,
  extra?: WalletRole[],
): WalletRole[] {
  const roles = new Set<WalletRole>(extra ?? [])
  const mapping: Array<[WalletRole, string]> = [
    ["approver", escrow.roles.approver],
    ["dispute_resolver", escrow.roles.dispute_resolver],
    ["platform", escrow.roles.platform],
    ["release_signer", escrow.roles.release_signer],
    ["service_provider", escrow.roles.service_provider],
  ]
  for (const [role, address] of mapping) {
    if (address === wallet) roles.add(role)
  }
  if (escrow.milestones.some((milestone) => milestone.receiver === wallet)) {
    roles.add("receiver")
  }
  return [...roles]
}

export function walletInvolved(escrow: Escrow, wallet: string, extra?: WalletRole[]): boolean {
  return walletRolesForEscrow(escrow, wallet, extra).length > 0
}
