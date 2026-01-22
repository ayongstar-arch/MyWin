import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { DriverService } from './driver.service';
import { PassengerService } from './passenger.service';
import { ChatService } from './chat.service';
import { RideRequestDto, TripActionDto } from './dtos';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private readonly driverService: DriverService,
    private readonly passengerService: PassengerService,
    private readonly chatService: ChatService,
  ) { }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // --- DRIVER EVENTS ---

  @SubscribeMessage('DRIVER_UPDATE_STATUS')
  async handleDriverStatus(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    if (data.status === 'IDLE' && data.location) {
      const res = await this.driverService.goOnline({
        driverId: data.id,
        lat: data.location.lat,
        lng: data.location.lng
      });
      this.server.emit('DRIVER_UPDATE_STATUS', data);
      client.emit('SYSTEM_MESSAGE', { text: res.message });
    } else if (data.status === 'OFFLINE') {
      this.server.emit('DRIVER_UPDATE_STATUS', data);
    }
  }

  @SubscribeMessage('TRIP_ACCEPT')
  async handleTripAccept(@MessageBody() data: TripActionDto) {
    try {
      await this.driverService.acceptTrip(data);
      this.server.emit('TRIP_ACCEPT', { driverId: data.driverId, tripId: data.tripId });
    } catch (e) {
      this.logger.error(e.message);
    }
  }

  @SubscribeMessage('DRIVER_REJECT_JOB')
  async handleTripReject(@MessageBody() data: { driverId: string; riderId: string }) {
    this.server.emit('DRIVER_REJECT_JOB', data);
  }

  @SubscribeMessage('TRIP_COMPLETE')
  async handleTripComplete(@MessageBody() data: { driverId: string; tripId?: string }) {
    this.server.emit('TRIP_COMPLETE', data);
  }

  // --- PASSENGER EVENTS ---

  @SubscribeMessage('RIDE_REQUEST')
  async handleRideRequest(@MessageBody() data: any) {
    const requestDto: RideRequestDto = {
      passengerId: data.riderId,
      pickupLat: data.location.lat,
      pickupLng: data.location.lng,
      pickupAddress: 'Unknown',
      destLat: 0,
      destLng: 0,
      destAddress: 'Random Destination'
    };

    try {
      await this.passengerService.requestRide(requestDto);
      this.server.emit('RIDE_REQUEST', data);
    } catch (e) {
      this.logger.error(e.message);
    }
  }

  @SubscribeMessage('RIDE_CANCEL')
  async handleRideCancel(@MessageBody() data: { riderId: string }) {
    this.server.emit('RIDE_CANCEL', data);
  }

  // --- CHAT EVENTS ---

  @SubscribeMessage('CHAT_JOIN_ROOM')
  handleChatJoinRoom(@MessageBody() data: { tripId: string }, @ConnectedSocket() client: Socket) {
    const roomName = `trip:${data.tripId}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined chat room: ${roomName}`);
  }

  @SubscribeMessage('CHAT_LEAVE_ROOM')
  handleChatLeaveRoom(@MessageBody() data: { tripId: string }, @ConnectedSocket() client: Socket) {
    const roomName = `trip:${data.tripId}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left chat room: ${roomName}`);
  }

  @SubscribeMessage('CHAT_SEND')
  async handleChatSend(
    @MessageBody() data: { tripId: string; senderId: string; senderType: 'DRIVER' | 'PASSENGER'; content: string },
    @ConnectedSocket() client: Socket
  ) {
    try {
      const savedMessage = await this.chatService.saveMessage({
        tripId: data.tripId,
        senderId: data.senderId,
        senderType: data.senderType,
        content: data.content,
      });
      const roomName = `trip:${data.tripId}`;
      this.server.to(roomName).emit('CHAT_RECEIVE', savedMessage);
      this.logger.log(`Chat message sent in trip ${data.tripId}`);
    } catch (e) {
      this.logger.error(`Chat send error: ${e.message}`);
      client.emit('CHAT_ERROR', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('CHAT_GET_HISTORY')
  async handleChatGetHistory(@MessageBody() data: { tripId: string }, @ConnectedSocket() client: Socket) {
    try {
      const messages = await this.chatService.getMessagesByTripId(data.tripId);
      client.emit('CHAT_HISTORY', { tripId: data.tripId, messages });
    } catch (e) {
      this.logger.error(`Chat history error: ${e.message}`);
    }
  }

  @SubscribeMessage('CHAT_TYPING')
  handleChatTyping(@MessageBody() data: { tripId: string; senderId: string }, @ConnectedSocket() client: Socket) {
    const roomName = `trip:${data.tripId}`;
    client.to(roomName).emit('CHAT_TYPING', data);
  }

  @SubscribeMessage('CHAT_MARK_READ')
  async handleChatMarkRead(@MessageBody() data: { tripId: string; readerId: string }) {
    try {
      await this.chatService.markMessagesAsRead(data.tripId, data.readerId);
      const roomName = `trip:${data.tripId}`;
      this.server.to(roomName).emit('CHAT_READ_RECEIPT', { tripId: data.tripId, readerId: data.readerId });
    } catch (e) {
      this.logger.error(`Mark read error: ${e.message}`);
    }
  }

  // --- SOS EVENTS ---

  @SubscribeMessage('SOS_TRIGGER')
  async handleSOSTrigger(
    @MessageBody() data: { userId: string; userType: 'DRIVER' | 'PASSENGER'; tripId?: string; location: { lat: number; lng: number } },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.warn(`🆘 SOS TRIGGERED by ${data.userType} ${data.userId} at ${data.location.lat}, ${data.location.lng}`);

    // Broadcast to admin dashboard
    this.server.emit('ADMIN_SOS_ALERT', {
      id: `SOS-${Date.now()}`,
      ...data,
      timestamp: new Date().toISOString(),
      status: 'ACTIVE'
    });

    // Acknowledge to sender
    client.emit('SOS_ACKNOWLEDGED', { message: 'SOS received. Help is on the way.' });
  }

  // --- ADMIN / SYNC EVENTS ---

  @SubscribeMessage('SYNC_CLIENT_STATE')
  handleSyncState(@MessageBody() data: any) {
    this.server.emit('SYNC_CLIENT_STATE', data);
  }
}
