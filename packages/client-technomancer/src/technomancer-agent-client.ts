import { Client, Content, IAgentRuntime, Memory, UUID, elizaLogger, getEmbeddingZeroVector, stringToUuid } from "@elizaos/core";
import { TechnomancerClient } from "./technomancer-client";
import { SupabaseProvider } from "./providers/supabase.provider";
import { validateTechnomancerConfig } from "./environment";

export class TechnomancerAgentClient implements Client {
    name = "technomancer";
    client: TechnomancerClient;
    config?: { [key: string]: any; };

    private agent: UUID; 
    private agents: Map<string, IAgentRuntime>;

    constructor(runtime: IAgentRuntime) {
        const config = validateTechnomancerConfig(runtime);
        this.agent = runtime.agentId;
        this.agents = new Map();
        this.agents.set(runtime.agentId, runtime);
        
        const privateKey = config.EVM_PRIVATE_KEY as `0x${string}`;
        const sb = new SupabaseProvider(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        this.client = new TechnomancerClient(sb,config.THIRDWEB_CLIENT_SECRET,config.TECHNO_ADDRESS,config.LOCATION_ADDRESS,this.createMemory);

        elizaLogger.info("Technomancer client initialized.");
    }

    async start() {
        await this.client.initialise();
        this.client.listen();
        
        return {
            stop: async () => {
                await this.client.stop();
            },
        };
    }

     createMemory = async (block: number, locationId: number, ownerId: number, whatHappened: string, technomancerId?: number, name?:string): Promise<string> => {
        const userId = technomancerId ? stringToUuid(technomancerId) : this.agent;
        const roomId = stringToUuid(locationId);

        await this.agents.get(this.agent).ensureConnection(
            userId,
            roomId,
            undefined,
            name,
            "chain"
        );

        const content: Content = {
            text: whatHappened,
            source: "chain",
            inReplyTo: undefined,
        };

        const userMessage = {
            content,
            userId,
            roomId,
            agentId: this.agent,
        };

        const id = technomancerId ? stringToUuid(block + "-" + technomancerId) : stringToUuid(block + "-" + locationId);

        const techOrLocMem: Memory = {
            id,
            ...userMessage,
            agentId: this.agent,
            userId,
            roomId,
            content,
            createdAt: Date.now(),
        };

        await this.agents.get(this.agent).messageManager.addEmbeddingToMemory(techOrLocMem);
        await this.agents.get(this.agent).messageManager.createMemory(techOrLocMem);

        let state = await this.agents.get(this.agent).composeState(userMessage, {
            agentName: this.agents.get(this.agent).character.name,
            block: block,
            technomancerId: technomancerId,
            locationId: locationId,
        });

        let message = null as Content | null;

        const trigger:Memory = {
            id: stringToUuid(block + "-" + technomancerId + "-" + this.agent),
                ...userMessage,
                userId: this.agent,
                content: {action: "TECHNOMANCER_CHRONICLER"},
                embedding: getEmbeddingZeroVector(),
                createdAt: Date.now(),
        } as Memory;

        await this.agents.get(this.agent).processActions(
            techOrLocMem,
            [trigger],
            state,
            async (newMessages) => {
                message = newMessages;
                return [techOrLocMem];
            }
        );

        if(message) {
            const rid = technomancerId ? 
                stringToUuid(block + "-" + technomancerId + "-" + this.agents.get(this.agent).character.name) : 
                stringToUuid(block + "-" + locationId + "-" + this.agents.get(this.agent).character.name);

            const responseMessage: Memory = {
                id: rid,
                ...userMessage,
                userId: this.agent,
                content: message,
                embedding: getEmbeddingZeroVector(),
                createdAt: Date.now(),
            };

            await this.agents.get(this.agent).messageManager.createMemory(responseMessage);
            state = await this.agents.get(this.agent).updateRecentMessageState(state);

            await this.agents.get(this.agent).evaluate(techOrLocMem, state, true);
        }        

        return message?.text;
    }

    static async start(runtime: IAgentRuntime) {
        const client = new TechnomancerAgentClient(runtime);
        return await client.start();
    }

}