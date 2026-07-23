import { Module } from '@nestjs/common';
import { ChatPresenceService } from './chat-presence.service';

@Module({
  providers: [ChatPresenceService],
  exports: [ChatPresenceService],
})
export class ChatPresenceModule {}
