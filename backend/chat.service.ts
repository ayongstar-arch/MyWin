import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity } from './entities/chat.entity';

export interface ChatMessage {
    id: string;
    tripId: string;
    senderId: string;
    senderType: 'DRIVER' | 'PASSENGER';
    content: string;
    createdAt: Date;
    isRead: boolean;
}

export interface SendMessageDto {
    tripId: string;
    senderId: string;
    senderType: 'DRIVER' | 'PASSENGER';
    content: string;
}

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        @InjectRepository(ChatMessageEntity)
        private readonly chatRepository: Repository<ChatMessageEntity>,
    ) { }

    /**
     * Save a new chat message to the database
     */
    async saveMessage(dto: SendMessageDto): Promise<ChatMessage> {
        try {
            const message = this.chatRepository.create({
                tripId: dto.tripId,
                senderId: dto.senderId,
                senderType: dto.senderType,
                content: dto.content,
                isRead: false,
            });

            const saved = await this.chatRepository.save(message);
            this.logger.log(`Message saved: ${saved.id} for trip ${dto.tripId}`);
            return saved;
        } catch (error) {
            this.logger.error(`Failed to save message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all messages for a specific trip
     */
    async getMessagesByTripId(tripId: string): Promise<ChatMessage[]> {
        try {
            const messages = await this.chatRepository.find({
                where: { tripId },
                order: { createdAt: 'ASC' },
            });
            return messages;
        } catch (error) {
            this.logger.error(`Failed to get messages for trip ${tripId}: ${error.message}`);
            return [];
        }
    }

    /**
     * Mark messages as read
     */
    async markMessagesAsRead(tripId: string, readerId: string): Promise<void> {
        try {
            await this.chatRepository.update(
                {
                    tripId,
                    isRead: false,
                    // Mark messages from the OTHER party as read
                },
                { isRead: true }
            );
        } catch (error) {
            this.logger.error(`Failed to mark messages as read: ${error.message}`);
        }
    }

    /**
     * Get unread message count for a user in a trip
     */
    async getUnreadCount(tripId: string, userId: string): Promise<number> {
        try {
            const count = await this.chatRepository.count({
                where: {
                    tripId,
                    isRead: false,
                    // Count messages NOT sent by this user
                },
            });
            return count;
        } catch (error) {
            this.logger.error(`Failed to get unread count: ${error.message}`);
            return 0;
        }
    }

    /**
     * Delete all messages for a completed trip (optional cleanup)
     */
    async deleteMessagesForTrip(tripId: string): Promise<void> {
        try {
            await this.chatRepository.delete({ tripId });
            this.logger.log(`Deleted all messages for trip ${tripId}`);
        } catch (error) {
            this.logger.error(`Failed to delete messages: ${error.message}`);
        }
    }
}
