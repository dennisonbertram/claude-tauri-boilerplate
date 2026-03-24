import type { PipelineContext, StepResult, StructuredExtractionResult, EntityCandidate } from './types';
import { getDocumentContent, insertEntities, insertEntityRelationships, deleteEntitiesForDocument, getEntitiesForDocument } from '../../db';

export async function executeEntityExtraction(ctx: PipelineContext): Promise<StepResult> {
  const content = getDocumentContent(ctx.db, ctx.document.id);
  if (!content?.structuredData) {
    return { success: true, skip: true, result: { reason: 'No structured data from Claude Vision to extract entities from' } };
  }

  let structured: StructuredExtractionResult;
  try {
    structured = typeof content.structuredData === 'string'
      ? JSON.parse(content.structuredData)
      : content.structuredData as StructuredExtractionResult;
  } catch {
    return { success: false, error: 'Failed to parse structured data as JSON' };
  }

  if (!structured.entities || !Array.isArray(structured.entities) || structured.entities.length === 0) {
    return { success: true, skip: true, result: { reason: 'No entities found in structured data' } };
  }

  // Delete existing entities (idempotent reprocessing -- cascades to relationships)
  deleteEntitiesForDocument(ctx.db, ctx.document.id);

  // Normalize entity types FIRST, then deduplicate
  // (otherwise two unknown types could survive dedup, then both become 'other')
  const validTypes = ['person', 'organization', 'date', 'amount', 'account_number', 'location', 'topic', 'other'];
  const typeNormalized = structured.entities.map(e => ({
    ...e,
    type: validTypes.includes(e.type) ? e.type : 'other',
  }));
  const validEntities = deduplicateEntities(typeNormalized);

  // Insert entities
  const entityCount = insertEntities(ctx.db, ctx.document.id, validEntities.map(e => ({
    entityType: e.type,
    value: e.value,
    normalizedValue: e.normalizedValue || normalizeEntityValue(e.value, e.type),
    confidence: e.confidence || null,
    sourceText: e.sourceText || null,
    pageNumber: e.pageNumber || null,
  })));

  // Build relationships from co-occurrence
  const relationshipCandidates = buildRelationships(validEntities);

  let relationshipCount = 0;
  if (relationshipCandidates.length > 0) {
    // Fetch inserted entities to get their DB IDs
    const dbEntities = getEntitiesForDocument(ctx.db, ctx.document.id);

    // Build lookup: "type:normalizedValue" -> entity ID
    const entityIdMap = new Map<string, string>();
    for (const e of dbEntities) {
      const key = `${e.entityType}:${(e.normalizedValue || e.value).toLowerCase().trim()}`;
      entityIdMap.set(key, e.id);
    }

    // Resolve relationship candidates to actual entity IDs
    const resolvedRelationships = relationshipCandidates
      .map(r => {
        const sourceKey = `${r.sourceType}:${normalizeEntityValue(r.sourceValue, r.sourceType)}`;
        const targetKey = `${r.targetType}:${normalizeEntityValue(r.targetValue, r.targetType)}`;
        const sourceId = entityIdMap.get(sourceKey);
        const targetId = entityIdMap.get(targetKey);
        if (!sourceId || !targetId) return null;
        return {
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          relationshipType: r.relationshipType,
          confidence: r.confidence,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (resolvedRelationships.length > 0) {
      relationshipCount = insertEntityRelationships(ctx.db, ctx.document.id, resolvedRelationships);
    }
  }

  return {
    success: true,
    result: { entityCount, relationshipCount, types: countByType(validEntities) },
  };
}

function normalizeEntityValue(value: string, type: string): string {
  let normalized = value.trim();

  switch (type) {
    case 'amount':
      // Remove currency symbols, commas, keep numbers and decimal
      normalized = normalized.replace(/[^0-9.-]/g, '');
      break;
    case 'date':
      // Try to parse as date and output ISO format
      try {
        const d = new Date(normalized);
        if (!isNaN(d.getTime())) normalized = d.toISOString().split('T')[0];
      } catch { /* keep original */ }
      break;
    case 'person':
    case 'organization':
    case 'location':
    case 'topic':
      normalized = normalized.toLowerCase().trim();
      break;
    default:
      normalized = normalized.toLowerCase().trim();
  }

  return normalized;
}

function deduplicateEntities(entities: EntityCandidate[]): EntityCandidate[] {
  const seen = new Map<string, EntityCandidate>();

  for (const entity of entities) {
    const key = `${entity.type}:${normalizeEntityValue(entity.value, entity.type)}`;
    const existing = seen.get(key);

    if (!existing || (entity.confidence || 0) > (existing.confidence || 0)) {
      seen.set(key, entity);
    }
  }

  return Array.from(seen.values());
}

interface RelationshipCandidate {
  sourceValue: string;
  sourceType: string;
  targetValue: string;
  targetType: string;
  relationshipType: string;
  confidence: number;
}

function buildRelationships(entities: EntityCandidate[]): RelationshipCandidate[] {
  const relationships: RelationshipCandidate[] = [];

  // Build co-occurrence relationships between meaningful entity type pairs.
  // All entities in the same document are considered co-occurring.
  // We only create relationships between semantically meaningful pairs
  // (e.g. person↔organization, person↔amount) not between all combos.
  const meaningfulPairs: Record<string, string> = {
    'person:organization': 'associated_with',
    'organization:person': 'associated_with',
    'person:amount': 'has_amount',
    'organization:amount': 'has_amount',
    'person:date': 'has_date',
    'organization:date': 'has_date',
    'person:location': 'located_at',
    'organization:location': 'located_at',
    'person:account_number': 'has_account',
    'organization:account_number': 'has_account',
    // Topic/concept relationships
    'person:topic': 'discusses',
    'organization:topic': 'discusses',
    'topic:person': 'involves',
    'topic:organization': 'involves',
    'topic:amount': 'valued_at',
    'topic:topic': 'related_to',
    'topic:location': 'pertains_to',
  };

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];

      const pairKey = `${a.type}:${b.type}`;
      const relType = meaningfulPairs[pairKey];
      if (!relType) continue;

      // Higher confidence if on the same page (when page info is available)
      const samePage = a.pageNumber && b.pageNumber && a.pageNumber === b.pageNumber;
      const confidence = samePage ? 0.8 : 0.5;

      relationships.push({
        sourceValue: a.value,
        sourceType: a.type,
        targetValue: b.value,
        targetType: b.type,
        relationshipType: relType,
        confidence,
      });
    }
  }

  return relationships;
}

function countByType(entities: EntityCandidate[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entities) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return counts;
}
