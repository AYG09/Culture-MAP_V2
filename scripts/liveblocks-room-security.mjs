#!/usr/bin/env node

import { Liveblocks } from '@liveblocks/node';

const ROOM_PREFIX = 'culturemap-v2-';
const CONFIG_ROOM_ID = 'culturemap-admin-config';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const json = args.has('--json');
const includeConfig = !args.has('--skip-config');

const secret = process.env.LIVEBLOCKS_SECRET_KEY;

if (!secret) {
  console.error('LIVEBLOCKS_SECRET_KEY is required. Set it in your shell environment before running this script.');
  process.exit(1);
}

const liveblocks = new Liveblocks({ secret });

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function roomMetadata(room) {
  return room.metadata && typeof room.metadata === 'object' ? room.metadata : {};
}

function isShellRoom(room) {
  const metadata = roomMetadata(room);
  const hasSessionMetadata = Boolean(metadata.code || metadata.name || metadata.type || metadata.createdAt || metadata.organization);
  return room.id.startsWith(ROOM_PREFIX) && !hasSessionMetadata;
}

function summarizeRoom(room) {
  const defaultAccesses = toArray(room.defaultAccesses);
  const groupsAccesses = room.groupsAccesses || {};
  const usersAccesses = room.usersAccesses || {};

  return {
    id: room.id,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    defaultAccesses,
    groupsAccessCount: Object.keys(groupsAccesses).length,
    usersAccessCount: Object.keys(usersAccesses).length,
    metadata: roomMetadata(room),
    needsPrivateAccessMigration: defaultAccesses.length > 0,
    looksLikeShellRoom: isShellRoom(room),
  };
}

async function collectRooms() {
  const rooms = [];

  for await (const room of liveblocks.iterRooms({ query: { roomId: { startsWith: ROOM_PREFIX } } }, { pageSize: 100 })) {
    rooms.push(room);
  }

  if (includeConfig) {
    try {
      rooms.push(await liveblocks.getRoom(CONFIG_ROOM_ID));
    } catch (error) {
      if (!String(error).includes('404')) {
        throw error;
      }
    }
  }

  return rooms;
}

async function main() {
  const rooms = await collectRooms();
  const summaries = rooms.map(summarizeRoom).sort((left, right) => left.id.localeCompare(right.id));
  const migrationTargets = summaries.filter((room) => room.needsPrivateAccessMigration);

  if (apply) {
    for (const room of migrationTargets) {
      await liveblocks.updateRoom(room.id, { defaultAccesses: [] });
    }
  }

  const result = {
    mode: apply ? 'apply' : 'dry-run',
    totalRooms: summaries.length,
    publicAccessRooms: migrationTargets.map((room) => room.id),
    shellLikeRooms: summaries.filter((room) => room.looksLikeShellRoom).map((room) => room.id),
    migratedRooms: apply ? migrationTargets.map((room) => room.id) : [],
    rooms: summaries,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Liveblocks room security ${result.mode}`);
  console.log(`Rooms scanned: ${result.totalRooms}`);
  console.log(`Rooms with default public access: ${result.publicAccessRooms.length}`);
  console.log(`Shell-like session rooms: ${result.shellLikeRooms.length}`);

  if (result.publicAccessRooms.length > 0) {
    console.log('\nRooms needing defaultAccesses=[]:');
    for (const roomId of result.publicAccessRooms) console.log(`- ${roomId}`);
  }

  if (result.shellLikeRooms.length > 0) {
    console.log('\nShell-like rooms to review before deleting:');
    for (const roomId of result.shellLikeRooms) console.log(`- ${roomId}`);
  }

  if (!apply && result.publicAccessRooms.length > 0) {
    console.log('\nRun with --apply to remove default public access from these rooms.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});