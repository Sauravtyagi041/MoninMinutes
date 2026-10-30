const STOP = new Set(
  'a an the to of and or for in on at by with be is are was will we our us it this that should needs need please can could would up from as about then so also'.split(' '),
);

const tokens = (s) =>
  new Set(
    (s.toLowerCase().match(/[a-z0-9]+/g) || [])
      .filter((w) => !STOP.has(w))
      .map((w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w)),
  );

export const similarity = (a, b) => {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
};

const unionIds = (a, b) => [...new Set([...a, ...b])].sort((x, y) => x - y);

/** Merges near-duplicate {text, segment_ids} items (e.g. the same point found in two chunks). */
export const dedupeTextItems = (items, threshold = 0.7) => {
  const out = [];
  for (const item of items) {
    const dup = out.find((o) => similarity(o.text, item.text) >= threshold);
    if (dup) {
      dup.segment_ids = unionIds(dup.segment_ids, item.segment_ids);
      if (!dup.owner && item.owner) dup.owner = item.owner;
    } else {
      out.push({ ...item, segment_ids: [...item.segment_ids] });
    }
  }
  return out;
};

const sameAssignee = (a, b) => !a || !b || a.toLowerCase() === b.toLowerCase();

/** Merges duplicate action items, keeping the more confident wording and filling gaps from the other. */
export const dedupeActionItems = (items, threshold = 0.6) => {
  const out = [];
  for (const item of items) {
    const idx = out.findIndex(
      (o) => sameAssignee(o.assignee, item.assignee) && similarity(o.task, item.task) >= threshold,
    );
    if (idx === -1) {
      out.push({ ...item, segment_ids: [...item.segment_ids] });
      continue;
    }
    const cur = out[idx];
    const best = item.confidence > cur.confidence ? item : cur;
    out[idx] = {
      ...best,
      assignee: cur.assignee || item.assignee || null,
      due_date_text: cur.due_date_text || item.due_date_text || null,
      due_date: cur.due_date || item.due_date || null,
      evidence: best.evidence || cur.evidence || item.evidence || null,
      segment_ids: unionIds(cur.segment_ids, item.segment_ids),
      confidence: Math.max(cur.confidence, item.confidence),
    };
  }
  return out;
};
