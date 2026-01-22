import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('chat_messages')
export class ChatMessageEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ length: 100 })
    tripId: string;

    @Column({ length: 100 })
    senderId: string;

    @Column({ type: 'enum', enum: ['DRIVER', 'PASSENGER'] })
    senderType: 'DRIVER' | 'PASSENGER';

    @Column({ type: 'text' })
    content: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ default: false })
    isRead: boolean;
}
