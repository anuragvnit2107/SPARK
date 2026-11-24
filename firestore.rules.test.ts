import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesText = fs.readFileSync(rulesPath, 'utf8');

test('firestore.rules enforces global default-deny and prohibits open rules', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2'/);
  assert.match(rulesText, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
  assert.equal(/allow\s+(read|write|get|list|create|update|delete)[^;]*:\s*if\s+true\s*;/.test(rulesText), false);
});

test('boards/{boardId} rules enforce auth, owner/collaborator reads, owner delete, and strict schema validation', () => {
  assert.match(rulesText, /match \/boards\/\{boardId\}/);
  assert.match(rulesText, /allow get:\s*if isSignedIn\(\) && isValidId\(boardId\) && isBoardOwnerOrCollaborator\(\);/);
  assert.match(
    rulesText,
    /allow list:\s*if isSignedIn\(\) && \(existing\(\)\.ownerId == request\.auth\.uid \|\| request\.auth\.uid in existing\(\)\.collaborators\);/
  );
  assert.match(rulesText, /allow create:\s*if isVerifiedSignedIn\(\)[\s\S]*isValidBoard\(incoming\(\)\)[\s\S]*incoming\(\)\.ownerId == request\.auth\.uid/);
  assert.match(rulesText, /allow update:\s*if isVerifiedSignedIn\(\)[\s\S]*isValidBoard\(incoming\(\)\)[\s\S]*incoming\(\)\.ownerId == existing\(\)\.ownerId/);
  assert.match(rulesText, /allow delete:\s*if isVerifiedSignedIn\(\)[\s\S]*isBoardOwner\(\);/);
});

test('boards/{boardId}/presence/{userId} checks parent board membership and isolates writes per userId', () => {
  assert.match(rulesText, /match \/presence\/\{userId\}/);
  assert.match(rulesText, /function isParentBoardMember\(boardId\)/);
  assert.match(rulesText, /request\.auth\.uid == userId/);
  assert.match(rulesText, /isValidPresence\(incoming\(\), userId\)/);
});

test('Dirty Dozen invariants: IDs, sizes, timestamps, and array bounds are strictly guarded', () => {
  assert.match(rulesText, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rulesText, /data\.collaborators\.size\(\) <= 25/);
  assert.match(rulesText, /data\.elements\.size\(\) <= 1000/);
  assert.match(rulesText, /data\.keys\(\)\.hasOnly\(/);
});
