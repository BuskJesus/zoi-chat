import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      context: ({ req, connection }) => {
        if (connection) {
          return {
            req: {
              ...connection.context,
              user: connection.context?.user
            }
          };
        }
        return { req };
      },
      subscriptions: {
        'graphql-ws': {
            onConnect: (context: any) => {
                const { connectionParams } = context;
                
                if (!connectionParams?.Authorization) {
                    throw new Error('Missing auth token!');
                }

                return {
                    req: {
                        connectionParams
                    }
                };
            },
        },
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PubSubModule,
    MessagesModule,
  ],
})
export class AppModule {}
