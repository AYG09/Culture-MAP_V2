import { useCallback, useRef } from 'react';
import { addEdge } from '@xyflow/react';
import type { Node, Edge, ReactFlowInstance } from '@xyflow/react';
import liveblocksService from '../services/LiveblocksService';
import type {
  AddNodePayload,
  AddNodesWithConnectionsPayload,
  AdjustLayerHeightPayload,
  AiAction,
  BatchConnectionInput,
  BatchNodeInput,
  CreateConnectionPayload,
  DeleteConnectionPayload,
  DeleteNodePayload,
  FitViewPayload,
  FocusNodePayload,
  PanViewportPayload,
  PinNodePayload,
  RestoreSnapshotPayload,
  SaveSnapshotPayload,
  SetLayerOpacityPayload,
  SetStyleVariablesPayload,
  SetUiVisibilityPayload,
  SetViewportPayload,
  ToggleLayerBackgroundPayload,
  UnpinNodePayload,
  UpdateNodePayload,
  ZoomViewportPayload,
} from '../types/actions';
import {
  isAddNodePayload,
  isAddNodesWithConnectionsPayload,
  isDeleteConnectionPayload,
  isDeleteNodePayload,
  isUpdateNodePayload,
} from '../types/actions';
import { INTENSITY_MAP } from '../types/culture';
import { convertFromFlowData, convertToFlowData } from '../utils/flowDataConverter';
import { getOptimalHandles, LAYER_MAX_HEIGHT } from '../utils/flowAutoLayout';

const SNAPSHOT_INDEX_KEY = 'culture-map-snapshots:index';
type SnapshotIndexEntry = { id: string; savedAt: string };

const loadSnapshotIndex = (): SnapshotIndexEntry[] => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return false;
      const typed = entry as { id?: unknown; savedAt?: unknown };
      return typeof typed.id === 'string' && typeof typed.savedAt === 'string';
    }) as SnapshotIndexEntry[];
  } catch (err) {
    console.warn('⚠️ snapshot index load failed', err);
    return [];
  }
};

const saveSnapshotIndex = (entries: SnapshotIndexEntry[]) => {
  try {
    localStorage.setItem(SNAPSHOT_INDEX_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('⚠️ snapshot index save failed', err);
  }
};

// Hook Configuration Interface
interface UseAiActionsProps {
  // React Flow State
  nodesRef: React.MutableRefObject<Node[]>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edgesRef: React.MutableRefObject<Edge[]>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  reactFlowInstance: ReactFlowInstance | null;
  
  // Layer State
  layerHeights: number[];
  setLayerHeights: React.Dispatch<React.SetStateAction<number[]>>;
  layerOpacities: number[];
  setLayerOpacities: React.Dispatch<React.SetStateAction<number[]>>;
  
  // UI State Setters
  setShowLayerBackground: (show: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowMiniMap: (show: boolean) => void;
  setShowExportMenu: (show: boolean) => void;
  setShowLayerControlPanel: (show: boolean) => void;
  
  // Styling
  styleVariables: {
    edgeColor: string;
    edgeWidth: number;
    // Add other necessary style variables if strictly needed, or use Partial
    [key: string]: any; 
  };
  setStyleVariables: React.Dispatch<React.SetStateAction<any>>;
  
  // Callbacks & Layout
  safeAutoLayout: (showAlert?: boolean) => Promise<void>;
  ensureLiveblocksConnected: (actionLabel: string) => boolean;
  onNotesChange: (notes: any[]) => void; // Using any[] to avoid circular deps if possible, or strict types
  onConnectionsChange: (connections: any[]) => void;
  handleNodeContentUpdate: (id: string, content: string) => void;
  handleStartNodeEditing: (id: string) => boolean;
  handleStopNodeEditing: (id: string) => void;
  handleTogglePin: (id: string, nextPinned: boolean) => void;
  
  // Mode
  isConsultingMode: boolean;
  
  // Refs for tracking layout state
  layoutSpacingRef: React.MutableRefObject<'compact' | 'normal' | 'wide'>;
  preserveEdgesRef: React.MutableRefObject<boolean>;
  isUserLayerHeightChangeRef: React.MutableRefObject<boolean>;
}

export const useAiActions = ({
  nodesRef,
  setNodes,
  edgesRef,
  setEdges,
  reactFlowInstance,
  layerHeights,
  setLayerHeights,
  layerOpacities,
  setLayerOpacities,
  setShowLayerBackground,
  setShowControls,
  setShowMiniMap,
  setShowExportMenu,
  setShowLayerControlPanel,
  styleVariables,
  setStyleVariables,
  safeAutoLayout,
  ensureLiveblocksConnected,
  onNotesChange,
  onConnectionsChange,
  handleNodeContentUpdate,
  handleStartNodeEditing,
  handleStopNodeEditing,
  handleTogglePin,
  isConsultingMode,
  layoutSpacingRef,
  preserveEdgesRef,
  isUserLayerHeightChangeRef,
}: UseAiActionsProps) => {

  const actionQueuePromiseRef = useRef<Promise<void>>(Promise.resolve());

  const executeAiAction = useCallback((action: AiAction) => {
    console.log('🤖 [Action Bridge] AI 액션 실행:', action);
    const { name } = action;
    const args = (action.args ?? {}) as Record<string, unknown>;

    const checkUserCreatedProtection = (
      itemId: string,
      itemType: 'node' | 'edge',
      operation: 'update' | 'delete'
    ): boolean => {
      const force = args.force === true;
      
      if (itemType === 'node') {
        const node = nodesRef.current.find(n => n.id === itemId);
        const createdBy = (node?.data as { createdBy?: string })?.createdBy;
        if (createdBy === 'user' && !force) {
          console.warn(`⚠️ [Action Bridge] 사용자가 생성한 노드는 AI가 임의로 ${operation}할 수 없습니다: ${itemId}`);
          return false;
        }
      } else {
        const edge = edgesRef.current.find(e => e.id === itemId);
        const createdBy = (edge?.data as { createdBy?: string })?.createdBy;
        if (createdBy === 'user' && !force) {
          console.warn(`⚠️ [Action Bridge] 사용자가 생성한 연결선은 AI가 임의로 ${operation}할 수 없습니다: ${itemId}`);
          return false;
        }
      }
      return true;
    };

    const getNodeTypeFromLayer = (layerValue: number) => {
      const layerToType: Record<number, string> = {
        1: 'result',
        2: 'behavior',
        3: 'tangible_lever',
        4: 'intangible_lever',
      };
      return layerToType[Math.max(1, Math.min(4, layerValue))] || 'result';
    };

    const requiresSync = [
      'add_node',
      'add_nodes_with_connections',
      'update_node',
      'delete_node',
      'delete_connection',
      'create_connection',
      'pin_node',
      'unpin_node',
    ];

    if (requiresSync.includes(name) && !ensureLiveblocksConnected('AI 액션')) {
      return;
    }

    switch (name) {
      case 'add_node': {
        if (!isAddNodePayload(args)) {
          console.error('❌ [Action Bridge] Invalid add_node payload:', args);
          break;
        }
        const payload = args as AddNodePayload;
        const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const layerValue = payload.layer ?? 2;
        const layerIndex = layerValue - 1;

        let currentY = 0;
        for (let i = 0; i < layerIndex; i++) {
          currentY += layerHeights[i];
        }
        const defaultY = currentY + (layerHeights[layerIndex] / 2);

        const existingNodesInLayer = nodesRef.current.filter(n => n.data?.layer === layerValue).length;
        const baseX = 150 + (existingNodesInLayer * 220);
        const x = typeof payload.x === 'number' ? payload.x : baseX;
        const y = typeof payload.y === 'number' ? payload.y : defaultY + (Math.random() * 20 - 10);

        const typeMap: Record<string, string> = {
          '결과': 'result',
          '행동': 'behavior',
          '유형_레버': 'tangible_lever',
          '무형_레버': 'intangible_lever',
          'result': 'result',
          'behavior': 'behavior',
          'tangible_lever': 'tangible_lever',
          'intangible_lever': 'intangible_lever',
        };
        const nodeType = typeMap[payload.type] || getNodeTypeFromLayer(layerValue);

        const content = payload.content || payload.label || '새 노드';
        const sentiment = payload.sentiment === 'positive' ? 'positive' : (payload.sentiment === 'negative' ? 'negative' : 'neutral');
        const frequency = isConsultingMode
          ? (typeof payload.intensity === 'number'
            ? INTENSITY_MAP.TO_STRING(payload.intensity)
            : (payload.intensity ?? 'medium'))
          : undefined;

        liveblocksService.updateStickyNote({
          id: newNodeId,
          content,
          x,
          y,
          layer: layerValue,
          sentiment,
          type: nodeType,
          createdBy: 'ai',
          ...(isConsultingMode && frequency ? { frequency } : {}),
        });

        const newNode: Node = {
          id: newNodeId,
          type: nodeType,
          position: { x, y },
          data: {
            id: newNodeId,
            content,
            author: liveblocksService.getCurrentUserDisplayName(),
            timestamp: Date.now(),
            sentiment,
            createdBy: 'ai',
            ...(isConsultingMode && frequency ? { frequency } : {}),
            type: nodeType,
            layer: layerValue,
            onUpdate: handleNodeContentUpdate,
            onEditStart: handleStartNodeEditing,
            onEditEnd: handleStopNodeEditing,
            onTogglePin: handleTogglePin,
            pinned: false,
            isLocked: false,
            lockedBy: undefined,
          },
          draggable: true,
        };

        setNodes((nds) => {
          const updated = nds.concat(newNode);
          nodesRef.current = updated;
          return updated;
        });
        console.log('✅ [Action Bridge] New node added to UI:', newNodeId);
        break;
      }

      case 'add_nodes_with_connections': {
        if (!isAddNodesWithConnectionsPayload(args)) break;
        const payload = args as AddNodesWithConnectionsPayload;
        const nodeInputs = Array.isArray(payload.nodes) ? (payload.nodes as BatchNodeInput[]) : [];
        const connectionInputs = Array.isArray(payload.connections) ? (payload.connections as BatchConnectionInput[]) : [];
        if (!nodeInputs.length) break;

        const typeMap: Record<string, string> = {
          '결과': 'result', '행동': 'behavior', '유형_레버': 'tangible_lever', '무형_레버': 'intangible_lever',
          'result': 'result', 'behavior': 'behavior', 'tangible_lever': 'tangible_lever', 'intangible_lever': 'intangible_lever',
        };

        const layerCounts = new Map<number, number>();
        nodesRef.current.forEach((node) => {
          const lv = typeof node.data?.layer === 'number' ? node.data.layer : undefined;
          if (lv) layerCounts.set(lv, (layerCounts.get(lv) ?? 0) + 1);
        });

        const idMap: Record<string, string> = {};
        const newNodes: Node[] = [];
        const batchTimestamp = Date.now();

        nodeInputs.forEach((input, index) => {
          const layerValue = typeof input.layer === 'number' ? input.layer : 2;
          const layerIndex = Math.max(1, Math.min(4, layerValue)) - 1;
          const currentCount = layerCounts.get(layerValue) ?? 0;
          layerCounts.set(layerValue, currentCount + 1);

          let currentY = 0;
          for (let i = 0; i < layerIndex; i++) currentY += layerHeights[i];
          const defaultY = currentY + (layerHeights[layerIndex] / 2);
          const baseX = 150 + (currentCount * 220);

          const x = typeof input.x === 'number' && Number.isFinite(input.x) ? input.x : baseX;
          const y = typeof input.y === 'number' && Number.isFinite(input.y) ? input.y : defaultY + (Math.random() * 20 - 10);

          const nodeType = typeMap[input.type] || getNodeTypeFromLayer(layerValue);
          const content = input.content || input.label || '새 노드';
          const sentiment = input.sentiment === 'positive' ? 'positive' : (input.sentiment === 'negative' ? 'negative' : 'neutral');
          const frequency = isConsultingMode
            ? (typeof input.intensity === 'number' ? INTENSITY_MAP.TO_STRING(input.intensity) : input.intensity)
            : undefined;

          const newNodeId = `node-${batchTimestamp}-${index}-${Math.random().toString(36).substr(2, 4)}`;
          if (input.tempId) idMap[input.tempId] = newNodeId;

          liveblocksService.updateStickyNote({
            id: newNodeId,
            content,
            x,
            y,
            layer: layerValue,
            sentiment,
            type: nodeType,
            createdBy: 'ai',
            ...(isConsultingMode && frequency ? { frequency } : {}),
          });

          newNodes.push({
            id: newNodeId,
            type: nodeType,
            position: { x, y },
            data: {
              id: newNodeId,
              content,
              author: liveblocksService.getCurrentUserDisplayName(),
              timestamp: Date.now(),
              sentiment,
              createdBy: 'ai',
              ...(isConsultingMode && frequency ? { frequency } : {}),
              type: nodeType,
              layer: layerValue,
              onUpdate: handleNodeContentUpdate,
              onEditStart: handleStartNodeEditing,
              onEditEnd: handleStopNodeEditing,
              onTogglePin: handleTogglePin,
              pinned: false,
            },
            draggable: true,
          });
        });

        const updatedNodes = [...nodesRef.current, ...newNodes];
        setNodes(() => {
            nodesRef.current = updatedNodes;
            return updatedNodes;
        });

        const newEdges: Edge[] = [];
        connectionInputs.forEach((connection, index) => {
          const sourceId = idMap[connection.sourceId] || connection.sourceId;
          const targetId = idMap[connection.targetId] || connection.targetId;
          if (!sourceId || !targetId) return;

          const relationType = connection.relationType === 'indirect' ? 'indirect' : 'direct';
          const isPositive = connection.isPositive !== false;
          const edgeColor = isPositive ? '#10b981' : '#ef4444';
          const edgeId = `edge-${sourceId}-${targetId}-${batchTimestamp}-${index}`;

          const sourceNode = updatedNodes.find(n => n.id === sourceId);
          const targetNode = updatedNodes.find(n => n.id === targetId);
          let { sourceHandle, targetHandle } = (sourceNode && targetNode) 
            ? getOptimalHandles(sourceNode, targetNode) 
            : { sourceHandle: undefined, targetHandle: undefined };

          newEdges.push({
            id: edgeId,
            source: sourceId,
            target: targetId,
            sourceHandle,
            targetHandle,
            type: 'animatedFlow',
            style: {
              strokeWidth: 2,
              stroke: edgeColor,
              strokeDasharray: relationType === 'indirect' ? '5 5' : undefined,
            },
            markerEnd: { type: 'arrowclosed', width: 20, height: 20, color: edgeColor },
            data: { relationType, isPositive, createdBy: 'ai' },
          });

          liveblocksService.updateConnection({
            id: edgeId, sourceId, targetId, relationType, isPositive, createdBy: 'ai', sourceHandle, targetHandle,
          });
        });

        const updatedEdges = [...edgesRef.current, ...newEdges];
        setEdges(() => {
            edgesRef.current = updatedEdges;
            return updatedEdges;
        });
        
        const { connections: updatedConnections } = convertFromFlowData(updatedNodes, updatedEdges);
        onConnectionsChange(updatedConnections);
        console.log('✅ [Action Bridge] Batch nodes/connections added:', newNodes.length, newEdges.length);
        break;
      }

      case 'update_node': {
        if (!isUpdateNodePayload(args)) break;
        const payload = args as UpdateNodePayload & { layer?: number; type?: string; force?: boolean };
        if (!payload.id) break;
        if (!checkUserCreatedProtection(payload.id, 'node', 'update')) break;

        const sentiment = payload.sentiment === 'positive' ? 'positive' : (payload.sentiment === 'negative' ? 'negative' : 'neutral');
        const frequency = isConsultingMode
          ? (typeof payload.intensity === 'number' ? INTENSITY_MAP.TO_STRING(payload.intensity) : payload.intensity)
          : undefined;
        let content = payload.content || payload.label;
        const hasX = typeof payload.x === 'number' && Number.isFinite(payload.x);
        const hasY = typeof payload.y === 'number' && Number.isFinite(payload.y);
        const layerValue = typeof payload.layer === 'number' ? payload.layer : undefined;
        const typeValue = typeof payload.type === 'string' ? payload.type : undefined;

        liveblocksService.updateStickyNote({
          id: payload.id,
          content,
          sentiment,
          ...(isConsultingMode && frequency ? { frequency } : {}),
          ...(hasX ? { x: payload.x } : {}),
          ...(hasY ? { y: payload.y } : {}),
          ...(layerValue ? { layer: layerValue } : {}),
          ...(typeValue ? { type: typeValue } : {}),
        });

        setNodes((nds) => {
          const updated = nds.map((node) => {
            if (node.id === payload.id) {
                // If content is undefined in payload, keep existing. If null/empty string update to empty is intentional?
                // Using helper logic from original file:
                // content = payload.content || payload.label; (already done)
              const nextPosition = (hasX || hasY) ? { x: hasX ? payload.x! : node.position.x, y: hasY ? payload.y! : node.position.y } : node.position;
              return {
                ...node,
                position: nextPosition,
                data: {
                  ...node.data,
                  ...(content !== undefined ? { content } : {}),
                  ...(sentiment ? { sentiment } : {}),
                  ...(isConsultingMode && frequency ? { frequency } : {}),
                  ...(typeValue ? { type: typeValue } : {}),
                  ...(layerValue ? { layer: layerValue } : {}),
                },
              };
            }
            return node;
          });
          nodesRef.current = updated;
          return updated;
        });
        break;
      }

      case 'delete_node': {
        if (!isDeleteNodePayload(args)) break;
        const payload = args as DeleteNodePayload & { force?: boolean };
        if (!payload.id) break;
        if (!checkUserCreatedProtection(payload.id, 'node', 'delete')) break;

        const edgesToDelete = edgesRef.current.filter(e => e.source === payload.id || e.target === payload.id);
        liveblocksService.deleteStickyNote(payload.id);
        edgesToDelete.forEach(e => liveblocksService.deleteConnection(e.id));
        
        setNodes(nds => {
            const up = nds.filter(n => n.id !== payload.id);
            nodesRef.current = up;
            return up;
        });
        setEdges(eds => {
            const up = eds.filter(e => e.source !== payload.id && e.target !== payload.id);
            edgesRef.current = up;
            return up;
        });
        
        const { notes, connections } = convertFromFlowData(nodesRef.current, edgesRef.current);
        onNotesChange(notes);
        onConnectionsChange(connections);
        break;
      }

      case 'delete_connection': {
        if (!isDeleteConnectionPayload(args)) break;
        const payload = args as DeleteConnectionPayload & { force?: boolean };
        if (!payload.id) break;
        if (!checkUserCreatedProtection(payload.id, 'edge', 'delete')) break;

        liveblocksService.deleteConnection(payload.id);
        setEdges(eds => {
            const up = eds.filter(e => e.id !== payload.id);
            edgesRef.current = up;
            return up;
        });
        
        const { connections } = convertFromFlowData(nodesRef.current, edgesRef.current);
        onConnectionsChange(connections);
        break;
      }

      case 'create_connection': {
        const payload = args as unknown as CreateConnectionPayload & { source?: string; target?: string };
        let sourceId = payload.sourceId || payload.source;
        let targetId = payload.targetId || payload.target;
        if (!sourceId || !targetId) break;

        const findNodeByContentOrId = (idOrContent: string): string | undefined => {
            const exactMatch = nodesRef.current.find(n => n.id === idOrContent);
            if (exactMatch) return exactMatch.id;
            const term = idOrContent.replace(/^"|"$/g, '').trim().toLowerCase();
            const contentMatch = nodesRef.current.find(n => {
                const c = String((n.data as { content?: string })?.content || '').toLowerCase();
                const l = String((n.data as { label?: string })?.label || '').toLowerCase();
                return c.includes(term) || term.includes(c) || l.includes(term) || term.includes(l) || c === term || l === term;
            });
            return contentMatch?.id;
        };

        const rSourceId = findNodeByContentOrId(sourceId);
        const rTargetId = findNodeByContentOrId(targetId);

        if (!rSourceId || !rTargetId) {
            console.warn('⚠️ [Action Bridge] Node not found for connection');
            break;
        }
        sourceId = rSourceId;
        targetId = rTargetId;

        const relationType = payload.relationType === 'indirect' ? 'indirect' : 'direct';
        const isPositive = payload.isPositive !== false;
        
        const sourceNode = nodesRef.current.find(n => n.id === sourceId);
        const targetNode = nodesRef.current.find(n => n.id === targetId);
        let { sourceHandle, targetHandle } = (sourceNode && targetNode) 
            ? getOptimalHandles(sourceNode, targetNode) 
            : { sourceHandle: undefined, targetHandle: undefined };

        const edgeId = `edge-${sourceId}-${targetId}`;
        const newEdge: Edge = {
            id: edgeId, source: sourceId, target: targetId, sourceHandle, targetHandle, type: 'animatedFlow',
            style: { strokeWidth: styleVariables.edgeWidth, stroke: styleVariables.edgeColor, strokeDasharray: relationType === 'indirect' ? '5 5' : undefined },
            markerEnd: { type: 'arrowclosed', width: 20, height: 20, color: styleVariables.edgeColor },
            data: { relationType, isPositive, createdBy: 'ai' },
        };

        setEdges(eds => {
            const up = addEdge(newEdge, eds);
            edgesRef.current = up;
            return up;
        });

        const { connections } = convertFromFlowData(nodesRef.current, [...edgesRef.current, newEdge]);
        onConnectionsChange(connections);

        liveblocksService.updateConnection({
            id: edgeId, sourceId, targetId, relationType, isPositive, createdBy: 'ai', sourceHandle, targetHandle
        });
        break;
      }

      case 'pin_node': {
        const payload = (args as unknown) as PinNodePayload;
        if (!payload?.id) break;
        liveblocksService.updateStickyNote({ id: payload.id, pinned: true, pinnedHandles: payload.pinHandles === true });
        setNodes(nds => {
            const up = nds.map(n => n.id !== payload.id ? n : { ...n, data: { ...n.data, pinned: true, pinnedHandles: payload.pinHandles === true } });
            nodesRef.current = up;
            return up;
        });
        break;
      }

      case 'unpin_node': {
        const payload = (args as unknown) as UnpinNodePayload;
        if (!payload?.id) break;
        liveblocksService.updateStickyNote({ id: payload.id, pinned: false, pinnedHandles: false });
        setNodes(nds => {
            const up = nds.map(n => n.id !== payload.id ? n : { ...n, data: { ...n.data, pinned: false, pinnedHandles: false } });
            nodesRef.current = up;
            return up;
        });
        break;
      }

      case 'adjust_layer_height': {
        const payload = (args as unknown) as AdjustLayerHeightPayload;
        if (payload.layer && payload.height) {
          const layerIndex = payload.layer - 1;
          const newHeights = [...layerHeights];
          newHeights[layerIndex] = Math.min(LAYER_MAX_HEIGHT, Math.max(100, payload.height));
          isUserLayerHeightChangeRef.current = true;
          setLayerHeights(newHeights);
          if (liveblocksService.isConnected()) {
            liveblocksService.updateLayerSettings({ layerHeights: newHeights, layerOpacities });
          }
          setTimeout(() => safeAutoLayout(false), 100);
        }
        break;
      }

      case 'set_viewport': {
        const payload = (args as unknown) as SetViewportPayload;
        if (!reactFlowInstance) break;
        const duration = typeof payload.duration === 'number' ? payload.duration : 0;
        const viewport = reactFlowInstance.getViewport();
        const x = typeof payload.x === 'number' ? payload.x : viewport.x;
        const y = typeof payload.y === 'number' ? payload.y : viewport.y;
        const zoom = typeof payload.zoom === 'number' ? payload.zoom : viewport.zoom;
        void reactFlowInstance.setViewport({ x, y, zoom }, duration > 0 ? { duration } : undefined);
        break;
      }

      case 'pan_viewport': {
        const payload = (args as unknown) as PanViewportPayload;
        if (!reactFlowInstance) break;
        if (typeof payload.dx !== 'number' || typeof payload.dy !== 'number') break;
        const duration = typeof payload.duration === 'number' ? payload.duration : 0;
        const viewport = reactFlowInstance.getViewport();
        void reactFlowInstance.setViewport(
          { x: viewport.x + payload.dx, y: viewport.y + payload.dy, zoom: viewport.zoom },
          duration > 0 ? { duration } : undefined
        );
        break;
      }

      case 'zoom_viewport': {
        const payload = (args as unknown) as ZoomViewportPayload;
        if (!reactFlowInstance) break;
        const duration = typeof payload.duration === 'number' ? payload.duration : 0;
        const viewport = reactFlowInstance.getViewport();
        const nextZoom = typeof payload.zoom === 'number'
          ? payload.zoom
          : typeof payload.delta === 'number'
            ? viewport.zoom + payload.delta
            : viewport.zoom;
        void reactFlowInstance.setViewport({ x: viewport.x, y: viewport.y, zoom: nextZoom }, duration > 0 ? { duration } : undefined);
        break;
      }

      case 'fit_view': {
        const payload = (args as unknown) as FitViewPayload;
        if (!reactFlowInstance) break;
        const duration = typeof payload.duration === 'number' ? payload.duration : 0;
        const padding = typeof payload.padding === 'number' ? payload.padding : 0.1;
        void reactFlowInstance.fitView(duration > 0 ? { duration, padding } : { padding });
        break;
      }

      case 'focus_node': {
        const payload = (args as unknown) as FocusNodePayload;
        if (!reactFlowInstance || !payload.id) break;
        const target = nodesRef.current.find((node) => node.id === payload.id);
        if (!target) break;
        const duration = typeof payload.duration === 'number' ? payload.duration : 0;
        const zoom = typeof payload.zoom === 'number' ? payload.zoom : reactFlowInstance.getViewport().zoom;
        const nodeWidth = typeof target.measured?.width === 'number' ? target.measured.width : 250;
        const nodeHeight = typeof target.measured?.height === 'number' ? target.measured.height : 120;
        const centerX = target.position.x + nodeWidth / 2;
        const centerY = target.position.y + nodeHeight / 2;
        const viewport = reactFlowInstance.getViewport();
        const x = viewport.x + (viewport.zoom - zoom) * centerX;
        const y = viewport.y + (viewport.zoom - zoom) * centerY;
        void reactFlowInstance.setViewport({ x, y, zoom }, duration > 0 ? { duration } : undefined);
        break;
      }

      case 'set_layer_opacity': {
        const payload = (args as unknown) as SetLayerOpacityPayload;
        // Fallback: AI may send layer as string like "Layer 2" instead of number 2
        const layerRaw = (payload as { layer?: unknown }).layer;
        let layerNum = typeof layerRaw === 'number' ? layerRaw : 0;
        if (typeof layerRaw === 'string') {
          const match = layerRaw.match(/\d+/);
          layerNum = match ? parseInt(match[0], 10) : 0;
        }
        if (!layerNum || typeof payload.opacity !== 'number') break;
        const index = Math.max(1, Math.min(4, layerNum)) - 1;
        const next = [...layerOpacities];
        next[index] = Math.max(0, Math.min(1, payload.opacity));
        setLayerOpacities(next);
        break;
      }

      case 'toggle_layer_background': {
        const payload = (args as unknown) as ToggleLayerBackgroundPayload;
        if (typeof payload.visible !== 'boolean') break;
        setShowLayerBackground(payload.visible);
        if (liveblocksService.isConnected()) {
          liveblocksService.updateLayerSettings({ layerHeights, layerOpacities, showLayerBackground: payload.visible });
        }
        break;
      }

      case 'set_ui_visibility': {
        const payload = (args as unknown) as SetUiVisibilityPayload;
        if (typeof payload.controls === 'boolean') setShowControls(payload.controls);
        if (typeof payload.minimap === 'boolean') setShowMiniMap(payload.minimap);
        if (typeof payload.layerPanel === 'boolean') setShowLayerControlPanel(payload.layerPanel);
        if (typeof payload.layerBackground === 'boolean') setShowLayerBackground(payload.layerBackground);
        if (typeof payload.exportMenu === 'boolean') setShowExportMenu(payload.exportMenu);
        break;
      }

      case 'set_style_variables': {
        const payload = (args as unknown) as SetStyleVariablesPayload;
        setStyleVariables((prev: any) => {
          const nextEdgeColor = payload.edgeColor ?? prev.edgeColor;
          const nextEdgeWidth = typeof payload.edgeWidth === 'number' ? payload.edgeWidth : prev.edgeWidth;
          
          if (payload.edgeColor || typeof payload.edgeWidth === 'number') {
            setEdges((eds) => {
              const updated = eds.map((edge) => {
                const markerEnd = edge.markerEnd;
                const nextMarkerEnd: Edge['markerEnd'] = markerEnd && typeof markerEnd === 'object'
                  ? { ...markerEnd, color: nextEdgeColor }
                  : markerEnd ?? { type: 'arrowclosed' as const, width: 20, height: 20, color: nextEdgeColor };
                return {
                  ...edge,
                  style: { ...(edge.style ?? {}), stroke: nextEdgeColor, strokeWidth: nextEdgeWidth },
                  markerEnd: nextMarkerEnd,
                };
              });
              edgesRef.current = updated;
              return updated;
            });
          }

          return { ...prev, ...payload, edgeColor: nextEdgeColor, edgeWidth: nextEdgeWidth };
        });
        break;
      }

      case 'save_snapshot': {
        const payload = (args as unknown) as SaveSnapshotPayload;
        const snapshotName = payload.name?.trim() || payload.snapshot_id?.trim() || 'default';
        const viewport = reactFlowInstance?.getViewport?.();
        const snapshotNodes = nodesRef.current.map((node) => ({
          ...node,
          data: { ...node.data },
        }));
        const snapshotEdges = edgesRef.current.map((edge) => ({
          ...edge,
          data: edge.data ? { ...edge.data } : edge.data,
        }));
        const flow = {
          nodes: snapshotNodes,
          edges: snapshotEdges,
          viewport,
          layerHeights,
          layerOpacities,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(`culture-map-snapshot:${snapshotName}`, JSON.stringify(flow));
        const savedAt = flow.savedAt as string;
        const nextIndex = loadSnapshotIndex().filter(entry => entry.id !== snapshotName);
        nextIndex.unshift({ id: snapshotName, savedAt });
        saveSnapshotIndex(nextIndex);
        break;
      }

      case 'restore_snapshot': {
        const payload = (args as unknown) as RestoreSnapshotPayload;
        const snapshotName = payload.name?.trim() || payload.snapshot_id?.trim() || 'default';
        const raw = localStorage.getItem(`culture-map-snapshot:${snapshotName}`);
        if (!raw) break;
        try {
          const flow = JSON.parse(raw);
          const rawNodes = Array.isArray(flow.nodes) ? (flow.nodes as Node[]) : [];
          const rawEdges = Array.isArray(flow.edges) ? (flow.edges as Edge[]) : [];
          const nextLayerHeights = Array.isArray(flow.layerHeights)
            ? flow.layerHeights.filter((value: unknown) => typeof value === 'number')
            : undefined;
          const nextLayerOpacities = Array.isArray(flow.layerOpacities)
            ? flow.layerOpacities.filter((value: unknown) => typeof value === 'number')
            : undefined;

          if (nextLayerHeights && nextLayerHeights.length) {
            setLayerHeights(nextLayerHeights);
          }

          if (nextLayerOpacities && nextLayerOpacities.length) {
            setLayerOpacities(nextLayerOpacities);
          }

          const { notes, connections } = convertFromFlowData(rawNodes, rawEdges);
          const { nodes: nextNodes, edges: nextEdges } = convertToFlowData(
            notes,
            connections,
            handleNodeContentUpdate,
            {
              onNodeEditStart: handleStartNodeEditing,
              onNodeEditEnd: handleStopNodeEditing,
              onTogglePin: handleTogglePin,
              currentUserId: liveblocksService.getCurrentUserId() ?? undefined,
              includeFrequency: isConsultingMode,
            }
          );
          setNodes(nextNodes);
          setEdges(nextEdges);
          nodesRef.current = nextNodes;
          edgesRef.current = nextEdges;

          onNotesChange(notes);
          onConnectionsChange(connections);

          if (liveblocksService.isConnected()) {
            if (nextLayerHeights || nextLayerOpacities) {
              liveblocksService.updateLayerSettings({
                layerHeights: nextLayerHeights ?? layerHeights,
                layerOpacities: nextLayerOpacities ?? layerOpacities,
              });
            }
            const lbNotes = notes.map((note) => ({
              id: note.id, content: note.content, x: note.position.x, y: note.position.y,
              layer: note.layer, sentiment: note.sentiment, type: note.type,
              width: note.width, height: note.height, frequency: note.perceptionIntensity,
              basis: note.basis, pinned: note.pinned, pinnedHandles: note.pinnedHandles,
              timestamp: Date.now(), author: liveblocksService.getCurrentUserDisplayName(),
            }));
            const lbConnections = connections.map((connection) => ({
              id: connection.id, sourceId: connection.sourceId, targetId: connection.targetId,
              relationType: connection.relationType, isPositive: connection.isPositive,
              sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle,
            }));
            liveblocksService.restoreMapData(lbNotes, lbConnections);
          }
          if (flow.viewport && reactFlowInstance) reactFlowInstance.setViewport(flow.viewport);
        } catch (err) { console.error('Snapshot restore failed', err); }
        break;
      }

      case 'undo_layout': {
        if (!reactFlowInstance) break;
        const raw = localStorage.getItem('culture-map-snapshot:_before_layout');
        if (!raw) break;
        try {
          const flow = JSON.parse(raw);
          const nextNodes = Array.isArray(flow.nodes) ? flow.nodes : [];
          const nextEdges = Array.isArray(flow.edges) ? flow.edges : [];
          setNodes(nextNodes);
          setEdges(nextEdges);
          nodesRef.current = nextNodes;
          edgesRef.current = nextEdges;
          
          const { notes, connections } = convertFromFlowData(nextNodes, nextEdges);
          onNotesChange(notes);
          onConnectionsChange(connections);

          if (liveblocksService.isConnected()) {
             // (Identical to restore_snapshot liveblocks logic - redundant but safe)
             const lbNotes = notes.map((note) => ({
                id: note.id, content: note.content, x: note.position.x, y: note.position.y,
                layer: note.layer, sentiment: note.sentiment, type: note.type,
                width: note.width, height: note.height, frequency: note.perceptionIntensity,
                basis: note.basis, pinned: note.pinned, pinnedHandles: note.pinnedHandles,
                timestamp: Date.now(), author: liveblocksService.getCurrentUserDisplayName(),
              }));
              const lbConnections = connections.map((connection) => ({
                id: connection.id, sourceId: connection.sourceId, targetId: connection.targetId,
                relationType: connection.relationType, isPositive: connection.isPositive,
                sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle,
              }));
              liveblocksService.restoreMapData(lbNotes, lbConnections);
          }
          if (flow.viewport) reactFlowInstance.setViewport(flow.viewport);
        } catch (err) { console.error('Undo layout failed', err); }
        break;
      }

      case 'auto_layout':
        break;

      default:
        console.warn('⚠️ 알 수 없는 AI 액션:', name);
    }
  }, [
    ensureLiveblocksConnected,
    layerHeights,
    layerOpacities,
    onConnectionsChange,
    onNotesChange,
    reactFlowInstance,
    safeAutoLayout,
    setEdges,
    setLayerOpacities,
    setNodes,
    setShowControls,
    setShowExportMenu,
    setShowLayerBackground,
    setShowLayerControlPanel,
    setShowMiniMap,
    setStyleVariables,
    styleVariables,
    isConsultingMode,
    handleNodeContentUpdate,
    handleStartNodeEditing,
    handleStopNodeEditing,
    setLayerHeights
  ]);

  const handleAiAction = useCallback((action: AiAction | AiAction[]) => {
    const actions = Array.isArray(action) ? action : [action];

    actionQueuePromiseRef.current = actionQueuePromiseRef.current
      .then(async () => {
        let requestedLayout = false;
        let layoutNeeded = false;
        let suppressAutoLayout = false;

        for (const queuedAction of actions) {
          const name = queuedAction?.name;
          if (queuedAction?.__suppressAutoLayout) {
            suppressAutoLayout = true;
          }

          if (name === 'auto_layout') {
            requestedLayout = true;
            const spacing = queuedAction?.args?.spacing;
            if (spacing === 'compact' || spacing === 'normal' || spacing === 'wide') {
              layoutSpacingRef.current = spacing as any;
            }
            const preserveEdges = queuedAction?.args?.preserveEdges;
            if (typeof preserveEdges === 'boolean') {
              preserveEdgesRef.current = preserveEdges;
            }
            continue;
          }

          if (
            name === 'add_node' || name === 'add_nodes_with_connections' ||
            name === 'update_node' || name === 'delete_node' || name === 'delete_connection' ||
            name === 'create_connection'
          ) {
            layoutNeeded = true;
          }

          try {
            executeAiAction(queuedAction);
          } catch (err) {
            console.error('❌ AI 액션 실행 실패:', err);
          }
        }

        if (!suppressAutoLayout && (requestedLayout || layoutNeeded)) {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              void safeAutoLayout(false).finally(resolve);
            });
          });
        }
      })
      .catch((err) => {
        console.error('❌ [Action Bridge] AI 액션 체인 실패:', err);
      });
  }, [executeAiAction, safeAutoLayout]);

  return { executeAiAction, handleAiAction };
};
