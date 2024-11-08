import { Field, ObjectType } from "@nestjs/graphql";
import { User } from "src/users/models/user.model";
import { Message } from "./message.model";

@ObjectType()
export class Conversation {
  @Field(() => String)
  id: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => [User])
  participants: User[];

  @Field(() => [Message])
  messages: Message[];
}