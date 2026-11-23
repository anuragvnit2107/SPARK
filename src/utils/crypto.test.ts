import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoomShareUrl,
  decryptJson,
  encryptJson,
  generateEncryptionKey,
  generateRoomId,
  importEncryptionKey,
  parseRoomHash,
} from '../crypto';

test('AES-256-GCM encryption and decryption roundtrip with exported URL key', async () => {
  const roomId = generateRoomId();
  const { keyString } = await generateEncryptionKey();
  const importedKey = await importEncryptionKey(keyString);

  const secretPayload = {
    elements: [{ id: 'res_1', type: 'circuit', componentValue: '4.7kΩ' }],
  };

  const envelope = await encryptJson(secretPayload, importedKey);
  assert.ok(envelope.iv.length > 8);
  assert.ok(envelope.ciphertext.length > 10);
  assert.ok(!envelope.ciphertext.includes('4.7k'));

  const decrypted = await decryptJson<typeof secretPayload>(envelope, importedKey);
  assert.deepEqual(decrypted, secretPayload);

  const shareUrl = buildRoomShareUrl('https://rustly.example', roomId, keyString);
  const parsed = parseRoomHash(new URL(shareUrl).hash);
  assert.ok(parsed);
  assert.equal(parsed.roomId, roomId);
  assert.equal(parsed.keyString, keyString);
});
