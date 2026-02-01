import { useEffect, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import liveblocksService from '../services/LiveblocksService';
import type { LayerSettings, SessionType } from '../types/liveblocks';
import aiService from '../services/AIService';

interface CollaborationLock {
  itemId: string;
  itemType: 'note' | 'connection';
  userId: string;
  displayName?: string;
}

interface UseLiveblocksSyncProps {
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  
  // Hydration logic
  hydrateFromLiveblocks: (reason: string) => void | Promise<void>;
  
  // Callbacks passed to node data
  handleNodeContentUpdate: (id: string, content: string) => void;
  handleStartNodeEditing: (id: string) => boolean;
  handleStopNodeEditing: (id: string) => void;
  
  // Layer Settings
  setLayerHeights: React.Dispatch<React.SetStateAction<number[]>>;
  setLayerOpacities: React.Dispatch<React.SetStateAction<number[]>>;
  setShowLayerBackground: (visible: boolean) => void;
  
  // Collaboration Locks
  collaborationLocksRef: React.MutableRefObject<Record<string, CollaborationLock>>;
  setCollaborationLocks: React.Dispatch<React.SetStateAction<Record<string, CollaborationLock>>>;
  
  // Other State Setters
  setReportContent: React.Dispatch<React.SetStateAction<string>>;
  setSessionType: React.Dispatch<React.SetStateAction<SessionType>>;
  
  isConsultingMode: boolean;
}

export const useLiveblocksSync = ({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  hydrateFromLiveblocks,
  handleNodeContentUpdate,
  handleStartNodeEditing,
  handleStopNodeEditing,
  setLayerHeights,
  setLayerOpacities,
  setShowLayerBackground,
  collaborationLocksRef,
  setCollaborationLocks,
  setReportContent,
  setSessionType,
  isConsultingMode,
}: UseLiveblocksSyncProps) => {

  const pendingHydrateRef = useRef<number | null>(null);

  const getCurrentUserId = useCallback(() => liveblocksService.getCurrentUserId() ?? 'local-user', []);

  // Hydration Scheduler
  const scheduleHydrate = useCallback(
    (reason: string) => {
      if (pendingHydrateRef.current !== null) return;

      pendingHydrateRef.current = requestAnimationFrame(() => {
        pendingHydrateRef.current = null;
        hydrateFromLiveblocks(reason);
      });
    },
    [hydrateFromLiveblocks]
  );

  // 1. Session Type Sync
  useEffect(() => {
    // Initial sync
    const currentType = liveblocksService.getCurrentSession()?.type ?? 'workshop';
    setSessionType(currentType);

    // Listener
    const handleSessionTypeChange = (...args: unknown[]) => {
      const nextType = args[0] as SessionType | undefined;
      if (!nextType) return;
      console.log('🔄 [LiveblocksSync] Session type changed:', nextType);
      setSessionType(nextType);
    };

    liveblocksService.on('session-type-changed', handleSessionTypeChange);
    return () => {
      liveblocksService.off('session-type-changed', handleSessionTypeChange);
    };
  }, [setSessionType]);

  // 2. Report Content Sync
  useEffect(() => {
    // Initial check is handled by component usually, but listener is key here
    const unsubscribe = liveblocksService.onReportContent((content) => {
      setReportContent(content);
    });

    return () => {
      unsubscribe();
    };
  }, [setReportContent]);

  // 2.5. AI Insights Sync
  useEffect(() => {
    let unsubscribeInsights = () => { };

    const syncInsights = () => {
      if (!liveblocksService.isConnected()) {
        return;
      }

      const currentInsights = liveblocksService.getInsights();
      if (currentInsights.length > 0) {
        aiService.setInsights(currentInsights);
      }

      unsubscribeInsights();
      unsubscribeInsights = liveblocksService.onInsights((insights) => {
        aiService.setInsights(insights);
      });
    };

    syncInsights();
    liveblocksService.on('sync-complete', syncInsights);

    return () => {
      liveblocksService.off('sync-complete', syncInsights);
      unsubscribeInsights();
    };
  }, []);

  // 3. Layer Settings & Global Sync Control
  useEffect(() => {
    // Handler for layer settings updates
    const applyLayerSettings = (settings: LayerSettings, source: string) => {
      console.log(`🎨 [LiveblocksSync] Applying layer settings (${source})`, settings);
      
      if (settings.layerHeights) {
        // Prevent feedback loop by marking as non-user change ? 
        // Actually the original code just set state.
        // But we should probably check if values are different to avoid re-renders
        setLayerHeights(prev => {
           if (JSON.stringify(prev) !== JSON.stringify(settings.layerHeights)) {
             return settings.layerHeights!;
           }
           return prev;
        });
      }
      
      if (settings.layerOpacities) {
        setLayerOpacities(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(settings.layerOpacities)) {
            return settings.layerOpacities!;
          }
          return prev;
        });
      }
      
      if (typeof settings.showLayerBackground === 'boolean') {
        setShowLayerBackground(settings.showLayerBackground);
      }
    };

    const handleLayerSettingsChanged = (...args: unknown[]) => {
      const settings = args[0] as LayerSettings | undefined;
      if (settings) {
        applyLayerSettings(settings, 'layer-settings-changed');
      }
    };

    const handleSyncComplete = () => {
      // Cleanup cleanup duplicate nodes on sync complete
      const cleaned = liveblocksService.cleanupDuplicateNodes();
      if (cleaned > 0) {
        console.log(`🧹 [LiveblocksSync] sync-complete: ${cleaned} duplicate nodes cleaned`);
      }
      
      hydrateFromLiveblocks('sync-complete');
      
      const settings = liveblocksService.getLayerSettings();
      if (settings) {
        applyLayerSettings(settings, 'sync-complete');
      }
    };

    liveblocksService.on('layer-settings-changed', handleLayerSettingsChanged);
    liveblocksService.on('sync-complete', handleSyncComplete);

    // Initial check
    if (liveblocksService.isConnected()) {
      const settings = liveblocksService.getLayerSettings();
      if (settings) {
        applyLayerSettings(settings, 'initial');
      }
    }

    // Polling for initial connection (copied from original)
    let retryCount = 0;
    const maxRetries = 10;
    let intervalId: number | undefined;

    const tryInitialHydrate = (reason: string) => {
      if (!liveblocksService.isConnected()) {
        return false;
      }
      hydrateFromLiveblocks(reason);
      return true;
    };

    if (!tryInitialHydrate('initial')) {
      intervalId = window.setInterval(() => {
        retryCount += 1;
        if (tryInitialHydrate('polling') || retryCount >= maxRetries) {
          if (intervalId) {
            window.clearInterval(intervalId);
          }
        }
      }, 500);
    }

    return () => {
      liveblocksService.off('layer-settings-changed', handleLayerSettingsChanged);
      liveblocksService.off('sync-complete', handleSyncComplete);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [hydrateFromLiveblocks, setLayerHeights, setLayerOpacities, setShowLayerBackground]);

  // 4. Main Data Sync (Liveblocks Events -> React Flow)
  useEffect(() => {
    console.log('✅ [LiveblocksSync] Registering Liveblocks listeners');

    type StickyNoteUpdateEvent = {
        id: string; author?: string; content?: string; text?: string;
        x: number; y: number; layer: number; layerIndex?: number;
        sentiment: string; width?: number; height?: number;
    };
    type StickyNoteDeleteEvent = { noteId: string };
    type ConnectionUpdateEvent = {
        id: string; sourceId: string; targetId: string;
        relationType: 'direct' | 'indirect'; isPositive: boolean;
        sourceHandle?: string; targetHandle?: string;
    };
    type ConnectionDeleteEvent = { connectionId: string };

    const handleStickyNoteUpdated = (note: StickyNoteUpdateEvent) => {
        // ... (Logic copied from original)
        setNodes((currentNodes) => {
            const existingIndex = currentNodes.findIndex((n) => n.id === note.id);
            const existingNode = existingIndex >= 0 ? currentNodes[existingIndex] : undefined;
            const existingData = (existingNode?.data as Record<string, unknown>) ?? {};

            const typeMap: { [key: number]: string } = {
                1: 'result', 2: 'behavior', 3: 'tangible_lever', 4: 'intangible_lever',
            };
            const nodeType = typeMap[note.layer] || 'result';

            const activeLock = collaborationLocksRef.current[note.id];
            const currentUserId = getCurrentUserId();
            const isLockedByOther = Boolean(
                activeLock && activeLock.itemType === 'note' && activeLock.userId !== currentUserId
            );

            const previousContent = (existingData as { content?: string }).content ?? '';
            const previousSentiment = (existingData as { sentiment?: string }).sentiment ?? 'neutral';

            const updatedData: Record<string, unknown> = {
                ...existingData,
                content: note.content ?? previousContent,
                sentiment: note.sentiment ?? previousSentiment,
                onUpdate: handleNodeContentUpdate,
                onEditStart: handleStartNodeEditing,
                onEditEnd: handleStopNodeEditing,
                isLocked: isLockedByOther,
                lockedBy: activeLock?.displayName ?? activeLock?.userId,
            };

            const pinnedFromNote = (note as { pinned?: boolean } | undefined)?.pinned;
            const isPinned = pinnedFromNote === true
              || (existingData as { pinned?: boolean } | undefined)?.pinned === true;

            if (typeof pinnedFromNote === 'boolean') {
              updatedData.pinned = pinnedFromNote;
            }

            const hasValidX = Number.isFinite(note.x);
            const hasValidY = Number.isFinite(note.y);
            const nextX = hasValidX ? note.x : existingNode?.position.x ?? 0;
            const nextY = hasValidY ? note.y : existingNode?.position.y ?? 0;

            const updatedNode: Node = {
                id: note.id,
                type: nodeType,
                position: { x: nextX, y: nextY },
                data: updatedData,
                selected: existingNode?.selected ?? false,
              draggable: !isPinned && !isLockedByOther,
            };

            if (existingIndex >= 0) {
                const updatedNodes = currentNodes.map((n, idx) => (idx === existingIndex ? updatedNode : n));
                nodesRef.current = updatedNodes;
                return updatedNodes;
            }
            const updatedNodes = [...currentNodes, updatedNode];
            nodesRef.current = updatedNodes;
            return updatedNodes;
        });
    };

    const handleStickyNoteDeleted = (data: StickyNoteDeleteEvent) => {
        setNodes((currentNodes) => {
            const updatedNodes = currentNodes.filter((n) => n.id !== data.noteId);
            nodesRef.current = updatedNodes;
            return updatedNodes;
        });
        setEdges((currentEdges) => {
            const updatedEdges = currentEdges.filter((e) => e.source !== data.noteId && e.target !== data.noteId);
            edgesRef.current = updatedEdges;
            return updatedEdges;
        });
    };

    const handleConnectionUpdated = (connection: ConnectionUpdateEvent) => {
        setEdges((currentEdges) => {
            const existingIndex = currentEdges.findIndex((e) => e.id === connection.id);
            const relationType = connection.relationType === 'indirect' ? 'indirect' : 'direct';
            const edgeStyle = relationType === 'direct' ? { strokeWidth: 2 } : { strokeWidth: 2, strokeDasharray: '5 5' };
            const edgeColor = connection.isPositive ? '#10b981' : '#ef4444';

            const updatedEdge: Edge = {
                id: connection.id,
                source: connection.sourceId,
                target: connection.targetId,
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
                type: 'animatedFlow',
                style: { ...edgeStyle, stroke: edgeColor },
                markerEnd: { type: 'arrowclosed', width: 20, height: 20, color: edgeColor },
                data: { relationType, isPositive: connection.isPositive },
            };

            if (existingIndex >= 0) {
                const updatedEdges = currentEdges.map((e, idx) => (idx === existingIndex ? updatedEdge : e));
                edgesRef.current = updatedEdges;
                return updatedEdges;
            } else {
                const updatedEdges = [...currentEdges, updatedEdge];
                edgesRef.current = updatedEdges;
                return updatedEdges;
            }
        });
    };

    const handleConnectionDeleted = (data: ConnectionDeleteEvent) => {
        setEdges((currentEdges) => {
            const updatedEdges = currentEdges.filter((e) => e.id !== data.connectionId);
            edgesRef.current = updatedEdges;
            return updatedEdges;
        });
    };

    const handleNotesChanged = () => scheduleHydrate('notes-changed');
    const handleConnectionsChanged = () => scheduleHydrate('connections-changed');

    // Attach Listeners
    liveblocksService.on('sticky-note-updated', handleStickyNoteUpdated as any);
    liveblocksService.on('sticky-note-deleted', handleStickyNoteDeleted as any);
    liveblocksService.on('connection-updated', handleConnectionUpdated as any);
    liveblocksService.on('connection-deleted', handleConnectionDeleted as any);
    liveblocksService.on('notes-changed', handleNotesChanged);
    liveblocksService.on('connections-changed', handleConnectionsChanged);

    return () => {
      if (pendingHydrateRef.current !== null) {
        cancelAnimationFrame(pendingHydrateRef.current);
        pendingHydrateRef.current = null;
      }
      liveblocksService.off('sticky-note-updated', handleStickyNoteUpdated as any);
      liveblocksService.off('sticky-note-deleted', handleStickyNoteDeleted as any);
      liveblocksService.off('connection-updated', handleConnectionUpdated as any);
      liveblocksService.off('connection-deleted', handleConnectionDeleted as any);
      liveblocksService.off('notes-changed', handleNotesChanged);
      liveblocksService.off('connections-changed', handleConnectionsChanged);
    };
  }, [
    getCurrentUserId,
    handleNodeContentUpdate,
    handleStartNodeEditing,
    handleStopNodeEditing,
    scheduleHydrate,
    setNodes,
    setEdges,
    nodesRef,
    edgesRef,
    collaborationLocksRef
  ]);

  // 5. Presence/Locking Events
  useEffect(() => {
    type EditingEventPayload = {
      itemId: string;
      itemType: 'note' | 'connection';
      userId: string;
      displayName?: string;
    };

    const handleEditingStarted = (payload: unknown) => {
      const data = payload as EditingEventPayload | undefined;
      if (!data?.itemId) return;

      setCollaborationLocks(prev => {
        const prevLock = prev[data.itemId];
        if (prevLock && prevLock.userId === data.userId && prevLock.itemType === data.itemType) {
          return prev;
        }
        return {
          ...prev,
          [data.itemId]: {
            itemId: data.itemId,
            itemType: data.itemType,
            userId: data.userId,
            displayName: data.displayName,
          },
        };
      });
    };

    const handleEditingStopped = (payload: unknown) => {
      const data = payload as EditingEventPayload | undefined;
      if (!data?.itemId) return;

      setCollaborationLocks(prev => {
        const prevLock = prev[data.itemId];
        if (!prevLock || prevLock.userId !== data.userId) {
          return prev;
        }
        const updated = { ...prev };
        delete updated[data.itemId];
        return updated;
      });
    };

    liveblocksService.on('editing-started', handleEditingStarted as any);
    liveblocksService.on('editing-stopped', handleEditingStopped as any);

    return () => {
      liveblocksService.off('editing-started', handleEditingStarted as any);
      liveblocksService.off('editing-stopped', handleEditingStopped as any);
    };
  }, [setCollaborationLocks]);

  return { scheduleHydrate };
};
