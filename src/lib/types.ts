export type Flags = {
  approved: boolean
  disputed: boolean
  released: boolean
  resolved: boolean
}

export type Roles = {
  approver: string
  dispute_resolver: string
  platform: string
  release_signer: string
  service_provider: string
}

export type Trustline = {
  address: string
}

export type Milestone = {
  amount: bigint
  description: string
  evidence: string
  flags: Flags
  receiver: string
  status: string
}

export type Escrow = {
  description: string
  engagement_id: string
  milestones: Milestone[]
  platform_fee: number
  receiver_memo: number
  roles: Roles
  title: string
  trustline: Trustline
}

export type ParsedIssue = {
  title: string
  project: string
  issueUrl: string
  prUrl: string
}

export type WalletRole =
  | "receiver"
  | "approver"
  | "dispute_resolver"
  | "platform"
  | "release_signer"
  | "service_provider"
  | "signer"

export type MilestoneRow = {
  escrowId: string
  campaign: string
  campaignDescription: string
  engagementId: string
  project: string
  milestoneTitle: string
  milestoneIndex: number
  amount: bigint
  amountDisplay: string
  status: string
  payoutStatus: string
  flags: Flags
  receiver: string
  roles: Roles
  trustline: string
  decimals: number
  evidence: string
  issueUrl: string
  prUrl: string
  walletRoles: WalletRole[]
  txHash?: string
  createdAt?: string
}

export type LookupSummary = {
  wallet: string
  escrowCount: number
  rowCount: number
  total: bigint
  released: bigint
  pending: bigint
  rejected: bigint
  decimals: number
  warnings: string[]
}

export type LookupResult = {
  rows: MilestoneRow[]
  summary: LookupSummary
}

export type LookupProgress = {
  stage: string
  detail?: string
  percent?: number
}

export type ScanMode = "factory" | "deployer" | "escrow"

export type NetworkConfig = {
  name: "mainnet" | "testnet"
  passphrase: string
  horizonUrl: string
  rpcUrl: string
  factoryId: string
  expertBase: string
  expertApi: string
}
