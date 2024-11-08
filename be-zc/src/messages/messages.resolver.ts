import { Resolver, Query, Mutation, Args, Subscription, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Message } from './models/message.model';
import { MessagesService } from './messages.service';
import { GqlAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/models/user.model';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CreateMessageInput } from 'src/users/dto/create-message.input';
import { Conversation } from './models/conversation.model';
import { PubSubService } from 'src/pubsub/pubsub.service';

@Resolver(() => Message)
export class MessagesResolver {
  constructor(
    private messagesService: MessagesService,
    private pubSubService: PubSubService,
  ) {}

  @Query(() => [Conversation])
  @UseGuards(GqlAuthGuard)
  async conversations(@CurrentUser() user: User) {
    console.log(`Getting conversations for user ${user.id}`);
    return this.messagesService.getUserConversations(user.id);
  }

  @Query(() => Conversation)
  @UseGuards(GqlAuthGuard)
  async conversation(
    @CurrentUser() user: User,
    @Args('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.getConversation(user.id, otherUserId);
  }

  @Mutation(() => Message)
  @UseGuards(GqlAuthGuard)
  async sendMessage(
    @Args('input') createMessageInput: CreateMessageInput,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.create(user.id, createMessageInput);
  }

  @Mutation(() => Message)
  @UseGuards(GqlAuthGuard)
  async markAsRead(
    @Args('messageId') messageId: string,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.markMessageAsRead(messageId, user.id);
  }

  @Subscription(() => Message, {
    filter: (payload, variables, context) => {
        const user = context.req.user;
        if (!user) {
            console.log('No user in context');
            return false;
        }

        const userId = user.sub || user.id;
        const message = payload.newMessage;
        
        return message.senderId === userId || message.receiverId === userId;
    },
})
@UseGuards(GqlAuthGuard)
newMessage(@Context() context: any) {
    const user = context.req.user;
    if (!user) {
        throw new Error('No user in context');
    }
    
    const userId = user.sub || user.id;
    console.log('Setting up subscription for user:', userId);
    
    return this.pubSubService.asyncIterator(`newMessage.${userId}`);
}
}