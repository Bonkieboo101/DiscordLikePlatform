import { createMessage } from '../src/services/message.service';

describe('message service', () => {
  it('createMessage should throw when channel or conversation missing', async () => {
    await expect(createMessage('nonexistent','hello',{} as any)).rejects.toThrow(/channelId or conversationId required/i);
  });
});