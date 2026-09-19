import { DEFAULT_PIPELINE_STATUSES, type PipelineDataset } from '../pipeline/model'

// Sample pipeline: a generic six-stage data pipeline. It shows stages with
// components in them, edges between components, three artifacts, a guided
// walk, and a callout pinned to a stage and an artifact.

export const SAMPLE_PIPELINE: PipelineDataset = {
  title: 'Pipeline (sample data)',
  subtitle: 'collect → clean → enrich → join → model → serve',
  footnote: 'the pipeline ends at a served prediction',
  emptyHint:
    'Click a panel or a chip. Live runs in production; isolated runs but feeds nothing yet; planned is not built.',
  tagLabel: 'Owner',
  statuses: DEFAULT_PIPELINE_STATUSES,
  stages: [
    { id: 'collect', index: '01', title: 'Collect', caption: 'Raw inputs', thesis: 'Nothing downstream is better than what is gathered here.' },
    { id: 'clean', index: '02', title: 'Clean', caption: 'Make it usable', thesis: 'Drop what is broken, normalise what is not.' },
    { id: 'enrich', index: '03', title: 'Enrich', caption: 'Add what is missing', thesis: 'Derive the fields the raw input never carried.' },
    { id: 'join', index: '04', title: 'Join', caption: 'One table', thesis: 'Bring the sources together on a shared key.' },
    { id: 'model', index: '05', title: 'Model', caption: 'Learn from it', thesis: 'Fit once the table is trustworthy, not before.' },
    { id: 'serve', index: '06', title: 'Serve', caption: 'Put it to work', thesis: 'A prediction nobody can call does not exist.' },
  ],
  nodes: [
    { id: 'ingest', stage: 'collect', name: 'Ingest job', status: 'live', purpose: 'Pull records from the source systems.', summary: 'Runs nightly and lands raw records unchanged.', produces: ['raw_records'], tag: 'data platform' },
    { id: 'uploads', stage: 'collect', name: 'Manual uploads', status: 'live', purpose: 'Accept files people hand over.', summary: 'A drop folder for one-off sources.', produces: ['raw_files'] },
    { id: 'dedupe', stage: 'clean', name: 'De-duplicate', status: 'live', purpose: 'Collapse repeated records.', summary: 'Keeps the most recent copy of each key.', produces: ['unique_records'] },
    { id: 'validate', stage: 'clean', name: 'Validate', status: 'live', purpose: 'Reject records that break the schema.', summary: 'Quarantines failures instead of dropping them silently.', produces: ['valid_records', 'quarantine'] },
    { id: 'features', stage: 'enrich', name: 'Feature extraction', status: 'isolated', purpose: 'Compute derived fields.', summary: 'Runs today, but nothing reads its output yet.', produces: ['features'] },
    { id: 'labels', stage: 'enrich', name: 'Labels', status: 'planned', purpose: 'Attach the outcome each record led to.', summary: 'Needs an agreed definition of the outcome first.', produces: ['labels'] },
    { id: 'table', stage: 'join', name: 'Training table', status: 'planned', purpose: 'Join features to labels.', summary: 'The one table the model is fitted on.', produces: ['training_table'] },
    { id: 'fit', stage: 'model', name: 'Fit', status: 'planned', purpose: 'Train and evaluate.', summary: 'Held-out evaluation, reported with sample sizes.', produces: ['model', 'eval_report'] },
    { id: 'endpoint', stage: 'serve', name: 'Prediction endpoint', status: 'planned', purpose: 'Answer a request with a prediction.', summary: 'Returns the prediction with its confidence band.', produces: ['prediction'] },
  ],
  edges: [
    { from: 'ingest', to: 'dedupe' },
    { from: 'uploads', to: 'dedupe' },
    { from: 'dedupe', to: 'validate' },
    { from: 'validate', to: 'features' },
    { from: 'validate', to: 'labels' },
    { from: 'features', to: 'table', label: 'features' },
    { from: 'labels', to: 'table', label: 'labels' },
    { from: 'table', to: 'fit' },
    { from: 'fit', to: 'endpoint', label: 'model' },
  ],
  artifacts: [
    { id: 'dataset', name: 'Clean dataset', role: 'Artifact 1', summary: 'Validated, de-duplicated records.' },
    { id: 'training', name: 'Training table', role: 'Artifact 2', summary: 'Features joined to labels on one key.' },
    { id: 'prediction', name: 'Served prediction', role: 'Artifact 3', summary: 'What a caller gets back, with its band.' },
  ],
  walk: [
    { id: 'w1', title: 'It starts with what is collected', body: 'Two ways in: a nightly job and a drop folder.', focus: { kind: 'stage', id: 'collect' } },
    { id: 'w2', title: 'The first artifact is a clean dataset', body: 'Everything after this can trust its input.', focus: { kind: 'artifact', id: 'dataset' } },
    { id: 'w3', title: 'The join is the missing piece', body: 'Features already run; labels and the join are planned.', focus: { kind: 'stage', id: 'join' } },
    { id: 'w4', title: 'The deliverable is a served prediction', body: 'Everything upstream exists to make this call answerable.', focus: { kind: 'artifact', id: 'prediction' } },
  ],
  callouts: [
    {
      attachTo: ['serve', 'prediction'],
      heading: 'Worked example',
      meta: 'record 1042 · feature_a = 12',
      body: 'Feature A is 12. Comparable records sit at p90 = 9 (n=72), so this one is flagged as unusually high.',
      result: 'flag: feature_a / high',
    },
  ],
}
