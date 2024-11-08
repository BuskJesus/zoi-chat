import { Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

@Injectable()
export class PubSubService {
  private pubSub: PubSub;

  constructor() {
    this.pubSub = new PubSub();
  }

  publish(trigger: string, payload: any) {
    return this.pubSub.publish(trigger, payload);
  }

  asyncIterator<T>(triggers: string | string[]) {
    return this.pubSub.asyncIterator<T>(triggers);
  }
}