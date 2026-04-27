/**
 * Liveblocks 관리 API 클라이언트
 * Vercel Serverless Function을 통해 Liveblocks REST API 호출
 */

export interface LiveblocksRoom {
    id: string;
    type: string;
    lastConnectionAt: string;
    createdAt: string;
    defaultAccesses: string[];
    metadata?: Record<string, string>;
}

export interface ListRoomsResponse {
    data: LiveblocksRoom[];
    nextCursor?: string;
}

export interface DeleteRoomResult {
    roomId: string;
    success: boolean;
    error?: string;
}

class LiveblocksAdminService {
    private baseUrl = '/api/liveblocks-admin';

    /**
     * 모든 룸 목록 조회
     */
    async listRooms(): Promise<LiveblocksRoom[]> {
        try {
            const response = await fetch(`${this.baseUrl}?action=list`, { credentials: 'include' });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to list rooms: ${response.status} ${errorText}`);
            }
            const data: ListRoomsResponse = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('❌ 룸 목록 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 단일 룸 삭제
     */
    async deleteRoom(roomId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}?action=delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ roomId }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete room ${roomId}: ${response.status} ${errorText}`);
            }
            const data = await response.json();
            return data.success === true;
        } catch (error) {
            console.error(`❌ 룸 삭제 실패: ${roomId}`, error);
            return false;
        }
    }

    /**
     * 여러 룸 일괄 삭제
     */
    async deleteRooms(roomIds: string[]): Promise<DeleteRoomResult[]> {
        try {
            const response = await fetch(`${this.baseUrl}?action=delete-bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ roomIds }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Bulk delete failed: ${response.status} ${errorText}`);
            }
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error('❌ 일괄 삭제 실패:', error);
            return roomIds.map((roomId) => ({ roomId, success: false }));
        }
    }

    /**
     * Culture-MAP 관련 룸만 필터링 (v2, 구버전 포함, admin-config 제외)
     */
    filterCultureMapRooms(rooms: LiveblocksRoom[]): LiveblocksRoom[] {
        return rooms.filter((room) =>
            room.id.startsWith('culturemap') &&
            room.id !== 'culturemap-admin-config'
        );
    }

    /**
     * 오래된 룸 필터링 (기본: 7일 이상)
     */
    filterOldRooms(rooms: LiveblocksRoom[], daysOld: number = 7): LiveblocksRoom[] {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        return rooms.filter((room) => {
            const lastConnection = new Date(room.lastConnectionAt);
            return lastConnection < cutoffDate;
        });
    }
}

export const liveblocksAdminService = new LiveblocksAdminService();
export default liveblocksAdminService;
