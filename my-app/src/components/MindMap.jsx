import React, { useState, useEffect, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Dialog, DialogTitle, DialogContent } from '@mui/material';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InputKeywords from './InputKeywords';
import Transcript from './Transcript';
// import jsonData from '../data/nodesAndEdges.json';
import { getOpenAIResponse } from './callLLM';
import {
  getMaxNodeId,
  parseMindMapResponse,
  validateIncrementalUpdate,
} from '../utils/mindMapTree';

// Custom node with right-side handle
const RightHandleNode = ({ data }) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        border: '1px solid #ccc',
        borderRadius: 12,
        background: 'rgb(208, 170, 248)',
        minWidth: 120,
        textAlign: 'center',
        fontWeight: 900,
        color: 'white',
        fontSize: '0.95rem',
        boxShadow: '0 1px 3px rgb(162, 191, 242)',
        transition: 'all 0.2s ease-in-out',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgb(162, 191, 242)';
        e.currentTarget.style.background = 'rgb(175, 116, 239)';
        e.currentTarget.style.transform = 'scale(1.03)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgb(162, 191, 242)';
        e.currentTarget.style.background = 'rgb(208, 170, 248)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {data.label}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
};

const convertToFlow = (data) => {
  const nodes = [];
  const edges = [];

  // Track vertical positions per depth to stack siblings
  const levelYTracker = {};

  const traverse = (item, parentId = null, depth = 0) => {
    const nodeId = item.id.toString();

    // Determine Y based on how many nodes are already on this level
    if (!levelYTracker[depth]) levelYTracker[depth] = 0;
    const y = levelYTracker[depth] * 120;
    const x = depth * 300;
    levelYTracker[depth] += 1;

    // Create node
    nodes.push({
      id: nodeId,
      type: 'rightHandle',
      data: { label: item.label, transcript: item.transcript || '' },
      position: { x, y },
    });

    // Create edge
    if (parentId) {
      edges.push({
        id: `e${parentId}-${nodeId}`,
        source: parentId.toString(),
        target: nodeId,
      });
    }

    // Traverse children
    if (item.children && item.children.length > 0) {
      item.children.forEach((child) => traverse(child, nodeId, depth + 1));
    }
  };

  data.forEach((item) => traverse(item));
  return { nodes, edges };
};

const nodeTypes = {
  rightHandle: RightHandleNode,
};

/** Wait after the last transcript edit before calling the LLM. */
const TRANSCRIPT_DEBOUNCE_MS = 2500;
/** Also update at least this often while speech keeps changing. */
const TRANSCRIPT_MAX_INTERVAL_MS = 8000;

function buildMindMapPrompt({
  existingMap,
  newTranscript,
  activeLeafId,
  nextNodeId,
  isInitial,
}) {
  const activeLeafLine =
    activeLeafId != null
      ? `The current active leaf (ongoing point) is node id ${activeLeafId}.`
      : 'There is no active leaf yet — this is the first update.';

  return `
You incrementally update a meeting mind map. Each update must preserve every existing node exactly as-is, except you may extend the active leaf's transcript or add new nodes.

${activeLeafLine}
Use new node ids starting at ${nextNodeId} (never reuse or change existing ids).

<Immutable rules — violations will be discarded>
1. Do NOT change id, label, parent, or transcript on any existing node EXCEPT the active leaf (id ${activeLeafId ?? 'none'}), whose transcript may grow or be refined.
2. Do NOT delete nodes or move nodes between parents.
3. Do NOT edit labels on nodes that already exist.

<When speakers are still on the SAME point>
- Append or refine ONLY the active leaf's "transcript" field with the new speech.
- Do not add sibling or child nodes.

<When speakers have moved to a NEW point>
1. Decide if this is truly a new topic/point (not just more detail on the same point).
2. Choose where to branch:
   a) Sibling branch (parallel to current thread): add a new leaf as another child of the active leaf's PARENT — use when the meeting advances to a new point while staying under the same topic.
   b) Deeper branch: add a new leaf as a child of the active leaf — use when the new point is a sub-point of what was just discussed.
   c) Earlier branch: add a new leaf under an EARLIER topic node (not the active leaf) — use when speakers returned to or continued a prior thread; create a sibling next to that thread's existing leaves.
3. New leaf: brief "label", "transcript" = only what was said about this new point in the new transcript below (you may expand later on subsequent updates when it becomes the active leaf).
4. Set "activeLeafId" in your response to the id of the leaf now being discussed.

<Mind map shape>
- Roots: topic nodes with "children" only (no transcript on roots unless a root is also a leaf in your tree).
- Leaves: have "transcript"; may have "children" if you branch deeper later.
[
  {
    "id": 1,
    "label": "Brief topic",
    "children": [
      {
        "id": 2,
        "label": "Brief sub-point",
        "transcript": "What was said for this point so far"
      }
    ]
  }
]

<Existing mind map — frozen except active leaf rules above>
${JSON.stringify(existingMap)}

<New transcript since last update${isInitial ? ' (full meeting so far)' : ''}>
${newTranscript}

Return ONLY valid JSON:
{
  "activeLeafId": <number>,
  "mindMap": [ ...complete forest... ]
}
If the new transcript is empty noise or unrelated, return the existing mind map unchanged with the same activeLeafId.
`.trim();
}

const MindMap = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [time, setTime] = useState(0);
  const [selectedTranscript, setSelectedTranscript] = useState('');
  const [open, setOpen] = useState(false);
  const [structuredData, setStructuredData] = useState([]);
  const structuredDataRef = useRef(structuredData);
  const activeLeafIdRef = useRef(null);
  const transcriptRef = useRef(transcript);
  const processedTranscriptLengthRef = useRef(0);
  const lastSyncAtRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef(false);

  useEffect(() => {
    structuredDataRef.current = structuredData;
  }, [structuredData]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    const transcriptText = transcript.trim();
    if (!transcriptText) return;

    let cancelled = false;
    let debounceTimer;
    let maxIntervalTimer;

    const applyMindMap = (mindMap, activeLeafId) => {
      setStructuredData(mindMap);
      activeLeafIdRef.current = activeLeafId;
      const { nodes: newNodes, edges: newEdges } = convertToFlow(mindMap);
      setNodes(newNodes);
      setEdges(newEdges);
    };

    const runSync = async () => {
      if (syncInFlightRef.current) {
        pendingSyncRef.current = true;
        return;
      }

      const fullText = transcriptRef.current.trim();
      if (!fullText) return;

      const existingMap = structuredDataRef.current;
      const isInitial = existingMap.length === 0;
      const delta = isInitial
        ? fullText
        : fullText.slice(processedTranscriptLengthRef.current).trim();

      if (!delta && !isInitial) return;

      syncInFlightRef.current = true;
      try {
        const prompt = buildMindMapPrompt({
          existingMap,
          newTranscript: delta,
          activeLeafId: activeLeafIdRef.current,
          nextNodeId: getMaxNodeId(existingMap) + 1,
          isInitial,
        });
        const raw = await getOpenAIResponse(prompt);
        if (cancelled) return;

        if (!raw?.length) {
          console.error('No data returned from OpenAI API');
          return;
        }

        const { mindMap, activeLeafId } = parseMindMapResponse(raw);
        const validation = validateIncrementalUpdate(
          existingMap,
          mindMap,
          activeLeafIdRef.current,
        );

        if (!validation.ok) {
          console.warn('Mind map update rejected:', validation.reason);
          return;
        }

        applyMindMap(
          validation.mindMap,
          activeLeafId ?? activeLeafIdRef.current,
        );
        processedTranscriptLengthRef.current = fullText.length;
        lastSyncAtRef.current = Date.now();
      } catch (error) {
        if (!cancelled) {
          console.error('Error updating mind map from transcript:', error);
        }
      } finally {
        syncInFlightRef.current = false;
        if (!cancelled && pendingSyncRef.current) {
          pendingSyncRef.current = false;
          runSync();
        }
      }
    };

    const scheduleSync = () => {
      window.clearTimeout(debounceTimer);
      window.clearTimeout(maxIntervalTimer);

      debounceTimer = window.setTimeout(runSync, TRANSCRIPT_DEBOUNCE_MS);

      const elapsed = Date.now() - lastSyncAtRef.current;
      const maxDelay =
        lastSyncAtRef.current === 0
          ? TRANSCRIPT_MAX_INTERVAL_MS
          : Math.max(0, TRANSCRIPT_MAX_INTERVAL_MS - elapsed);
      maxIntervalTimer = window.setTimeout(runSync, maxDelay);
    };

    scheduleSync();

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      window.clearTimeout(maxIntervalTimer);
    };
  }, [transcript]);

  const handleNodeClick = (event, node) => {
    if (node?.data?.transcript) {
      setSelectedTranscript(node.data.transcript);
      setOpen(true);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', position: 'relative' }}>
      {/* Gradient Stripe with Logo */}
      <Box
        sx={{
          height: 40,
          minHeight: 40,
          flexShrink: 0,
          background: 'linear-gradient(to right,rgb(133, 62, 208),rgb(53, 109, 207))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <img
          src="src/assets/MindEcho.svg"
          alt="MindEcho"
          style={{ height: 28, width: 'auto', maxWidth: 140 }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', flex: 1, minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 280, minHeight: 0, overflow: 'auto' }}>
          <InputKeywords transcript={transcript} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 2, minHeight: 0 }}>
          <Box sx={{ flex: 1, minHeight: 120, position: 'relative' }}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                nodeTypes={nodeTypes}
                panOnScroll
                zoomOnScroll
                zoomOnPinch
                panOnDrag
                onNodeClick={handleNodeClick}
                style={{
                  backgroundColor: 'white',
                  background: 'white',
                  color: 'black',
                }}
              >
                <Background color="#ddd" gap={16} />
                <Controls />
              </ReactFlow>
            </ReactFlowProvider>
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Details (transcript):
                <IconButton onClick={() => setOpen(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent>
                <Typography variant="body1">{selectedTranscript}</Typography>
              </DialogContent>
            </Dialog>
          </Box>
          {/* Transcript Section */}
          <Transcript setTime={setTime} setTranscript={setTranscript} />
        </Box>
      </Box>
    </Box>
  );
};

export default MindMap;