import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageInput } from 'src/users/dto/create-message.input';
import { PubSubService } from 'src/pubsub/pubsub.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService, private pubSubService: PubSubService) {}

  async create(senderId: string, createMessageInput: CreateMessageInput) {
    // Verify receiver exists
    const receiver = await this.prisma.user.findUnique({
      where: { id: createMessageInput.receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: senderId } } },
          { participants: { some: { id: createMessageInput.receiverId } } },
        ],
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          participants: {
            connect: [
              { id: senderId },
              { id: createMessageInput.receiverId },
            ],
          },
        },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        content: createMessageInput.content,
        senderId,
        receiverId: createMessageInput.receiverId,
        conversationId: conversation.id,
      },
      include: {
        sender: true,
        receiver: true,
        conversation: true,
      },
    });

  await this.pubSubService.publish(`newMessage.${senderId}`, { newMessage: message });
  await this.pubSubService.publish(`newMessage.${createMessageInput.receiverId}`, { newMessage: message });

    return message;
  }

  async getConversation(userId: string, otherUserId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: userId } } },
          { participants: { some: { id: otherUserId } } },
        ],
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            sender: true,
            receiver: true,
          },
        },
        participants: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: userId },
        },
      },
      include: {
        participants: true,
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get only the last message
          include: {
            sender: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async markMessageAsRead(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.receiverId !== userId) {
      throw new ForbiddenException('Cannot mark this message as read');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.message.count({
      where: {
        receiverId: userId,
        read: false,
      },
    });
  }
}