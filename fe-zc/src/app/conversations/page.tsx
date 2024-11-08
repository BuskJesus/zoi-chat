'use client';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, MessageSquare, Search, UserPlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import ConversationWindow from './components/ConversationWindow';
import { subscribeToNewMessages } from './subscriptions/websocketClient';

async function fetchConversations(accessToken: string | undefined) {
    if (!accessToken) {
      throw new Error('No access token available');
    }
  
    try {
        const response = await fetch('http://localhost:3001/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          mode: 'cors',
          credentials: 'include', // Changed from 'same-origin' to 'include'
          body: JSON.stringify({
            query: `
              query GetConversations {
                conversations {
                  id
                  participants {
                    id
                    username
                  }
                  messages {
                    id
                    content
                    senderId
                    createdAt
                    read
                    sender {
                      username
                    }
                  }
                }
              }
            `
          }),
        });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const json = await response.json();
      console.log('Response received:', json); // Debug log
  
      if (json.errors) {
        console.error('GraphQL Errors:', json.errors);
        throw new Error(json.errors[0].message);
      }
  
      return json.data;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }
  
  async function fetchConversation(accessToken: string | undefined, otherUserId: string) {
    if (!accessToken) {
      throw new Error('No access token available');
    }
  
    try {
      const response = await fetch('http://localhost:3001/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        mode: 'cors',
        credentials: 'same-origin',
        body: JSON.stringify({
          query: `
            query GetConversation($otherUserId: String!) {
              conversation(otherUserId: $otherUserId) {
                id
                participants {
                  id
                  username
                }
                messages {
                  id
                  content
                  senderId
                  createdAt
                  read
                  sender {
                    username
                  }
                }
              }
            }
          `,
          variables: {
            otherUserId
          }
        }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const json = await response.json();
      if (json.errors) {
        throw new Error(json.errors[0].message);
      }
  
      return json.data.conversation;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  async function sendMessage(accessToken: string, receiverId: string, content: string) {
    const response = await fetch('http://localhost:3001/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      mode: 'cors',
      credentials: 'same-origin',
      body: JSON.stringify({
        query: `
          mutation SendMessage($input: CreateMessageInput!) {
            sendMessage(input: $input) {
              id
              content
              senderId
              createdAt
            }
          }
        `,
        variables: {
          input: {
            content,
            receiverId
          }
        }
      }),
    });
  
    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  }

export default function ConversationsPage() {
    const { data: session, status } = useSession();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [conversationsList, setConversationsList] = useState<any>(null);
    const [selectedConversation, setSelectedConversation] = useState<any>(null);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    console.log(session);

    const handleConversationSelect = (conversationId: string) => {
        setSelectedConversationId(conversationId);
      };
    
      const handleNewMessage = useCallback((newMessage: any) => {
        // Update selected conversation if the message belongs to it
        if (selectedConversation && 
            selectedConversation.participants.some((p: any) => 
              [newMessage.senderId, newMessage.receiverId].includes(p.id))) {
          setSelectedConversation(prev => ({
            ...prev,
            messages: [newMessage, ...prev.messages]
          }));
        }
    
        // Update conversations list
        setConversationsList(prev => {
          if (!prev?.conversations) return prev;
    
          const updatedConversations = prev.conversations.map((conv: any) => {
            if (conv.participants.some((p: any) => 
                [newMessage.senderId, newMessage.receiverId].includes(p.id))) {
              return {
                ...conv,
                messages: [newMessage]
              };
            }
            return conv;
          });
    
          return { ...prev, conversations: updatedConversations };
        });
      }, [selectedConversation]);

    useEffect(() => {
        if (status === 'loading') return;
        
        if (!session) {
          redirect('/login');
          return;
        }
    
        fetchConversations(session.accessToken)
          .then(result => {
            setConversationsList(result);
            setLoading(false);
          })
          .catch(err => {
            setError(err.message);
            setLoading(false);
          });
      }, [session, status]);

      useEffect(() => {
        if (!session?.user?.id) return;
    
        console.log('Setting up websocket subscription...');
        const unsubscribe = subscribeToNewMessages(handleNewMessage);
    
        return () => {
          console.log('Cleaning up websocket subscription...');
          //unsubscribe();
        };
      }, [session?.user?.id, handleNewMessage]);

      useEffect(() => {
        if (!session || !selectedConversationId) return;
    
        const conversation = conversationsList?.conversations.find(
          (c: any) => c.id === selectedConversationId
        );
        if (!conversation) return;
    
        const otherParticipant = conversation.participants.find(
          (p: any) => p.id !== session.user?.id
        );
        if (!otherParticipant) return;
    
        setLoading(true);
        fetchConversation(session.accessToken, otherParticipant.id)
          .then(result => {
            setSelectedConversation(result);
            setLoading(false);
          })
          .catch(err => {
            setError(err.message);
            setLoading(false);
          });
      }, [selectedConversationId, session, conversationsList]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  const conversations = conversationsList?.conversations || [];
  const currentUserId = session?.user?.id;

  

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-1/3 border-r bg-white">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Messages</h1>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <UserPlus className="h-5 w-5 text-gray-600" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Conversation List */}
          <div className="space-y-2">
            {conversations
              .filter(conv => 
                conv.participants.some(p => 
                  p.username.toLowerCase().includes(searchQuery.toLowerCase())
                )
              )
              .map(conversation => {
                const otherParticipant = conversation.participants.find(
                  p => p.id !== currentUserId
                );
                const lastMessage = conversation.messages[0];
                const hasUnread = conversation.messages.some(
                  m => !m.read && m.senderId !== currentUserId
                );

                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation.id)}
                    className={`flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer ${
                      selectedConversationId === conversation.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-gray-500" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">
                          {otherParticipant?.username || 'Unknown User'}
                        </h3>
                        {lastMessage && (
                          <span className="text-sm text-gray-500">
                            {new Date(lastMessage.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {lastMessage && (
                        <p className="text-sm text-gray-500 truncate">
                          {lastMessage.sender.username}: {lastMessage.content}
                        </p>
                      )}
                    </div>
                    {hasUnread && (
                      <div className="h-2 w-2 rounded-full bg-blue-500 ml-2" />
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-screen">
        {selectedConversation ? (
          <ConversationWindow
            conversation={selectedConversation}
            currentUserId={currentUserId!}
            onSendMessage={async (content) => {
              const otherParticipant = selectedConversation.participants.find(
                (p: any) => p.id !== currentUserId
              );
              if (!otherParticipant) return;
              
              await sendMessage(session!.accessToken, otherParticipant.id, content);
              // Refresh the full conversation after sending
              const result = await fetchConversation(session!.accessToken, otherParticipant.id);
              setSelectedConversation(result);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a conversation or start a new one
          </div>
        )}
      </div>
    </div>
  );
}