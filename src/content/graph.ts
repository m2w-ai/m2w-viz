import { DEFAULT_EDGE_KINDS, DEFAULT_STATUSES, type GraphDataset } from '../graph/model'

// Sample graph: a generic web product, to show node statuses, the four default
// edge kinds, parallel edges between one pair, and a dated milestone.

export const SAMPLE_GRAPH: GraphDataset = {
  title: 'Graph (sample data)',
  subtitle: 'every surface and how they connect',
  nodeNoun: { one: 'Surface', many: 'surfaces' },
  edgeKinds: DEFAULT_EDGE_KINDS,
  statuses: DEFAULT_STATUSES,
  nodes: [
    {
      id: 'landing',
      name: 'Landing page',
      status: 'live',
      summary: 'Where a visitor first arrives.',
      features: ['Pricing table', 'Sign-up call to action'],
    },
    {
      id: 'accounts',
      name: 'Accounts',
      status: 'live',
      summary: 'Sign-up, sign-in and profile.',
      features: ['Email and OAuth sign-in', 'Profile settings'],
    },
    {
      id: 'workspace',
      name: 'Workspace',
      status: 'live',
      summary: 'Where the user does the work the product is for.',
      features: ['Create and edit items', 'Autosave', 'Version history'],
    },
    {
      id: 'insights',
      name: 'Insights',
      status: 'beta',
      summary: 'Analysis of what is in the workspace, fed back to the user.',
      features: ['Per-item report', 'Trends over time'],
    },
    {
      id: 'sharing',
      name: 'Sharing',
      status: 'milestone',
      deadline: 'next quarter',
      summary: 'Public links to workspace items.',
      features: ['Read-only link', 'Comment link'],
    },
    {
      id: 'billing',
      name: 'Billing',
      status: 'live',
      summary: 'Plans, payment and entitlements.',
      features: ['Monthly and annual plans', 'Usage limits'],
    },
    {
      id: 'api',
      name: 'Public API',
      status: 'planned',
      summary: 'Programmatic access to the workspace.',
      features: ['Read endpoints', 'Webhooks'],
    },
  ],
  edges: [
    { from: 'landing', to: 'accounts', kind: 'user-flow', label: 'sign up' },
    { from: 'accounts', to: 'workspace', kind: 'user-flow' },
    { from: 'workspace', to: 'insights', kind: 'content', label: 'items' },
    { from: 'insights', to: 'workspace', kind: 'signal', label: 'reports' },
    { from: 'workspace', to: 'sharing', kind: 'content' },
    { from: 'sharing', to: 'landing', kind: 'user-flow', label: 'viewers arrive' },
    { from: 'billing', to: 'insights', kind: 'gate', label: 'paid plans' },
    { from: 'billing', to: 'api', kind: 'gate' },
    { from: 'accounts', to: 'billing', kind: 'user-flow' },
    { from: 'workspace', to: 'api', kind: 'content' },
  ],
}
