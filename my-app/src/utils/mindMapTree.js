/** Walk the mind map tree and collect every node by id. */
export function indexNodesById(forest) {
  const byId = new Map();

  const walk = (node, parentId = null) => {
    byId.set(node.id, {
      id: node.id,
      label: node.label,
      transcript: node.transcript ?? '',
      parentId,
      childIds: (node.children ?? []).map((c) => c.id),
    });
    for (const child of node.children ?? []) {
      walk(child, node.id);
    }
  };

  for (const root of forest ?? []) {
    walk(root, null);
  }
  return byId;
}

export function getMaxNodeId(forest) {
  let max = 0;
  const walk = (node) => {
    if (typeof node.id === 'number' && node.id > max) max = node.id;
    for (const child of node.children ?? []) walk(child);
  };
  for (const root of forest ?? []) walk(root);
  return max;
}

/** Accept `{ mindMap, activeLeafId }` or a bare forest array. */
export function parseMindMapResponse(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const parsed = JSON.parse(fenced ? fenced[1] : trimmed);

  if (Array.isArray(parsed)) {
    return { mindMap: parsed, activeLeafId: null };
  }
  if (parsed && Array.isArray(parsed.mindMap)) {
    return {
      mindMap: parsed.mindMap,
      activeLeafId:
        typeof parsed.activeLeafId === 'number' ? parsed.activeLeafId : null,
    };
  }
  throw new Error('Mind map response must be an array or { mindMap, activeLeafId }');
}

/**
 * Enforce incremental rules: frozen nodes stay identical except the prior
 * active leaf may have an updated transcript; new ids may be appended.
 */
export function validateIncrementalUpdate(previousForest, nextForest, previousActiveLeafId) {
  if (!previousForest?.length) {
    return { ok: true, mindMap: nextForest };
  }

  const prev = indexNodesById(previousForest);
  const next = indexNodesById(nextForest);

  for (const [id, prevNode] of prev) {
    const nextNode = next.get(id);
    if (!nextNode) {
      return { ok: false, reason: `Node ${id} was removed` };
    }
    if (nextNode.label !== prevNode.label) {
      return { ok: false, reason: `Label changed on node ${id}` };
    }
    if (nextNode.parentId !== prevNode.parentId) {
      return { ok: false, reason: `Parent changed on node ${id}` };
    }

    const childrenChanged =
      prevNode.childIds.length !== nextNode.childIds.length ||
      prevNode.childIds.some((childId) => !nextNode.childIds.includes(childId));

    const transcriptChanged = nextNode.transcript !== prevNode.transcript;
    const isActiveLeaf =
      previousActiveLeafId != null && id === previousActiveLeafId;

    if (childrenChanged) {
      const removed = prevNode.childIds.filter(
        (childId) => !nextNode.childIds.includes(childId),
      );
      if (removed.length > 0) {
        return { ok: false, reason: `Children removed from node ${id}` };
      }
    }

    if (transcriptChanged && !isActiveLeaf) {
      return { ok: false, reason: `Transcript changed on non-active node ${id}` };
    }
  }

  return { ok: true, mindMap: nextForest };
}
