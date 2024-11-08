import { createClient } from 'graphql-ws';
import { getSession } from 'next-auth/react';

let wsClient: any = null;

const createWsClient = async () => {
    const session = await getSession();
    
    return createClient({
        url: 'ws://localhost:3001/graphql',
        connectionParams: {
            Authorization: session?.accessToken ? `Bearer ${session.accessToken}` : '',
        },
        retryAttempts: 5,
        shouldRetry: () => true,
        onNonLazyError: console.error,
    });
};

export const getWsClient = async () => {
    if (!wsClient) {
        wsClient = await createWsClient();
    }
    return wsClient;
};

export const subscribeToNewMessages = async (onMessage: (message: any) => void) => {
    const client = await getWsClient();
    
    const unsubscribe = client.subscribe(
        {
            query: `
                subscription OnNewMessage {
                    newMessage {
                        id
                        content
                        senderId
                        receiverId
                        createdAt
                        read
                        sender {
                            username
                        }
                    }
                }
            `,
        },
        {
            next: (data: any) => {
                if (data.data?.newMessage) {
                    onMessage(data.data.newMessage);
                }
            },
            error: (error: any) => {
                console.error('WebSocket error:', error);
            },
            complete: () => {
                console.log('WebSocket subscription completed');
            },
        }
    );

    return unsubscribe;
};