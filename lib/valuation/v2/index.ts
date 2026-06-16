/**
 * V2 Engine — Public Entry Point
 *
 * This module is dynamically loaded by computeCockpitOutputV2 in cockpit.ts.
 * It exports computeCockpitOutputV2Impl which must match the V1 CockpitOutput
 * contract exactly so the adapter layer can substitute it transparently.
 */

export { computeCockpitOutputV2Impl } from './adapters'
export * from './types'
export * from './units'
export * from './dataValidation'
export * from './enterpriseValueBridge'
export { computeFCFFDcfV2, buildGrowthCurveFromLegacyCagr, buildFCFFInputsFromV1Snapshot } from './fcffDcf'
