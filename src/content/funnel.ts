import type { FunnelDataset, Stage } from '../funnel/model'

// Sample funnel. The numbers are invented and shaped only to exercise the
// layout: a wide top, real drop-off between columns, and a last column that
// mixes large and small nodes. Replace with your own scenarios — or with the
// result of a query — and the tool needs no other change.

const STAGES: Stage[] = [
  { id: 'sources', title: 'Sources', caption: 'Where they come from' },
  { id: 'signup', title: 'Signup', caption: 'Account created' },
  { id: 'activation', title: 'Activation', caption: 'First real action' },
  { id: 'outcome', title: 'Outcome', caption: 'Where they end up' },
]

export const SAMPLE_FUNNEL: FunnelDataset = {
  title: 'Funnel (sample data)',
  subtitle: 'sources → signup → activation → outcome',
  unitNote: 'per month · illustrative',
  defaultScenarioId: 'base',
  scenarios: [
    {
      id: 'base',
      label: 'Base case',
      badge: 'sample',
      description: 'Three channels, one account type, two outcomes.',
      stages: STAGES,
      kpis: [
        { label: 'visitors', stage: 'sources' },
        { label: 'paying', nodeIds: ['out_paid'], accent: 'emerald' },
      ],
      nodes: [
        { id: 'src_search', stage: 'sources', label: 'Search', value: 5000, color: '#fb7185' },
        { id: 'src_social', stage: 'sources', label: 'Social', value: 3000, color: '#fdba74' },
        { id: 'src_referral', stage: 'sources', label: 'Referral', value: 1200, color: '#fcd34d' },
        {
          id: 'su_account',
          stage: 'signup',
          label: 'Accounts',
          value: 2300,
          color: '#a78bfa',
          description: 'Everyone who finished creating an account.',
        },
        { id: 'act_first', stage: 'activation', label: 'First action', value: 1400, color: '#38bdf8' },
        { id: 'act_invite', stage: 'activation', label: 'Invited a peer', value: 300, color: '#22d3ee' },
        { id: 'out_paid', stage: 'outcome', label: 'Paid plan', value: 350, color: '#34d399' },
        { id: 'out_free', stage: 'outcome', label: 'Free, retained', value: 900, color: '#a3e635' },
        { id: 'out_churn', stage: 'outcome', label: 'Churned', value: 450, color: '#737373' },
      ],
      links: [
        { source: 'src_search', target: 'su_account', value: 1200 },
        { source: 'src_social', target: 'su_account', value: 600 },
        { source: 'src_referral', target: 'su_account', value: 500, note: 'best converting' },
        { source: 'su_account', target: 'act_first', value: 1400 },
        { source: 'su_account', target: 'act_invite', value: 300 },
        { source: 'act_first', target: 'out_paid', value: 250 },
        { source: 'act_first', target: 'out_free', value: 750 },
        { source: 'act_first', target: 'out_churn', value: 400 },
        { source: 'act_invite', target: 'out_paid', value: 100 },
        { source: 'act_invite', target: 'out_free', value: 150 },
        { source: 'act_invite', target: 'out_churn', value: 50 },
      ],
    },
    {
      id: 'stretch',
      label: 'Stretch case',
      badge: 'sample',
      description:
        'A second account type joins. Small and large nodes share a column, so the layout compresses the spread.',
      stages: STAGES,
      valueExponent: 0.8,
      minHeight: 820,
      kpis: [
        { label: 'visitors', stage: 'sources' },
        { label: 'paying', nodeIds: ['out_paid', 'out_team'], accent: 'emerald' },
      ],
      nodes: [
        { id: 'src_search', stage: 'sources', label: 'Search', value: 9000, color: '#fb7185' },
        { id: 'src_social', stage: 'sources', label: 'Social', value: 6000, color: '#fdba74' },
        { id: 'src_referral', stage: 'sources', label: 'Referral', value: 2500, color: '#fcd34d' },
        { id: 'src_sales', stage: 'sources', label: 'Outbound', value: 120, color: '#f0abfc' },
        { id: 'su_account', stage: 'signup', label: 'Individuals', value: 4800, color: '#a78bfa' },
        { id: 'su_team', stage: 'signup', label: 'Teams', value: 60, color: '#e879f9' },
        { id: 'act_first', stage: 'activation', label: 'First action', value: 3100, color: '#38bdf8' },
        { id: 'act_invite', stage: 'activation', label: 'Invited a peer', value: 700, color: '#22d3ee' },
        { id: 'act_seats', stage: 'activation', label: 'Seats assigned', value: 45, color: '#c084fc' },
        { id: 'out_paid', stage: 'outcome', label: 'Paid plan', value: 900, color: '#34d399' },
        { id: 'out_team', stage: 'outcome', label: 'Team contract', value: 30, color: '#2dd4bf' },
        { id: 'out_free', stage: 'outcome', label: 'Free, retained', value: 2100, color: '#a3e635' },
        { id: 'out_churn', stage: 'outcome', label: 'Churned', value: 815, color: '#737373' },
      ],
      links: [
        { source: 'src_search', target: 'su_account', value: 2400 },
        { source: 'src_social', target: 'su_account', value: 1400 },
        { source: 'src_referral', target: 'su_account', value: 1000 },
        { source: 'src_sales', target: 'su_team', value: 60 },
        { source: 'su_account', target: 'act_first', value: 3100 },
        { source: 'su_account', target: 'act_invite', value: 700 },
        { source: 'su_team', target: 'act_seats', value: 45 },
        { source: 'act_first', target: 'out_paid', value: 650 },
        { source: 'act_first', target: 'out_free', value: 1700 },
        { source: 'act_first', target: 'out_churn', value: 750 },
        { source: 'act_invite', target: 'out_paid', value: 250 },
        { source: 'act_invite', target: 'out_free', value: 400 },
        { source: 'act_invite', target: 'out_churn', value: 50 },
        { source: 'act_seats', target: 'out_team', value: 30 },
        { source: 'act_seats', target: 'out_churn', value: 15 },
      ],
    },
  ],
}
